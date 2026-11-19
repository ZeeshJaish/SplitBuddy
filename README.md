# SplitBuddy

[Open the live SplitBuddy demo](https://zeeshjaish.github.io/SplitBuddy/)

The GitHub Pages demo runs the same PostgreSQL schema and queries in the browser. Pick a demo account, open **Weekend trip**, and try an expense or repayment. Your changes are saved in this browser.

SplitBuddy is a project we're building to make sharing expenses with friends simple. It will help people record shared transactions, split costs, keep track of who owes whom, and settle balances clearly.

Whether it's a group trip, dinner, rent, or everyday spending, SplitBuddy aims to keep everyone's share easy to understand.

## Planned Features

- Create groups for friends, roommates, and trips.
- Add shared expenses and record who paid.
- Split costs equally or by custom amounts.
- View each person's share and outstanding balance.
- Record repayments and track settlements.
- Review transaction history in one place.

## Project Status

The local demo uses PostgreSQL to create groups, split expenses, show balances and record repayments. Choose one of the demo accounts to see the groups that person belongs to.

## Run the app

Install Node.js 20+ and PostgreSQL 15+. Start PostgreSQL and open a terminal from this repository. On Windows the commands below can run in Git Bash. Use the same PostgreSQL connection settings for psql and the app.

```bash
npm ci
createdb splitbuddy
psql -X -v ON_ERROR_STOP=1 -d splitbuddy -f dbms/03_schema.sql -f dbms/demo.sql
PGDATABASE=splitbuddy npm start
```

Open [SplitBuddy](http://127.0.0.1:4100). The Weekend trip group shows a ₹900 expense split three ways and a ₹300 repayment. Switch the demo account, open an expense's shares, or create a separate group to try the forms.

## Build the GitHub Pages demo

Run `npm ci` and `npm run build:pages` with Node.js 20.19+ or 22.12+. The static output is in `dist-pages/`. The repository publishes that output from the root of `gh-pages`.

## DBMS submission

- [Normalization](dbms/01_normalization.md) and [ER diagram](dbms/02_er_diagram.png)
- [Schema](dbms/03_schema.sql) and [the app's 11 parameterized queries](dbms/04_queries.sql)
- [Three-run timings](dbms/05_query_timings.md) and [raw PostgreSQL plans](dbms/plans/)

Use a separate database for the checks and benchmark. The write checks and plans roll back their sample changes.

```bash
createdb splitbuddy_bench
psql -X -v ON_ERROR_STOP=1 -d splitbuddy_bench -f dbms/03_schema.sql
psql -X -v ON_ERROR_STOP=1 -d splitbuddy_bench -f dbms/checks/application.sql
psql -X -v ON_ERROR_STOP=1 -d splitbuddy_bench -f dbms/checks/expense_splits.sql
psql -X -v ON_ERROR_STOP=1 -d splitbuddy_bench -f dbms/checks/expense_benchmark_seed.sql
bash dbms/benchmark.sh splitbuddy_bench
```

## Team Members

- Mradul
- Himank
- Sujay
- Zishan
