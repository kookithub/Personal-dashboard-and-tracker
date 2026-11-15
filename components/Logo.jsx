"use client";
// The logo in the top bar. Set in Settings > Look, saved as dashboard.logo:
//   "icon:star"  a built-in icon     "text:K" letters or an emoji     "img:<path or https link>" a picture
// It also becomes the browser tab icon and the iPhone home-screen icon.
import { useEffect, useRef } from "react";
import { flatLook, imgSrc } from "@/lib/theme";
import { useApp } from "./AppProvider";
import { Icon } from "./ui";

export function parseLogo(v) {
  const m = /^(icon|text|img):(.+)$/s.exec(String(v || ""));
  return m ? { kind: m[1], value: m[2] } : { kind: "icon", value: "house" };
}

export function LogoMark({ logo, className = "" }) {
  const { kind, value } = parseLogo(logo);
  return (
    <div className={"b-logo " + (kind === "img" ? "img " : "") + className}>
      {kind === "img" ? <img src={imgSrc(value)} alt="" /> : kind === "text" ? <span className="b-logo-t">{value}</span> : <Icon name={value} />}
    </div>
  );
}

export default function Logo() {
  const app = useApp();
  const { dark, settings, api, saveSetting } = app;
  const dash = flatLook(app.dash);
  const ref = useRef();
  useEffect(() => {
    const el = ref.current?.firstChild;
    if (!el) return;
    (async () => {
      const big = await drawLogo(el, dash.logo, 512);
      if (big) setPageIcons(big);
      // Save the icons on the server (the iPhone home-screen icon comes from there).
      // Redone when the logo or its colors change; not for a dark-mode switch.
      const sig = dash.logo ? [dash.logo, dash.palette, dash.light_accent || dash.base.light[0], dash.style].join("|") : "";
      if (dark || (settings.icon_sig ?? "") === sig) return;
      const icons = big ? {
        "apple-touch-icon.png": await resize(big, 180),
        "icon-192.png": await resize(big, 192),
        "icon-512.png": big.split(",")[1],
      } : null;
      const r = await api("/api/icons", { method: "PUT", body: JSON.stringify({ icons }) });
      if (r.ok) saveSetting("icon_sig", sig);
    })().catch(() => {});
  }, [dash.logo, dash.palette, dash.light_accent, dash.dark_accent, dash.style, dark, settings.icon_sig]); // eslint-disable-line
  return <div ref={ref} style={{ display: "contents" }}><LogoMark logo={dash.logo} /></div>;
}

const load = (src) => new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = src; });

// Draws the logo onto a square PNG (data URL). Returns null for the default logo.
async function drawLogo(el, logo, size) {
  if (!logo) return null;
  const { kind, value } = parseLogo(logo);
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  const cs = getComputedStyle(el);
  if (kind === "img") {
    const img = await load(imgSrc(value));
    const s = Math.max(size / img.width, size / img.height);
    g.drawImage(img, (size - img.width * s) / 2, (size - img.height * s) / 2, img.width * s, img.height * s);
  } else {
    g.fillStyle = cs.backgroundColor || "#1d1a17";
    g.fillRect(0, 0, size, size);
    g.fillStyle = cs.color || "#fff";
    if (kind === "text") {
      g.font = `700 ${Math.round(size * (value.length > 2 ? 0.36 : 0.5))}px ${cs.fontFamily}`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(value, size / 2, size * 0.53);
    } else {
      const svg = el.querySelector("svg");
      if (!svg) return null;
      const copy = svg.cloneNode(true);
      const inner = Math.round(size * 0.52);
      copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      copy.setAttribute("width", inner);
      copy.setAttribute("height", inner);
      copy.setAttribute("stroke", cs.color);
      const img = await load("data:image/svg+xml;charset=utf-8," + encodeURIComponent(copy.outerHTML));
      g.drawImage(img, (size - inner) / 2, (size - inner) / 2, inner, inner);
    }
  }
  return c.toDataURL("image/png");
}

// A smaller copy, as base64 PNG (no "data:" prefix).
async function resize(dataUrl, size) {
  const img = await load(dataUrl);
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  g.imageSmoothingQuality = "high";
  g.drawImage(img, 0, 0, size, size);
  return c.toDataURL("image/png").split(",")[1];
}

// Browser tab icon, updated right away (no reload needed).
function setPageIcons(url) {
  for (const rel of ["icon"]) {
    const links = document.querySelectorAll(`link[rel="${rel}"]`);
    links.forEach((l) => { l.href = url; l.removeAttribute("sizes"); l.removeAttribute("type"); });
    if (!links.length) {
      const l = document.createElement("link");
      l.rel = rel;
      l.href = url;
      document.head.appendChild(l);
    }
  }
}
