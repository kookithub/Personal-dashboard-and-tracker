// One-time setup on Cloudflare. Run after `npx wrangler login`:
//   npm run setup
// Creates the database, copies your Obsidian notes into it (if this folder sits in your vault),
// publishes the site and asks you for the password. Safe to run again: existing notes are never
// overwritten. No vault? The dashboard simply starts empty.
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const CONFIG = new URL("../wrangler.jsonc", import.meta.url);
const wrangler = (args, opts = {}) =>
  spawnSync(process.execPath, ["node_modules/wrangler/bin/wrangler.js", ...args], { encoding: "utf8", ...opts });
const step = (s) => console.log("\n== " + s);
function run(args, opts) {
  const r = wrangler(args, { stdio: "inherit", ...opts });
  if (r.status !== 0) { console.error("\nStopped: `wrangler " + args.join(" ") + "` failed."); process.exit(1); }
}

step("checking you are logged in to Cloudflare");
const who = wrangler(["whoami"]);
if (!/You are logged in|associated with the email/i.test(who.stdout + who.stderr)) {
  console.error("Not logged in. Run:  npx wrangler login   then run this again.");
  process.exit(1);
}

let config = readFileSync(CONFIG, "utf8");
if (config.includes('"00000000-0000-0000-0000-000000000000"')) {
  step("creating the database");
  const r = wrangler(["d1", "create", "home-dashboard"]);
  const out = r.stdout + r.stderr;
  let id = /"database_id":\s*"([0-9a-f-]{36})"/.exec(out)?.[1] || /database_id\s*=\s*"([0-9a-f-]{36})"/.exec(out)?.[1];
  if (!id) {
    // Already exists (e.g. an earlier run stopped halfway): look it up.
    const list = wrangler(["d1", "list", "--json"]);
    try { id = JSON.parse(list.stdout).find((d) => d.name === "home-dashboard")?.uuid; } catch {}
  }
  if (!id) { console.error(out); console.error("Could not create the database."); process.exit(1); }
  config = config.replace("00000000-0000-0000-0000-000000000000", id);
  writeFileSync(CONFIG, config);
  console.log("database id saved in wrangler.jsonc");
}

step("creating tables");
run(["d1", "execute", "home-dashboard", "--remote", "--file", "schema.sql", "--yes"]);

step("copying your notes in (if this folder sits in an Obsidian vault)");
spawnSync(process.execPath, ["scripts/import-vault.mjs"], { stdio: "inherit" });
if (existsSync("seed.sql")) run(["d1", "execute", "home-dashboard", "--remote", "--file", "seed.sql", "--yes"]);

step("building and publishing the site (Next.js via OpenNext)");
const ON = "node_modules/@opennextjs/cloudflare/dist/cli/index.js";
for (const cmd of ["build", "deploy"]) {
  const r = spawnSync(process.execPath, [ON, cmd], { stdio: "inherit" });
  if (r.status !== 0) { console.error(`\nStopped: opennextjs-cloudflare ${cmd} failed.`); process.exit(1); }
}

step("setting the login key (random, you never need to know it)");
run(["secret", "put", "SESSION_SECRET"], { input: randomBytes(32).toString("hex"), stdio: ["pipe", "inherit", "inherit"] });

step("choose your password");
console.log("Type the password you'll use on your phone, then press Enter. (Use a long one: it protects all your notes.)");
run(["secret", "put", "APP_PASSWORD"]);

console.log("\nDone. Open the https://home-dashboard.<your-subdomain>.workers.dev link printed above on your iPhone.");
