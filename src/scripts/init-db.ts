import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isDatabaseEnabled, pool } from "../data/db.js";

const run = async (): Promise<void> => {
  if (!isDatabaseEnabled || !pool) {
    throw new Error("DATABASE_URL is required for db init mode");
  }

  const migrationPath = resolve(process.cwd(), "migrations", "001_initial_space_case_schema.sql");
  const sql = readFileSync(migrationPath, "utf8");

  await pool.query(sql);
  process.stdout.write(`Schema initialized from ${migrationPath}\n`);
};

run()
  .catch((error) => {
    process.stderr.write(`${(error as Error).message}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool?.end();
  });
