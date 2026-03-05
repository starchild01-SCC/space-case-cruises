import "./config/validateEnv.js";
import { app } from "./app.js";
import { env } from "./config/env.js";

const host = process.env.HOST?.trim() || "0.0.0.0";

app.listen(env.port, host, () => {
  process.stdout.write(
    `Space Case Cruises API listening on http://${host}:${env.port} (LAN: http://192.168.1.225:${env.port})\n`,
  );
});
