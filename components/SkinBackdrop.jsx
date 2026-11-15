"use client";
// Moving backgrounds of the Hyper and Zeus base themes (and themes made from them), in light and dark.
// The motion is CSS (app/globals.css, "Moving backgrounds"); this only draws the layers. Everything
// moves by transform and opacity only, so phones can do it without redrawing. Nothing here asks the
// server for anything but your own slideshow: Zeus' gods are plain files in /public/skins/zeus, Hyper's
// ticker uses your tasks.
import { useEffect, useMemo, useRef, useState } from "react";
import { RIBBON_COLORS, imgSrc, ownSlides } from "@/lib/theme";
import { useApp } from "./AppProvider";
import { useBoard } from "./board";

const ZEUS_PICS = ["throne", "god-1", "god-2", "god-3", "god-4", "god-5", "god-6"];
// Where each picture drifts while it slowly zooms in (x, y), so no two slides move alike.
const DRIFT = [["0%", "-4%"], ["-4%", "2%"], ["4%", "-2%"], ["-3%", "-3%"], ["3%", "3%"], ["-4%", "-1%"], ["4%", "1%"]];

export default function SkinBackdrop() {
  const { skin, flat, motion } = useApp();
  if (!motion) return null; // switched off on this device (Settings > Look)
  if (skin === "zeus") return <ZeusBackdrop zs={flat.zs} />;
  if (skin === "hyper") return <HyperBackdrop hy={flat.hy} />;
  return null;
}

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// A full-screen picture drawn ONCE into a small canvas that the screen stretches. Phones keep a
// moving layer in graphics memory at the screen's full pixel density: a 1600 x 1000 picture on a
// 3x iPhone screen costs ~58 MB per layer, and a dozen of them crashed Safari. A canvas layer only
// costs its own pixels (800 x 500 = 1.6 MB), and these soft shapes don't need more.
function Painted({ src, className, style, w = 1600, h = 1000 }) {
  const ref = useRef();
  useEffect(() => {
    const cv = ref.current;
    if (!cv || !src) return;
    const big = window.innerWidth > 900;
    cv.width = big ? 1200 : 800;
    cv.height = Math.round(cv.width * h / w);
    let live = true;
    const img = new Image();
    img.onload = () => { if (live) cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height); };
    img.src = src;
    return () => { live = false; };
  }, [src, w, h]);
  return <canvas ref={ref} className={className} style={{ ...style, width: w + "px", height: h + "px" }} />;
}

/* ---------- Zeus ---------- */

// Lightning bolts: where (x), how big, and their own rhythm, so they strike in different places.
const BOLTS = [
  { x: "12%", w: 70, h: "62vh", t: 7, d: 0, path: "M34 0 L18 110 L34 112 L10 300 L44 140 L28 138 L48 0Z" },
  { x: "78%", w: 60, h: "52vh", t: 9, d: -3, path: "M30 0 L40 90 L26 92 L46 210 L32 212 L50 300 L14 180 L28 178 L8 80 L22 78Z" },
  { x: "46%", w: 46, h: "40vh", t: 11, d: -6.5, path: "M28 0 L16 70 L30 74 L12 160 L26 162 L6 300 L42 150 L26 148 L44 60 L32 58 L40 0Z" },
  { x: "30%", w: 38, h: "34vh", t: 13, d: -9, path: "M24 0 L34 100 L20 104 L38 200 L26 204 L40 300 L8 190 L22 186 L6 90 L18 86Z" },
  { x: "90%", w: 34, h: "44vh", t: 8.5, d: -5, path: "M32 0 L14 120 L30 124 L18 300 L46 110 L30 108 L42 0Z" },
];
const SLIDE_STEP = { slow: 9, normal: 6, fast: 4 }; // seconds each picture shows
// Rays of light: soft wedges fading out from the middle, as a picture (drawn once, small).
const RAYS = "data:image/svg+xml," + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000"><defs><radialGradient id="f"><stop offset=".1" stop-color="#fff" stop-opacity=".16"/><stop offset=".62" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>` +
  Array.from({ length: 26 }, (_, k) => {
    const a = (k / 26) * Math.PI * 2, b = a + 0.12;
    return `<path d="M500 500 L${(500 + 700 * Math.cos(a)).toFixed(0)} ${(500 + 700 * Math.sin(a)).toFixed(0)} L${(500 + 700 * Math.cos(b)).toFixed(0)} ${(500 + 700 * Math.sin(b)).toFixed(0)}Z" fill="url(#f)"/>`;
  }).join("") + `</svg>`);

// The gods' portraits cross-fade one after another, each panning and zooming, while clouds drift,
// rays of light turn, sparks rise, lime bolts float about, and lightning strikes here and there.
// Adjustable per theme (Settings > Look > Zeus effects): lightning, slide speed, sparks, floating bolts.
function ZeusBackdrop({ zs }) {
  const step = SLIDE_STEP[zs.slides] || 6;
  // Phones get a lighter version (fewer bolts, sparks and floating bolts, one cloud layer):
  // every moving layer costs graphics memory, which phones have little of.
  const phone = typeof window !== "undefined" && window.innerWidth < 820;
  const all = phone ? BOLTS.slice(0, 3) : BOLTS;
  const bolts = zs.lightning === "off" ? [] : zs.lightning === "storm" ? all.map((b) => ({ ...b, t: b.t * 0.45 })) : all;
  // Slideshow: the gods, or the theme's own videos and pictures (the gods if that set is empty).
  const own = zs.show === "own" ? ownSlides(zs) : [];
  return (
    <div className="zs-bg" aria-hidden="true" style={{ "--zs-step": step + "s", "--zs-cycle": step * ZEUS_PICS.length + "s" }}>
      {own.length ? <OwnSlides items={own} step={step} /> : ZEUS_PICS.map((name, i) => (
        <img key={name} className="zs-slide" src={`/skins/zeus/${name}.webp`} alt="" draggable={false} decoding="async"
          style={{ "--i": i, "--dx": DRIFT[i][0], "--dy": DRIFT[i][1] }} />
      ))}
      <Painted className="zs-rays" src={RAYS} w={1000} h={1000} />
      <div className="zs-cloud c1" />
      {!phone && <div className="zs-cloud c2" />}
      <div className="zs-lines" />
      <div className="zs-veil" />
      {zs.sparks && (
        <div className="zs-sparks">
          {Array.from({ length: phone ? 6 : 12 }, (_, i) => (
            <i key={i} style={{ left: `${(i * 37) % 100}%`, "--t": `${6 + ((i * 7) % 8)}s`, "--w": `${-((i * 1.7) % 12)}s`, "--s": `${2 + (i % 3)}px` }} />
          ))}
        </div>
      )}
      {zs.floaters && (
        <div className="zs-float">
          {Array.from({ length: phone ? 3 : 6 }, (_, i) => (
            <i key={i} style={{ left: `${(i * 23 + 6) % 94}%`, top: `${(i * 41 + 12) % 86}%`, "--z": `${16 + (i % 4) * 6}px`, "--t": `${3 + (i % 4)}s`, "--w": `${-i * 0.7}s` }} />
          ))}
        </div>
      )}
      {bolts.map((b, i) => (
        <svg key={i} className="zs-bolt" viewBox="0 0 60 300" preserveAspectRatio="none"
          style={{ "--bx": b.x, "--bw": b.w + "px", "--bh": b.h, "--bt": b.t + "s", "--bd": b.d + "s" }}>
          <path d={b.path} />
        </svg>
      ))}
      {bolts.length > 0 && <div className="zs-flash" style={{ "--bt": bolts[0].t + "s", "--bd": bolts[0].d + "s" }} />}
    </div>
  );
}

// Your own slideshow: each video plays to its end, each picture shows for the "Pictures change" time,
// then the next one fades in over it. Only the slide showing (and, for a second, the one under it)
// is on the page: a playing video is a full-screen layer in graphics memory, so they never pile up.
function OwnSlides({ items, step }) {
  const n = items.length;
  const [s, setS] = useState({ i: 0, k: 0, prev: null });
  const fails = useRef(0);
  const next = () => setS((c) => ({ i: (c.i + 1) % n, k: c.k + 1, prev: { i: c.i, k: c.k } }));
  const cur = { i: s.i % n, k: s.k };
  const item = items[cur.i];
  // The one under it is dropped once the new one has faded in.
  useEffect(() => {
    if (!s.prev) return;
    const t = setTimeout(() => setS((c) => (c.k === s.k ? { ...c, prev: null } : c)), 1600);
    return () => clearTimeout(t);
  }, [s.k]); // eslint-disable-line
  // Pictures move on after the chosen time; videos when they end (see Slide).
  useEffect(() => {
    if (n < 2 || item.kind !== "picture") return;
    const t = setTimeout(next, step * 1000);
    return () => clearTimeout(t);
  }, [s.k, n, item.kind, step]); // eslint-disable-line
  const failed = () => {
    // A video that won't load (deleted, or a format this device can't play) is skipped,
    // unless none of them load, so it doesn't spin round for ever.
    fails.current += 1;
    if (n > 1 && fails.current < n) setTimeout(next, 800);
  };
  const layers = [s.prev && s.prev.k !== cur.k ? { ...s.prev, i: s.prev.i % n } : null, cur].filter(Boolean);
  return layers.map((l) => (
    <Slide key={l.k} item={items[l.i]} top={l.k === cur.k} loop={n === 1} step={step}
      onEnd={() => l.k === s.k && n > 1 && next()} onFail={() => l.k === s.k && failed()} onPlay={() => { fails.current = 0; }} />
  ));
}

function Slide({ item, top, loop, step, onEnd, onFail, onPlay }) {
  const ref = useRef();
  useEffect(() => {
    const v = ref.current;
    if (item.kind !== "video" || !v) return;
    // Phones only play videos by themselves when they are muted (set here as well as on the tag,
    // which some iPhones need). Low Power Mode still refuses: then it moves on like a picture.
    v.muted = true;
    v.defaultMuted = true;
    v.setAttribute("muted", "");
    let t;
    v.play()?.catch(() => { if (!loop) t = setTimeout(onEnd, step * 1000); });
    return () => clearTimeout(t);
  }, [item.src]); // eslint-disable-line
  const cls = "zs-own" + (top ? " top" : "");
  if (item.kind === "picture") return <img className={cls + " pic"} src={imgSrc(item.src)} alt="" draggable={false} decoding="async" onError={onFail} />;
  return (
    <video ref={ref} className={cls} src={imgSrc(item.src)} autoPlay muted playsInline loop={loop} preload="auto"
      disablePictureInPicture disableRemotePlayback onEnded={onEnd} onError={onFail} onPlaying={onPlay} />
  );
}

/* ---------- Hyper ---------- */

// Bands of light on a 1600 x 1000 stage. Each swings (or circles), cross-fades between two
// color sets, and has streaks of light riding along it. Up to six; "count" picks how many.
const BANDS = [
  { d: "M-300 860 C 250 260, 1150 160, 1900 700", a: ["#22d3ff", "#6b7bff", "#ff3fd0"], b: ["#ff2d55", "#ff8a3d", "#ffd23f"], w: 40, move: "swing", t: 11, hue: 9, run: 2.6 },
  { d: "M-300 180 C 380 760, 1080 920, 1900 260", a: ["#ff3fd0", "#a35cff", "#22d3ff"], b: ["#22d3ff", "#3ef0b0", "#ff2d55"], w: 34, move: "swing2", t: 14, hue: 12, run: 3.2 },
  { d: "M250 -200 C 520 420, 1150 560, 1450 1200", a: ["#ff2d55", "#ff3fd0", "#a35cff"], b: ["#3ef0b0", "#22d3ff", "#6b7bff"], w: 26, move: "sway", t: 9, hue: 7, run: 2.1 },
  { d: "M800 500 m -620 0 a 620 300 0 1 0 1240 0 a 620 300 0 1 0 -1240 0", a: ["#ffb547", "#ff2d55", "#6b7bff"], b: ["#a35cff", "#22d3ff", "#ff3fd0"], w: 20, move: "orbit", t: 26, hue: 10, run: 4 },
  { d: "M-300 620 C 420 470, 1080 980, 1900 880", a: ["#a35cff", "#ff5fa8", "#ffb547"], b: ["#22d3ff", "#ff2d55", "#ffd23f"], w: 24, move: "swing", t: 16, hue: 11, run: 2.8 },
  { d: "M1400 -200 C 1100 380, 500 600, 150 1200", a: ["#3ef0b0", "#22d3ff", "#ff3fd0"], b: ["#ff2d55", "#a35cff", "#22d3ff"], w: 22, move: "sway", t: 12, hue: 8, run: 2.4 },
];
// Color sets other than Neon: each band gets them in a different order.
const COLOR_SETS = {
  fire: [["#ff2d55", "#ff6a00", "#ffd23f"], ["#ff3b3b", "#ff9a3d", "#fff1a8"]],
  ice: [["#22d3ff", "#7ae7ff", "#ffffff"], ["#3b82ff", "#22d3ff", "#c8f7ff"]],
  toxic: [["#3ef0b0", "#b6ff3a", "#22d3ff"], ["#00ff88", "#d6ff3a", "#3ef0b0"]],
  mono: [["#ffffff", "#c8cbe0", "#ffffff"], ["#e8eaff", "#ffffff", "#aab0c8"]],
};
const rot = (cs, k) => cs.map((_, j) => cs[(j + k) % cs.length]);
const bandColors = (band, i, set) => (COLOR_SETS[set] ? [rot(COLOR_SETS[set][0], i), rot(COLOR_SETS[set][1], i + 1)] : [band.a, band.b]);

// A band as a light trail: a wide soft glow, a tighter glow, five fine strands and a white-hot
// core, all fading out at the ends. Drawn once as a picture; only moved and faded afterwards.
function bandSvg(band, colors, key, width, glow) {
  const fade = (cs, a) => [
    `<stop offset="0" stop-color="${cs[0]}" stop-opacity="0"/>`,
    `<stop offset=".14" stop-color="${cs[0]}" stop-opacity="${a}"/>`,
    `<stop offset=".5" stop-color="${cs[1]}" stop-opacity="${a}"/>`,
    `<stop offset=".86" stop-color="${cs[2]}" stop-opacity="${a}"/>`,
    `<stop offset="1" stop-color="${cs[2]}" stop-opacity="0"/>`,
  ].join("");
  const w = band.w * width;
  const strands = [-2, -1, 0, 1, 2].map((k) =>
    `<path d="${band.d}" transform="translate(0 ${(k * w * 0.16).toFixed(1)})" fill="none" stroke="url(#c${key})" stroke-width="${((k === 0 ? 2.4 : 1.4) * Math.sqrt(width)).toFixed(2)}" opacity="${k === 0 ? 1 : 0.75}"/>`).join("");
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000">` +
    `<defs><linearGradient id="c${key}" x1="0" y1="0" x2="1" y2="0">${fade(colors, 1)}</linearGradient>` +
    `<linearGradient id="h${key}" x1="0" y1="0" x2="1" y2="0">${fade(["#fff", "#fff", "#fff"], 0.9)}</linearGradient>` +
    `<filter id="s${key}" x="-20%" y="-30%" width="140%" height="160%"><feGaussianBlur stdDeviation="30"/></filter>` +
    `<filter id="t${key}" x="-20%" y="-30%" width="140%" height="160%"><feGaussianBlur stdDeviation="7"/></filter></defs>` +
    `<path d="${band.d}" fill="none" stroke="url(#c${key})" stroke-width="${w * 3}" filter="url(#s${key})" opacity="${Math.min(1, 0.32 * glow).toFixed(2)}"/>` +
    `<path d="${band.d}" fill="none" stroke="url(#c${key})" stroke-width="${w * 0.9}" filter="url(#t${key})" opacity="${Math.min(1, 0.6 * glow).toFixed(2)}"/>` +
    strands +
    `<path d="${band.d}" fill="none" stroke="url(#h${key})" stroke-width="${(1.6 * Math.sqrt(width)).toFixed(2)}"/>` +
    `</svg>`;
  return "data:image/svg+xml," + encodeURIComponent(svg);
}

/* Ribbon style: solid bands (100% opaque) whipping around fast, each in its own color, flashing to the
   other bands' colors. Only flowing curves, no ring. Each band is one picture per color, stacked; the
   colors fade in and out on the band's own rhythm at the chosen flash rate. */
const RIBBONS = [
  { d: "M-300 760 C 200 300, 900 120, 1900 520", w: 70, move: "whip", t: 3.2 },
  { d: "M-300 240 C 300 760, 1100 900, 1900 300", w: 58, move: "whip2", t: 4.1 },
  { d: "M200 -200 C 480 400, 1180 520, 1500 1200", w: 52, move: "sweep", t: 3.6 },
  { d: "M-300 980 C 500 520, 1000 820, 1900 60", w: 46, move: "whip", t: 5.0 },
  { d: "M1400 -200 C 1050 360, 560 640, 120 1200", w: 44, move: "sweep2", t: 4.4 },
  { d: "M-300 520 C 400 360, 1200 760, 1900 600", w: 40, move: "whip2", t: 2.8 },
];
// One solid band in one color: a soft shadow below, then the band with slightly darker edges and a
// sheen along the middle. Fully opaque.
function ribbonSvg(band, color, key, width, glow) {
  const W = band.w * width;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000">` +
    `<defs><filter id="sh${key}" x="-20%" y="-30%" width="140%" height="160%"><feGaussianBlur stdDeviation="${(W * 0.25).toFixed(1)}"/></filter>` +
    `<filter id="sn${key}" x="-20%" y="-30%" width="140%" height="160%"><feGaussianBlur stdDeviation="${(W * 0.07).toFixed(1)}"/></filter></defs>` +
    `<path d="${band.d}" transform="translate(0 ${(W * 0.3).toFixed(1)})" fill="none" stroke="#000" stroke-width="${W.toFixed(1)}" filter="url(#sh${key})" opacity="${Math.min(0.55, 0.28 * glow).toFixed(2)}"/>` +
    `<path d="${band.d}" fill="none" stroke="${color}" stroke-width="${W.toFixed(1)}"/>` +
    `<path d="${band.d}" fill="none" stroke="#000" stroke-width="${W.toFixed(1)}" opacity="0.1"/>` +
    `<path d="${band.d}" fill="none" stroke="${color}" stroke-width="${(W * 0.84).toFixed(1)}"/>` +
    `<path d="${band.d}" transform="translate(0 ${(-W * 0.12).toFixed(1)})" fill="none" stroke="#fff" stroke-width="${(W * 0.22).toFixed(1)}" filter="url(#sn${key})" opacity="${Math.min(0.7, 0.32 * glow).toFixed(2)}"/>` +
    `</svg>`;
  return "data:image/svg+xml," + encodeURIComponent(svg);
}

function RibbonBand({ b, i, still, hy, imgs }) {
  const speed = Math.max(0.25, +hy.speed || 1);
  // Flash rate (Settings > Hyper effects): flashes per second for each band. Each color layer flashes
  // once per its own cycle; cycles differ a little per band and color, so together they look random
  // while the band as a whole keeps to the chosen rate.
  const rate = Math.min(8, Math.max(0.25, +hy.flash || 1));
  const n = imgs.length - 1;
  return (
    <div className={`hy-ribbon ${b.move}`} style={{ "--t": Math.max(0.9, b.t / speed) + "s", "--w": `${-i * 0.9}s` }}>
      <Painted src={imgs[0]} />
      {!still && imgs.slice(1).map((src, k) => (
        <Painted key={k} className="flash" src={src}
          style={{ "--f": Math.max(0.12, (n / rate) * (0.8 + ((i * 7 + k * 5) % 9) * 0.05)).toFixed(2) + "s", "--fd": `${-((i * 1.3 + k * 0.7) % 3)}s` }} />
      ))}
    </div>
  );
}

function Band({ b, i, still, hy, imgs }) {
  const speed = Math.max(0.2, +hy.speed || 1);
  const run = b.run / Math.max(0.2, +hy.streak || 1);
  const cols = bandColors(b, i, hy.colors);
  return (
    <div className={`hy-band ${b.move}`} style={{ "--t": b.t / speed + "s", "--hue": b.hue / speed + "s", "--w": `${-i * 2.3}s` }}>
      <Painted className="a" src={imgs[0]} />
      <Painted className="b" src={imgs[1]} />
      {!still && [0, 1].map((k) => (
        <i key={k} className="hy-comet"
          style={{ "--p": `path("${b.d}")`, "--r": `${run}s`, "--rd": `${-k * run / 2}s`, "--c": k ? cols[1][0] : cols[0][1],
            height: Math.max(2, Math.round(4 * Math.sqrt(+hy.width || 1))) + "px" }} />
      ))}
    </div>
  );
}

// Adjustable per theme (Settings > Look > Hyper effects): band speed, width, how many, glow, colors,
// streak speed, and the strobe, scan line, grid floor and ticker on or off.
function HyperBackdrop({ hy }) {
  const still = reduced();
  const ref = useRef();
  const count = Math.min(BANDS.length, Math.max(1, Math.round(+hy.count || 4)));
  const width = Math.min(3, Math.max(0.3, +hy.width || 1));
  const glow = Math.min(2, Math.max(0, +hy.glow ?? 1));
  // Band pictures are redrawn only when their look changes (width, glow, colors), never per frame.
  const ribbon = hy.style === "ribbon";
  // Ribbons: white plus two flash colors per band (bands take turns which two), drawn once.
  const images = useMemo(() => (ribbon
    ? RIBBONS.slice(0, count).map((b, i) => {
      // Each band has its own color and flashes to (up to two of) the other bands' colors.
      const cols = Array.from({ length: count }, (_, j) => (Array.isArray(hy.ribbon) && /^#[0-9a-f]{6}$/i.test(hy.ribbon[j] || "") ? hy.ribbon[j] : RIBBON_COLORS[j]));
      const others = cols.filter((_, j) => j !== i);
      const flashTo = count === 1 ? [RIBBON_COLORS[1]] : [others[i % others.length], others[(i + 1) % others.length]].filter((c, k, a) => a.indexOf(c) === k);
      return [cols[i], ...flashTo].map((c, k) => ribbonSvg(b, c, `r${i}-${k}`, width, glow));
    })
    : BANDS.map((b, i) => {
      const [a, c] = bandColors(b, i, hy.colors);
      return [bandSvg(b, a, "a" + i, width, glow), bandSvg(b, c, "b" + i, width, glow)];
    })), [ribbon, width, glow, hy.colors, count, (hy.ribbon || []).join()]);
  // The stage is 1600 x 1000; scale it so it always covers the screen (with room to swing).
  useEffect(() => {
    const fit = () => ref.current?.style.setProperty("--hy-s", (Math.max(window.innerWidth / 1600, window.innerHeight / 1000) * 1.3).toFixed(3));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  // Without the ticker the page doesn't need the room at the top.
  useEffect(() => {
    document.body.classList.toggle("hy-noticker", !hy.ticker);
    return () => document.body.classList.remove("hy-noticker");
  }, [hy.ticker]);
  return (
    <>
      <div className={"hy-bg" + (hy.style === "ribbon" ? " ribbons" : "")} aria-hidden="true" ref={ref}
        style={/^#[0-9a-f]{6}$/i.test(hy.bg || "") ? { background: hy.bg } : undefined}>
        {hy.grid && <div className="hy-floor"><div className="hy-grid" style={{ animationDuration: 0.55 / Math.max(0.2, +hy.speed || 1) + "s" }} /></div>}
        <div className="hy-stage">
          {ribbon
            ? RIBBONS.slice(0, count).map((b, i) => <RibbonBand key={i} b={b} i={i} still={still} hy={hy} imgs={images[i]} />)
            : BANDS.slice(0, count).map((b, i) => <Band key={i} b={b} i={i} still={still} hy={hy} imgs={images[i]} />)}
        </div>
        {hy.scan && <div className="hy-scan" />}
        {hy.strobe && <><div className="hy-strobe s1" /><div className="hy-strobe s2" /></>}
      </div>
      {hy.ticker && <Ticker />}
    </>
  );
}

function Ticker() {
  const b = useBoard();
  const { gcal } = useApp();
  const hw = Object.values(gcal.events || {}).flat().filter((e) => e.hw).length;
  const pct = b.studyTotal ? Math.round((b.studyDone / b.studyTotal) * 100) : null;
  // Symbol, value, and whether it's good news (up, green) or bad (down, red).
  const items = [
    ["DUE.TODAY", b.dueToday.length, b.dueToday.length === 0],
    ["OVERDUE", b.overdue.length, b.overdue.length === 0],
    ["THIS.WEEK", b.thisWeek.length, true],
    ["OPEN.TASKS", b.openTasks.length, b.openTasks.length < 10],
    ...(pct != null ? [["EXAM.PREP", pct + "%", pct >= 50]] : []),
    ["PROJECTS", b.projects.length, true],
    ["COURSES", b.courses.length, true],
    ...(hw ? [["HOMEWORK", hw, true]] : []),
  ];
  const row = items.map(([sym, val, up]) => (
    <span key={sym} className={up ? "up" : "down"}>
      <b>{sym}</b> {val} <i>{up ? "▲" : "▼"}</i>
    </span>
  ));
  return (
    <div className="hy-ticker" aria-hidden="true">
      <div className="hy-tape"><div className="hy-run">{row}{row}</div></div>
    </div>
  );
}
