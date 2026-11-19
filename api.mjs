export class RequestError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function loadQueries(sql) {
  const entries = sql.split(/(?=^-- (?:READ|WRITE) [RW]\d+ — )/m).slice(1);
  return new Map(entries.map(entry => {
    const match = entry.match(/^-- (?:READ|WRITE) ([RW]\d+) — [^\n]+\n(?:-- [^\n]*\n)*PREPARE (splitbuddy_[a-z_]+)(?: \(([^)]+)\))? AS\n([\s\S]+);\s*$/);
    if (!match) throw new Error("Invalid query declaration in dbms/04_queries.sql");
    const [, id, name, signature, sqlBody] = match;
    const types = signature ? signature.split(", ") : [];
    const text = sqlBody.replace(/\$(\d+)/g, (argument, position) => {
      const type = types[Number(position) - 1];
      if (!["bigint", "bigint[]", "text", "timestamptz"].includes(type)) {
        throw new Error("Invalid parameter type in " + id);
      }
      return argument + "::" + type;
    });
    return [id, { name, text }];
  }));
}

function id(value, label) {
  const text = typeof value === "number" && Number.isSafeInteger(value) ? String(value) : value;
  if (typeof text !== "string" || !/^[1-9]\d{0,18}$/.test(text) || BigInt(text) > 9223372036854775807n) {
    throw new RequestError(400, "Choose a valid " + label + ".");
  }
  return text;
}

function paise(value, allowZero = false) {
  if (allowZero && (value === "0" || value === 0)) return "0";
  return id(value, "amount");
}

function label(value, blankMessage, maxLength) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed || trimmed.length > maxLength) throw new RequestError(400, blankMessage);
  return trimmed;
}

function saved(rows, message) {
  if (!rows.length) throw new RequestError(400, message);
  return rows;
}

function cursor(params) {
  const time = params.get("before");
  const kind = params.get("kind");
  const event = params.get("event");
  if (!time && !kind && !event) return [null, null, null];
  if (!time || !Number.isFinite(Date.parse(time)) || !["expense", "settlement"].includes(kind)) {
    throw new RequestError(400, "Open the latest history to restart paging.");
  }
  return [time, kind, id(event, "history event")];
}

export function createApi(catalog, database) {
  const queries = loadQueries(catalog);
  const result = (status, data) => ({ status, data });

  function query(client, key, values = []) {
    const { name, text } = queries.get(key);
    return client.query({ name, text, values }).then(result => result.rows);
  }

  async function groupView(group, user, historyCursor) {
    return database.read(async client => {
      const members = await query(client, "R3", [group, user]);
      if (!members.length) throw new RequestError(404, "This group is available to its members.");
      const balances = await query(client, "R4", [group, user]);
      const history = await query(client, "R5", [group, user, ...historyCursor]);
      return { members, balances, history };
    });
  }

  function createExpense(group, user, values) {
    const description = label(values.description, "Enter an expense description up to 160 characters.", 160);
    if (!Array.isArray(values.participants) || !values.participants.length) {
      throw new RequestError(400, "Choose at least one member for the split.");
    }
    const participants = values.participants.map(value => id(value, "member"));
    const parameters = [group, user, description, paise(values.amount), participants];
    if (values.method === "equal") return query(database, "W3", parameters);
    if (values.method === "custom" && Array.isArray(values.shares)) {
      return query(database, "W4", [...parameters, values.shares.map(value => paise(value, true))]);
    }
    throw new RequestError(400, "Choose an equal or custom split.");
  }

  return async function handleRequest(method, url, readBody) {
    if (method === "GET" && url.pathname === "/api/users") {
      return result(200, await query(database, "R1"));
    }
    if (url.pathname === "/api/groups") {
      const user = id(url.searchParams.get("user"), "demo account");
      if (method === "GET") return result(200, await query(database, "R2", [user]));
      if (method === "POST") {
        const values = await readBody();
        const name = label(values.name, "Enter a group name up to 80 characters.", 80);
        const rows = saved(await query(database, "W1", [user, name]), "Choose an existing demo account.");
        return result(201, rows[0]);
      }
    }
    const groupRoute = url.pathname.match(/^\/api\/groups\/([1-9]\d*)(?:\/(members|expenses|settlements)(?:\/([1-9]\d*))?)?$/);
    if (groupRoute) {
      const [, groupText, action, expense] = groupRoute;
      const group = id(groupText, "group");
      const user = id(url.searchParams.get("user"), "demo account");
      if (method === "GET" && !action) {
        return result(200, await groupView(group, user, cursor(url.searchParams)));
      }
      if (method === "GET" && action === "expenses" && expense) {
        const rows = await query(database, "R6", [group, user, id(expense, "expense")]);
        if (!rows.length) throw new RequestError(404, "This expense is available to its group members.");
        return result(200, rows);
      }
      if (method === "POST" && action && !expense) {
        const values = await readBody();
        if (action === "members") {
          const rows = await query(database, "W2", [group, user, id(values.person, "member")]);
          return result(201, saved(rows, "Choose someone the group creator can add."));
        }
        if (action === "expenses") {
          const rows = await createExpense(group, user, values);
          return result(201, saved(rows, "Choose group members and make the shares add up to the total."));
        }
        const rows = await query(database, "W5", [group, user, id(values.to, "recipient"), paise(values.amount)]);
        return result(201, saved(rows, "Choose a different member in this group."));
      }
    }
    throw new RequestError(404, "This page or group was not found.");
  };
}
