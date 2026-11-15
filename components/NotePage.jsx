"use client";
// One note: read it (tick tasks, follow links) or edit its Markdown.
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { STATUSES, TPL, edit, fileName, folderPath, isActive, noteHref, parseFrontmatter, statusOf } from "@/lib/notes";
import { useApp } from "./AppProvider";
import Markdown from "./Markdown";
import { Btn, Empty, IconBtn, Segmented, useDialogs } from "./ui";

export default function NotePage() {
  const params = useParams();
  const router = useRouter();
  const { files, writeFile, trashNote, restoreNote, notice, editingRef } = useApp();
  const { confirm } = useDialogs();
  const segs = Array.isArray(params.path) ? params.path : [params.path];
  const path = segs.map((s) => { try { return decodeURIComponent(s); } catch { return s; } }).join("/");
  const f = files.get(path);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const ta = useRef();

  useEffect(() => { editingRef.current = editing; }, [editing, editingRef]);
  useEffect(() => { window.scrollTo(0, 0); }, [path]);

  const dirty = editing && text !== f?.content;
  const back = () => {
    if (dirty && !window.confirm("Leave without saving your changes?")) return;
    setEditing(false);
    router.push("/");
  };
  const startEdit = () => { setText(f.content); setEditing(true); setTimeout(() => ta.current?.focus(), 0); };
  const save = async () => {
    if (text !== f.content) {
      try { await writeFile(path, text); } catch (e) {
        if (e.message === "conflict") notice("This note was changed on another device. Your text is kept here; saving again replaces the other version.");
        return;
      }
      notice("Saved");
    }
    setEditing(false);
  };
  const onKey = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); save(); }
    if (e.key === "Tab") {
      // Tab indents, so subtasks can be typed.
      e.preventDefault();
      const el = e.currentTarget;
      el.setRangeText("\t", el.selectionStart, el.selectionEnd, "end");
      setText(el.value);
    }
  };

  return (
    <div className="b-root b-enter">
      <div className="b-note-top">
        <IconBtn icon="arrow-left" label="Back" onClick={back} />
        <div className="b-top-m">
          <div className="b-top-t">{fileName(path)}</div>
          <div className="b-top-s">{segs.slice(0, -1).map(decodeURIComponent).join(" / ") || "notes"}</div>
        </div>
        {f && (
          <div className="b-row">
            {editing ? (
              <>
                <Btn variant="ghost" onClick={() => { if (!dirty || window.confirm("Discard your changes?")) setEditing(false); }}>Cancel</Btn>
                <Btn variant="primary" icon="check" onClick={save}>Save</Btn>
              </>
            ) : path.startsWith(".trash/") ? (
              <Btn variant="primary" icon="arrow-up" onClick={async () => { const to = await restoreNote(path); if (to) router.replace(noteHref(to)); }}>Restore</Btn>
            ) : (
              <>
                <IconBtn icon="trash-2" label="Delete note" className="sm b-del"
                  onClick={() => confirm(`Delete "${fileName(path)}"?`, async () => { await trashNote(path); router.push("/"); })} />
                <Btn variant="primary" icon="pencil" onClick={startEdit}>Edit</Btn>
              </>
            )}
          </div>
        )}
      </div>
      {f && !editing && <StatusBar path={path} text={f.content} />}
      <div className="b-tile b-note">
        {!f ? <Empty>This note doesn&apos;t exist (it may have been deleted).</Empty>
          : editing ? (
            <textarea ref={ta} className="b-textarea b-editor" spellCheck={false} value={text}
              onChange={(e) => setText(e.target.value)} onKeyDown={onKey} />
          ) : <Markdown path={path} />}
      </div>
    </div>
  );
}

// Projects, courses and ongoing things have a status. Anything but "active" moves the
// note to its "not active" section on the dashboard (it never disappears).
function StatusBar({ path, text }) {
  const { files, processFile, notice } = useApp();
  if (path.startsWith(TPL + "/") || path.startsWith(".trash/")) return null;
  const { fm } = parseFrontmatter(text);
  const kinds = [["Projects", "Done & paused projects"], ["Academic", "Past courses"], ["Ongoing", "Stopped & paused"]];
  const kind = kinds.find(([name]) => path.startsWith(folderPath(files, name) + "/"));
  if (!kind && fm.status == null) return null;
  const cur = statusOf(fm);
  const options = Object.fromEntries([...STATUSES, ...(STATUSES.includes(cur) ? [] : [cur])].map((v) => [v, v[0].toUpperCase() + v.slice(1)]));
  const set = async (v) => {
    if (v === cur) return;
    const ok = await processFile(path, edit.setProp("status", v));
    if (!ok) return;
    notice(isActive({ status: v }) ? "Active again." : `Marked ${v}.` + (kind ? ` It's now under "${kind[1]}" on the dashboard.` : ""));
  };
  return (
    <div className="b-status">
      <span>Status</span>
      <Segmented value={cur} options={options} onChange={set} />
    </div>
  );
}
