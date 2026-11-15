// Look of the dashboard. Everything is picked in Settings > Look and saved in the `dashboard`
// setting, except light/dark, which is saved on each device.
//
//   theme      a palette (Classic, Sage…), one of your own, or a special theme (Hyper, Zeus)
//   per theme  colors, wallpaper or pattern, font style, corners and card decoration
//   mode       light or dark; every theme has both
//   logo       one for all themes

// Color palettes: [main accent, second color] for light and dark mode.
export const PALETTES = {
  terracotta: { light: ["#e0561f", "#9cc9dd"], dark: ["#ff7a45", "#8fc3d9"] },
  sage: { light: ["#5f7a3f", "#d9c27a"], dark: ["#a3bf7c", "#e3cc85"] },
  ocean: { light: ["#1f6fb2", "#e7a36b"], dark: ["#6cb2ec", "#f0b483"] },
  rose: { light: ["#c23b5d", "#c9b8e6"], dark: ["#f07a98", "#c4b2e8"] },
  plum: { light: ["#6b3fa0", "#e6b87a"], dark: ["#b392e6", "#ecc28a"] },
  forest: { light: ["#2f6b4f", "#e8b04a"], dark: ["#6cc59a", "#f0c46a"] },
  sunset: { light: ["#d9480f", "#f2a6c4"], dark: ["#ff8a4c", "#f5b3cf"] },
  lagoon: { light: ["#0f8b8d", "#f4a259"], dark: ["#4fd1c5", "#f6b77a"] },
  cherry: { light: ["#b5172f", "#f5c86a"], dark: ["#ff6b81", "#f7d07f"] },
  mono: { light: ["#1d1a17", "#b9b0a7"], dark: ["#f2ede8", "#7d746c"] },
};
export const DEFAULT_BG = { light: "#ece7e1", dark: "#171513" };

// Font styles (fonts are loaded in app/layout.jsx). Any theme can use any of them.
export const STYLES = {
  studio: "Studio",
  modern: "Modern",
  rounded: "Rounded",
  mono: "Typewriter",
  neon: "Neon",
  grotesk: "Grotesk",
};
export const CORNERS = { round: "Round", soft: "Soft", square: "Square" };
// Card decoration. Any theme can use any of them.
export const DECORS = { ribbon: "Ribbon", glow: "Glow", sticker: "Sticker", chase: "Chase", greek: "Greek", plain: "Plain" };
// Background pattern, used when there is no wallpaper picture.
export const BACKDROPS = { glow: "Glow", plain: "Plain", mesh: "Mesh", dots: "Dots", grid: "Grid" };
export const MODES = { light: "Light", dark: "Dark" };

// Special themes: their colors and moving background are drawn by CSS (body.skin-…) and
// components/SkinBackdrop.jsx, in a light and a dark version. They start with their own font,
// corners and card decoration, which can be changed like any theme's.
export const SKIN_THEMES = {
  hyper: { name: "Hyper", base: { light: ["#6a5cff", "#00a8d6"], dark: ["#8f86ff", "#22d3ff"] }, style: "neon", decor: "chase", corners: "round" },
  zeus: { name: "Zeus", base: { light: ["#0000f2", "#d6ff3a"], dark: ["#d6ff3a", "#7a7aff"] }, style: "grotesk", decor: "greek", corners: "soft" },
};
// What a plain palette theme starts with.
const CLASSIC = { style: "studio", decor: "ribbon", corners: "round" };

// The three kinds of theme. Each has a base theme that can't be removed (Classic, Hyper, Zeus).
export const CLASSIC_BASE = "terracotta";
export const BASES = { default: "Classic", hyper: "Hyper", zeus: "Zeus" };

// How cards look in a theme (each card can also set its own, in Customize).
export const CARD_LOOKS = { solid: "Solid", glass: "Glass", clear: "Clear" };

// Hyper's adjustable effects (per theme). Speeds are multipliers.
export const HY_COLORS = { neon: "Neon", fire: "Fire", ice: "Ice", toxic: "Toxic", mono: "Mono" };
// Band style: thin glowing light trails, or wide satin ribbons with shading and a shadow.
export const HY_STYLES = { trail: "Neon trail", ribbon: "Ribbon" };
// bg: "" uses the theme's own background (dark or light); a color fills it instead.
// ribbon: each ribbon band's own color (it flashes to the other bands' colors); flash: flashes per
// second per band (above 3 Settings warns about photosensitive epilepsy).
export const RIBBON_COLORS = ["#ffffff", "#ff1f4b", "#1f5bff", "#ffd000", "#16e07a", "#a35cff"];
export const FLASH_WARN = 3;
export const HY_DEFAULTS = {
  style: "trail", speed: 1, width: 1, count: 4, streak: 1, glow: 1, colors: "neon", bg: "", strobe: true, scan: true, grid: true, ticker: true,
  flash: 1, ribbon: RIBBON_COLORS,
};
// Zeus' adjustable effects (per theme).
export const ZS_LIGHTNING = { off: "Off", some: "Some", storm: "Storm" };
export const ZS_SLIDES = { slow: "Slow", normal: "Normal", fast: "Fast" };
// Slideshow: the Greek gods (built in), or the theme's own set of uploaded videos and pictures
// (own: [{ src: "Attachments/…", kind: "video" | "picture" }], played in order).
export const ZS_SHOWS = { gods: "Greek gods", own: "Your own" };
export const ZS_DEFAULTS = { lightning: "some", slides: "normal", sparks: true, floaters: true, show: "gods", own: [] };
export const ownSlides = (zs = {}) => (Array.isArray(zs.own) ? zs.own : [])
  .filter((x) => x && typeof x.src === "string" && x.src && (x.kind === "video" || x.kind === "picture"));

export const isHex = (h) => /^#[0-9a-f]{6}$/i.test(String(h || ""));
const pick = (obj, v, d) => (String(v || "").toLowerCase() in obj ? String(v).toLowerCase() : d);
export const styleName = (s) => pick(STYLES, s, "studio");
export const cornerName = (c) => pick(CORNERS, c, "round");
export const backdropName = (b) => pick(BACKDROPS, b, "glow");
export const decorName = (d) => pick(DECORS, d, "ribbon");
export const modeName = (m) => (m === "dark" ? "dark" : "light");

/* ---------- Themes ----------
   Saved in the `dashboard` setting as
     palette: id of the theme in use
     themes: { [id]: { name?, base?, skin?, light_accent, …, wallpaper, wall_dim, backdrop, style, decor, corners } }
     hidden_themes: ids of built-in themes that were removed
   Built-in themes take their base colors from PALETTES or SKIN_THEMES; added ones carry `base`
   and `name` (and `skin` when copied from Hyper or Zeus).
   Older settings kept some of these at the top level: colors and background for the theme in use,
   and font style, corners and decoration for all plain themes. They are still read that way. */
export const THEME_FIELDS = [
  "light_accent", "light_second", "light_background", "dark_accent", "dark_second", "dark_background",
  "wallpaper", "wall_dim", "backdrop", "style", "decor", "corners", "cards", "hy", "zs",
];
const legacyTheme = (dash) => {
  const t = {};
  THEME_FIELDS.forEach((k) => { if (dash[k] != null && dash[k] !== "") t[k] = dash[k]; });
  return t;
};

// The themes on offer, in order: built-ins (minus removed ones), then added ones.
export function themeList(dash = {}) {
  const themes = dash.themes || {};
  const hidden = Array.isArray(dash.hidden_themes) ? dash.hidden_themes : [];
  // The "terracotta" palette is the Classic base theme, shown as "Classic": always on offer, like Hyper and Zeus, so there is always one to copy.
  const list = Object.keys(PALETTES).filter((id) => id === CLASSIC_BASE || !hidden.includes(id))
    .map((id) => ({ id, name: id === CLASSIC_BASE ? "Classic" : id, base: PALETTES[id], custom: false, skin: null, locked: id === CLASSIC_BASE }));
  // Hyper and Zeus are base themes: always on offer.
  Object.entries(SKIN_THEMES).forEach(([id, t]) => list.push({ id, name: t.name, base: t.base, custom: false, skin: id, locked: true }));
  Object.entries(themes).forEach(([id, t]) => {
    if (!(id in PALETTES) && !(id in SKIN_THEMES) && t?.base?.light && t?.base?.dark) {
      list.push({ id, name: t.name || "My theme", base: t.base, custom: true, skin: t.skin in SKIN_THEMES ? t.skin : null });
    }
  });
  return list.map((t) => ({ ...t, baseTheme: t.skin || "default" }));
}

// The id of the theme in use (falls back to the first one on offer).
export function activeTheme(dash = {}) {
  const list = themeList(dash);
  const id = String(dash.palette || "");
  return (list.find((t) => t.id === id || t.id === id.toLowerCase()) || list[0] || { id: "terracotta" }).id;
}

// One theme's saved settings (colors, wallpaper, pattern).
export function themeSettings(dash = {}, id = activeTheme(dash)) {
  if (dash.themes) return dash.themes[id] || {};
  return id === activeTheme(dash) ? legacyTheme(dash) : {};
}

export const themeBase = (dash, id) => (PALETTES[id] || SKIN_THEMES[id]?.base || dash.themes?.[id]?.base) || PALETTES.terracotta;
// Hyper or Zeus if the theme is (or was copied from) one of them, else null.
export const skinOf = (dash, id = activeTheme(dash)) =>
  id in SKIN_THEMES ? id : dash.themes?.[id]?.skin in SKIN_THEMES ? dash.themes[id].skin : null;
// Font style, corners and decoration a theme starts with.
export const themeDefaults = (dash, id) => {
  const skin = skinOf(dash, id);
  if (skin) return SKIN_THEMES[skin];
  // Plain themes: the older all-themes choice, if there was one.
  return { style: dash.style || CLASSIC.style, decor: dash.decor || CLASSIC.decor, corners: dash.corners || CLASSIC.corners };
};

// The dashboard setting with the theme in use folded in at the top level,
// which is what applyLook, the wallpaper and the logo read.
export function flatLook(dash = {}) {
  const id = activeTheme(dash);
  const def = themeDefaults(dash, id);
  const out = { ...dash, palette: id, base: themeBase(dash, id), skin: skinOf(dash, id) };
  THEME_FIELDS.forEach((k) => delete out[k]);
  const t = themeSettings(dash, id);
  return {
    ...out, ...t, style: t.style || def.style, decor: t.decor || def.decor, corners: t.corners || def.corners,
    cards: CARD_LOOKS[t.cards] ? t.cards : "solid",
    hy: { ...HY_DEFAULTS, ...(t.hy || {}) }, zs: { ...ZS_DEFAULTS, ...(t.zs || {}) },
  };
}

// Moves older top-level theme fields into `themes`, so each theme keeps its own.
export function withThemes(dash = {}) {
  if (dash.themes) return dash;
  const id = activeTheme(dash);
  const out = { ...dash, palette: id, themes: { [id]: legacyTheme(dash) } };
  THEME_FIELDS.forEach((k) => delete out[k]);
  return out;
}

export const defaultColor = (base, mode, key) =>
  key === "background" ? DEFAULT_BG[mode] : base[mode][key === "accent" ? 0 : 1];

// Body classes for the special theme, style, corners, backdrop and decoration. Cached on the
// device so the page draws with the right look before the settings arrive (see layout.jsx).
// `look` is a flatLook().
export const lookClasses = (look = {}) => [
  ...(look.skin ? [`skin-${look.skin}`] : []),
  `st-${styleName(look.style)}`, `cr-${cornerName(look.corners)}`, `bd-${backdropName(look.backdrop)}`, `dc-${decorName(look.decor)}`,
  ...(look.cards && look.cards !== "solid" ? [`cb-${look.cards}`] : []),
];

// Applies the whole look to <body>: light/dark, palette, custom colors, style classes.
// `raw` is the dashboard setting (or the settings panel's unsaved preview of it).
export function applyLook(raw = {}, dark = false) {
  const dash = flatLook(raw);
  const skin = dash.skin;
  const body = document.body;
  body.classList.toggle("theme-dark", dark);
  body.classList.toggle("theme-light", !dark);
  [...body.classList].forEach((c) => /^(skin|st|cr|bd|dc|cb)-/.test(c) && body.classList.remove(c));
  const cls = lookClasses(dash);
  body.classList.add(...cls);
  store.set("k-look", cls.join(" "));

  const mode = dark ? "dark" : "light";
  const [a, b] = dash.base[mode];
  const st = body.style;
  if (skin) {
    // Hyper and Zeus set every color in CSS; drop any inline ones.
    ["--accent", "--accent2", "--bg", "--tile", "--tile-2", "--tile-3"].forEach((v) => st.removeProperty(v));
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = getComputedStyle(body).getPropertyValue("--bg").trim();
    return;
  }
  st.setProperty("--accent", isHex(dash[`${mode}_accent`]) ? dash[`${mode}_accent`] : a);
  st.setProperty("--accent2", isHex(dash[`${mode}_second`]) ? dash[`${mode}_second`] : b);
  ["--bg", "--tile", "--tile-2", "--tile-3"].forEach((v) => st.removeProperty(v));
  const bg = dash[`${mode}_background`];
  if (isHex(bg)) {
    const mix = (c, p) => `color-mix(in srgb, ${bg}, ${c} ${p}%)`;
    st.setProperty("--bg", bg);
    st.setProperty("--tile", dark ? mix("white", 5) : mix("white", 70));
    st.setProperty("--tile-2", dark ? mix("white", 9) : mix("black", 3));
    st.setProperty("--tile-3", dark ? mix("white", 14) : mix("black", 7));
  }
  const dim = Number.isFinite(+dash.wall_dim) ? Math.max(0, Math.min(85, +dash.wall_dim)) : 25;
  st.setProperty("--wall-dim", dim + "%");
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = getComputedStyle(body).getPropertyValue("--bg").trim() || DEFAULT_BG[mode];
}

// Picture paths are either https links or uploads stored under /api/blob/.
export const imgSrc = (v) => (!v ? null : /^(https?:|data:)/.test(v) ? v : "/api/blob/" + encodeURIComponent(v));

export const store = {
  get: (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
};
