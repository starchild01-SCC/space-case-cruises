import { setDefaultResultOrder } from "node:dns";
import { Pool } from "pg";
import { env } from "../config/env.js";

// Force IPv4 for DNS resolution (avoids ENETUNREACH on Render when IPv6 is unreachable)
setDefaultResultOrder("ipv4first");

export const isDatabaseEnabled = env.databaseUrl !== null;

export const pool = env.databaseUrl
  ? new Pool({
      connectionString: env.databaseUrl,
      ssl: env.databaseUrl.includes("localhost") ? false : { rejectUnauthorized: false },
    })
  : null;
