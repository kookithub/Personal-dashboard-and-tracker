// Quick check of a running server: pages load, the API needs a login, and the
// password from .dev.vars works.   node scripts/smoke-test.mjs http://127.0.0.1:8788
import { readFileSync } from "node:fs";

const base = process.argv[2] || "http://127.0.0.1:3000";
const pw = /APP_PASSWORD=(.*)/.exec(readFileSync(new URL("../.dev.vars", import.meta.url), "utf8"))[1].trim();

for (let i = 0; i < 60; i++) {
  try { if ((await fetch(base + "/")).ok) break; } catch {}
  await new Promise((r) => setTimeout(r, 1000));
}
const status = async (p, opts) => (await fetch(base + p, opts)).status;
console.log("home page:", await status("/"));
console.log("note page:", await status("/note/Life/Money%20Map.md"));
console.log("api without login:", await status("/api/files"));
const login = await fetch(base + "/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: pw }) });
const cookie = (login.headers.get("set-cookie") || "").split(";")[0];
console.log("login:", login.status);
const files = await fetch(base + "/api/files", { headers: { cookie } });
const data = await files.json();
console.log("api after login:", files.status, "-", data.files?.length, "notes, palette:", data.settings?.dashboard?.palette);
