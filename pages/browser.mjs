import { PGliteWorker } from "@electric-sql/pglite/worker";
import { createApi, RequestError } from "../api.mjs";
import catalog from "../dbms/04_queries.sql?raw";

const statusLine = document.getElementById("status");
statusLine.textContent = "Starting the demo database…";

try {
  const worker = new Worker(new URL("./database-worker.mjs", import.meta.url), { type: "module" });
  const db = await PGliteWorker.create(worker, { id: "t0120-splitbuddy-v1" });
  const adapter = client => ({ query: ({ text, values }) => client.query(text, values) });
  const handleRequest = createApi(catalog, {
    ...adapter(db),
    read: run => db.transaction(tx => run(adapter(tx))),
  });

  globalThis.splitBuddyDemoRequest = async (path, options) => {
    try {
      const url = new URL(path, location.origin);
      const { status, data } = await handleRequest(options?.method ?? "GET", url, () => JSON.parse(options.body));
      return Response.json(data, { status });
    } catch (error) {
      if (error instanceof RequestError) return Response.json({ error: error.message }, { status: error.status });
      console.error("SplitBuddy request failed", error);
      return Response.json({ error: "The demo could not save or load this request. Try again." }, { status: 500 });
    }
  };

  statusLine.textContent = "";
  await import("../public/app.js");
} catch (error) {
  console.error("SplitBuddy could not start", error);
  statusLine.classList.add("error");
  statusLine.textContent = "The demo database could not start. Allow site storage and reload.";
}
