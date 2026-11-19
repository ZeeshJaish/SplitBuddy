import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { createApi, RequestError } from "./api.mjs";

const { Pool } = pg;
const pool = new Pool({ database: process.env.PGDATABASE || "splitbuddy", max: 6 });
const port = Number(process.env.PORT || 4100);

const database = {
  query: options => pool.query(options),
  async read(run) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      const data = await run(client);
      await client.query("COMMIT");
      return data;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
};
const catalog = await readFile(new URL("./dbms/04_queries.sql", import.meta.url), "utf8");
const handleRequest = createApi(catalog, database);

const assets = new Map(await Promise.all([
  ["/", "index.html", "text/html; charset=utf-8"],
  ["/app.js", "app.js", "text/javascript; charset=utf-8"],
  ["/app.css", "app.css", "text/css; charset=utf-8"],
  ["/ui.woff2", "ui.woff2", "font/woff2"],
].map(async ([path, file, type]) => [path, {
  type,
  body: await readFile(new URL("./public/" + file, import.meta.url)),
}])));

async function jsonBody(request) {
  if (request.headers["content-type"]?.split(";")[0] !== "application/json") {
    throw new RequestError(415, "Send the form as JSON.");
  }
  let raw = "";
  request.setEncoding("utf8");
  for await (const chunk of request) {
    raw += chunk;
    if (Buffer.byteLength(raw) > 32768) throw new RequestError(413, "This form is too large.");
  }
  try {
    const values = JSON.parse(raw);
    if (!values || typeof values !== "object" || Array.isArray(values)) throw new Error();
    return values;
  } catch {
    throw new RequestError(400, "Enter valid form values.");
  }
}

function sendJSON(response, status, data) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(data));
}

async function serve(request, response) {
  const url = new URL(request.url, "http://127.0.0.1");
  const asset = assets.get(url.pathname);
  if (request.method === "GET" && asset) {
    response.writeHead(200, { "Content-Type": asset.type, "X-Content-Type-Options": "nosniff" });
    response.end(asset.body);
    return;
  }
  const { status, data } = await handleRequest(request.method, url, () => jsonBody(request));
  sendJSON(response, status, data);
}

if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Set PORT to a number from 1 to 65535.");
const connection = await pool.connect();
connection.release();

const server = createServer((request, response) => {
  serve(request, response).catch(error => {
    if (response.headersSent) return response.end();
    if (error instanceof RequestError) return sendJSON(response, error.status, { error: error.message });
    console.error("SplitBuddy request failed", error.code || error.name);
    return sendJSON(response, 500, { error: "Check the local PostgreSQL connection and try again." });
  });
});
server.listen(port, "127.0.0.1", () => console.log("SplitBuddy is ready at http://127.0.0.1:" + port));
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => server.close(() => pool.end()));
}
