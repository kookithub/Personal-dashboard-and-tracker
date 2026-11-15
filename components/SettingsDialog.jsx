"use client";
// Settings, in four parts: Look (themes with their own colors and background, font, logo), Home (title, tabs, cards),
// Calendars and Account. Look changes show at once and are only kept when you press Save.
import { useEffect, useState } from "react";
import {
  BACKDROPS, BASES, CARD_LOOKS, CORNERS, DECORS, FLASH_WARN, HY_COLORS, HY_STYLES, MODES, RIBBON_COLORS, STYLES, THEME_FIELDS, ZS_LIGHTNING, ZS_SHOWS, ZS_SLIDES, activeTheme, backdropName, defaultColor, flatLook, imgSrc, isHex,
  ownSlides, themeBase, themeList, withThemes,
} from "@/lib/theme";
import { MAX_VIDEO_MB, useApp } from "./AppProvider";
import { BUILTIN_TABS as BUILTIN_DEFAULTS, TAB_ICONS, getLayout, tabList } from "@/lib/layout";
import { useBoard } from "./board";
import { LogoMark, parseLogo } from "./Logo";
import { Btn, Field, Icon, IconBtn, LOGO_ICONS, Modal, ModalButtons, Segmented } from "./ui";
import TrashDialog from "./TrashDialog";
import DevicesDialog from "./DevicesDialog";
import { BUDDY_ACTIVITY, BUDDY_KINDS, BUDDY_LINES, BUDDY_MOTIONS, BUDDY_SPEEDS, BUILT_IN, Drawn, getBuddies, getBuddyPics } from "./Buddy";

const PARTS = { look: "Look", home: "Home", buddy: "Buddy", calendars: "Calendars", account: "Account" };
const COLOR_KEYS = ["accent", "second", "background"];
const KIND_HINT = { default: "Your colors and wallpaper", hyper: "Neon bands of light", zeus: "Greek gods and lightning" };
const lines = (s) => s.split("\n").map((x) => x.trim()).filter(Boolean);

export default function SettingsDialog({ close, onCustomize, part: firstPart }) {
  const app = useApp();
  const { dash, settings, dark } = app;
  const { links } = useBoard();
  const [part, setPart] = useState(PARTS[firstPart] ? firstPart : "look");

  // Look: a draft of the look-related fields, previewed live. Each theme keeps its own colors,
  // background, font style, corners and decoration in look.themes[id] (see lib/theme.js).
  const [look, setLook] = useState(() => {
    const d = withThemes(dash);
    return {
      palette: activeTheme(d), logo: d.logo || "", themes: d.themes || {}, hidden_themes: Array.isArray(d.hidden_themes) ? d.hidden_themes : [],
    };
  });
  const setL = (patch) => setLook((l) => ({ ...l, ...patch }));
  // Buddies (characters on the dashboard), previewed live like the look. `bi` is the one being edited.
  // Uploaded pictures live in a library (`pics`), so each is uploaded once and can be picked again later;
  // `hiddenKinds` are built-in characters that were removed.
  const rid = () => Math.random().toString(36).slice(2, 8);
  const newBuddy = () => ({ id: rid(), on: true, kind: "blob", motion: "walk", activity: "lively", speed: "normal", size: 84 });
  const [buddyInit] = useState(() => {
    const pics = getBuddyPics(dash).map((p) => ({ ...p }));
    const list = getBuddies(dash).map((b) => ({ ...newBuddy(), on: false, ...b }));
    // Pictures uploaded before the library existed join it.
    for (const b of list) {
      if (b.kind !== "own" || b.pic || !String(b.src || "").trim()) continue;
      let p = pics.find((x) => x.src === b.src.trim());
      if (!p) {
        p = { id: rid(), name: `My picture ${pics.length + 1}`, src: b.src.trim(), pixel: !!b.pixel, frames: b.frames || 1, flip: !!b.flip };
        pics.push(p);
      }
      b.pic = p.id;
    }
    const buddies = (list.length ? list : [{ ...newBuddy(), on: false }]).map((b) => ({
      ...b, linesText: (Array.isArray(b.lines) && b.lines.length ? b.lines : BUDDY_LINES).join("\n"),
    }));
    return { pics, buddies };
  });
  const [pics, setPics] = useState(buddyInit.pics);
  const [hiddenKinds, setHiddenKinds] = useState(() => (Array.isArray(dash.buddy_hidden) ? dash.buddy_hidden : []));
  const [buddies, setBuddies] = useState(buddyInit.buddies);
  const [bi, setBi] = useState(0);
  const buddy = buddies[Math.min(bi, buddies.length - 1)];
  const setB = (patch) => setBuddies((list) => list.map((b, j) => (j === Math.min(bi, list.length - 1) ? { ...b, ...patch } : b)));
  const curPic = buddy.kind === "own" ? pics.find((p) => p.id === buddy.pic) : null;
  const setPic = (patch) => curPic && setPics((list) => list.map((p) => (p.id === curPic.id ? { ...p, ...patch } : p)));
  const addPic = (src, fileName) => {
    const p = { id: rid(), name: String(fileName || "").replace(/\.\w+$/, "").slice(0, 24) || `My picture ${pics.length + 1}`, src, pixel: false, frames: 1, flip: false };
    setPics((list) => [...list, p]);
    setB({ kind: "own", pic: p.id });
  };
  const builtIns = BUILT_IN.filter((k) => !hiddenKinds.includes(k));
  // What a buddy shows when its character is removed: the first character still on offer.
  const fallback = (gonePic, goneKind) => {
    const pic = pics.find((p) => p.id !== gonePic);
    const kind = builtIns.find((k) => k !== goneKind);
    return kind ? { kind, pic: undefined } : pic ? { kind: "own", pic: pic.id } : { kind: "blob", pic: undefined };
  };
  const removeKind = (k) => {
    const next = fallback(null, k);
    setHiddenKinds([...hiddenKinds, k]);
    setBuddies((list) => list.map((b) => (b.kind === k ? { ...b, ...next } : b)));
  };
  const removePic = (id) => {
    const next = fallback(id, null);
    setPics((list) => list.filter((p) => p.id !== id));
    setBuddies((list) => list.map((b) => (b.kind === "own" && b.pic === id ? { ...b, ...next } : b)));
    app.notice("Removed. Press Save; the picture then waits 30 days in the Trash.");
  };
  const savedBuddies = () => buddies.map(({ linesText, src, pixel, frames, flip, ...b }) => ({ ...b, lines: lines(linesText) })); // eslint-disable-line no-unused-vars
  const savedPics = () => pics.map((p) => ({ ...p, name: String(p.name || "").trim() || "My picture", src: String(p.src).trim() }));
  useEffect(() => {
    app.previewLook({ ...dash, ...look, buddies: savedBuddies(), buddy_pics: savedPics() });
  }, [look, buddies, pics]); // eslint-disable-line

  const themes = themeList(look);
  const cur = activeTheme(look);
  const curTheme = themes.find((t) => t.id === cur);
  const ts = look.themes[cur] || {};
  const setHy = (patch) => setT({ hy: { ...(ts.hy || {}), ...patch } });
  const setZs = (patch) => setT({ zs: { ...(ts.zs || {}), ...patch } });
  // The theme in use as it shows, with its font style, corners and decoration filled in.
  const flat = flatLook({ ...dash, ...look });
  const curSkin = flat.skin;
  const wallpaper = ts.wallpaper || "";
  const wallDim = ts.wall_dim != null && Number.isFinite(+ts.wall_dim) ? +ts.wall_dim : 25;
  // Changes the theme in use (undefined removes a field).
  const setT = (patch) => setLook((l) => {
    const id = activeTheme(l);
    const t = { ...(l.themes[id] || {}), ...patch };
    Object.keys(t).forEach((k) => t[k] === undefined && delete t[k]);
    return { ...l, themes: { ...l.themes, [id]: t } };
  });
  // A theme's colors as they show: its own colors over the base ones.
  const colorsOf = (id, m) => {
    const t = look.themes[id] || {}, base = themeBase(look, id);
    return [t[`${m}_accent`] || base[m][0], t[`${m}_second`] || base[m][1]];
  };

  const [naming, setNaming] = useState(null);
  const addTheme = () => {
    const name = (naming || "").trim() || "My theme";
    const id = "my-" + Date.now().toString(36);
    const copy = {
      name, base: { light: colorsOf(cur, "light"), dark: colorsOf(cur, "dark") },
      style: flat.style, decor: flat.decor, corners: flat.corners, ...(curSkin ? { skin: curSkin } : {}),
    };
    ["wallpaper", "wall_dim", "backdrop", "light_background", "dark_background"].forEach((k) => { if (ts[k] != null) copy[k] = ts[k]; });
    setLook((l) => ({ ...l, palette: id, themes: { ...l.themes, [id]: copy } }));
    setNaming(null);
  };
  // Classic, Hyper and Zeus are base themes and stay, so each kind always has one to copy.
  const removeTheme = () => {
    if (curTheme?.locked) return app.notice(`${curTheme.name} is a base theme and can't be removed.`);
    setLook((l) => {
      const rest = { ...l.themes };
      delete rest[cur];
      const hidden = curTheme.custom ? l.hidden_themes : [...l.hidden_themes, cur];
      const n = { ...l, themes: rest, hidden_themes: hidden };
      return { ...n, palette: themeList(n)[0].id };
    });
  };

  // Home
  const [title, setTitle] = useState(dash.title && dash.title !== "HOME" ? dash.title : "Home");
  const [tabs, setTabs] = useState(() => tabList(dash));
  const [linkText, setLinkText] = useState(links.map((l) => `${l.name} | ${l.target} | ${l.icon}`).join("\n"));

  // Calendars
  const [gcal, setGcal] = useState((settings.gcal_urls || []).join("\n"));
  const [hw, setHw] = useState((settings.hw_urls || []).join("\n"));

  const finish = () => { app.previewLook(null); close(); };

  const [busy, setBusy] = useState(false);
  const upload = async (file, key, opts) => {
    if (!file) return;
    setBusy(true);
    app.notice("Uploading…");
    try {
      const path = await app.uploadImage(file, opts);
      if (key === "logo") setL({ logo: "img:" + path });
      else if (key === "buddy") addPic(path, file.name);
      else setT({ wallpaper: path });
      app.notice("Uploaded. Press Save to keep it.");
    }
    catch (e) { app.notice("Upload failed: " + e.message); }
    setBusy(false);
  };

  // Zeus' own slideshow. Uploads take a while, so the finished one is added to the theme that was
  // open when it started, with whatever else changed in the meantime kept.
  const [progress, setProgress] = useState(null);
  const setOwn = (id, fn) => setLook((l) => {
    const t = l.themes[id] || {};
    return { ...l, themes: { ...l.themes, [id]: { ...t, zs: { ...(t.zs || {}), own: fn(ownSlides(t.zs)) } } } };
  });
  const addSlide = async (file, kind) => {
    if (!file) return;
    if (busy) return app.notice("Still uploading, one moment…");
    const id = cur;
    setBusy(true);
    setProgress(0);
    try {
      const src = kind === "video" ? await app.uploadVideo(file, setProgress) : await app.uploadImage(file);
      setOwn(id, (own) => [...own, { src, kind }]);
      app.notice("Added. Press Save to keep it.");
    } catch (e) { app.notice("Upload failed: " + e.message); }
    setBusy(false);
    setProgress(null);
  };

  const save = async () => {
    if (busy) return app.notice("Still uploading, one moment…");
    const urls = lines(gcal);
    const hwUrls = lines(hw);
    const urlsChanged = urls.join("\n") !== (settings.gcal_urls || []).join("\n") || hwUrls.join("\n") !== (settings.hw_urls || []).join("\n");
    if (urlsChanged) {
      await app.saveSetting("gcal_urls", urls);
      await app.saveSetting("hw_urls", hwUrls);
      try { localStorage.removeItem("k-gcal-cache"); } catch {}
    }
    const savedThemes = {};
    Object.entries(look.themes).forEach(([id, t]) => {
      const c = { ...t };
      if (typeof c.wallpaper === "string") c.wallpaper = c.wallpaper.trim();
      Object.keys(c).forEach((k) => (c[k] === "" || c[k] == null) && delete c[k]);
      savedThemes[id] = c;
    });
    // Font style, corners and decoration used to be one choice for all plain themes: keep it for them.
    const legacy = { style: dash.style, decor: dash.decor, corners: dash.corners };
    themeList(look).filter((t) => !t.skin).forEach((t) => {
      const c = { ...(savedThemes[t.id] || {}) };
      ["style", "decor", "corners"].forEach((k) => { if (!c[k] && legacy[k]) c[k] = legacy[k]; });
      if (Object.keys(c).length) savedThemes[t.id] = c;
    });
    const next = {
      ...dash, title: title.trim() || "Home", ...savedTabs(dash, tabs),
      links: lines(linkText), ...look, palette: cur, themes: savedThemes,
      buddies: savedBuddies(),
      buddy_pics: savedPics(),
      buddy_hidden: hiddenKinds,
    };
    delete next.last_default; // older: the last plain theme, used by the base picker that is gone
    delete next.buddy; // older single-buddy setting, now in `buddies`
    THEME_FIELDS.forEach((k) => delete next[k]); // older top-level copies, now kept per theme
    if (!next.hidden_themes.length) delete next.hidden_themes;
    if (!next.logo) delete next.logo;
    await app.saveSetting("dashboard", next);
    finish();
    if (urlsChanged) app.loadGcal(true);
  };

  const logo = parseLogo(look.logo);
  const mode = dark ? "dark" : "light";

  return (
    <Modal title="Settings" wide onClose={finish}>
      <div className="b-parts"><Segmented value={part} options={PARTS} onChange={setPart} /></div>

      {part === "look" && (
        <>
          <Field label="Mode" hint="Saved on this device. Every theme has a light and a dark version.">
            <Segmented value={app.mode} options={MODES} onChange={app.setMode} />
          </Field>
          <Field label="Moving background on this device" hint="Hyper's bands and Zeus' gods and lightning. Off saves battery and memory. If the page crashes 3 times in a row right after opening, it turns itself off on that device.">
            <Segmented value={app.motion ? "on" : "off"} options={{ on: "On", off: "Off" }} onChange={(v) => app.setMotion(v === "on")} />
          </Field>

          {/* 1. Pick a theme. Themes are grouped by kind; a new theme is a copy of the one you're on. */}
          <div className="b-msec">Theme</div>
          {Object.entries(BASES).map(([b, name]) => (
            <div key={b} className="b-theme-group">
              <div className="b-theme-kind"><b>{name}</b><span>{KIND_HINT[b]}</span></div>
              <div className="b-swatches">
                {themes.filter((t) => t.baseTheme === b).map((t) => {
                  const [a, c] = colorsOf(t.id, mode);
                  return (
                    <button type="button" key={t.id} className={"b-swatch" + (t.id === cur ? " on" : "")} onClick={() => setL({ palette: t.id })}>
                      <i className={t.skin ? "sw-" + t.skin : ""} style={t.skin ? undefined : { background: `linear-gradient(135deg, ${a} 50%, ${c} 50%)` }} />
                      {t.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {naming != null ? (
            <div className="b-row b-theme-new">
              <input className="b-input" style={{ flex: 1 }} autoFocus maxLength={24} placeholder={`Name (a copy of ${curTheme?.name || "this theme"})`}
                value={naming} onChange={(e) => setNaming(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addTheme(); if (e.key === "Escape") setNaming(null); }} />
              <Btn onClick={addTheme}>Add</Btn>
              <Btn variant="ghost" onClick={() => setNaming(null)}>Cancel</Btn>
            </div>
          ) : (
            <div className="b-row b-theme-tools">
              <Btn icon="plus" variant="ghost" onClick={() => setNaming("")}>New theme (copy of this one)</Btn>
              {curTheme?.locked ? <small className="b-hint">{curTheme.name} is a base theme: it always stays, to copy from.</small>
                : <Btn icon="trash-2" variant="ghost" onClick={removeTheme}>Remove</Btn>}
              {look.hidden_themes.length > 0 && (
                <Btn icon="refresh-cw" variant="ghost" onClick={() => setL({ hidden_themes: [] })}>Bring back removed</Btn>
              )}
            </div>
          )}

          {/* 2. Customize the theme in use. Everything below is saved with this theme only. */}
          <div className="b-msec">Customize · {curTheme?.name}</div>
          {curTheme?.custom && (
            <Field label="Name">
              <input className="b-input" maxLength={24} value={ts.name || ""} onChange={(e) => setT({ name: e.target.value })} />
            </Field>
          )}

          {!curSkin && (
            <>
              <Field label={`Colors (${mode} mode)`} hint="Optional. Switch mode above to set the other one.">
                <div className="b-colors">
                  {COLOR_KEYS.map((k) => {
                    const key = `${mode}_${k}`;
                    return (
                      <label key={key}>
                        <input type="color" value={isHex(ts[key]) ? ts[key] : defaultColor(themeBase(look, cur), mode, k)}
                          onChange={(e) => setT({ [key]: e.target.value })} />
                        {k === "second" ? "second color" : k}
                        {ts[key] && <button type="button" className="b-x" aria-label={"Reset " + k} onClick={() => setT({ [key]: undefined })}><Icon name="x" /></button>}
                      </label>
                    );
                  })}
                </div>
              </Field>
              <Field label="Wallpaper picture" hint="Choose a photo, or paste an https link to one. Without one, a pattern is used.">
                {imgSrc(wallpaper) && <img className="b-thumb wide" src={imgSrc(wallpaper)} alt="" />}
                <div className="b-row">
                  <input className="b-input" style={{ flex: 1 }} value={wallpaper} placeholder="https://…" onChange={(e) => setT({ wallpaper: e.target.value })} />
                  <label className="b-btn">
                    <Icon name="upload" /> Photo
                    <input type="file" accept="image/*" hidden onChange={(e) => upload(e.target.files?.[0], "wallpaper")} />
                  </label>
                  {wallpaper && <Btn variant="ghost" onClick={() => setT({ wallpaper: undefined })}>Remove</Btn>}
                </div>
              </Field>
              {wallpaper ? (
                <Field label={`Soften the picture: ${wallDim}%`}>
                  <input type="range" min="0" max="85" step="5" value={wallDim} onChange={(e) => setT({ wall_dim: +e.target.value })} />
                </Field>
              ) : (
                <Field label="Pattern"><Segmented value={backdropName(ts.backdrop)} options={BACKDROPS} onChange={(v) => setT({ backdrop: v })} /></Field>
              )}
            </>
          )}


          {curSkin === "hyper" && (
            <>
              <Field label="Bands">
                <Segmented value={flat.hy.style} options={HY_STYLES} onChange={(v) => setHy({ style: v })} />
              </Field>
              {flat.hy.style === "ribbon" ? (
                <Field label="Ribbon colors" hint="One per band; each band flashes to the others' colors.">
                  <div className="b-row b-ribbon-cols">
                    {Array.from({ length: Math.max(1, Math.round(flat.hy.count)) }, (_, j) => {
                      const cols = Array.isArray(flat.hy.ribbon) ? flat.hy.ribbon : RIBBON_COLORS;
                      const v = isHex(cols[j]) ? cols[j] : RIBBON_COLORS[j];
                      return (
                        <label key={j} className="b-ribbon-col">
                          <input type="color" value={v} aria-label={`Band ${j + 1} color`}
                            onChange={(e) => { const next = RIBBON_COLORS.map((c, k) => (isHex(cols[k]) ? cols[k] : c)); next[j] = e.target.value; setHy({ ribbon: next }); }} />
                          <span>{j + 1}</span>
                        </label>
                      );
                    })}
                  </div>
                </Field>
              ) : (
                <Field label="Band colors"><Segmented value={flat.hy.colors} options={HY_COLORS} onChange={(v) => setHy({ colors: v })} /></Field>
              )}
              <Field label="Background">
                <div className="b-row">
                  <Segmented value={flat.hy.bg ? "color" : ""} options={{ "": "Theme", color: "Color" }}
                    onChange={(v) => setHy({ bg: v === "color" ? flat.hy.bg || "#f0194d" : "" })} />
                  {flat.hy.bg && <input type="color" className="b-box-pick" style={{ marginTop: 0 }} value={flat.hy.bg} onChange={(e) => setHy({ bg: e.target.value })} aria-label="Background color" />}
                </div>
              </Field>
              <details className="b-fine">
                <summary>Fine-tune the effects</summary>
                <Field label={`Number of bands: ${flat.hy.count}`}>
                  <input type="range" min="1" max="6" step="1" value={flat.hy.count} onChange={(e) => setHy({ count: +e.target.value })} />
                </Field>
                <Field label={`Band speed: ${flat.hy.speed}×`}>
                  <input type="range" min="0.25" max="3" step="0.25" value={flat.hy.speed} onChange={(e) => setHy({ speed: +e.target.value })} />
                </Field>
                <Field label={`Band width: ${flat.hy.width}×`}>
                  <input type="range" min="0.5" max="3" step="0.25" value={flat.hy.width} onChange={(e) => setHy({ width: +e.target.value })} />
                </Field>
                <Field label={`Light streak speed: ${flat.hy.streak}×`}>
                  <input type="range" min="0.25" max="3" step="0.25" value={flat.hy.streak} onChange={(e) => setHy({ streak: +e.target.value })} />
                </Field>
                <Field label={flat.hy.style === "ribbon" ? `Shadow and sheen: ${flat.hy.glow}×` : `Glow: ${flat.hy.glow}×`}>
                  <input type="range" min="0" max="2" step="0.25" value={flat.hy.glow} onChange={(e) => setHy({ glow: +e.target.value })} />
                </Field>
                {flat.hy.style === "ribbon" && (
                  <Field label={`Flash rate: ${flat.hy.flash} per second`}
                    hint={flat.hy.flash > FLASH_WARN
                      ? "⚠ More than 3 flashes a second can trigger seizures in people with photosensitive epilepsy."
                      : "Up to 3 a second is the usual safe limit; higher asks you to confirm."}>
                    <input type="range" min="0.25" max="8" step="0.25" value={flat.hy.flash}
                      onChange={(e) => {
                        const v = +e.target.value;
                        if (v > FLASH_WARN && flat.hy.flash <= FLASH_WARN && !window.confirm("Flashing faster than 3 times a second can trigger seizures in people with photosensitive epilepsy. Turn it up anyway?")) return;
                        setHy({ flash: v });
                      }} />
                  </Field>
                )}
                <Field label="Extras">
                  <div className="b-checks">
                    {[["strobe", "Strobe flashes"], ["scan", "Scan line"], ["grid", "Grid floor"], ["ticker", "Live ticker"]].map(([k, label]) => (
                      <label key={k}><input type="checkbox" checked={!!flat.hy[k]} onChange={(e) => setHy({ [k]: e.target.checked })} />{label}</label>
                    ))}
                  </div>
                </Field>
              </details>
            </>
          )}
          {curSkin === "zeus" && (
            <>
              <Field label="Slideshow" hint={flat.zs.show === "own"
                ? `This theme's own videos and pictures, in order. Videos play muted to the end; MP4 plays on every device. Up to ${MAX_VIDEO_MB} MB per video. Make a copy of the theme for another set.`
                : "The Greek gods. Or switch to Your own to use your videos and pictures."}>
                <Segmented value={flat.zs.show} options={ZS_SHOWS} onChange={(v) => setZs({ show: v })} />
              </Field>
              {flat.zs.show === "own" && (
                <OwnSlidesEditor items={ownSlides(flat.zs)} progress={progress} busy={busy}
                  onAdd={addSlide} onChange={(fn) => setOwn(cur, fn)} />
              )}
              <Field label="Lightning"><Segmented value={flat.zs.lightning} options={ZS_LIGHTNING} onChange={(v) => setZs({ lightning: v })} /></Field>
              <Field label="Pictures change"><Segmented value={flat.zs.slides} options={ZS_SLIDES} onChange={(v) => setZs({ slides: v })} /></Field>
              <Field label="Extras">
                <div className="b-checks">
                  {[["sparks", "Rising sparks"], ["floaters", "Floating bolts"]].map(([k, label]) => (
                    <label key={k}><input type="checkbox" checked={!!flat.zs[k]} onChange={(e) => setZs({ [k]: e.target.checked })} />{label}</label>
                  ))}
                </div>
              </Field>
            </>
          )}

          <Field label="Font style">
            <div className="b-styles">
              {Object.entries(STYLES).map(([k, label]) => (
                <button type="button" key={k} className={`b-style st-${k}` + (flat.style === k ? " on" : "")} onClick={() => setT({ style: k })}>
                  <b>A<em>a</em></b><span>{label}</span>
                </button>
              ))}
            </div>
          </Field>
          <Field label="Corners"><Segmented value={flat.corners} options={CORNERS} onChange={(v) => setT({ corners: v })} /></Field>
          <Field label="Card decoration"><Segmented value={flat.decor} options={DECORS} onChange={(v) => setT({ decor: v })} /></Field>
          <Field label="Cards" hint="Glass lets the background show through; Clear has no box. Each card can also have its own color (pencil > Change).">
            <Segmented value={flat.cards} options={CARD_LOOKS} onChange={(v) => setT({ cards: v })} />
          </Field>

          <div className="b-msec">Logo</div>
          <div className="b-logo-edit">
            <LogoMark logo={look.logo} className="big" />
            <div className="b-logo-opts">
              <div className="b-icons">
                {LOGO_ICONS.map((n) => (
                  <button type="button" key={n} aria-label={n} title={n}
                    className={logo.kind === "icon" && logo.value === n ? "on" : ""} onClick={() => setL({ logo: n === "house" ? "" : "icon:" + n })}>
                    <Icon name={n} />
                  </button>
                ))}
              </div>
              <div className="b-row">
                <input className="b-input" style={{ flex: 1 }} maxLength={3} placeholder="Letters or emoji"
                  value={logo.kind === "text" ? logo.value : ""} onChange={(e) => setL({ logo: e.target.value.trim() ? "text:" + e.target.value : "" })} />
                <label className="b-btn">
                  <Icon name="upload" /> Picture
                  <input type="file" accept="image/*" hidden onChange={(e) => upload(e.target.files?.[0], "logo", { max: 512, png: true })} />
                </label>
              </div>
              <small className="b-hint">Also used as the browser tab and home-screen icon.</small>
            </div>
          </div>

        </>
      )}

      {part === "home" && (
        <>
          <Field label="Title"><input className="b-input" value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
          <Field label="Tabs" hint="Untick to take a tab out of the dock (what's on it is kept). Your own tabs start empty: open one and tap the pencil to fill it.">
            <TabsEditor tabs={tabs} setTabs={setTabs} dash={dash} />
          </Field>
          <Field label="What each tab shows" hint="Move, resize, add or take off cards, widgets and section headings.">
            <div><Btn icon="pencil" onClick={() => { finish(); onCustomize?.(); }}>Customize the open tab</Btn></div>
          </Field>
          <Field label="Life links" hint="One per line:  Name | note path | icon (e.g. wallet, database, star)">
            <textarea className="b-textarea" rows={4} value={linkText} onChange={(e) => setLinkText(e.target.value)} />
          </Field>
        </>
      )}

      {part === "buddy" && (
        <>
          <div className="b-row b-buddy-tabs">
            <Segmented value={String(Math.min(bi, buddies.length - 1))}
              options={Object.fromEntries(buddies.map((b, j) => [String(j), `${b.on ? "" : "○ "}${
                b.kind === "own" ? pics.find((p) => p.id === b.pic)?.name || "Buddy " + (j + 1) : BUDDY_KINDS[b.kind] || "Buddy " + (j + 1)}`]))}
              onChange={(v) => setBi(+v)} />
            {buddies.length < 6 && <Btn icon="plus" variant="ghost" onClick={() => { setBuddies([...buddies, { ...newBuddy(), linesText: BUDDY_LINES.join("\n") }]); setBi(buddies.length); }}>Add buddy</Btn>}
          </div>
          <small className="b-hint">Each buddy has its own look, moves and lines. Pick one above to change it.</small>
          <Field label="Show this buddy" hint="A little character that moves around. Tap it and it says something.">
            <div className="b-row">
              <Segmented value={buddy.on ? "on" : "off"} options={{ on: "On", off: "Off" }} onChange={(v) => setB({ on: v === "on" })} />
              {buddies.length > 1 && (
                <Btn icon="trash-2" variant="ghost" onClick={() => { setBuddies(buddies.filter((_, j) => j !== Math.min(bi, buddies.length - 1))); setBi(0); }}>Remove this buddy</Btn>
              )}
            </div>
          </Field>
          <Field label="Character" hint="Pictures you upload stay here to pick again any time. × removes one (a removed upload waits 30 days in the Trash).">
            <div className="b-buddy-pick">
              {builtIns.map((k) => (
                <div key={k} className={"b-buddy-opt" + (buddy.kind === k ? " on" : "")}>
                  <button type="button" onClick={() => setB({ kind: k, pic: undefined })}>
                    <span className={"b-buddy-mini" + (k.startsWith("pix") ? " pixel" : "")}><Drawn kind={k} /></span>
                    {BUDDY_KINDS[k]}
                  </button>
                  <button type="button" className="b-buddy-x" aria-label={"Remove " + BUDDY_KINDS[k]} title="Remove" onClick={() => removeKind(k)}>
                    <Icon name="x" />
                  </button>
                </div>
              ))}
              {pics.map((p) => (
                <div key={p.id} className={"b-buddy-opt" + (buddy.kind === "own" && buddy.pic === p.id ? " on" : "")}>
                  <button type="button" onClick={() => setB({ kind: "own", pic: p.id })}>
                    <span className={"b-buddy-mini" + (p.pixel ? " pixel" : "")}><img src={imgSrc(p.src)} alt="" /></span>
                    {p.name || "My picture"}
                  </button>
                  <button type="button" className="b-buddy-x" aria-label={"Remove " + (p.name || "picture")} title="Remove" onClick={() => removePic(p.id)}>
                    <Icon name="x" />
                  </button>
                </div>
              ))}
              <label className="b-buddy-opt add">
                <span className="b-buddy-mini"><Icon name="upload" /></span>
                {busy ? "Uploading…" : "Upload"}
                <input type="file" accept="image/*" hidden disabled={busy}
                  onChange={(e) => { upload(e.target.files?.[0], "buddy", { max: 512, png: true, keep: true }); e.target.value = ""; }} />
              </label>
            </div>
            {hiddenKinds.length > 0 && (
              <div><Btn icon="refresh-cw" variant="ghost" onClick={() => setHiddenKinds([])}>Bring back removed built-in characters</Btn></div>
            )}
          </Field>
          {curPic && (
            <Field label="This picture" hint="A PNG with a see-through background looks best; an animated GIF keeps moving (up to about 1 MB). A sprite strip (walking frames side by side) plays while it walks.">
              <input className="b-input" value={curPic.name || ""} maxLength={24} aria-label="Picture name" placeholder="Name" onChange={(e) => setPic({ name: e.target.value })} />
              <label className="b-check"><input type="checkbox" checked={!!curPic.flip} onChange={(e) => setPic({ flip: e.target.checked })} /> Flip it (if it walks backwards)</label>
              <label className="b-check"><input type="checkbox" checked={!!curPic.pixel} onChange={(e) => setPic({ pixel: e.target.checked })} /> Pixel art (keep the pixels sharp)</label>
              <label className="b-check">
                Frames in the picture:
                <input className="b-input" type="number" min="1" max="12" style={{ width: 70 }} value={curPic.frames || 1}
                  onChange={(e) => setPic({ frames: Math.min(12, Math.max(1, +e.target.value || 1)) })} />
                <span>(1 for a normal picture or GIF)</span>
              </label>
            </Field>
          )}
          <Field label="How it moves"><Segmented value={buddy.motion} options={BUDDY_MOTIONS} onChange={(v) => setB({ motion: v })} /></Field>
          <Field label="How restless" hint="Lively and Hyper rest less, hop, dash and jump more.">
            <Segmented value={buddy.activity || "lively"} options={BUDDY_ACTIVITY} onChange={(v) => setB({ activity: v })} />
          </Field>
          <Field label="Speed"><Segmented value={buddy.speed} options={BUDDY_SPEEDS} onChange={(v) => setB({ speed: v })} /></Field>
          <Field label={`Size: ${buddy.size}px`}>
            <input type="range" min="48" max="180" step="4" value={buddy.size} onChange={(e) => setB({ size: +e.target.value })} />
          </Field>
          <Field label="Things it says when tapped" hint="One per line. {due} and {overdue} become your task counts.">
            <textarea className="b-textarea" rows={4} value={buddy.linesText} onChange={(e) => setB({ linesText: e.target.value })} />
          </Field>
        </>
      )}

      {part === "calendars" && (
        <>
          <Field label="Google Calendar (secret iCal links)"
            hint="One per line. Google Calendar > Settings > your calendar > Integrate calendar > Secret address in iCal format. Kept on the server behind your password.">
            <textarea className="b-textarea" rows={3} value={gcal} placeholder="https://calendar.google.com/calendar/ical/…/basic.ics" onChange={(e) => setGcal(e.target.value)} />
          </Field>
          <Field label="Homework (iCal links from your school)" hint="One per line. These show in the Homework card and the calendar.">
            <textarea className="b-textarea" rows={3} value={hw} placeholder="https://…/calendar.ics" onChange={(e) => setHw(e.target.value)} />
          </Field>
        </>
      )}

      {part === "account" && (
        <div className="b-row">
          <Btn icon="trash-2" onClick={() => { finish(); app.openDialog((c) => <TrashDialog close={c} />); }}>
            Trash ({[...app.files.keys()].filter((p) => p.startsWith(".trash/")).length})
          </Btn>
          {app.auth === "in" && <Btn icon="user" onClick={() => { finish(); app.openDialog((c) => <DevicesDialog close={c} />); }}>Signed-in devices</Btn>}
          <Btn icon="download" onClick={() => downloadBackup(app)}>Download backup</Btn>
          <Btn icon="log-out" variant="danger" onClick={async () => { await fetch("/api/logout", { method: "POST" }); location.reload(); }}>Log out</Btn>
        </div>
      )}

      <ModalButtons onCancel={finish} okText="Save" onOk={save} />
    </Modal>
  );
}

// The list of a Zeus theme's own slides: each can move up or down or be taken off (an upload nothing
// uses any more waits 30 days in the Trash).
function OwnSlidesEditor({ items, progress, busy, onAdd, onChange }) {
  const move = (i, d) => onChange((own) => {
    const j = i + d;
    if (j < 0 || j >= own.length) return own;
    const next = [...own];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });
  return (
    <div className="b-field">
      {items.length > 0 && (
        <div className="b-slides">
          {items.map((x, i) => (
            <div key={x.src + i} className="b-slide-row">
              {x.kind === "video"
                ? <video className="b-slide-thumb" src={imgSrc(x.src) + "#t=0.5"} muted playsInline preload="metadata" />
                : <img className="b-slide-thumb" src={imgSrc(x.src)} alt="" loading="lazy" />}
              <span className="b-slide-name"><Icon name={x.kind === "video" ? "film" : "image"} /><span>{x.src.replace(/^Attachments\/\d+-/, "")}</span></span>
              <IconBtn icon="arrow-up" label="Earlier" onClick={() => move(i, -1)} />
              <IconBtn icon="arrow-down" label="Later" onClick={() => move(i, 1)} />
              <IconBtn icon="x" label="Take off" onClick={() => onChange((own) => own.filter((_, j) => j !== i))} />
            </div>
          ))}
        </div>
      )}
      {!items.length && <small>Nothing in it yet, so the gods show until you add something.</small>}
      <div className="b-row">
        <label className={"b-btn" + (busy ? " disabled" : "")}>
          <Icon name="film" /> {progress != null ? `Uploading ${Math.round(progress * 100)}%` : "Add video"}
          <input type="file" accept="video/mp4,video/webm,video/quicktime,.mp4,.m4v,.webm,.mov" hidden disabled={busy}
            onChange={(e) => { onAdd(e.target.files?.[0], "video"); e.target.value = ""; }} />
        </label>
        <label className={"b-btn" + (busy ? " disabled" : "")}>
          <Icon name="upload" /> Add picture
          <input type="file" accept="image/*" hidden disabled={busy}
            onChange={(e) => { onAdd(e.target.files?.[0], "picture"); e.target.value = ""; }} />
        </label>
      </div>
    </div>
  );
}

function downloadBackup({ files, settings }) {
  const data = {
    exported: new Date().toISOString(),
    files: [...files].map(([path, f]) => ({ path, content: f.content, mtime: f.mtime })),
    settings, // everything: look, widgets, calendar links, homework ticks
  };
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  a.download = `dashboard-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// The tab list as saved: tabs in the dock, own tabs' names and icons, renamed built-in tabs.
// Layouts of deleted own tabs are dropped.
function savedTabs(dash, rows) {
  const shown = rows.filter((t) => t.shown && t.name.trim()).map((t) => t.id);
  const tab_info = {};
  for (const t of rows) {
    const name = t.name.trim() || (t.custom ? "Tab" : BUILTIN_DEFAULTS[t.id][1]);
    const head = { ...(t.head ? { head: t.head } : {}), ...(t.sub ? { sub: t.sub } : {}) };
    if (t.custom || name !== BUILTIN_DEFAULTS[t.id][1] || t.icon !== BUILTIN_DEFAULTS[t.id][0] || t.head || t.sub) tab_info[t.id] = { name, icon: t.icon, ...head };
  }
  const layout = { ...(dash.layout || {}) };
  for (const id of Object.keys(layout)) if (!rows.some((t) => t.id === id)) delete layout[id];
  return { tabs: shown.length ? shown : ["overview"], tab_info, layout };
}

function TabsEditor({ tabs, setTabs, dash }) {
  const [iconsFor, setIconsFor] = useState(null);
  const set = (i, patch) => setTabs(tabs.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  const move = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= tabs.length) return;
    const next = [...tabs];
    [next[i], next[j]] = [next[j], next[i]];
    setTabs(next);
  };
  const remove = (i) => {
    const t = tabs[i];
    const n = getLayout(dash, t.id).length;
    if (n && !window.confirm(`Delete the tab "${t.name}" and the ${n} thing${n === 1 ? "" : "s"} on it?`)) return;
    setTabs(tabs.filter((_, j) => j !== i));
  };
  const add = () => {
    setTabs([...tabs, { id: "t-" + Date.now().toString(36), name: "New tab", icon: "star", custom: true, shown: true }]);
    setIconsFor(tabs.length);
  };
  return (
    <div className="b-tabs-ed">
      {tabs.map((t, i) => (
        <div key={t.id}>
          <div className="b-tabs-row">
            <input type="checkbox" checked={t.shown} aria-label={"Show " + t.name + " in the dock"} onChange={(e) => set(i, { shown: e.target.checked })} />
            <button type="button" className="b-icon-btn sm" aria-label="Choose icon" title="Choose icon" onClick={() => setIconsFor(iconsFor === i ? null : i)}>
              <Icon name={t.icon} />
            </button>
            <input className="b-input" value={t.name} maxLength={20} aria-label="Tab name" onChange={(e) => set(i, { name: e.target.value })} />
            <IconBtn icon="arrow-up" label="Move up" className="sm" onClick={() => move(i, -1)} />
            <IconBtn icon="arrow-down" label="Move down" className="sm" onClick={() => move(i, 1)} />
            {t.custom ? <IconBtn icon="trash-2" label="Delete tab" className="sm b-del" onClick={() => remove(i)} /> : <span className="b-tabs-gap" />}
          </div>
          {iconsFor === i && (
            <div className="b-icons">
              {TAB_ICONS.map((n) => (
                <button type="button" key={n} aria-label={n} title={n} className={t.icon === n ? "on" : ""}
                  onClick={() => { set(i, { icon: n }); setIconsFor(null); }}>
                  <Icon name={n} />
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
      <div><Btn icon="plus" onClick={add}>New tab</Btn></div>
    </div>
  );
}
