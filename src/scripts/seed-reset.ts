import "dotenv/config";
import { isDatabaseEnabled, pool } from "../data/db.js";
import { seedDatabase, FIXTURES } from "./seed-lib.js";

const assertResetAllowed = (): void => {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to run seed reset in production");
  }

  if (process.env.ALLOW_DB_RESET !== "true") {
    throw new Error("Set ALLOW_DB_RESET=true to run seed reset");
  }
};

const run = async (): Promise<void> => {
  if (!isDatabaseEnabled || !pool) {
    throw new Error("DATABASE_URL is required for db reset mode");
  }

  assertResetAllowed();

  const client = await pool.connect();

  try {
    await client.query("begin");

    await client.query(
      `truncate table
        cadet_badges,
        badges,
        commitments,
        cruise_subgroups,
        subgroups,
        cruises,
        users
      restart identity cascade`,
    );

    await seedDatabase(client);
    await client.query("commit");

    process.stdout.write(
      `Reset + seed complete. Admin=${FIXTURES.adminEmail}, Cadet=${FIXTURES.cadetEmail}\n`,
    );
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
};

run()
  .catch((error) => {
    process.stderr.write(`${(error as Error).message}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool?.end();
  });
