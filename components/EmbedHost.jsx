"use client";
// Keeps embed widgets (Spotify, YouTube…) playing when you switch tabs or open a note.
//
// A tab is drawn afresh each time it opens, and an <iframe> that leaves the page stops (moving it
// reloads it too). So the frames don't live in the tiles: they live here, in one layer that stays for
// as long as the app is open. Each Embed widget only leaves a placeholder (EmbedSlot) in its tile, and
// every frame is laid exactly over its placeholder while that is on screen. When it isn't (another tab,
// a note, customize mode), the frame moves out of sight and keeps playing. Once you have used a player,
// a small button then brings it up over the page, with Stop.
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getLayout, tabList } from "@/lib/layout";
import { useApp } from "./AppProvider";
import { Icon } from "./ui";

const Ctx = createContext(null);
// What a player may do. Safari keeps a player's own login cookies away from it inside another site
// ("Prevent Cross-Site Tracking"); a player that asks Safari for them may (storage-access). Spotify's
// player doesn't ask, so in Safari it plays previews only. A player can't read or change this page.
const ALLOW = "autoplay; encrypted-media; fullscreen; picture-in-picture; clipboard-write; storage-access";
const SANDBOX = "allow-scripts allow-same-origin allow-popups allow-presentation allow-forms allow-storage-access-by-user-activation";

export function EmbedHost({ children }) {
  const { dash, auth } = useApp();
  const [frames, setFrames] = useState({}); // id -> { url, height, title, run }
  const [used, setUsed] = useState([]); // ids of players you have clicked into (most recent first)
  const [shown, setShown] = useState(null); // id of the player brought up over the page
  const slots = useRef(new Map()); // id -> placeholder element
  const els = useRef(new Map()); // id -> iframe
  const [away, setAway] = useState([]); // used players whose placeholder isn't on screen
  const awayRef = useRef([]);
  // The layer is added after the page has loaded (the server draws the page without it).
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const api = useRef({
    attach(id, el, info) {
      slots.current.set(id, el);
      setFrames((f) => (f[id] && f[id].url === info.url && f[id].height === info.height && f[id].title === info.title
        ? f : { ...f, [id]: { run: 0, ...f[id], ...info } }));
    },
    detach(id, el) { if (slots.current.get(id) === el) slots.current.delete(id); },
  }).current;

  // Embeds taken off the dashboard (or after logging out) close for good.
  useEffect(() => {
    const ids = new Set();
    if (auth === "in" || auth === "guest") {
      for (const t of tabList(dash)) for (const it of getLayout(dash, t.id)) if (it.type === "embed") ids.add(embedId(it));
    }
    setFrames((f) => {
      const gone = Object.keys(f).filter((id) => !ids.has(id));
      if (!gone.length) return f;
      const next = { ...f };
      gone.forEach((id) => delete next[id]);
      return next;
    });
  }, [dash, auth]);

  // Clicking into a player (the page loses focus to that frame) marks it as used.
  useEffect(() => {
    const onBlur = () => setTimeout(() => {
      const a = document.activeElement;
      for (const [id, el] of els.current) if (el === a) setUsed((u) => [id, ...u.filter((x) => x !== id)]);
    }, 0);
    window.addEventListener("blur", onBlur);
    return () => window.removeEventListener("blur", onBlur);
  }, []);

  // Lays each frame over its placeholder, every frame of the screen (cheap: a few rectangles), so it
  // follows scrolling, resizing and dragging. Styles are only written when something changed.
  useLayoutEffect(() => {
    // No players open: nothing to lay out, so no work every frame.
    if (!Object.keys(frames).length) { if (awayRef.current.length) { awayRef.current = []; setAway([]); } return; }
    let raf;
    const last = new Map();
    const tick = () => {
      const off = [];
      for (const [id, el] of els.current) {
        const slot = slots.current.get(id);
        let pos;
        if (shown === id) pos = "up";
        else if (slot && slot.isConnected && !slot.closest(".b-editing")) {
          const r = slot.getBoundingClientRect();
          pos = r.width ? `${Math.round(r.left + window.scrollX)},${Math.round(r.top + window.scrollY)},${Math.round(r.width)},${Math.round(r.height)}` : "off";
        } else pos = "off";
        if (pos === "off") off.push(id);
        if (last.get(id) === pos) continue;
        last.set(id, pos);
        el.classList.toggle("up", pos === "up");
        el.classList.toggle("off", pos === "off");
        if (pos !== "up" && pos !== "off") {
          const [x, y, w, h] = pos.split(",");
          Object.assign(el.style, { left: x + "px", top: y + "px", width: w + "px", height: h + "px" });
        } else if (pos === "up") Object.assign(el.style, { left: "", top: "", width: "", height: frames[id]?.height + "px" });
        else Object.assign(el.style, { left: "", top: "" });
      }
      const next = used.filter((id) => off.includes(id) && frames[id]);
      if (next.join() !== awayRef.current.join()) { awayRef.current = next; setAway(next); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [frames, used, shown]);

  // Stop = load the player again, which ends whatever it was playing.
  const stop = (id) => {
    setFrames((f) => ({ ...f, [id]: { ...f[id], run: (f[id].run || 0) + 1 } }));
    setUsed((u) => u.filter((x) => x !== id));
    setShown(null);
  };
  const cur = shown && frames[shown] ? shown : away[0];

  return (
    <Ctx.Provider value={api}>
      {children}
      {ready && createPortal(
        <>
          <div className="b-embeds">
            {Object.entries(frames).map(([id, f]) => (
              <iframe key={id + "|" + f.url + "|" + f.run} ref={(el) => (el ? els.current.set(id, el) : els.current.delete(id))}
                className="b-embed b-embed-live off" src={f.url} title={f.title || "embed"} allow={ALLOW} sandbox={SANDBOX}
                style={{ height: f.height }} />
            ))}
          </div>
          {cur && (
            <div className={"b-nowplaying" + (shown ? " open" : "")} style={shown ? { bottom: `calc(env(safe-area-inset-bottom) + 100px + ${frames[shown].height}px)` } : undefined}>
              <button type="button" className="b-np-main" onClick={() => setShown(shown ? null : cur)}>
                <Icon name="music" /><span>{frames[cur].title || hostName(frames[cur].url)}</span>
                <Icon name={shown ? "chevron-down" : "arrow-up"} />
              </button>
              <button type="button" className="b-np-stop" onClick={() => stop(cur)}>Stop</button>
            </div>
          )}
        </>,
        document.body,
      )}
    </Ctx.Provider>
  );
}

const hostName = (url) => { try { return new URL(url).hostname.replace(/^(www|open|w|embed)\./, ""); } catch { return "Player"; } };
export const embedId = (w) => String(w.id || w.url || "embed");

// The placeholder an Embed widget leaves in its tile; the frame itself is laid over it by EmbedHost.
export function EmbedSlot({ id, url, height, title }) {
  const host = useContext(Ctx);
  const ref = useRef();
  useLayoutEffect(() => {
    const el = ref.current;
    host?.attach(id, el, { url, height, title });
    return () => host?.detach(id, el);
  }, [host, id, url, height, title]);
  return (
    <div ref={ref} className="b-embed b-embed-slot" style={{ height }}>
      <span><Icon name="music" /> Keeps playing while you customize</span>
    </div>
  );
}
