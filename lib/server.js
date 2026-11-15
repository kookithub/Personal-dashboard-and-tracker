// Server side of the dashboard API (runs on Cloudflare via the Next.js route handler
// in app/api/[...route]/route.js). Every /api route except login needs the
// session cookie, which is only handed out for the right password.

const COOKIE = "sid";
const SESSION_DAYS = 90;
const MAX_FAILS = 8; // per IP per 15 minutes
const MAX_BLOB = 1_500_000; // base64 chars (D1 rows max out around 2 MB)
const PICTURE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/avif"];
// Videos (Zeus' own slideshow) are too big for one row: they are stored in 1 MB parts
// (1.4 MB as base64) in video_parts, and their row in blobs only holds { size, parts }.
const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const MAX_VIDEO = 30 * 1024 * 1024;
const VIDEO_PART = 1024 * 1024;

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...headers },
  });

const enc = new TextEncoder();
async function hmac(secret, text) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(text));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function sameString(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/* ---------- sessions: every signed-in device is a row, so each can be seen and logged out ----------
   The cookie is "<id>.<signature>". The signature (HMAC with SESSION_SECRET) turns away made-up cookies
   without a database read; the row in `sessions` says the device is still signed in. Logging a device
   out deletes its row. Cookies from before this (no id) are no longer accepted, so every device that
   is signed in is in the list. */
const SEEN_EVERY = 10 * 60_000; // last-used time is written at most every 10 minutes
const BAD_KEEP_DAYS = 30; // wrong-password attempts are listed this long

const sessionTables = (env) => env.DB.batch([
  env.DB.prepare("CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, created INTEGER NOT NULL, seen INTEGER NOT NULL, expires INTEGER NOT NULL, agent TEXT, ip TEXT, place TEXT)"),
  env.DB.prepare("CREATE TABLE IF NOT EXISTS login_log (at INTEGER NOT NULL, ip TEXT, place TEXT, agent TEXT)"),
]);
const placeOf = (cf, req) => [cf.city, cf.region, cf.country || req.headers.get("cf-ipcountry")].filter(Boolean).join(", ");
const agentOf = (req) => String(req.headers.get("user-agent") || "").slice(0, 300);
const ipOf = (req) => req.headers.get("cf-connecting-ip") || "local";

async function makeSession(env, req, cf) {
  const id = [...crypto.getRandomValues(new Uint8Array(18))].map((b) => b.toString(16).padStart(2, "0")).join("");
  const now = Date.now();
  await env.DB.prepare("INSERT INTO sessions (id, created, seen, expires, agent, ip, place) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(id, now, now, now + SESSION_DAYS * 86400_000, agentOf(req), ipOf(req), placeOf(cf, req)).run();
  return `${id}.${await hmac(env.SESSION_SECRET, "session:" + id)}`;
}
// The signed-in device's session id, or null.
async function validSession(env, req, cf) {
  const m = /(?:^|;\s*)sid=([0-9a-f]{36})\.([0-9a-f]{64})(?:;|$)/.exec(req.headers.get("cookie") || "");
  if (!m || !sameString(m[2], await hmac(env.SESSION_SECRET, "session:" + m[1]))) return null;
  const now = Date.now();
  const row = await env.DB.prepare("SELECT seen, expires, ip FROM sessions WHERE id = ?").bind(m[1]).first().catch(() => null);
  if (!row || row.expires < now) return null;
  if (now - row.seen > SEEN_EVERY || row.ip !== ipOf(req)) {
    await env.DB.prepare("UPDATE sessions SET seen = ?, ip = ?, place = ?, agent = ? WHERE id = ?")
      .bind(now, ipOf(req), placeOf(cf, req), agentOf(req), m[1]).run();
  }
  return m[1];
}

// Signed-in devices and recent wrong passwords (Settings > Account).
async function getSessions(env, sid) {
  const now = Date.now();
  await env.DB.prepare("DELETE FROM sessions WHERE expires < ?").bind(now).run();
  await env.DB.prepare("DELETE FROM login_log WHERE at < ?").bind(now - BAD_KEEP_DAYS * 86400_000).run();
  const [{ results: devices }, { results: bad }] = await Promise.all([
    env.DB.prepare("SELECT id, created, seen, agent, ip, place FROM sessions ORDER BY seen DESC").all(),
    env.DB.prepare("SELECT at, ip, place, agent FROM login_log ORDER BY at DESC LIMIT 50").all(),
  ]);
  return json({
    devices: devices.map(({ id, ...d }) => ({ ...d, key: id.slice(0, 8), current: id === sid })),
    bad, bad_keep_days: BAD_KEEP_DAYS,
  });
}
// Logs one device out (by the start of its id, as listed), or every device but this one.
async function endSessions(req, env, sid) {
  const { key, others } = await req.json();
  if (others) await env.DB.prepare("DELETE FROM sessions WHERE id != ?").bind(sid).run();
  else if (/^[0-9a-f]{8}$/.test(String(key))) await env.DB.prepare("DELETE FROM sessions WHERE substr(id, 1, 8) = ? AND id != ?").bind(key, sid).run();
  else return json({ error: "bad request" }, 400);
  return json({ ok: true });
}
// "Secure" (https only) everywhere except plain-http testing on this PC's Wi-Fi,
// where an iPhone would otherwise refuse the cookie.
const cookie = (value, maxAge, req) =>
  `${COOKIE}=${value}; Path=/; HttpOnly;${new URL(req.url).protocol === "https:" ? " Secure;" : ""} SameSite=Strict; Max-Age=${maxAge}`;

async function login(req, env, cf) {
  if (!env.APP_PASSWORD || !env.SESSION_SECRET) return json({ error: "The password is not set up on the server yet." }, 500);
  const ip = req.headers.get("cf-connecting-ip") || "local";
  const since = Date.now() - 15 * 60_000;
  await env.DB.prepare("DELETE FROM login_fails WHERE at < ?").bind(since).run();
  const { n } = await env.DB.prepare("SELECT COUNT(*) AS n FROM login_fails WHERE ip = ?").bind(ip).first();
  if (n >= MAX_FAILS) return json({ error: "Too many tries. Wait 15 minutes." }, 429);

  const { password = "" } = await req.json().catch(() => ({}));
  // Compare HMACs so the time taken doesn't depend on the password.
  const ok = sameString(await hmac(env.SESSION_SECRET, "pw:" + password), await hmac(env.SESSION_SECRET, "pw:" + env.APP_PASSWORD));
  await sessionTables(env);
  if (!ok) {
    await env.DB.batch([
      env.DB.prepare("INSERT INTO login_fails (ip, at) VALUES (?, ?)").bind(ip, Date.now()),
      env.DB.prepare("INSERT INTO login_log (at, ip, place, agent) VALUES (?, ?, ?, ?)").bind(Date.now(), ip, placeOf(cf, req), agentOf(req)),
    ]);
    return json({ error: "Wrong password." }, 401);
  }
  return json({ ok: true }, 200, { "set-cookie": cookie(await makeSession(env, req, cf), SESSION_DAYS * 86400, req) });
}

const cleanPath = (p) => {
  const s = String(p || "").replace(/\\/g, "/").replace(/^\/+/, "").trim();
  if (!s || s.length > 300 || s.split("/").some((x) => x === ".." || x === "")) return null;
  return s;
};

async function putFile(req, env) {
  const { path: raw, content, base } = await req.json();
  const path = cleanPath(raw);
  if (!path || typeof content !== "string") return json({ error: "bad request" }, 400);
  if (content.length > 1_000_000) return json({ error: "note too large" }, 413);
  const cur = await env.DB.prepare("SELECT content, mtime FROM files WHERE path = ?").bind(path).first();
  // `base` is the version the phone/PC last saw. If the note changed since, refuse,
  // so an edit made on another device isn't silently overwritten.
  if (base !== undefined && (cur ? cur.mtime : null) !== base) return json({ error: "conflict", current: cur }, 409);
  const mtime = Math.max(Date.now(), (cur?.mtime || 0) + 1);
  await env.DB.prepare(
    "INSERT INTO files (path, content, mtime) VALUES (?, ?, ?) ON CONFLICT(path) DO UPDATE SET content = excluded.content, mtime = excluded.mtime"
  ).bind(path, content, mtime).run();
  return json({ path, mtime });
}

// Deleting moves the note under .trash/<time>/<original path>, so it can be put back
// where it was (Trash in the app). Older trash entries look like ".trash/<date> <name>".
async function trashFile(req, env) {
  const { path: raw } = await req.json();
  const path = cleanPath(raw);
  if (!path || path.startsWith(".trash/")) return json({ error: "bad request" }, 400);
  const to = `.trash/${new Date().toISOString().replace(/[:.]/g, "-")}/${path}`;
  const res = await env.DB.batch([
    env.DB.prepare("INSERT INTO files (path, content, mtime) SELECT ?, content, ? FROM files WHERE path = ?").bind(to, Date.now(), path),
    env.DB.prepare("DELETE FROM files WHERE path = ?").bind(path),
  ]);
  if (!res[0].meta?.changes) return json({ error: "not found" }, 404);
  return json({ ok: true, trashed: to });
}

// Moves a note (used to restore from the trash). Never overwrites another note.
async function moveFile(req, env) {
  const { from: rawFrom, to: rawTo } = await req.json();
  const from = cleanPath(rawFrom), to = cleanPath(rawTo);
  if (!from || !to || to.startsWith(".trash/")) return json({ error: "bad request" }, 400);
  if (await env.DB.prepare("SELECT 1 FROM files WHERE path = ?").bind(to).first()) return json({ error: "exists" }, 409);
  const mtime = Date.now();
  const res = await env.DB.batch([
    env.DB.prepare("INSERT INTO files (path, content, mtime) SELECT ?, content, ? FROM files WHERE path = ?").bind(to, mtime, from),
    env.DB.prepare("DELETE FROM files WHERE path = ?").bind(from),
  ]);
  if (!res[0].meta?.changes) return json({ error: "not found" }, 404);
  return json({ ok: true, path: to, mtime });
}

// Deleting for good is only possible for notes already in the trash (or after 30 days there, see tidyUp).
async function purgeFile(req, env) {
  const { path: raw } = await req.json();
  const path = cleanPath(raw);
  if (!path || !path.startsWith(".trash/")) return json({ error: "bad request" }, 400);
  await env.DB.prepare("DELETE FROM files WHERE path = ?").bind(path).run();
  return json({ ok: true });
}

/* ---------- the bin: things stay 30 days, then go for good ---------- */

const KEEP_DAYS = 30;
const DAY = 86400_000;

// Every picture name mentioned in a note or a setting (wallpaper, logo, widgets, buddies…).
async function usedPictures(env) {
  const [files, settings] = await Promise.all([
    env.DB.prepare("SELECT content FROM files").all(),
    env.DB.prepare("SELECT value FROM settings").all(),
  ]);
  const used = new Set();
  const scan = (text) => {
    for (const m of String(text).matchAll(/Attachments(?:\/|%2F)[\w.%-]+/gi)) {
      try { used.add(decodeURIComponent(m[0])); } catch { used.add(m[0]); }
    }
  };
  files.results.forEach((r) => scan(r.content));
  settings.results.forEach((r) => scan(r.value));
  return used;
}

// Runs at most every 6 hours (from loading the notes). Pictures nothing uses any more are
// marked as in the bin (and unmarked if used again); notes, tasks and pictures that have
// been in the bin for 30 days are deleted.
async function tidyUp(env) {
  const now = Date.now();
  const last = await env.DB.prepare("SELECT value FROM settings WHERE key = 'tidied_at'").first();
  if (last && now - Number(JSON.parse(last.value)) < 6 * 3600_000) return;
  await env.DB.prepare("INSERT INTO settings (key, value) VALUES ('tidied_at', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .bind(String(now)).run();
  // Older databases don't have this column yet; adding it again just fails.
  await env.DB.prepare("ALTER TABLE blobs ADD COLUMN trashed_at INTEGER").run().catch(() => {});
  const cutoff = now - KEEP_DAYS * DAY;
  await env.DB.prepare("DELETE FROM files WHERE path LIKE '.trash/%' AND mtime < ?").bind(cutoff).run();
  // Deleted tasks are kept in the task_bin setting; drop the old ones.
  const bin = await env.DB.prepare("SELECT value FROM settings WHERE key = 'task_bin'").first();
  if (bin) {
    let list = [];
    try { list = JSON.parse(bin.value); } catch {}
    const keep = Array.isArray(list) ? list.filter((x) => x && x.at >= cutoff) : [];
    if (!Array.isArray(list) || keep.length !== list.length) {
      await env.DB.prepare("UPDATE settings SET value = ? WHERE key = 'task_bin'").bind(JSON.stringify(keep)).run();
    }
  }
  await videoTable(env);
  const used = await usedPictures(env);
  const { results } = await env.DB.prepare("SELECT path, trashed_at FROM blobs WHERE path NOT LIKE 'Icons/%'").all();
  const changes = [];
  for (const b of results) {
    if (used.has(b.path)) {
      if (b.trashed_at) changes.push(env.DB.prepare("UPDATE blobs SET trashed_at = NULL WHERE path = ?").bind(b.path));
    } else if (!b.trashed_at) changes.push(env.DB.prepare("UPDATE blobs SET trashed_at = ? WHERE path = ?").bind(now, b.path));
    else if (b.trashed_at < cutoff) {
      changes.push(env.DB.prepare("DELETE FROM blobs WHERE path = ?").bind(b.path));
      changes.push(env.DB.prepare("DELETE FROM video_parts WHERE path = ?").bind(b.path));
    }
  }
  if (changes.length) await env.DB.batch(changes);
}

// Pictures and videos in the bin (no data, just names and sizes in bytes).
async function getBin(env) {
  await env.DB.prepare("ALTER TABLE blobs ADD COLUMN trashed_at INTEGER").run().catch(() => {});
  const { results } = await env.DB.prepare(
    "SELECT path, type, trashed_at, length(data) AS size, CASE WHEN type LIKE 'video/%' THEN data END AS meta FROM blobs WHERE trashed_at IS NOT NULL ORDER BY trashed_at DESC"
  ).all();
  const pictures = results.map(({ meta, size, ...b }) => ({ ...b, bytes: meta ? videoMeta(meta).size : Math.round(size * 0.75) }));
  return json({ pictures, keep_days: KEEP_DAYS });
}
async function binPicture(req, env, action) {
  const { path } = await req.json();
  if (typeof path !== "string" || !path.startsWith("Attachments/")) return json({ error: "bad request" }, 400);
  if (action === "keep") await env.DB.prepare("UPDATE blobs SET trashed_at = NULL WHERE path = ?").bind(path).run();
  else {
    const res = await env.DB.prepare("DELETE FROM blobs WHERE path = ? AND trashed_at IS NOT NULL").bind(path).run();
    if (res.meta?.changes) await env.DB.prepare("DELETE FROM video_parts WHERE path = ?").bind(path).run().catch(() => {});
  }
  return json({ ok: true });
}

async function getSettings(env) {
  const { results } = await env.DB.prepare("SELECT key, value FROM settings").all();
  const out = {};
  for (const r of results) {
    try { out[r.key] = JSON.parse(r.value); } catch { out[r.key] = r.value; }
  }
  return out;
}
async function putSetting(req, env) {
  const { key, value } = await req.json();
  if (!/^[a-z0-9_-]{1,40}$/i.test(String(key))) return json({ error: "bad key" }, 400);
  const text = JSON.stringify(value ?? null);
  if (text.length > 200_000) return json({ error: "too large" }, 413);
  await env.DB.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).bind(key, text).run();
  return json({ ok: true });
}

async function putBlob(req, env) {
  const { name, type, data } = await req.json();
  // Plain pictures only: no SVG, which can carry scripts.
  if (!PICTURE_TYPES.includes(String(type)) || typeof data !== "string") return json({ error: "images only" }, 400);
  if (data.length > MAX_BLOB) return json({ error: "image too large" }, 413);
  const safe = String(name || "image").replace(/[^\w.-]+/g, "-").slice(-80);
  const path = `Attachments/${Date.now()}-${safe}`;
  await env.DB.prepare("INSERT INTO blobs (path, type, data) VALUES (?, ?, ?)").bind(path, type, data).run();
  return json({ path });
}
// Pictures are stored as base64. Buffer (nodejs_compat) decodes in native code: about 0.5 ms
// for a 1 MB picture, against ~110 ms character by character, which is far over the free
// plan's 10 ms CPU per request.
const fromBase64 = (b64) => Buffer.from(b64, "base64");

async function getBlob(req, path, env) {
  const row = await env.DB.prepare("SELECT type, data FROM blobs WHERE path = ?").bind(path).first();
  if (!row) return new Response("not found", { status: 404 });
  if (row.type.startsWith("video/")) return getVideo(req, path, row, env);
  const bin = fromBase64(row.data);
  // Served as a picture and nothing else: never sniffed as a page, and sandboxed so even an older
  // upload (an SVG from before uploads were limited) can't run scripts on this site.
  return new Response(bin, { headers: {
    "content-type": row.type, "cache-control": "private, max-age=31536000, immutable",
    "x-content-type-options": "nosniff", "content-security-policy": "sandbox; default-src 'none'; img-src data:; style-src 'unsafe-inline'",
  } });
}

/* ---------- videos, stored in parts ---------- */

const videoTable = (env) => env.DB.prepare(
  "CREATE TABLE IF NOT EXISTS video_parts (path TEXT NOT NULL, n INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY (path, n))"
).run();
const videoMeta = (text) => {
  try {
    const m = JSON.parse(text);
    if (m && Number.isInteger(m.size) && Number.isInteger(m.parts)) return m;
  } catch {}
  return { size: 0, parts: 0 };
};

// 1. The browser says what it is about to send (name, type, size) and gets the video's path back.
async function startVideo(req, env) {
  const { name, type, size } = await req.json();
  if (!VIDEO_TYPES.includes(String(type))) return json({ error: "MP4, WebM or MOV videos only" }, 400);
  if (!Number.isInteger(size) || size < 1) return json({ error: "bad size" }, 400);
  if (size > MAX_VIDEO) return json({ error: `video too large (up to ${MAX_VIDEO / 1024 / 1024} MB)` }, 413);
  await videoTable(env);
  const safe = String(name || "video").replace(/[^\w.-]+/g, "-").slice(-80);
  const path = `Attachments/${Date.now()}-${safe}`;
  const meta = { size, parts: Math.ceil(size / VIDEO_PART) };
  await env.DB.prepare("INSERT INTO blobs (path, type, data) VALUES (?, ?, ?)").bind(path, type, JSON.stringify(meta)).run();
  return json({ path, part: VIDEO_PART, parts: meta.parts });
}

// 2. Then each 1 MB part, as raw bytes (PUT /api/video/part?path=…&n=0, 1, 2…).
// Buffer turns them into base64 in native code, well inside the free plan's 10 ms CPU.
async function putVideoPart(req, env, url) {
  const path = url.searchParams.get("path") || "";
  const n = Number(url.searchParams.get("n"));
  const row = await env.DB.prepare("SELECT type, data FROM blobs WHERE path = ?").bind(path).first();
  if (!row || !row.type.startsWith("video/")) return json({ error: "not found" }, 404);
  const { size, parts } = videoMeta(row.data);
  if (!Number.isInteger(n) || n < 0 || n >= parts) return json({ error: "bad part" }, 400);
  const bytes = Buffer.from(await req.arrayBuffer());
  if (bytes.length !== Math.min(VIDEO_PART, size - n * VIDEO_PART)) return json({ error: "wrong part size" }, 400);
  await env.DB.prepare(
    "INSERT INTO video_parts (path, n, data) VALUES (?, ?, ?) ON CONFLICT(path, n) DO UPDATE SET data = excluded.data"
  ).bind(path, n, bytes.toString("base64")).run();
  return json({ ok: true });
}

// Playing: browsers ask for byte ranges (iPhones insist on it). Each answer covers at most one
// part, so a request decodes at most 1 MB; the browser simply asks again for the rest.
async function getVideo(req, path, row, env) {
  const { size, parts } = videoMeta(row.data);
  const headers = {
    "content-type": row.type, "accept-ranges": "bytes", "cache-control": "private, max-age=31536000, immutable",
    "x-content-type-options": "nosniff",
  };
  const part = async (n) => {
    const r = await env.DB.prepare("SELECT data FROM video_parts WHERE path = ? AND n = ?").bind(path, n).first();
    return r ? fromBase64(r.data) : null;
  };
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") || "");
  if (!m) {
    // No range asked for: send it all, one part at a time.
    let n = 0;
    const body = new ReadableStream({
      async pull(ctl) {
        const bytes = n < parts ? await part(n++) : null;
        if (bytes) ctl.enqueue(bytes);
        else ctl.close();
      },
    });
    return new Response(body, { headers: { ...headers, "content-length": String(size) } });
  }
  let start, end;
  if (m[1] === "") { start = Math.max(0, size - Number(m[2] || 0)); end = size - 1; }
  else { start = Number(m[1]); end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1); }
  if (!(start <= end) || start >= size) {
    return new Response(null, { status: 416, headers: { ...headers, "content-range": `bytes */${size}` } });
  }
  const n = Math.floor(start / VIDEO_PART);
  end = Math.min(end, (n + 1) * VIDEO_PART - 1);
  const bytes = await part(n);
  if (!bytes) return new Response("not found", { status: 404 });
  const slice = bytes.subarray(start - n * VIDEO_PART, end - n * VIDEO_PART + 1);
  return new Response(slice, {
    status: 206, headers: { ...headers, "content-range": `bytes ${start}-${end}/${size}`, "content-length": String(slice.length) },
  });
}

// Home-screen and tab icons made from the logo (Settings > Look). They are public,
// because iPhones fetch the home-screen icon without the login cookie. With no
// custom logo, the built-in icons in /public are used.
const ICON_NAMES = ["apple-touch-icon.png", "icon-192.png", "icon-512.png"];
async function getIcon(name, env, url) {
  if (!ICON_NAMES.includes(name)) return new Response("not found", { status: 404 });
  const row = await env.DB.prepare("SELECT data FROM blobs WHERE path = ?").bind("Icons/" + name).first();
  if (!row) return Response.redirect(new URL("/" + name, url), 302);
  const bin = fromBase64(row.data);
  return new Response(bin, { headers: { "content-type": "image/png", "cache-control": "public, max-age=300" } });
}
async function putIcons(req, env) {
  const { icons } = await req.json();
  if (icons === null) {
    await env.DB.prepare("DELETE FROM blobs WHERE path LIKE 'Icons/%'").run();
    return json({ ok: true });
  }
  for (const name of ICON_NAMES) {
    const data = icons?.[name];
    if (typeof data !== "string" || data.length > MAX_BLOB) return json({ error: "bad icon" }, 400);
  }
  await env.DB.batch(ICON_NAMES.map((name) => env.DB.prepare(
    "INSERT INTO blobs (path, type, data) VALUES (?, 'image/png', ?) ON CONFLICT(path) DO UPDATE SET data = excluded.data"
  ).bind("Icons/" + name, icons[name])));
  return json({ ok: true });
}

// Google Calendar / school homework iCal links are fetched here, because browsers
// block reading them directly. The links themselves never leave the server
// except into the (logged-in) customize panel.
async function getIcal(env) {
  const s = await getSettings(env);
  const list = [
    ...(s.gcal_urls || []).map((url) => ({ url, hw: /courseville|canvas|instructure|moodle|blackboard|schoology/i.test(url) })),
    ...(s.hw_urls || []).map((url) => ({ url, hw: true })),
  ];
  const out = await Promise.all(
    list.map(async ({ url, hw }) => {
      try {
        const r = await fetch(String(url).replace(/^webcal:\/\//i, "https://"), { headers: { "user-agent": "home-dashboard" } });
        if (!r.ok) throw new Error("HTTP " + r.status);
        const text = await r.text();
        if (!text.includes("BEGIN:VCALENDAR")) throw new Error("not an iCal link");
        return { hw, text };
      } catch (e) {
        return { hw, error: e.message };
      }
    })
  );
  return json({ calendars: out });
}

async function api(req, env, url, cf) {
  const p = url.pathname;
  const m = req.method;
  if (p === "/api/login" && m === "POST") return login(req, env, cf);
  if (p.startsWith("/api/icon/") && m === "GET") return getIcon(p.slice("/api/icon/".length), env, url);
  if (p === "/api/logout" && m === "POST") {
    const sid = await validSession(env, req, cf);
    if (sid) await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(sid).run();
    return json({ ok: true }, 200, { "set-cookie": cookie("", 0, req) });
  }

  const sid = await validSession(env, req, cf);
  if (!sid) return json({ error: "login required" }, 401);
  // Writes must come from this site (cookie is SameSite=Strict too).
  if (m !== "GET") {
    const origin = req.headers.get("origin");
    if (origin && origin !== url.origin) return json({ error: "bad origin" }, 403);
  }

  if (p === "/api/me") return json({ ok: true });
  if (p === "/api/files" && m === "GET") {
    await tidyUp(env).catch((e) => console.error("tidy up", e));
    const { results } = await env.DB.prepare("SELECT path, content, mtime FROM files").all();
    return json({ files: results, settings: await getSettings(env) });
  }
  if (p === "/api/files" && m === "PUT") return putFile(req, env);
  if (p === "/api/trash" && m === "POST") return trashFile(req, env);
  if (p === "/api/move" && m === "POST") return moveFile(req, env);
  if (p === "/api/purge" && m === "POST") return purgeFile(req, env);
  if (p === "/api/bin" && m === "GET") return getBin(env);
  if (p === "/api/bin/keep" && m === "POST") return binPicture(req, env, "keep");
  if (p === "/api/bin/purge" && m === "POST") return binPicture(req, env, "purge");
  if (p === "/api/settings" && m === "PUT") return putSetting(req, env);
  if (p === "/api/blob" && m === "POST") return putBlob(req, env);
  if (p === "/api/video" && m === "POST") return startVideo(req, env);
  if (p === "/api/video/part" && m === "PUT") return putVideoPart(req, env, url);
  if (p === "/api/icons" && m === "PUT") return putIcons(req, env);
  if (p.startsWith("/api/blob/") && m === "GET") return getBlob(req, decodeURIComponent(p.slice("/api/blob/".length)), env);
  if (p === "/api/ical" && m === "GET") return getIcal(env);
  if (p === "/api/sessions" && m === "GET") return getSessions(env, sid);
  if (p === "/api/sessions/end" && m === "POST") return endSessions(req, env, sid);
  return json({ error: "not found" }, 404);
}

export async function handleApi(req, env, cf = {}) {
  // The public demo (npm run deploy:demo) has no database and no API: guests are answered in the browser.
  if (process.env.NEXT_PUBLIC_DEMO === "1") {
    const icon = /^\/api\/icon\/([\w.-]+)$/.exec(new URL(req.url).pathname);
    return icon ? Response.redirect(new URL("/" + icon[1], req.url), 302) : json({ error: "demo" }, 404);
  }
  try {
    return await api(req, env, new URL(req.url), cf);
  } catch (e) {
    console.error(e);
    return json({ error: "server error" }, 500);
  }
}
