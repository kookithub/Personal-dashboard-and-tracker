// Builds (and with "deploy", publishes) the public demo: NEXT_PUBLIC_DEMO=1 makes the site open
// straight into sample data, and wrangler.demo.jsonc has no database.
//   npm run build:demo      npm run deploy:demo
// The demo bar's "Get the code" link goes to NEXT_PUBLIC_REPO_URL (this repo unless set; "" hides it).
import { spawnSync } from "node:child_process";

const env = {
  ...process.env, NEXT_PUBLIC_DEMO: "1",
  NEXT_PUBLIC_REPO_URL: process.env.NEXT_PUBLIC_REPO_URL ?? "https://github.com/kookithub/Personal-dashboard-and-tracker",
};
const cli = "node_modules/@opennextjs/cloudflare/dist/cli/index.js";
const run = (args) => {
  const r = spawnSync(process.execPath, [cli, ...args], { stdio: "inherit", env });
  if (r.status !== 0) process.exit(r.status || 1);
};
run(["build", "-c", "wrangler.demo.jsonc"]);
if (process.argv[2] === "deploy") run(["deploy", "-c", "wrangler.demo.jsonc"]);
