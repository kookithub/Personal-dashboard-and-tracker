"use client";
// App-wide state: notes, settings, login, calendar events, theme, toast and dialogs.
// Components call useApp() for data and actions.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { M, TPL, buildPages, clean, edit, fileName, fillTemplate, folderPath, resolveLink, taskBlock, trashOrigin } from "@/lib/notes";
import { buildEvents } from "@/lib/ical";
import { demoData } from "@/lib/demo";
import { SKIN_THEMES, activeTheme, applyLook, flatLook, modeName, store, themeBase, themeSettings } from "@/lib/theme";

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

const GCAL_TTL = 30 * 60 * 1000;
// Built with NEXT_PUBLIC_DEMO=1 (npm run deploy:demo): a public demo with sample data only.
export const DEMO = process.env.NEXT_PUBLIC_DEMO === "1";
export const REPO_URL = process.env.NEXT_PUBLIC_REPO_URL || "";
// Videos that can be uploaded (by file ending, since some systems leave the type blank).
const VIDEO_EXT = { mp4: "video/mp4", m4v: "video/mp4", webm: "video/webm", mov: "video/quicktime" };
export const MAX_VIDEO_MB = 30;

export function AppProvider({ children }) {
  const filesRef = useRef(new Map());
  const settingsRef = useRef({});
  const [files, setFiles] = useState(new Map());
  const [settings, setSettings] = useState({});
  const [auth, setAuth] = useState("loading"); // loading | in | out | error
  const [toast, setToast] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [mode, setModeState] = useState("light"); // light | dark (this device only)
  const oldSkin = useRef(null); // Hyper / Zeus chosen as a mode on this device before they became themes
  const [gcal, setGcal] = useState({ events: {}, error: "" });
  const toastTimer = useRef();

  // A short message at the bottom. With an action ({ label: "Undo", run }) it shows a button and stays longer.
  const notice = useCallback((text, action = null) => {
    clearTimeout(toastTimer.current);
    setToast({ text, action, id: Date.now() });
    toastTimer.current = setTimeout(() => setToast(null), action ? 7000 : 3500);
  }, []);

  const commitFiles = () => setFiles(new Map(filesRef.current));
  const commitSettings = () => setSettings({ ...settingsRef.current });

  // Guest mode ("Look around as a guest"): sample data only, kept in memory. Every request is
  // answered here and never reaches the server, so nothing is saved and no real data is loaded.
  const guestRef = useRef(false);
  const guestReply = (path, opts) => {
    const reply = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
    const m = (opts.method || "GET").toUpperCase();
    let body = {};
    try { body = JSON.parse(opts.body || "{}"); } catch {}
    if (path === "/api/files" && m === "GET") return reply({ files: [...filesRef.current].map(([p, f]) => ({ path: p, ...f })), settings: settingsRef.current });
    if (path === "/api/files") return reply({ path: body.path, mtime: Math.max(Date.now(), (filesRef.current.get(body.path)?.mtime || 0) + 1) });
    if (path === "/api/trash") return reply({ ok: true, trashed: `.trash/${new Date().toISOString().replace(/[:.]/g, "-")}/${body.path}` });
    if (path === "/api/move") return reply({ ok: true, path: body.to, mtime: Date.now() });
    if (path === "/api/ical") return reply({ calendars: [] });
    if (path === "/api/bin") return reply({ pictures: [] });
    if (path === "/api/sessions") return reply({ devices: [], bad: [] });
    if (path === "/api/blob" || path === "/api/icons" || path.startsWith("/api/video")) return reply({ error: "Guests can't upload pictures or videos." }, 403);
    return reply({ ok: true });
  };

  const api = useCallback(async (path, opts = {}) => {
    if (guestRef.current) return guestReply(path, opts);
    const r = await fetch(path, {
      credentials: "same-origin",
      ...opts,
      headers: { "content-type": "application/json", ...(opts.headers || {}) },
    });
    if (r.status === 401 && path !== "/api/login") {
      setAuth("out");
      throw new Error("login required");
    }
    return r;
  }, []);

  const loadAll = useCallback(async () => {
    const r = await api("/api/files");
    if (!r.ok) throw new Error("HTTP " + r.status);
    const data = await r.json();
    filesRef.current = new Map(data.files.map((f) => [f.path, { content: f.content, mtime: f.mtime }]));
    settingsRef.current = data.settings || {};
    commitFiles();
    commitSettings();
    setAuth(guestRef.current ? "guest" : "in");
  }, [api]);

  const enterGuest = useCallback(() => {
    guestRef.current = true;
    const demo = demoData();
    filesRef.current = new Map(demo.files.map((f) => [f.path, { content: f.content, mtime: f.mtime }]));
    settingsRef.current = demo.settings;
    commitFiles();
    commitSettings();
    setAuth("guest");
  }, []);

  // Save a note. `base` says which version the edit started from, so an edit made
  // meanwhile on another device is not silently overwritten.
  const writeFile = useCallback(async (path, content) => {
    const cur = filesRef.current.get(path);
    const r = await api("/api/files", { method: "PUT", body: JSON.stringify({ path, content, base: cur ? cur.mtime : null }) });
    if (r.status === 409) {
      const { current } = await r.json();
      if (current) filesRef.current.set(path, current); else filesRef.current.delete(path);
      commitFiles();
      notice("This note was changed on another device. Showing the newest version, please try again.");
      throw new Error("conflict");
    }
    if (!r.ok) {
      notice("Could not save: " + ((await r.json().catch(() => ({}))).error || r.status));
      throw new Error("save failed");
    }
    const { mtime } = await r.json();
    filesRef.current.set(path, { content, mtime });
    commitFiles();
  }, [api, notice]);

  // Change a note with fn(text) => newText. Returns false if it could not be saved.
  // With `undo` (a message such as "Deleted X") the toast offers to put the note back as it was.
  const processFile = useCallback(async (path, fn, undo) => {
    const f = filesRef.current.get(path);
    if (!f) { notice("Note not found: " + fileName(path)); return false; }
    const before = f.content;
    const next = fn(before);
    if (next === before) return true;
    try { await writeFile(path, next); } catch { return false; }
    if (undo) {
      notice(undo, {
        label: "Undo",
        run: async () => {
          if (filesRef.current.get(path)?.content !== next) return notice("Can't undo: the note changed since.");
          try { await writeFile(path, before); notice("Undone"); } catch {}
        },
      });
    }
    return true;
  }, [writeFile, notice]);

  const saveSetting = useCallback(async (key, value) => {
    settingsRef.current = { ...settingsRef.current, [key]: value };
    commitSettings();
    const r = await api("/api/settings", { method: "PUT", body: JSON.stringify({ key, value }) });
    if (!r.ok) notice("Could not save settings.");
  }, [api, notice]);

  // Puts a trashed note back where it was (or next to it, if that name is taken now).
  const restoreNote = useCallback(async (trashPath, quiet = false) => {
    let to = trashOrigin(trashPath, filesRef.current);
    for (let n = 2; filesRef.current.has(to); n++) to = to.replace(/(?: \(restored(?: \d+)?\))?\.md$/, ` (restored${n > 2 ? " " + (n - 1) : ""}).md`);
    const r = await api("/api/move", { method: "POST", body: JSON.stringify({ from: trashPath, to }) });
    if (!r.ok) { notice("Could not restore " + fileName(trashPath)); return null; }
    const { mtime } = await r.json();
    const f = filesRef.current.get(trashPath);
    filesRef.current.delete(trashPath);
    if (f) filesRef.current.set(to, { content: f.content, mtime });
    commitFiles();
    if (!quiet) notice("Restored: " + fileName(to));
    return to;
  }, [api, notice]);

  /* ---------- deleted tasks: kept 30 days in the `task_bin` setting ---------- */

  const BIN_DAYS = 30;
  const taskBin = () => (Array.isArray(settingsRef.current.task_bin) ? settingsRef.current.task_bin : [])
    .filter((x) => x && Date.now() - x.at < BIN_DAYS * 86400_000);

  // Deletes a task (and its steps) from its note and keeps it in the bin. Undo puts it straight back.
  const deleteTask = useCallback(async (t) => {
    const f = filesRef.current.get(t.path);
    if (!f) { notice("Note not found: " + fileName(t.path)); return false; }
    const before = f.content;
    const next = edit.remove(t)(before);
    try { await writeFile(t.path, next); } catch { return false; }
    const item = { id: Math.random().toString(36).slice(2, 10), path: t.path, at: Date.now(), ...taskBlock(before, t) };
    await saveSetting("task_bin", [item, ...taskBin()].slice(0, 300));
    notice(`Deleted "${clean(t)}"`, {
      label: "Undo",
      run: async () => {
        if (filesRef.current.get(t.path)?.content !== next) return notice("Can't undo: the note changed since. It's in the Trash.");
        try { await writeFile(t.path, before); } catch { return; }
        saveSetting("task_bin", taskBin().filter((x) => x.id !== item.id));
        notice("Undone");
      },
    });
    return true;
  }, [writeFile, saveSetting, notice]); // eslint-disable-line

  // Puts a task from the bin back in its note (or the Tasks inbox, if that note is gone).
  const restoreTask = useCallback(async (item) => {
    let path = item.path;
    if (!filesRef.current.has(path)) {
      path = `${folderPath(filesRef.current, "Life")}/Tasks.md`;
      if (!filesRef.current.has(path)) { try { await writeFile(path, "# Tasks\n\n## Tasks\n"); } catch { return false; } }
    }
    const f = filesRef.current.get(path);
    try { await writeFile(path, edit.restoreTask(path, item)(f.content)); } catch { return false; }
    await saveSetting("task_bin", taskBin().filter((x) => x.id !== item.id));
    notice(path === item.path ? `Restored to ${fileName(path)}` : `Its note is gone, so it went to ${fileName(path)}`);
    return true;
  }, [writeFile, saveSetting, notice]); // eslint-disable-line
  const purgeTask = useCallback(async (item) => {
    await saveSetting("task_bin", taskBin().filter((x) => x.id !== item.id));
    notice("Task deleted for good.");
  }, [saveSetting, notice]); // eslint-disable-line

  const trashNote = useCallback(async (path) => {
    const r = await api("/api/trash", { method: "POST", body: JSON.stringify({ path }) });
    if (!r.ok) { notice("Could not delete " + fileName(path)); return false; }
    const { trashed } = await r.json();
    const f = filesRef.current.get(path);
    filesRef.current.delete(path);
    if (f && trashed) filesRef.current.set(trashed, { ...f, mtime: Date.now() });
    commitFiles();
    notice("Moved to trash: " + fileName(path), { label: "Undo", run: () => restoreNote(trashed) });
    return true;
  }, [api, notice, restoreNote]);

  const purgeNote = useCallback(async (trashPath) => {
    const r = await api("/api/purge", { method: "POST", body: JSON.stringify({ path: trashPath }) });
    if (!r.ok) return notice("Could not delete " + fileName(trashPath));
    filesRef.current.delete(trashPath);
    commitFiles();
    notice("Deleted for good: " + fileName(trashPath));
  }, [api, notice]);

  const ensureNote = useCallback(async (folder, name, tpl, date = M()) => {
    const path = `${folder ? folder + "/" : ""}${name}.md`;
    if (!filesRef.current.has(path)) {
      const t = filesRef.current.get(`${TPL}/${tpl}.md`);
      await writeFile(path, t ? fillTemplate(t.content, name, date) : `# ${name}\n`);
    }
    return path;
  }, [writeFile]);

  // Shrinks a photo before upload so it fits in the database.
  // { max: 512, png: true } keeps see-through parts (used for the logo).
  // { keep: true } uploads a small GIF / WebP / PNG unchanged, so an animation keeps moving.
  const uploadImage = useCallback(async (fileObj, { max = 1600, png = false, keep = false } = {}) => {
    if (keep && /^image\/(gif|webp|png)$/.test(fileObj.type) && fileObj.size <= 1_100_000) {
      const data = await new Promise((ok, fail) => {
        const fr = new FileReader();
        fr.onload = () => ok(String(fr.result).split(",")[1]);
        fr.onerror = () => fail(new Error("could not read the file"));
        fr.readAsDataURL(fileObj);
      });
      const r = await api("/api/blob", { method: "POST", body: JSON.stringify({ name: fileObj.name, type: fileObj.type, data }) });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "upload failed");
      return (await r.json()).path;
    }
    const img = await createImageBitmap(fileObj);
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    const type = png ? "image/png" : "image/jpeg";
    const url = c.toDataURL(type, 0.85);
    const r = await api("/api/blob", {
      method: "POST",
      body: JSON.stringify({ name: fileObj.name.replace(/\.\w+$/, png ? ".png" : ".jpg"), type, data: url.split(",")[1] }),
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "upload failed");
    return (await r.json()).path;
  }, [api]);

  // Uploads a video (Zeus' own slideshow) in 1 MB parts, so it fits the database's rows.
  // onProgress(0…1) after each part. Returns the video's path, like uploadImage.
  const uploadVideo = useCallback(async (fileObj, onProgress = () => {}) => {
    const ext = (/\.(\w+)$/.exec(fileObj.name || "") || [])[1]?.toLowerCase();
    const type = VIDEO_EXT[ext] || fileObj.type;
    if (!Object.values(VIDEO_EXT).includes(type)) throw new Error("pick an MP4, WebM or MOV video");
    if (fileObj.size > MAX_VIDEO_MB * 1024 * 1024) throw new Error(`the video is ${(fileObj.size / 1048576).toFixed(0)} MB; up to ${MAX_VIDEO_MB} MB fits`);
    const fail = async (r) => new Error((await r.json().catch(() => ({}))).error || "upload failed");
    const r = await api("/api/video", { method: "POST", body: JSON.stringify({ name: fileObj.name, type, size: fileObj.size }) });
    if (!r.ok) throw await fail(r);
    const { path, part, parts } = await r.json();
    for (let n = 0; n < parts; n++) {
      const body = fileObj.slice(n * part, (n + 1) * part);
      const send = () => api(`/api/video/part?path=${encodeURIComponent(path)}&n=${n}`, {
        method: "PUT", body, headers: { "content-type": "application/octet-stream" },
      });
      // One retry per part, for a phone's connection dropping for a moment.
      let pr = await send().catch(() => null);
      if (!pr?.ok) pr = await send();
      if (!pr.ok) throw await fail(pr);
      onProgress((n + 1) / parts);
    }
    return path;
  }, [api]);

  /* ---------- calendar links (fetched by the server) ---------- */

  const loadGcal = useCallback(async (force = false) => {
    const s = settingsRef.current;
    const total = (s.gcal_urls || []).length + (s.hw_urls || []).length;
    if (!total) return setGcal({ events: {}, error: "" });
    try {
      const cached = JSON.parse(store.get("k-gcal-cache", "null"));
      if (cached?.events) setGcal((g) => ({ ...g, events: cached.events }));
      if (!force && cached && Date.now() - cached.at < GCAL_TTL) return;
    } catch {}
    let errors = [];
    let events = null;
    try {
      const { calendars } = await (await api("/api/ical")).json();
      ({ events, errors } = buildEvents(calendars));
    } catch (e) {
      errors = [e.message];
    }
    const error = errors.length ? `Couldn't load ${errors.length} of ${total} calendar link(s): ${errors[0]}. Check it in settings.` : "";
    if (events && errors.length < total) {
      if (!errors.length) store.set("k-gcal-cache", JSON.stringify({ at: Date.now(), events }));
      setGcal({ events, error });
    } else setGcal((g) => ({ ...g, error }));
  }, [api]);

  /* ---------- theme ---------- */

  // Older saved values: "auto" becomes what the device is set to now; "hyper" and "zeus" were
  // modes and are now themes, so they become dark / light here and the theme once logged in.
  useEffect(() => {
    let saved = store.get("k-theme", "light");
    if (saved === "auto") saved = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    if (saved in SKIN_THEMES) { oldSkin.current = saved; saved = saved === "hyper" ? "dark" : "light"; }
    saved = modeName(saved);
    store.set("k-theme", saved);
    setModeState(saved);
  }, []);
  const dark = mode === "dark";

  // Moving backgrounds (Hyper, Zeus) can be switched off on this device. They are also switched off
  // by themselves if the page keeps crashing right after it opens (a phone running out of graphics
  // memory reloads the page again and again): three quick starts in a row that never got to settle.
  const [motion, setMotionState] = useState(true);
  useEffect(() => {
    let boot = {};
    try { boot = JSON.parse(store.get("k-boot", "{}")) || {}; } catch {}
    const now = Date.now();
    const n = boot.at && now - boot.at < 20_000 && !boot.ok ? (boot.n || 0) + 1 : 1;
    store.set("k-boot", JSON.stringify({ at: now, n, ok: false }));
    if (n >= 3 && store.get("k-motion", "on") !== "off") { store.set("k-motion", "off"); store.set("k-motion-auto", "1"); }
    setMotionState(store.get("k-motion", "on") !== "off");
    const t = setTimeout(() => store.set("k-boot", JSON.stringify({ at: now, n: 0, ok: true })), 12_000);
    return () => clearTimeout(t);
  }, []);
  const setMotion = useCallback((on) => { store.set("k-motion", on ? "on" : "off"); store.set("k-motion-auto", ""); setMotionState(on); }, []);
  const setMode = useCallback((m) => { const v = modeName(m); store.set("k-theme", v); setModeState(v); }, []);
  const setDark = useCallback((d) => setMode(d ? "dark" : "light"), [setMode]);
  const dash = useMemo(() => settings.dashboard || {}, [settings.dashboard]);
  // Before login the settings aren't known yet: use the theme colors this device saw last.
  const look = useMemo(() => {
    if (auth === "in" || auth === "guest") return dash;
    try { return JSON.parse(store.get("k-pal2", "")) || {}; } catch { return {}; }
  }, [auth, dash]);
  const palette = activeTheme(look);
  // The settings panel shows unsaved changes with previewLook(draft), and previewLook(null) to undo.
  const [preview, previewLook] = useState(null);
  // The theme in use as it shows (with unsaved changes from Settings): its skin and effects.
  const flat = useMemo(() => flatLook(preview || look), [preview, look]);
  const skin = flat.skin;
  useEffect(() => {
    if (auth !== "in" || !oldSkin.current) return;
    const s = oldSkin.current;
    oldSkin.current = null;
    if (activeTheme(dash) !== s) saveSetting("dashboard", { ...dash, palette: s });
  }, [auth]); // eslint-disable-line
  useEffect(() => {
    if (auth === "in") {
      const { wallpaper, ...colors } = themeSettings(look, palette); // eslint-disable-line no-unused-vars
      store.set("k-pal2", JSON.stringify({ palette, themes: { [palette]: { ...colors, base: themeBase(look, palette), name: "_" } } }));
    }
    applyLook(preview || look, dark);
  }, [auth, look, preview, palette, dark]);

  /* ---------- start, and refresh when the app comes back to the front ---------- */

  useEffect(() => {
    // The public demo build opens straight into the sample data: no login screen, no server.
    if (DEMO) return enterGuest();
    loadAll().then(() => loadGcal()).catch((e) => { if (e.message !== "login required") setAuth("error"); });
  }, [loadAll, loadGcal, enterGuest]);

  const editingRef = useRef(false);
  useEffect(() => {
    let last = Date.now();
    const onVis = () => {
      if (document.visibilityState !== "visible" || editingRef.current || guestRef.current || Date.now() - last < 15_000) return;
      last = Date.now();
      loadAll().then(() => loadGcal()).catch(() => {});
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [loadAll, loadGcal]);

  useEffect(() => {
    // Say so once, after logging in, if moving backgrounds were switched off because of crashes.
    if ((auth === "in" || auth === "guest") && store.get("k-motion-auto", "") === "1") {
      store.set("k-motion-auto", "");
      setTimeout(() => notice("The page kept crashing, so moving backgrounds are off on this device. Turn them back on in Settings > Look > Customize."), 800);
    }
  }, [auth, notice]);

  const login = useCallback(async (password) => {
    const r = await api("/api/login", { method: "POST", body: JSON.stringify({ password }) });
    if (!r.ok) return (await r.json().catch(() => ({}))).error || "Could not log in.";
    await loadAll();
    loadGcal();
    return null;
  }, [api, loadAll, loadGcal]);

  const pages = useMemo(() => buildPages(files), [files]);

  const value = {
    files, pages, settings, dash, auth, dark, setDark, mode, setMode, skin, flat, motion, setMotion, preview, previewLook, gcal, palette,
    notice, api, writeFile, processFile, saveSetting, trashNote, restoreNote, purgeNote, deleteTask, restoreTask, purgeTask, ensureNote, uploadImage, uploadVideo, loadGcal, loadAll, login, enterGuest,
    resolve: (t) => resolveLink(files, t),
    openDialog: (render) => setDialog(() => render),
    closeDialog: () => setDialog(null),
    editingRef,
  };

  return (
    <Ctx.Provider value={value}>
      {children}
      {dialog && dialog(() => setDialog(null))}
      <div className={"b-toast" + (toast ? " on" : "") + (toast?.action ? " act" : "")} role="status">
        <span>{toast?.text}</span>
        {toast?.action && (
          <button type="button" onClick={() => { const run = toast.action.run; setToast(null); run(); }}>{toast.action.label}</button>
        )}
      </div>
    </Ctx.Provider>
  );
}
