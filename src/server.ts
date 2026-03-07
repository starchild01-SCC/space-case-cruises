import "./config/validateEnv.js";
import { app } from "./app.js";
import { env } from "./config/env.js";

const host = process.env.HOST?.trim() || "0.0.0.0";
// Optional: LAN hint in logs only (e.g. NAS). Not used for paths; safe to leave unset on Render.
const lanHint = process.env.HOST_IP?.trim()
  ? ` (LAN: http://${process.env.HOST_IP}:${env.port})`
  : "";

app.listen(env.port, host, () => {
  process.stdout.write(
    `Space Case Cruises API listening on http://${host}:${env.port}${lanHint}\n`,
  );
});
