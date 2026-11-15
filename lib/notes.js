// Notes are Markdown files. This reads their properties (front matter) and tasks
// ("- [ ] Name [due:: 2026-11-20]", indented subtasks), and makes line edits.
import moment from "moment";

export const M = moment;
export const TPL = "Templates";
export const fileName = (path) => path.split("/").pop().replace(/\.md$/, "");
export const dayKey = (m) => m.format("YYYY-MM-DD");
export const clean = (t) => t.text.replace(/\[due::[^\]]*\]/gi, "").replace(/\s+/g, " ").trim();
export const isStudy = (t) => /exam/i.test(t.section || "");
export const pct = (done, total) => (total ? done / total : 0);
export const dueField = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v || "") ? ` [due:: ${v}]` : "");
export const safeName = (v) => String(v).replace(/[\\/:*?"<>|#^\[\]]/g, "").trim();
export const noteHref = (path) => "/note/" + path.split("/").map(encodeURIComponent).join("/");

// A project / course / ongoing note is "not active" when its status says so
// (status: done, paused, archived…). It then shows in its own section instead of
// with the active ones; nothing is hidden.
export const STATUSES = ["active", "paused", "done", "archived"];
const INACTIVE = /^(done|complete|completed|finished|paused|on[ -]?hold|archived?|dropped|cancell?ed|abandoned|inactive|someday|stopped|ended|past)$/;
export const statusOf = (p) => String(p?.status ?? "").trim().toLowerCase() || "active";
export const isActive = (p) => !INACTIVE.test(statusOf(p));

const unquote = (s) => String(s).trim().replace(/^(["'])(.*)\1$/, "$2");

export function parseFrontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*(\r?\n|$)/.exec(text);
  if (!m) return { fm: {}, lines: 0 };
  const fm = {};
  let key = null;
  for (const line of m[1].split(/\r?\n/)) {
    const item = /^\s+-\s*(.*)$/.exec(line);
    if (item && key) {
      if (!Array.isArray(fm[key])) fm[key] = [];
      fm[key].push(unquote(item[1]));
      continue;
    }
    const kv = /^([\w-]+):\s*(.*)$/.exec(line);
    if (kv) {
      key = kv[1];
      fm[key] = kv[2].trim() === "" ? null : unquote(kv[2]);
    }
  }
  return { fm, lines: m[0].split("\n").length - (m[2] ? 1 : 0) };
}

const indentWidth = (s) => [...s].reduce((n, c) => n + (c === "\t" ? 4 : 1), 0);

export function parseTasks(path, text) {
  const lines = text.split("\n");
  const { lines: skip } = parseFrontmatter(text);
  const items = [];
  let fence = false;
  let section = "";
  let stack = [];
  for (let i = skip; i < lines.length; i++) {
    const line = lines[i].replace(/\r$/, "");
    if (/^\s*(```|~~~)/.test(line)) { fence = !fence; stack = []; continue; }
    if (fence) continue;
    const h = /^#{1,6}\s+(.*)$/.exec(line);
    if (h) { section = h[1].trim(); stack = []; continue; }
    const li = /^([ \t]*)(?:[-*+]|\d+[.)])(?:\s+(.*))?$/.exec(line);
    if (!li) {
      if (line.trim() && !/^\s/.test(line)) stack = [];
      continue;
    }
    const indent = indentWidth(li[1]);
    const rest = li[2] ?? "";
    const tm = /^\[(.)\](?:\s+(.*))?$/.exec(rest);
    const text_ = tm ? tm[2] ?? "" : rest;
    const dueM = /[[(]due::\s*([^\])]*)[\])]/i.exec(text_);
    const due = dueM && M(dueM[1].trim(), "YYYY-MM-DD", true).isValid() ? M(dueM[1].trim(), "YYYY-MM-DD") : null;
    const item = {
      path, line: i, text: text_, task: !!tm, completed: !!tm && /[xX]/.test(tm[1]),
      children: [], parent: null, section, due,
    };
    while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
    const top = stack[stack.length - 1];
    if (top) { item.parent = top.item.line; top.item.children.push(item); }
    stack.push({ indent, item });
    items.push(item);
  }
  return items.filter((x) => x.task);
}

export function buildPages(files) {
  const pages = [];
  for (const [path, f] of files) {
    if (!path.endsWith(".md") || path.startsWith(".trash/")) continue;
    const { fm } = parseFrontmatter(f.content);
    pages.push({
      ...fm,
      file: { path, name: fileName(path), folder: path.split("/").slice(0, -1).join("/"), mtime: f.mtime, tasks: parseTasks(path, f.content) },
    });
  }
  return pages;
}

/* ---------- trash ---------- */

// Trashed notes: ".trash/<time>/<original path>" (new) or ".trash/<YYYY-MM-DD> <path with / as ' - '>" (older).
export function trashInfo(path) {
  const rest = path.slice(".trash/".length);
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-\d+Z\/(.+)$/.exec(rest);
  if (m) return { at: M.utc(`${m[1]} ${m[2]}:${m[3]}:${m[4]}`, "YYYY-MM-DD HH:mm:ss").local(), orig: m[5], old: false };
  const o = /^(\d{4}-\d{2}-\d{2}) (.+)$/.exec(rest);
  if (o) return { at: M(o[1], "YYYY-MM-DD"), orig: o[2], old: true };
  return { at: null, orig: rest, old: true };
}
// Where a trashed note goes back to. Older entries lost their folders; they are
// guessed from the folders that exist now ("Projects - Foo.md" → "Projects/Foo.md").
export function trashOrigin(path, files) {
  const { orig, old } = trashInfo(path);
  if (!old) return orig;
  const parts = orig.split(" - ");
  for (let i = parts.length - 1; i > 0; i--) {
    const folder = parts.slice(0, i).join("/");
    if ([...files.keys()].some((p) => p.startsWith(folder + "/") && !p.startsWith(".trash/"))) return folder + "/" + parts.slice(i).join(" - ");
  }
  return orig;
}

export function resolveLink(files, target) {
  const t = String(target || "").trim().replace(/\.md$/, "");
  if (!t) return null;
  if (files.has(t + ".md")) return t + ".md";
  const low = t.split("/").pop().toLowerCase();
  const hits = [...files.keys()].filter((p) => !p.startsWith(".trash/") && fileName(p).toLowerCase() === low);
  return hits.sort((a, b) => a.length - b.length)[0] || null;
}

// Folders are found by name anywhere, so they still work after being moved.
export function folderPath(files, name) {
  const folders = new Set();
  for (const p of files.keys()) {
    const parts = p.split("/");
    for (let i = 1; i < parts.length; i++) folders.add(parts.slice(0, i).join("/"));
  }
  const hits = [...folders].filter((f) => f.split("/").pop() === name).sort((a, b) => a.length - b.length);
  return hits[0] ?? name;
}

export function fillTemplate(text, title, date) {
  return text
    .replace(/\{\{title\}\}/g, title)
    .replace(/\{\{date:([^}]+)\}\}/g, (_, f) => date.format(f))
    .replace(/\{\{date\}\}/g, date.format("YYYY-MM-DD"))
    .replace(/\{\{time\}\}/g, date.format("HH:mm"));
}

/* ---------- line edits: each takes a note's text and returns the new text ---------- */

// A task (with its steps) as it is cut out of a note, so it can be kept in the bin and put back:
// its lines, the heading it was under, and the line of its parent task if it was a step.
export function taskBlock(data, t) {
  const lines = data.split("\n");
  let heading = "";
  for (let i = t.line - 1; i >= 0; i--) if (/^#{1,6}\s/.test(lines[i])) { heading = lines[i].trim(); break; }
  return {
    lines: lines.slice(t.line, lastLine(t) + 1).map((l) => l.replace(/\r$/, "")),
    heading,
    parentLine: t.parent != null ? lines[t.parent].replace(/\r$/, "") : null,
  };
}

export const lastLine = (t) => Math.max(t.line, ...(t.children || []).map(lastLine));
const onLine = (data, i, fn) => {
  const lines = data.split("\n");
  lines[i] = fn(lines[i]);
  return lines.join("\n");
};
export const edit = {
  done: (t, done) => (data) => onLine(data, t.line, (l) => (done ? l.replace("[ ]", "[x]") : l.replace(/\[[xX]\]/, "[ ]"))),
  rename: (t, name) => (data) =>
    onLine(data, t.line, (l) => l.replace(/^(\s*[-*+] \[.\] ).*?((?:\s*\[due::[^\]]*\])?)$/, (_, pre, due) => pre + name + due)),
  due: (t, v) => (data) => onLine(data, t.line, (l) => l.replace(/\s*\[due::[^\]]*\]/i, "") + dueField(v)),
  remove: (t) => (data) => {
    const lines = data.split("\n");
    lines.splice(t.line, lastLine(t) - t.line + 1);
    return lines.join("\n");
  },
  addStep: (t, name, date) => (data) => {
    const lines = data.split("\n");
    const indent = lines[t.line].match(/^\s*/)[0];
    lines.splice(lastLine(t) + 1, 0, `${indent}\t- [ ] ${name}${dueField(date)}`);
    return lines.join("\n");
  },
  // Set a property in the note's front matter (adds the front matter if missing).
  setProp: (key, value) => (data) => {
    const line = `${key}: ${value}`;
    const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(data);
    if (!m) return `---\n${line}\n---\n` + data;
    const lines = m[1].split(/\r?\n/);
    const i = lines.findIndex((l) => new RegExp(`^${key}:`).test(l));
    if (i < 0) lines.push(line);
    else {
      let end = i + 1;
      while (end < lines.length && /^\s+-/.test(lines[end])) end++; // an old list value
      lines.splice(i, end - i, line);
    }
    const start = m.index + m[0].indexOf(m[1]);
    return data.slice(0, start) + lines.join("\n") + data.slice(start + m[1].length);
  },
  // Puts a task from the bin back: after its parent task's steps if that task is still there,
  // else at the end of its old heading's section, else at the end of the note.
  restoreTask: (path, item) => (data) => {
    const r0 = item.lines[0].match(/^\s*/)[0];
    const rebase = (indent) => item.lines.map((l) => (l.startsWith(r0) ? indent + l.slice(r0.length) : l)).join("\n");
    if (item.parentLine) {
      const parent = parseTasks(path, data).find((x) => data.split("\n")[x.line].replace(/\r$/, "") === item.parentLine);
      if (parent) {
        const lines = data.split("\n");
        lines.splice(lastLine(parent) + 1, 0, rebase(lines[parent.line].match(/^\s*/)[0] + "\t"));
        return lines.join("\n");
      }
    }
    if (item.heading && data.split("\n").some((l) => l.trim().toLowerCase() === item.heading.toLowerCase())) {
      return edit.appendUnder(item.heading, rebase(""))(data);
    }
    return data.replace(/\s*$/, "") + "\n" + rebase("") + "\n";
  },
  // Insert a line at the end of a "## Heading" section (creates the section if missing).
  appendUnder: (heading, text) => (data) => {
    const lines = data.split("\n");
    const i = lines.findIndex((l) => l.trim().toLowerCase() === heading.toLowerCase());
    if (i < 0) return data.replace(/\s*$/, "") + `\n\n${heading}\n${text}\n`;
    let end = i + 1;
    while (end < lines.length && !/^#{1,2} /.test(lines[end])) end++;
    let at = end;
    while (at > i + 1 && lines[at - 1].trim() === "") at--;
    lines.splice(at, 0, text);
    return lines.join("\n");
  },
};
