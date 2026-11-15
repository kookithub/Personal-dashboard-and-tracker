"use client";
// Settings > Account > Signed-in devices: every device that is logged in (one row each, kept by the
// server in the `sessions` table), with Log out per device, and the wrong-password attempts of the last
// 30 days. Also the check on opening the app that warns about a new sign-in (see useSignInCheck).
import { useEffect, useState } from "react";
import { M } from "@/lib/notes";
import { store } from "@/lib/theme";
import { useApp } from "./AppProvider";
import { Btn, Empty, Icon, Modal } from "./ui";

// "iPhone · Safari", "Windows · Chrome"… from the browser's user agent.
export function deviceName(agent = "") {
  const a = String(agent);
  const os = /iPhone/.test(a) ? "iPhone" : /iPad/.test(a) ? "iPad" : /Android/.test(a) ? "Android"
    : /Windows/.test(a) ? "Windows" : /Mac OS X|Macintosh/.test(a) ? "Mac" : /CrOS/.test(a) ? "Chromebook" : /Linux/.test(a) ? "Linux" : "";
  const br = /Edg\//.test(a) ? "Edge" : /OPR\//.test(a) ? "Opera" : /SamsungBrowser/.test(a) ? "Samsung Internet"
    : /Firefox|FxiOS/.test(a) ? "Firefox" : /Chrome|CriOS/.test(a) ? "Chrome" : /Safari/.test(a) ? "Safari" : "";
  return [os, br].filter(Boolean).join(" · ") || "Unknown device";
}
const phone = (agent) => /iPhone|Android|Mobile/.test(String(agent));
const ago = (t) => (Date.now() - t < 120_000 ? "just now" : M(t).fromNow());
const when = (t) => M(t).format("D MMM YYYY, HH:mm");

export default function DevicesDialog({ close }) {
  const { api, notice } = useApp();
  const [data, setData] = useState(null);
  const [asking, setAsking] = useState(null);
  const load = () => api("/api/sessions").then((r) => r.json()).then(setData).catch(() => setData({ devices: [], bad: [] }));
  useEffect(() => { load(); }, []); // eslint-disable-line
  const end = async (body, text) => {
    setAsking(null);
    const r = await api("/api/sessions/end", { method: "POST", body: JSON.stringify(body) });
    notice(r.ok ? text : "Could not log it out. Try again.");
    load();
  };
  const devices = data?.devices || [];
  const others = devices.filter((d) => !d.current);
  return (
    <Modal title="Signed-in devices" wide onClose={close}>
      <p className="b-hint">
        Every device logged in to your dashboard. Don't recognize one? Log it out, then change your password
        (user guide: "Forgot the password?").
      </p>
      <div className="b-trash-list">
        {!data && <Empty>Loading…</Empty>}
        {devices.map((d) => (
          <div key={d.key} className="b-trash-row b-device">
            <span className="b-ico"><Icon name={phone(d.agent) ? "smartphone" : "monitor"} /></span>
            <div>
              <div className="b-result-t">{deviceName(d.agent)}{d.current && <b className="b-device-me">This device</b>}</div>
              <div className="b-result-s">
                {d.place || "Unknown place"} · last used {ago(d.seen)} · signed in {when(d.created)}
              </div>
              <div className="b-result-s b-device-ip">{d.ip}</div>
            </div>
            {!d.current && (asking === d.key ? (
              <>
                <Btn variant="danger" onClick={() => end({ key: d.key }, "That device is logged out.")}>Log out</Btn>
                <Btn variant="ghost" onClick={() => setAsking(null)}>Keep</Btn>
              </>
            ) : <Btn icon="log-out" onClick={() => setAsking(d.key)}>Log out</Btn>)}
          </div>
        ))}
      </div>
      {others.length > 1 && (
        <div className="b-row" style={{ marginTop: 10 }}>
          {asking === "all"
            ? <><Btn variant="danger" onClick={() => end({ others: true }, "Every other device is logged out.")}>Log out {others.length} devices</Btn>
              <Btn variant="ghost" onClick={() => setAsking(null)}>Keep</Btn></>
            : <Btn icon="log-out" onClick={() => setAsking("all")}>Log out all other devices</Btn>}
        </div>
      )}

      <div className="b-msec">Wrong passwords (last {data?.bad_keep_days || 30} days)</div>
      {data && !data.bad?.length && <Empty>None. Nobody has tried a wrong password.</Empty>}
      <div className="b-trash-list">
        {(data?.bad || []).map((b, i) => (
          <div key={i} className="b-trash-row">
            <div>
              <div className="b-result-t">{deviceName(b.agent)}</div>
              <div className="b-result-s">{b.place || "Unknown place"} · {when(b.at)} · {b.ip}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="b-modal-btns"><Btn onClick={close}>Close</Btn></div>
    </Modal>
  );
}

// On opening the app: warns once about a device that signed in, or wrong passwords tried, since this
// device last looked. The first time on a device it only remembers what is there.
export async function checkSignIns(api, notice, openDevices) {
  let data;
  try { data = await (await api("/api/sessions")).json(); } catch { return; }
  if (!Array.isArray(data?.devices)) return;
  const last = +store.get("k-signin-check", "0");
  store.set("k-signin-check", String(Date.now()));
  if (!last) return;
  const fresh = data.devices.filter((d) => !d.current && d.created > last);
  const bad = (data.bad || []).filter((b) => b.at > last);
  const open = { label: "See devices", run: openDevices };
  if (fresh.length) {
    const d = fresh[0];
    notice(`New sign-in: ${deviceName(d.agent)}${d.place ? ", " + d.place : ""}, ${ago(d.created)}.${fresh.length > 1 ? ` (+${fresh.length - 1} more)` : ""} Not you? Log it out.`, open);
  } else if (bad.length) {
    notice(`${bad.length} wrong password${bad.length > 1 ? "s" : ""} tried since you last looked.`, open);
  }
}
