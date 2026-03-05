import "dotenv/config";
import { pool, isDatabaseEnabled } from "../data/db.js";
import { FIXTURES, seedDatabase } from "./seed-lib.js";

const run = async (): Promise<void> => {
  if (!isDatabaseEnabled || !pool) {
    throw new Error("DATABASE_URL is required for db seed mode");
  }

  const client = await pool.connect();

  try {
    await client.query("begin");

    await seedDatabase(client);

    await client.query("commit");

    process.stdout.write(
      `Seed complete. Admin=${FIXTURES.adminEmail}, Cadet=${FIXTURES.cadetEmail}, Cruise=Space Case Cruise\n`,
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
