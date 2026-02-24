import { app } from "./app.js";
import { env } from "./config/env.js";

app.listen(env.port, () => {
  process.stdout.write(`Space Case Cruises API listening on http://localhost:${env.port}\n`);
});
