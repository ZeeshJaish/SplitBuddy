import { PGlite } from "@electric-sql/pglite";
import { worker } from "@electric-sql/pglite/worker";
import schema from "../dbms/03_schema.sql?raw";
import catalog from "../dbms/04_queries.sql?raw";
import demoData from "../dbms/demo_data.sql?raw";

await worker({
  async init() {
    const db = await PGlite.create("idb://t0120-splitbuddy-v1");
    try {
      const { rows: [state] } = await db.query("SELECT to_regclass('splitbuddy.users') IS NOT NULL AS initialized");
      if (!state.initialized) await db.exec(schema);
      const { rows: [fixture] } = await db.query("SELECT EXISTS (SELECT 1 FROM splitbuddy.users) AS seeded");
      if (!fixture.seeded) {
        await db.transaction(async tx => {
          await tx.exec(catalog);
          await tx.exec(demoData);
        });
      }
      return db;
    } catch (error) {
      await db.close();
      throw error;
    }
  },
});
