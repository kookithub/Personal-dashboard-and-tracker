"use client";
// The bin: deleted notes, deleted tasks and pictures (and videos) nothing uses any more. Each stays 30 days, then the
// server deletes it for good (lib/server.js, tidyUp). Until then it can be put back.
import { useEffect, useState } from "react";
import { M, fileName, trashOrigin } from "@/lib/notes";
import { getLayout, newId, withLayouts } from "@/lib/layout";
import { activeTheme, imgSrc, ownSlides, skinOf, withThemes } from "@/lib/theme";
import { useApp } from "./AppProvider";
import { useNav } from "./board";
import { Btn, Empty, Modal, Segmented } from "./ui";

const KEEP_DAYS = 30;
const size = (bytes) => (bytes >= 1048576 ? (bytes / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(bytes / 1024)) + " KB");
const left = (at) => {
  const n = KEEP_DAYS - M().diff(M(at), "days");
  return n <= 1 ? "deleted for good within a day" : `deleted for good in ${n} days`;
};

export default function TrashDialog({ close }) {
  const { files, settings, restoreNote, purgeNote, restoreTask, purgeTask, api, dash, saveSetting, notice } = useApp();
  const { openPath } = useNav();
  const [part, setPart] = useState("notes");
  const [asking, setAsking] = useState(null); // the thing waiting for "delete for good?"
  const [pictures, setPictures] = useState(null);

  useEffect(() => {
    api("/api/bin").then((r) => r.json()).then((d) => setPictures(d.pictures || [])).catch(() => setPictures([]));
  }, [api]);

  const notes = [...files.entries()]
    .filter(([p]) => p.startsWith(".trash/"))
    .map(([p, f]) => ({ p, at: f.mtime, to: trashOrigin(p, files) }))
    .sort((a, b) => b.at - a.at);

  const tasks = (Array.isArray(settings.task_bin) ? settings.task_bin : [])
    .filter((x) => x && Array.isArray(x.lines) && M().diff(M(x.at), "days") < KEEP_DAYS);
  const taskName = (x) => x.lines[0].replace(/^\s*(?:[-*+]|\d+[.)])\s+\[.\]\s*/, "").replace(/\[\w+::[^\]]*\]/g, "").trim() || "(empty task)";

  const restore = async (p) => {
    const to = await restoreNote(p);
    if (to) { close(); openPath(to); }
  };
  // A picture is "put back" by showing it again: as a picture widget at the end of Home.
  // A video goes back into a Zeus theme's own slideshow: the theme in use if it is one, else Zeus itself.
  const useAgain = async (path, type) => {
    await api("/api/bin/keep", { method: "POST", body: JSON.stringify({ path }) });
    if (/^video\//.test(type)) {
      const d = withThemes(dash);
      const id = skinOf(d) === "zeus" ? activeTheme(d) : "zeus";
      const t = d.themes[id] || {};
      const zs = { ...(t.zs || {}), show: "own", own: [...ownSlides(t.zs), { src: path, kind: "video" }] };
      await saveSetting("dashboard", { ...d, themes: { ...d.themes, [id]: { ...t, zs } } });
      notice(`Back in ${id === "zeus" ? "Zeus'" : "this theme's"} own slideshow.`);
    } else {
      await saveSetting("dashboard", withLayouts(dash, { overview: [...getLayout(dash, "overview"), { id: newId(), type: "picture", src: path }] }));
      notice("Back on Home as a picture widget.");
    }
    setPictures((list) => list.filter((x) => x.path !== path));
  };
  const purgePicture = async (path) => {
    const r = await api("/api/bin/purge", { method: "POST", body: JSON.stringify({ path }) });
    if (!r.ok) return notice("Could not delete the picture.");
    setPictures((list) => list.filter((x) => x.path !== path));
    notice("Deleted for good.");
  };
  const ask = (key, onYes, normal) => (asking === key ? (
    <>
      <Btn variant="danger" onClick={async () => { setAsking(null); await onYes(); }}>Delete for good</Btn>
      <Btn variant="ghost" onClick={() => setAsking(null)}>Keep</Btn>
    </>
  ) : normal);

  return (
    <Modal title="Trash" wide onClose={close}>
      <div className="b-parts">
        <Segmented value={part} onChange={setPart}
          options={{ notes: `Notes (${notes.length})`, tasks: `Tasks (${tasks.length})`, pictures: `Pictures${pictures ? ` (${pictures.length})` : ""}` }} />
      </div>
      <small className="b-hint">
        {part === "notes"
          ? "Deleted notes stay here 30 days, then they are deleted for good. Restore puts a note back in its folder."
          : part === "tasks"
          ? "Deleted tasks (with their steps) stay here 30 days. Restore puts a task back in its note, under the same heading or task."
          : "Pictures you took out (old wallpapers, removed widgets…) stay here 30 days, then they are deleted for good."}
      </small>
      <div className="b-results">
        {part === "notes" && notes.map(({ p, at, to }) => (
          <div key={p} className="b-trash-row">
            <div>
              <div className="b-result-t">{fileName(to)}</div>
              <div className="b-result-s">{to.split("/").slice(0, -1).join(" / ") || "notes"} · {left(at)}</div>
            </div>
            {ask(p, () => purgeNote(p), (
              <>
                <Btn icon="arrow-up" onClick={() => restore(p)}>Restore</Btn>
                <Btn variant="ghost" icon="trash-2" onClick={() => setAsking(p)}>Delete</Btn>
              </>
            ))}
          </div>
        ))}
        {part === "notes" && !notes.length && <Empty>No deleted notes.</Empty>}

        {part === "tasks" && tasks.map((x) => (
          <div key={x.id} className="b-trash-row">
            <div>
              <div className="b-result-t">{taskName(x)}</div>
              <div className="b-result-s">
                {fileName(x.path)}{x.lines.length > 1 ? ` · with ${x.lines.length - 1} step${x.lines.length === 2 ? "" : "s"}` : ""} · {left(x.at)}
              </div>
            </div>
            {ask(x.id, () => purgeTask(x), (
              <>
                <Btn icon="arrow-up" onClick={() => restoreTask(x)}>Restore</Btn>
                <Btn variant="ghost" icon="trash-2" onClick={() => setAsking(x.id)}>Delete</Btn>
              </>
            ))}
          </div>
        ))}
        {part === "tasks" && !tasks.length && <Empty>No deleted tasks.</Empty>}

        {part === "pictures" && pictures?.map((x) => (
          <div key={x.path} className="b-trash-row">
            {/^video\//.test(x.type)
              ? <video className="b-trash-pic" src={imgSrc(x.path) + "#t=0.5"} muted playsInline preload="metadata" />
              : <img className="b-trash-pic" src={imgSrc(x.path)} alt="" loading="lazy" />}
            <div>
              <div className="b-result-t">{x.path.replace(/^Attachments\/\d+-/, "")}</div>
              <div className="b-result-s">{size(x.bytes ?? x.size * 0.75)} · {left(x.trashed_at)}</div>
            </div>
            {ask(x.path, () => purgePicture(x.path), (
              <>
                <Btn icon="arrow-up" onClick={() => useAgain(x.path, x.type)}>Use again</Btn>
                <Btn variant="ghost" icon="trash-2" onClick={() => setAsking(x.path)}>Delete</Btn>
              </>
            ))}
          </div>
        ))}
        {part === "pictures" && pictures && !pictures.length && (
          <Empty>No unused pictures. A picture lands here a few hours after nothing uses it any more.</Empty>
        )}
        {part === "pictures" && !pictures && <Empty>Loading…</Empty>}
      </div>
      <div className="b-modal-btns"><Btn onClick={close}>Close</Btn></div>
    </Modal>
  );
}
