"use client";
// A little character that lives on the dashboard (Settings > Buddy). It can be one of the
// built-in ones or your own picture: an animated GIF keeps moving, and a sprite strip
// (walking frames side by side) plays while it walks. Tap it and it hops and says something.
// Saved in the `dashboard` setting as a list, `buddies` (older: one `buddy`), each
//   { id, on, kind, pic, motion, activity, speed, size, lines }
// kind "own" uses an uploaded picture from the `buddy_pics` library: { id, name, src, pixel, frames, flip },
// so a picture is uploaded once and can be picked again later. `buddy_hidden` lists removed built-in characters.
import { useEffect, useRef, useState } from "react";
import { imgSrc } from "@/lib/theme";
import { useApp } from "./AppProvider";
import { useBoard } from "./board";

export const BUDDY_KINDS = { pixcat: "Pixel cat", pixbun: "Pixel bunny", blob: "Blob", cat: "Cat", ghost: "Ghost", own: "My picture" };
export const BUDDY_MOTIONS = {
  explore: "Explore (jumps on cards)", walk: "Walk around", wander: "Wander anywhere", peek: "Peek in", bounce: "Bounce in a corner",
};
export const BUDDY_ACTIVITY = { calm: "Calm", lively: "Lively", hyper: "Hyper" };
export const BUDDY_SPEEDS = { slow: "Slow", normal: "Normal", fast: "Fast" };
export const BUDDY_LINES = ["Hi there!", "You have {due} due today.", "You got this!", "Time for a little break?", "{overdue} overdue... let's fix that!"];
const SPEED = { slow: 50, normal: 100, fast: 180 }; // pixels per second
// How restless it is: pauses (seconds), hops per second while standing, chance of a dash or a jump.
const ACTIVITY = {
  calm: { pause: [2, 6], hops: 0.08, dash: 0.05, leap: 0.1 },
  lively: { pause: [0.5, 2.2], hops: 0.35, dash: 0.25, leap: 0.3 },
  hyper: { pause: [0.1, 0.8], hops: 0.8, dash: 0.5, leap: 0.5 },
};

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (list) => list[Math.floor(Math.random() * list.length)];

export const getBuddies = (d) => (Array.isArray(d.buddies) ? d.buddies.filter((b) => b && typeof b === "object") : d.buddy ? [d.buddy] : []);
export const getBuddyPics = (d) => (Array.isArray(d.buddy_pics) ? d.buddy_pics.filter((p) => p && p.id && p.src) : []);
export const BUILT_IN = Object.keys(BUDDY_KINDS).filter((k) => k !== "own");

// Every buddy that is switched on. Settings shows unsaved changes live (app.preview).
export default function Buddies() {
  const app = useApp();
  const d = app.preview || app.dash;
  const pics = getBuddyPics(d);
  return getBuddies(d).map((cfg, i) => {
    if (!cfg.on) return null;
    // A picture from the library brings its own settings (sharp pixels, frames, flip).
    const pic = cfg.kind === "own" && cfg.pic ? pics.find((p) => p.id === cfg.pic) : null;
    const full = pic ? { ...cfg, src: pic.src, pixel: pic.pixel, frames: pic.frames, flip: pic.flip } : cfg;
    return <Buddy key={cfg.id || i} cfg={full} />;
  });
}

function Buddy({ cfg }) {
  const { overdue, dueToday } = useBoard();
  const box = useRef();
  const body = useRef();
  const [bubble, setBubble] = useState(null);
  const size = Math.min(200, Math.max(40, +cfg.size || 84));
  const motion = BUDDY_MOTIONS[cfg.motion] ? cfg.motion : "walk";
  const speed = SPEED[cfg.speed] || SPEED.normal;
  const act = ACTIVITY[cfg.activity] || ACTIVITY.lively;
  const kind = BUDDY_KINDS[cfg.kind] ? cfg.kind : "blob";
  const src = kind === "own" ? imgSrc(cfg.src) : null;
  const frames = Math.min(12, Math.max(1, Math.round(+cfg.frames || 1)));

  // Moves the character with requestAnimationFrame (no React re-render per frame).
  useEffect(() => {
    if (!cfg.on) return;
    const el = box.current, inner = body.current;
    if (!el || !inner) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const W = () => window.innerWidth, H = () => window.innerHeight;
    const floor = () => H() - size - (W() <= 820 ? 92 : 100); // stands just above the dock
    const anyX = () => rand(8, W() - size - 8);
    let x, y, face = 1, tilt = 0, raf, last = performance.now();
    // Steps: { x, y } walk there, { x, y, arc: true } jump there, { x, y, warp: true } appear there,
    // { wait } stand still. `fast` makes a walk a dash, `tilt` leans it (peeking).
    let plan = [];
    let perch = null; // the card it is standing on (Explore), so scrolling can knock it off

    const pause = () => ({ wait: rand(...act.pause) });
    // Spots on top of cards that are on screen.
    const perches = () => [...document.querySelectorAll(".b-tile")]
      .map((t) => t.getBoundingClientRect())
      .filter((r) => r.width > size * 1.3 && r.top > 70 + size && r.top < floor() - 20 && r.right > 0 && r.left < W());
    const nextPlan = () => {
      if (motion === "walk") {
        const tx = anyX();
        if (Math.random() < act.leap) plan.push({ x: tx, y: floor(), arc: true });
        else plan.push({ x: tx, y: floor(), fast: Math.random() < act.dash });
        plan.push(pause());
      } else if (motion === "wander") {
        const p = { x: anyX(), y: rand(90, floor()) };
        plan.push(Math.random() < act.leap ? { ...p, arc: true } : { ...p, fast: Math.random() < act.dash }, pause());
      } else if (motion === "explore") {
        const spots = perches();
        if (spots.length && Math.random() < 0.8) {
          const r = pick(spots);
          const top = r.top - size + 4;
          const lo = Math.max(r.left, 0), hi = Math.min(r.right, W()) - size;
          perch = { top: r.top };
          plan.push({ x: rand(lo, Math.max(lo, hi)), y: top, arc: true }, pause(),
            { x: rand(lo, Math.max(lo, hi)), y: top, fast: Math.random() < act.dash }, pause());
        } else {
          perch = null;
          plan.push({ x: anyX(), y: floor(), arc: true }, pause(), { x: anyX(), y: floor(), fast: Math.random() < act.dash }, pause());
        }
      } else if (motion === "peek") {
        const left = Math.random() < 0.5;
        const py = rand(H() * 0.25, floor());
        const out = left ? -size - 10 : W() + 10;
        const show = left ? -size * 0.2 : W() - size * 0.8;
        const t = left ? 18 : -18;
        plan.push({ x: out, y: py, warp: true, tilt: t }, { x: show, y: py, tilt: t }, { wait: rand(2.5, 4.5) * (act.pause[1] > 3 ? 1.5 : 1) },
          { x: out, y: py, tilt: t }, { wait: rand(...act.pause) * 4 + 3 });
      } else plan.push({ wait: 10 });
    };

    const corner = () => { x = W() - size - 16; y = floor(); };
    if (still || motion === "bounce") corner();
    else if (motion === "peek") { x = -size - 10; y = floor(); }
    else { x = anyX(); y = motion === "wander" ? rand(90, floor()) : floor(); }

    const draw = (state) => {
      el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
      inner.style.setProperty("--face", face * (cfg.flip ? -1 : 1));
      inner.style.setProperty("--tilt", tilt + "deg");
      inner.classList.toggle("moving", state === "walk");
      inner.classList.toggle("dashing", state === "dash");
      inner.classList.toggle("flying", state === "fly");
    };
    draw("idle");
    if (still || motion === "bounce") {
      const onResize = () => { corner(); draw("idle"); };
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    }

    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!plan.length) nextPlan();
      const step = plan[0];
      let state = "idle";
      if (step.wait != null) {
        step.wait -= dt;
        if (step.wait <= 0) plan.shift();
        else if (motion !== "peek" && Math.random() < dt * act.hops) hop(inner);
        // Sometimes turns around while standing, as if looking about.
        else if (motion !== "peek" && Math.random() < dt * act.hops * 0.6) face = -face;
      } else if (step.warp) {
        x = step.x; y = step.y; plan.shift();
      } else if (step.arc) {
        // A jump: straight line from where it was, plus a hop height that peaks halfway.
        if (step.t == null) {
          const d = Math.hypot(step.x - x, step.y - y);
          Object.assign(step, { t: 0, sx: x, sy: y, dur: Math.min(1.1, Math.max(0.4, d / (speed * 2.2))), h: 30 + Math.min(120, d * 0.25) });
          if (Math.abs(step.x - x) > 1) face = step.x < x ? -1 : 1;
        }
        step.t = Math.min(1, step.t + dt / step.dur);
        const t = step.t;
        x = step.sx + (step.x - step.sx) * t;
        y = step.sy + (step.y - step.sy) * t - step.h * 4 * t * (1 - t);
        state = "fly";
        if (t >= 1) { plan.shift(); hop(inner, "land"); }
      } else {
        const dx = step.x - x, dy = step.y - y, d = Math.hypot(dx, dy);
        if (d < 2) plan.shift();
        else {
          const s = Math.min(d, speed * (step.fast ? 2.4 : 1) * dt);
          x += (dx / d) * s;
          y += (dy / d) * s;
          if (Math.abs(dx) > 1 && motion !== "peek") face = dx < 0 ? -1 : 1;
          if (motion !== "peek") state = step.fast ? "dash" : "walk";
        }
      }
      tilt = step.tilt ?? 0;
      if (motion === "peek") face = (step.tilt ?? 0) < 0 ? -1 : 1;
      draw(state);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const onResize = () => {
      plan = [];
      x = Math.min(x, W() - size - 8);
      y = Math.min(y, floor());
    };
    // Scrolling moves the cards out from under it: it jumps back down to the floor.
    const onScroll = () => {
      if (motion !== "explore" || !perch) return;
      perch = null;
      plan = [{ x, y: floor(), arc: true }, pause()];
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll);
    };
  }, [cfg.on, cfg.flip, motion, speed, size, act]);

  if (!cfg.on) return null;

  const lines = (Array.isArray(cfg.lines) && cfg.lines.length ? cfg.lines : BUDDY_LINES)
    .map((l) => String(l).replace(/\{due\}/g, dueToday.length).replace(/\{overdue\}/g, overdue.length))
    .filter((l) => !/^0 overdue/.test(l));
  const tap = () => {
    hop(body.current);
    setBubble({ text: lines[Math.floor(Math.random() * lines.length)] || "Hi!", id: Date.now() });
  };

  return (
    <div className="b-buddy" ref={box} style={{ width: size, height: size }} aria-hidden="true">
      {bubble && <Bubble key={bubble.id} text={bubble.text} onDone={() => setBubble(null)} />}
      <div className={"b-buddy-body" + (cfg.pixel || kind.startsWith("pix") ? " pixel" : "")} ref={body} onClick={tap} title="Hi!">
        {src ? <OwnPicture src={src} frames={frames} /> : <Drawn kind={kind} />}
      </div>
      <div className="b-buddy-shadow" />
    </div>
  );
}

// Your picture. With frames > 1 it is a strip of frames side by side, played while it walks.
function OwnPicture({ src, frames }) {
  if (frames <= 1) return <img src={src} alt="" draggable={false} />;
  return (
    <div className="b-sprite" style={{
      backgroundImage: `url("${src}")`, backgroundSize: `${frames * 100}% 100%`,
      "--frames": frames, "--steps": frames, "--spd": `${frames * 0.11}s`,
    }} />
  );
}

function hop(el, kind = "hop") {
  if (!el || el.classList.contains("hop") || el.classList.contains("land")) return;
  el.classList.add(kind);
  setTimeout(() => el.classList.remove(kind), kind === "land" ? 260 : 600);
}

function Bubble({ text, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 2800); return () => clearTimeout(t); }, [onDone]);
  return <div className="b-buddy-say">{text}</div>;
}

/* ---------- built-in characters (original drawings) ---------- */

// Pixel art: one letter per pixel, "." is see-through. Two leg frames swap while walking.
const PIXEL = {
  pixcat: {
    colors: { k: "#26232b", g: "#3a3640", p: "var(--accent)", y: "#f5d76e", w: "#fff" },
    rows: [
      "................",
      "...k.......k....",
      "...kk.....kk....",
      "...kpk...kpk....",
      "...kkkkkkkkk....",
      "..kkkkkkkkkkk...",
      "..kkywkkkywkk...",
      "..kkyykkkyykk...",
      "..kkkkkpkkkkk...",
      "...kkkkkkkkk...k",
      "....kgggggk...kk",
      "...kkgggggkk.kk.",
      "...kkkkkkkkkkk..",
      "...kkkkkkkkkk...",
    ],
    legs: [["...kk..kk.kk....", "...kk.....kk...."], ["....kk.kk..kk...", "....kk......kk.."]],
  },
  pixbun: {
    colors: { o: "#9a8f99", w: "#fbfaf8", p: "var(--accent)", k: "#1c1917", r: "#f4a6b8" },
    rows: [
      "....o....o......",
      "...opo..opo.....",
      "...opo..opo.....",
      "...opo..opo.....",
      "...owo..owo.....",
      "..owwwoowwwo....",
      ".owwwwwwwwwwo...",
      ".owwkwwwwkwwo...",
      ".owrwwwwwwrwo...",
      ".owwwwkkwwwwo...",
      "..owwwwwwwwo....",
      "..owwwwwwwwwo...",
      ".owwwwwwwwwwwoo.",
      ".owwwwwwwwwwwwwo",
    ],
    legs: [["..owwo..owwo....", "..ooo....ooo...."], ["...owwo..owwo...", "...ooo....ooo..."]],
  },
};

function PixelArt({ art }) {
  const rect = (rows, y0, key) => rows.flatMap((row, j) => [...row.padEnd(16, ".").slice(0, 16)].map((c, i) =>
    art.colors[c] ? <rect key={`${key}${j}-${i}`} x={i} y={y0 + j} width="1.02" height="1.02" fill={art.colors[c]} /> : null));
  return (
    <svg viewBox="0 0 16 16" shapeRendering="crispEdges">
      {rect(art.rows, 0, "b")}
      <g className="b-px-f0">{rect(art.legs[0], 14, "a")}</g>
      <g className="b-px-f1">{rect(art.legs[1], 14, "c")}</g>
    </svg>
  );
}

export function Drawn({ kind }) {
  if (PIXEL[kind]) return <PixelArt art={PIXEL[kind]} />;
  const eyes = (lx, rx, y, c = "#1c1917") => (
    <g className="b-buddy-eyes">
      <ellipse cx={lx} cy={y} rx="5" ry="7" fill={c} />
      <ellipse cx={rx} cy={y} rx="5" ry="7" fill={c} />
      <circle cx={lx + 1.6} cy={y - 2.5} r="1.8" fill="#fff" />
      <circle cx={rx + 1.6} cy={y - 2.5} r="1.8" fill="#fff" />
    </g>
  );
  if (kind === "cat") {
    return (
      <svg viewBox="0 0 100 100">
        <path d="M80 70c10-4 14-16 8-24" fill="none" stroke="#26232b" strokeWidth="7" strokeLinecap="round" className="b-buddy-tail" />
        <path d="M22 40 L24 12 L42 28 L58 28 L76 12 L78 40 C84 52 82 92 50 92 C18 92 16 52 22 40Z" fill="#26232b" />
        <path d="M28 18 L31 30 L38 26Z M72 18 L69 30 L62 26Z" fill="color-mix(in srgb, var(--accent) 70%, #fff)" />
        {eyes(38, 62, 52, "#f5d76e")}
        <path d="M46 62 L54 62 L50 66Z" fill="color-mix(in srgb, var(--accent) 70%, #fff)" />
        <path d="M50 66 q-4 5 -9 2 M50 66 q4 5 9 2" fill="none" stroke="#bbb" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === "ghost") {
    return (
      <svg viewBox="0 0 100 100">
        <path d="M18 50 C18 26 32 12 50 12 C68 12 82 26 82 50 L82 90 L72 82 L61 90 L50 82 L39 90 L28 82 L18 90Z" fill="#fbfaf8" stroke="#d9d4ce" strokeWidth="2" />
        {eyes(39, 61, 46)}
        <ellipse cx="30" cy="58" rx="6" ry="3.5" fill="color-mix(in srgb, var(--accent) 45%, transparent)" />
        <ellipse cx="70" cy="58" rx="6" ry="3.5" fill="color-mix(in srgb, var(--accent) 45%, transparent)" />
        <ellipse cx="50" cy="60" rx="4" ry="5" fill="#1c1917" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 100 100">
      <path d="M50 16 C74 16 88 36 88 60 C88 82 72 92 50 92 C28 92 12 82 12 60 C12 36 26 16 50 16Z" fill="var(--accent)" />
      <path d="M36 26 C30 28 24 34 22 42" fill="none" stroke="rgba(255,255,255,.45)" strokeWidth="5" strokeLinecap="round" />
      {eyes(38, 62, 54)}
      <ellipse cx="28" cy="66" rx="6" ry="3.5" fill="rgba(255,255,255,.35)" />
      <ellipse cx="72" cy="66" rx="6" ry="3.5" fill="rgba(255,255,255,.35)" />
      <path d="M44 66 q6 6 12 0" fill="none" stroke="#1c1917" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}
