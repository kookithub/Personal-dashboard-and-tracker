// Checks a deployed site without logging in: pages load, the API is locked,
// and the local test password from .dev.vars is refused.   node scripts/check-live.mjs <url>
import { readFileSync } from "node:fs";

const base = process.argv[2];
const testPw = /APP_PASSWORD=(.*)/.exec(readFileSync(new URL("../.dev.vars", import.meta.url), "utf8"))[1].trim();
let ok = false;
for (let i = 0; i < 20 && !ok; i++) {
  try { ok = (await fetch(base + "/")).ok; } catch {}
  if (!ok) await new Promise((r) => setTimeout(r, 3000));
}
const status = async (p, opts) => { try { return (await fetch(base + p, opts)).status; } catch (e) { return e.message; } };
console.log("home page:", await status("/"));
console.log("note page:", await status("/note/Life/Money%20Map.md"));
console.log("icon:", await status("/apple-touch-icon.png"));
console.log("api without login:", await status("/api/files"));
const r = await fetch(base + "/api/login", { method: "POST", headers: { "content-type": "application/json", origin: base }, body: JSON.stringify({ password: testPw }) });
console.log("local test password on live site:", r.status, (await r.json()).error || "ACCEPTED (bad)");
