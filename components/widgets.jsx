"use client";
// Widgets: small cards you add yourself (Customize > Add). They are items in a tab's
// layout (see lib/layout.js): { id, type, title?, size?, ...fields }.
import { useEffect, useState } from "react";
import { M } from "@/lib/notes";
import { SIZES, SIZE_OPTIONS, tabList } from "@/lib/layout";
import { imgSrc, store } from "@/lib/theme";
import { useApp } from "./AppProvider";
import { EmbedSlot, embedId } from "./EmbedHost";
import { useBoard, useNav } from "./board";
import Markdown from "./Markdown";
import { hue } from "./tiles";
import { BoxField, Btn, Empty, Field, Ico, Modal, Segmented, Tile } from "./ui";

export const WIDGET_TYPES = {
  picture: ["image", "Picture"],
  quote: ["sticky-note", "Text / sticky note"],
  countdown: ["hourglass", "Countdown"],
  clock: ["clock", "World clock"],
  weather: ["cloud-sun", "Weather"],
  links: ["link", "Links"],
  note: ["file-text", "Note"],
  embed: ["globe", "Embed (YouTube, Spotify, map…)"],
  heading: ["layers", "Section heading"],
};
const DEFAULT_SPAN = { countdown: [2, 3], clock: [2, 3], weather: [2, 3], embed: [3, 6], heading: [6, 6] };
const COLORS = { "": "Default", accent: "Accent", amber: "Amber", green: "Green", blue: "Blue", pink: "Pink", violet: "Violet" };
// Picture shapes. "original" keeps the photo's own proportions; the others crop to fit.
const SHAPES = { original: "As is", square: "Square", wide: "Wide", tall: "Tall", fill: "Fill card" };
const FOCUS = { center: "Middle", top: "Top", bottom: "Bottom", left: "Left", right: "Right" };

// [desktop columns, phone columns] a widget takes.
export const widgetSpan = (w) => (w.type === "heading" ? [6, 6] : SIZES[w.size]?.slice(0, 2) || DEFAULT_SPAN[w.type] || [2, 6]);

export function Widget({ w, i }) {
  const { resolve } = useApp();
  const { today } = useBoard();
  const { openPath } = useNav();
  const h = w.color ? `var(--${w.color === "accent" ? "accent" : w.color})` : hue(i);
  const base = { hue: h };

  switch (w.type) {
    case "picture": {
      const src = imgSrc(w.src);
      const shape = SHAPES[w.shape] ? w.shape : "original";
      return (
        <Tile {...base} className={"pic shape-" + shape} onClick={w.link ? () => openPath(w.link) : undefined}>
          {src ? <img className="b-pic" src={src} alt={w.title || ""} style={{ objectPosition: FOCUS[w.focus] ? w.focus : "center" }} />
            : <Empty>No image chosen.</Empty>}
          {w.title && <div className="b-pic-cap">{w.title}</div>}
        </Tile>
      );
    }
    case "countdown": {
      const d = M(String(w.date || ""), "YYYY-MM-DD", true);
      const n = d.isValid() ? d.diff(today, "days") : null;
      return (
        <Tile {...base} className="tint" title={w.title || "Countdown"} icon="hourglass" >
          <div className="b-count">{n == null ? "?" : Math.abs(n)}</div>
          <div className="b-ntile-s">{n == null ? "Pick a date" : n === 0 ? "Today" : n > 0 ? `${n === 1 ? "day" : "days"} to go · ${d.format("D MMM")}` : "days ago"}</div>
        </Tile>
      );
    }
    case "heading":
      return null; // drawn by the dashboard as a section title
    case "quote":
      return (
        <Tile {...base} className={w.color ? "sticky" : "tint"} title={w.title || null} icon={w.title ? "sticky-note" : null} >
          <div className="b-quote">{w.text || ""}</div>
        </Tile>
      );
    case "links": {
      const rows = String(w.text || "").split("\n").map((s) => s.split("|").map((x) => x.trim())).filter(([n]) => n);
      return (
        <Tile {...base} title={w.title || "Links"} icon="link" >
          {rows.map(([n, target], j) => (
            <div key={j} className="b-link" onClick={() => openPath(target || n)}>
              <Ico name={/^https?:/.test(target || n) ? "globe" : "file-text"} />
              <span>{n}</span>
              <Ico name="chevron-right" />
            </div>
          ))}
          {!rows.length && <Empty>No links yet.</Empty>}
        </Tile>
      );
    }
    case "note": {
      const path = resolve(w.note);
      return (
        <Tile {...base} title={w.title || w.note || "Note"} icon="file-text" >
          {!path ? <Empty>Note not found: {w.note || "(none)"}</Empty> : (
            <>
              <div className="b-note-w"><Markdown path={path} interactive={false} /></div>
              <Btn variant="ghost" style={{ marginTop: 6 }} onClick={() => openPath(path)}>Open note</Btn>
            </>
          )}
        </Tile>
      );
    }
    case "clock":
      return <Tile {...base} className="tint" title={w.title || cityOf(w.tz)} icon="clock"><ClockFace tz={w.tz} /></Tile>;
    case "weather":
      return <Tile {...base} className="tint" title={w.title || w.city || "Weather"} icon="cloud-sun"><WeatherFace city={w.city} /></Tile>;
    case "embed": {
      // The frame itself lives in EmbedHost, so it keeps playing when you switch tabs.
      const em = embedFor(w.url);
      return (
        <Tile {...base} className="embed" title={w.title || null} icon={w.title ? "globe" : null} >
          {em ? <EmbedSlot id={embedId(w)} url={em.url} height={+w.height || em.height} title={w.title || ""} />
            : <Empty>Paste an https link.</Empty>}
        </Tile>
      );
    }
    default:
      return null;
  }
}

/* ---------- clock ---------- */

const cityOf = (tz) => (tz ? tz.split("/").pop().replace(/_/g, " ") : "Clock");
function ClockFace({ tz }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 10_000);
    return () => clearInterval(t);
  }, []);
  let time = "", day = "";
  try {
    time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: tz || undefined }).format(now);
    day = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "short", timeZone: tz || undefined }).format(now);
  } catch {
    return <Empty>Unknown time zone: {tz}</Empty>;
  }
  return (
    <>
      <div className="b-count">{time}</div>
      <div className="b-ntile-s">{day}</div>
    </>
  );
}

/* ---------- weather (Open-Meteo, free, no key) ---------- */

const WMO = [
  [0, "sun", "Clear"], [2, "cloud-sun", "Partly cloudy"], [3, "cloud", "Cloudy"], [48, "cloud-fog", "Fog"],
  [57, "cloud-drizzle", "Drizzle"], [67, "cloud-rain", "Rain"], [77, "cloud-snow", "Snow"], [82, "cloud-rain", "Showers"],
  [86, "cloud-snow", "Snow showers"], [99, "cloud-lightning", "Thunderstorm"],
];
const wmo = (code) => WMO.find(([max]) => code <= max) || WMO[WMO.length - 1];

function WeatherFace({ city }) {
  const [w, setW] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    if (!city) return;
    let live = true;
    const key = "k-wx-" + city.toLowerCase();
    try {
      const c = JSON.parse(store.get(key, "null"));
      if (c) setW(c);
      if (c && Date.now() - c.at < 30 * 60_000) return;
    } catch {}
    (async () => {
      try {
        const g = await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?count=1&name=${encodeURIComponent(city)}`)).json();
        const place = g.results?.[0];
        if (!place) throw new Error("City not found");
        const f = await (await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&forecast_days=1&timezone=auto`)).json();
        const data = {
          at: Date.now(), place: place.name, temp: Math.round(f.current.temperature_2m), code: f.current.weather_code,
          hi: Math.round(f.daily.temperature_2m_max[0]), lo: Math.round(f.daily.temperature_2m_min[0]),
        };
        store.set(key, JSON.stringify(data));
        if (live) { setW(data); setErr(""); }
      } catch (e) {
        if (live) setErr(e.message === "City not found" ? e.message : "Could not load the weather right now.");
      }
    })();
    return () => { live = false; };
  }, [city]);
  if (!city) return <Empty>Pick a city.</Empty>;
  if (!w) return <Empty>{err || "Loading…"}</Empty>;
  const [, icon, text] = wmo(w.code);
  return (
    <div className="b-wx">
      <div className="b-wx-i"><Ico name={icon} /></div>
      <div>
        <div className="b-count">{w.temp}°</div>
        <div className="b-ntile-s">{text} · {w.hi}° / {w.lo}°</div>
      </div>
    </div>
  );
}

/* ---------- embed ---------- */

// What can be pasted into an Embed widget: a link, or the embed code a site gives (Share > Embed),
// which is usually an <iframe …> (only its address and height are used, never the code itself).
// Embed codes that need a script (X/Twitter, Instagram, TikTok blockquotes) are turned into the
// site's own embed address from the post's link.
const decode = (s) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
export function parseEmbed(raw) {
  const s = String(raw || "").trim();
  if (!/^</.test(s)) return { url: s };
  const attr = (name) => {
    const m = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(s);
    return m ? decode(m[1] ?? m[2] ?? m[3]) : "";
  };
  if (/<iframe/i.test(s)) {
    const h = /^\d+(?:px)?$/.test(attr("height")) ? parseInt(attr("height"), 10)
      : +(/height\s*:\s*(\d+)px/i.exec(attr("style")) || [])[1] || undefined;
    return { url: attr("src").replace(/^\/\//, "https://"), height: h };
  }
  // Blockquote embeds: the post's link is in cite / data-instgrm-permalink / the last <a href>.
  const links = [...s.matchAll(/href\s*=\s*"([^"]+)"/gi)].map((m) => decode(m[1]));
  return { url: attr("cite") || attr("data-instgrm-permalink") || links.find((l) => /\/status\/\d+/.test(l)) || links[0] || "" };
}

// The address shown in the frame, and a height that suits it when none is set.
export function embedFor(raw) {
  const { url: s, height } = parseEmbed(raw);
  if (!/^https:\/\//.test(s)) return null;
  const out = (url, h) => ({ url, height: height || h });
  let m = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{6,})/.exec(s);
  if (m && !/youtube(-nocookie)?\.com\/embed\/videoseries/.test(s)) {
    const t = /[?&](?:t|start)=(\d+)/.exec(s);
    const list = /[?&]list=([\w-]+)/.exec(s);
    const q = [t && `start=${t[1]}`, list && `list=${list[1]}`].filter(Boolean).join("&");
    return out(`https://www.youtube-nocookie.com/embed/${m[1]}${q ? "?" + q : ""}`, 260);
  }
  m = /youtube\.com\/(?:playlist|embed\/videoseries)\?(?:.*&)?list=([\w-]+)/.exec(s);
  if (m) return out(`https://www.youtube-nocookie.com/embed/videoseries?list=${m[1]}`, 260);
  m = /open\.spotify\.com\/(?:intl-\w+\/)?(?:embed\/)?(track|album|playlist|episode|show|artist)\/(\w+)/.exec(s);
  if (m) return out(`https://open.spotify.com/embed/${m[1]}/${m[2]}`, m[1] === "track" || m[1] === "episode" ? 152 : 352);
  m = /(?:player\.)?vimeo\.com\/(?:video\/)?(\d+)(?:\/(\w+))?/.exec(s);
  if (m) return out(`https://player.vimeo.com/video/${m[1]}${m[2] ? "?h=" + m[2] : /[?&]h=(\w+)/.test(s) ? "?h=" + /[?&]h=(\w+)/.exec(s)[1] : ""}`, 260);
  m = /tiktok\.com\/(?:@[\w.-]+\/video\/|embed\/(?:v2\/)?)(\d+)/.exec(s);
  if (m) return out(`https://www.tiktok.com/embed/v2/${m[1]}`, 740);
  m = /instagram\.com\/(?:[\w.]+\/)?(p|reel|tv)\/([\w-]+)/.exec(s);
  if (m) return out(`https://www.instagram.com/${m[1]}/${m[2]}/embed`, 560);
  m = /(?:twitter|x)\.com\/\w+\/status\/(\d+)/.exec(s);
  if (m) return out(`https://platform.twitter.com/embed/Tweet.html?id=${m[1]}`, 420);
  if (/^https:\/\/soundcloud\.com\//.test(s)) return out(`https://w.soundcloud.com/player/?url=${encodeURIComponent(s)}`, 166);
  m = /^https:\/\/music\.apple\.com\/(.+)/.exec(s);
  if (m) return out(`https://embed.music.apple.com/${m[1]}`, 175);
  m = /docs\.google\.com\/(document|spreadsheets|presentation|forms)\/d\/(e\/)?([\w-]+)/.exec(s);
  if (m && !/\/(embed|preview|pubhtml|viewform)\b/.test(s)) {
    return out(`https://docs.google.com/${m[1]}/d/${m[2] || ""}${m[3]}/${m[1] === "presentation" ? "embed" : m[1] === "forms" ? "viewform?embedded=true" : "preview"}`, 420);
  }
  m = /google\.[a-z.]+\/maps\/place\/([^/@?]+)/.exec(s);
  if (m) return out(`https://maps.google.com/maps?q=${m[1]}&output=embed`, 320);
  return out(s, 260);
}
export const embedUrl = (raw) => embedFor(raw)?.url || null;

const embedHint = (v) => {
  const s = String(v || "").trim();
  if (s && !embedUrl(s)) return "That isn't an https link or embed code yet.";
  if (/maps\.app\.goo\.gl|goo\.gl\/maps/.test(s)) return "Short Google Maps links can't be shown in a frame: in Maps use Share > Embed a map > Copy HTML, and paste that here.";
  return "Paste a link (YouTube, Spotify, Vimeo, TikTok, Instagram, X, SoundCloud, Google Docs/Slides/Maps…) or the embed code a site gives you under Share > Embed (<iframe …>).";
};

/* ---------- add / edit dialog ---------- */

export function WidgetDialog({ close, initial, onSave, onDelete }) {
  const app = useApp();
  const tabs = tabList(app.dash);
  const [w, setW] = useState({ ...initial });
  const set = (k) => (e) => setW((x) => ({ ...x, [k]: typeof e === "string" ? e : e.target.value }));
  const [busy, setBusy] = useState(false);
  const upload = async (file) => {
    if (!file) return;
    setBusy(true);
    try { const p = await app.uploadImage(file, { keep: true }); setW((x) => ({ ...x, src: p })); }
    catch (e) { app.notice("Upload failed: " + e.message); }
    setBusy(false);
  };
  const zones = (() => { try { return Intl.supportedValuesOf("timeZone"); } catch { return []; } })();
  const save = () => {
    if (busy) return;
    const out = { ...w };
    for (const k of Object.keys(out)) {
      if (typeof out[k] === "string") out[k] = out[k].trim();
      if (out[k] === "" || out[k] == null) delete out[k];
    }
    if (out.type === "heading") ["size", "color"].forEach((k) => delete out[k]);
    close();
    onSave(out);
  };
  return (
    <Modal title={onDelete ? "Edit widget" : "Add widget"} wide onClose={close}>
      <div className="b-wtypes">
        {Object.entries(WIDGET_TYPES).map(([k, [icon, label]]) => (
          <button key={k} type="button" className={"b-wtype" + (w.type === k ? " on" : "")} onClick={() => setW((x) => ({ ...x, type: k }))}>
            <Ico name={icon} /><span>{label}</span>
          </button>
        ))}
      </div>

      {w.type === "picture" && (
        <>
          <Field label="Picture" hint="Choose a photo, or paste an https link to one.">
            {imgSrc(w.src) && <img className="b-thumb" src={imgSrc(w.src)} alt="" />}
            <input className="b-input" value={w.src || ""} placeholder="https://…" onChange={set("src")} />
            <input type="file" accept="image/*" onChange={(e) => upload(e.target.files?.[0])} />
            {busy && <small>Uploading…</small>}
          </Field>
          <Field label="Shape" hint="&quot;As is&quot; shows the whole photo. The others crop it to fit.">
            <Segmented value={SHAPES[w.shape] ? w.shape : "original"} options={SHAPES} onChange={set("shape")} />
          </Field>
          {(w.shape || "original") !== "original" && (
            <Field label="Keep in view when cropping"><Segmented value={w.focus || "center"} options={FOCUS} onChange={set("focus")} /></Field>
          )}
          <Field label="Open when tapped (optional)"><input className="b-input" value={w.link || ""} placeholder="Note name or https link" onChange={set("link")} /></Field>
        </>
      )}
      {w.type === "quote" && (
        <>
          <Field label="Text"><textarea className="b-textarea" rows={3} value={w.text || ""} onChange={set("text")} /></Field>
          <Field label="Color"><Segmented value={w.color || ""} options={COLORS} onChange={set("color")} /></Field>
        </>
      )}
      {w.type === "countdown" && <Field label="Date"><input className="b-input" type="date" value={w.date || ""} onChange={set("date")} /></Field>}
      {w.type === "clock" && (
        <Field label="Time zone" hint="Leave empty for this device's time. e.g. Asia/Tokyo, Europe/London">
          <input className="b-input" list="b-zones" value={w.tz || ""} placeholder="Europe/London" onChange={set("tz")} />
          <datalist id="b-zones">{zones.map((z) => <option key={z} value={z} />)}</datalist>
        </Field>
      )}
      {w.type === "weather" && (
        <Field label="City" hint="Weather from Open-Meteo, updated every 30 minutes.">
          <input className="b-input" value={w.city || ""} placeholder="e.g. London" onChange={set("city")} />
        </Field>
      )}
      {w.type === "links" && (
        <Field label="Links" hint="One per line:  Name | note name or https link">
          <textarea className="b-textarea" rows={4} value={w.text || ""} onChange={set("text")} />
        </Field>
      )}
      {w.type === "note" && <Field label="Note name" hint="Shows the note right on the dashboard."><input className="b-input" value={w.note || ""} placeholder="e.g. Reading list" onChange={set("note")} /></Field>}
      {w.type === "embed" && (
        <>
          <Field label="Link or embed code" hint={embedHint(w.url)}>
            <textarea className="b-textarea" rows={2} value={w.url || ""} placeholder="https://…  or  <iframe src=…></iframe>"
              onChange={(e) => {
                // Pasted embed code is kept as just its address (and its height, if the box is empty).
                const { url, height } = parseEmbed(e.target.value);
                const code = /^\s*</.test(e.target.value);
                setW((x) => ({ ...x, url: code ? url : e.target.value, ...(code && height && !x.height ? { height } : {}) }));
              }} />
          </Field>
          <Field label="Height in pixels (optional)"><input className="b-input" type="number" min="100" max="900" value={w.height || ""} onChange={set("height")} /></Field>
        </>
      )}

      <Field label={w.type === "heading" ? "Heading" : "Title (optional)"}>
        <input className="b-input" value={w.title || ""} placeholder={w.type === "heading" ? "e.g. My *goals*  (stars make a word fancy)" : ""} onChange={set("title")} />
      </Field>
      {w.type !== "heading" && (
        <Field label="Width" hint="Small sits two side by side on a phone.">
          <Segmented value={w.size || ""} options={{ "": "Auto", ...SIZE_OPTIONS }} onChange={set("size")} />
        </Field>
      )}
      {w.type !== "heading" && <BoxField value={w.box || ""} onChange={(v) => setW((x) => ({ ...x, box: v }))} />}
      <TabSelect tabs={tabs} value={w.tab} onChange={set("tab")} />

      <div className="b-modal-btns">
        {onDelete && <Btn variant="danger" icon="trash-2" onClick={() => { close(); onDelete(); }}>Remove</Btn>}
        <span style={{ flex: 1 }} />
        <Btn onClick={close}>Cancel</Btn>
        <Btn variant="primary" disabled={busy} onClick={save}>{busy ? "Uploading…" : onDelete ? "Save" : "Add"}</Btn>
      </div>
    </Modal>
  );
}

// "Show on" a tab: all tabs, including ones not in the dock right now.
export function TabSelect({ tabs, value, onChange }) {
  return (
    <Field label="Show on">
      <select className="b-input" value={value} onChange={onChange}>
        {tabs.map((t) => <option key={t.id} value={t.id}>{t.name}{t.shown ? "" : " (not in the dock)"}</option>)}
      </select>
    </Field>
  );
}
