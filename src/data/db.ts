import { Pool } from "pg";
import { env } from "../config/env.js";

export const isDatabaseEnabled = env.databaseUrl !== null;

export const pool = env.databaseUrl
  ? new Pool({
      connectionString: env.databaseUrl,
      ssl: env.databaseUrl.includes("localhost") ? false : { rejectUnauthorized: false },
    })
  : null;
