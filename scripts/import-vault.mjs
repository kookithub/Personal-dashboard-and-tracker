// Builds seed.sql from an Obsidian vault (optional): every note in the folders below, plus the
// Dashboard.md settings if there is one. Uses INSERT OR IGNORE, so running it again never
// overwrites a note that was already changed on the website.
//   npm run import -- "C:/path/to/your/vault"     (default: the folder this project sits in)
// No vault? Nothing to do: the dashboard starts empty and you add notes in the app.
import { existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const VAULT = resolve(process.argv[2] || process.env.VAULT_DIR || fileURLToPath(new URL("../../", import.meta.url)));
const SEED = new URL("../seed.sql", import.meta.url);
const FOLDERS = ["Academic", "Projects", "Life", "Daily", "Templates"];

const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";
const rows = [];

function walk(dir) {
  let entries = [];
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) walk(full);
    else if (e.name.endsWith(".md")) {
      const path = relative(VAULT, full).split(sep).join("/");
      const content = readFileSync(full, "utf8").replace(/\r\n/g, "\n");
      rows.push(`INSERT OR IGNORE INTO files (path, content, mtime) VALUES (${q(path)}, ${q(content)}, ${Math.round(statSync(full).mtimeMs)});`);
    }
  }
}
FOLDERS.forEach((f) => walk(join(VAULT, f)));

const notes = rows.length;
if (!notes) {
  if (existsSync(SEED)) rmSync(SEED);
  console.log(`No notes found in ${VAULT} (folders: ${FOLDERS.join(", ")}). Starting empty is fine.`);
  process.exit(0);
}

// Dashboard.md properties -> the "dashboard" setting.
const dash = existsSync(join(VAULT, "Dashboard.md")) ? readFileSync(join(VAULT, "Dashboard.md"), "utf8").replace(/\r\n/g, "\n") : "";
const fmText = /^---\n([\s\S]*?)\n---/.exec(dash)?.[1] ?? "";
const fm = {};
let key = null;
for (const line of fmText.split("\n")) {
  const item = /^\s+-\s*(.*)$/.exec(line);
  if (item && key) { (Array.isArray(fm[key]) ? fm[key] : (fm[key] = [])).push(item[1].trim().replace(/^(["'])(.*)\1$/, "$2")); continue; }
  const kv = /^([\w-]+):\s*(.*)$/.exec(line);
  if (kv) { key = kv[1]; fm[key] = kv[2].trim() === "" ? null : kv[2].trim().replace(/^(["'])(.*)\1$/, "$2"); }
}
delete fm.cssclasses;
fm.palette = "terracotta"; // the web version's default colors; change any time in settings
fm.title = "Home";
if (fm.wallpaper === null) fm.wallpaper = "";
rows.push(`INSERT OR IGNORE INTO settings (key, value) VALUES ('dashboard', ${q(JSON.stringify(fm))});`);

writeFileSync(SEED, rows.join("\n") + "\n");
console.log(`seed.sql: ${notes} notes + dashboard settings`);
