const el = id => document.getElementById(id);
const account = el("account");
const expenseForm = el("expense-form");
const participants = el("participant-rows");
const older = el("load-more");
const request = globalThis.splitBuddyDemoRequest ?? fetch;
const state = { people: [], groups: [], user: "", group: null, cursor: null, version: 0 };

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function status(message, error = false) {
  const notice = el("status");
  notice.textContent = message;
  notice.classList.toggle("error", error);
}

async function api(path, { user, payload, search } = {}) {
  const params = new URLSearchParams(search);
  if (user) params.set("user", user);
  const query = params.size ? "?" + params.toString() : "";
  const response = await request(path + query, payload ? {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
  } : undefined);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Try the request again.");
  return data;
}

const rupees = new Intl.NumberFormat("en-IN");
const eventDate = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" });

function money(value) {
  const amount = BigInt(value);
  const absolute = amount < 0n ? -amount : amount;
  return (amount < 0n ? "−" : "") + "₹" + rupees.format(absolute / 100n) + "." +
    (absolute % 100n).toString().padStart(2, "0");
}

function toPaise(value, zeroAllowed = false) {
  const match = /^(\d{1,12})(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) throw new Error("Enter an amount with up to two decimal places.");
  const cents = BigInt(match[1]) * 100n + BigInt((match[2] || "").padEnd(2, "0"));
  if (!zeroAllowed && cents === 0n) throw new Error("Enter an amount greater than ₹0.");
  return cents.toString();
}

function setOptions(select, people) {
  select.replaceChildren(...people.map(person => new Option(person.display_name, person.user_id)));
}

function renderGroups() {
  const nav = el("groups");
  const buttons = state.groups.map(group => {
    const button = element("button", group.group_name);
    button.type = "button";
    button.setAttribute("aria-pressed", String(state.group?.group_id === group.group_id));
    button.onclick = () => openGroup(group).catch(error => status(error.message, true));
    return button;
  });
  nav.replaceChildren(...buttons);
  if (!buttons.length) nav.append(element("p", "Create a group to get started.", "muted"));
}

function renderParticipants(members) {
  participants.replaceChildren(...members.map(member => {
    const row = element("div", undefined, "participant");
    const label = element("label");
    const check = document.createElement("input");
    check.type = "checkbox";
    check.name = "participant";
    check.value = member.user_id;
    check.checked = true;
    label.append(check, document.createTextNode(member.display_name));
    const share = document.createElement("input");
    share.inputMode = "decimal";
    share.placeholder = "0.00";
    share.setAttribute("aria-label", member.display_name + " share in rupees");
    share.dataset.shareFor = member.user_id;
    check.onchange = toggleShares;
    row.append(label, share);
    return row;
  }));
  toggleShares();
}

function toggleShares() {
  const custom = expenseForm.elements.method.value === "custom";
  for (const row of participants.children) {
    const checked = row.querySelector('input[type="checkbox"]').checked;
    const share = row.querySelector("[data-share-for]");
    share.hidden = !custom || !checked;
    share.required = custom && checked;
  }
}

function renderPeople(view) {
  el("group-members").textContent = view.members.map(member => member.display_name).join(", ");
  renderParticipants(view.members);
  const recipients = view.members.filter(member => member.user_id !== state.user);
  setOptions(el("recipients"), recipients);
  el("repayment-form").querySelector("button").disabled = !recipients.length;
  const memberIds = new Set(view.members.map(member => member.user_id));
  const nonmembers = state.people.filter(person => !memberIds.has(person.user_id));
  el("member-panel").hidden = state.group.created_by !== state.user || !nonmembers.length;
  setOptions(el("nonmembers"), nonmembers);
}

function renderBalances(rows) {
  el("balances").replaceChildren(...rows.map(row => {
    const item = element("li");
    const amount = BigInt(row.balance_paise);
    const kind = amount > 0n ? "positive" : amount < 0n ? "negative" : "even";
    item.append(
      element("span", row.display_name),
      element("strong", money(amount), "balance-amount " + kind),
      element("small", amount > 0n ? "Receives" : amount < 0n ? "Owes" : "Settled"),
    );
    return item;
  }));
}

function eventRow(entry, group, user) {
  const row = element("li", undefined, "event");
  const head = element("div", undefined, "event-head");
  head.append(element("strong", entry.label), element("span", money(entry.amount_paise), "event-amount"));
  const description = entry.kind === "expense" ? entry.actor + " paid" : entry.actor + " paid " + entry.recipient;
  row.append(head, element("p", description + " · " + eventDate.format(new Date(entry.occurred_at)), "muted"));
  if (entry.kind === "expense") {
    const button = element("button", "View shares", "share-button");
    button.type = "button";
    const list = element("ul", undefined, "share-list");
    list.hidden = true;
    button.setAttribute("aria-expanded", "false");
    button.onclick = async () => {
      if (!list.hidden) {
        list.hidden = true;
        button.textContent = "View shares";
        button.setAttribute("aria-expanded", "false");
        return;
      }
      button.disabled = true;
      try {
        const shares = await api("/api/groups/" + group + "/expenses/" + entry.event_id, { user });
        list.replaceChildren(...shares.map(share => element("li", share.display_name + " · " + money(share.share_paise))));
        list.hidden = false;
        button.textContent = "Hide shares";
        button.setAttribute("aria-expanded", "true");
      } catch (error) {
        status(error.message, true);
      } finally {
        button.disabled = false;
      }
    };
    row.append(button, list);
  }
  return row;
}

function renderHistory(entries, append = false) {
  const list = el("history");
  const rows = entries.map(entry => eventRow(entry, state.group.group_id, state.user));
  if (append) list.append(...rows);
  else list.replaceChildren(...rows);
  if (!append && !entries.length) list.append(element("li", "Expenses and repayments will appear here.", "muted"));
  const last = entries.at(-1);
  state.cursor = entries.length === 50 ? { before: last.cursor_time, kind: last.kind, event: last.event_id } : null;
  older.hidden = !state.cursor;
}

async function openGroup(group) {
  const version = ++state.version;
  state.group = group;
  renderGroups();
  el("group").hidden = true;
  el("empty").hidden = true;
  if (!group) {
    el("empty").textContent = "Create a group to record expenses and repayments.";
    el("empty").hidden = false;
    return;
  }
  const view = await api("/api/groups/" + group.group_id, { user: state.user });
  if (state.version !== version) return;
  el("group-title").textContent = group.group_name;
  renderPeople(view);
  renderBalances(view.balances);
  renderHistory(view.history);
  el("group").hidden = false;
}

async function loadGroups(preferred) {
  const version = ++state.version;
  const user = account.value;
  if (state.user !== user) {
    state.group = null;
    el("group").hidden = true;
  }
  state.user = user;
  const groups = await api("/api/groups", { user });
  if (state.version !== version) return;
  state.groups = groups;
  await openGroup(groups.find(group => group.group_id === preferred) || groups[0] || null);
}

function bindForm(form, body, save, message, closeDetails = false) {
  form.onsubmit = async event => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    if (button.disabled) return;
    button.disabled = true;
    const group = state.group;
    const user = state.user;
    const version = state.version;
    try {
      const result = await save(body(new FormData(form)), group, user);
      if (state.version !== version) return;
      form.reset();
      if (closeDetails) form.closest("details").open = false;
      await loadGroups(result?.group_id || group?.group_id);
      status(message);
    } catch (error) {
      status(error.message, true);
    } finally {
      if (form.id === "repayment-form") button.disabled = !el("recipients").options.length;
      else button.disabled = false;
    }
  };
}

const groupAction = action => (payload, group, user) =>
  api("/api/groups/" + group.group_id + "/" + action, { user, payload });

bindForm(el("new-group"), data => ({ name: data.get("name") }),
  (payload, group, user) => api("/api/groups", { user, payload }), "Group created.");
bindForm(el("member-form"), data => ({ person: data.get("person") }),
  groupAction("members"), "Member added.", true);
bindForm(el("repayment-form"), data => ({ to: data.get("to"), amount: toPaise(data.get("amount")) }),
  groupAction("settlements"), "Repayment saved.", true);
bindForm(expenseForm, data => {
  const method = data.get("method");
  const checked = data.getAll("participant");
  if (!checked.length) throw new Error("Choose at least one member for the split.");
  const values = {
    method,
    description: data.get("description"),
    amount: toPaise(data.get("amount")),
    participants: checked,
  };
  if (method === "custom") {
    values.shares = checked.map(user => {
      const input = participants.querySelector('[data-share-for="' + user + '"]');
      return toPaise(input.value, true);
    });
  }
  return values;
}, groupAction("expenses"), "Expense saved.", true);

expenseForm.elements.method.onchange = toggleShares;
older.onclick = async () => {
  const version = state.version;
  older.disabled = true;
  try {
    const view = await api("/api/groups/" + state.group.group_id, { user: state.user, search: state.cursor });
    if (state.version === version) renderHistory(view.history, true);
  } catch (error) {
    status(error.message, true);
  } finally {
    older.disabled = false;
  }
};
account.onchange = () => {
  status("");
  loadGroups().catch(error => status(error.message, true));
};
el("new-group").querySelector("button").disabled = true;
api("/api/users").then(people => {
  state.people = people;
  setOptions(account, people);
  account.disabled = !people.length;
  el("new-group").querySelector("button").disabled = !people.length;
  if (people.length) return loadGroups();
  el("empty").textContent = "Load dbms/demo.sql to create demo accounts.";
}).catch(error => status(error.message, true));
