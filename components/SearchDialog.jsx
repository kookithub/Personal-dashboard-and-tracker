"use client";
import { useMemo, useState } from "react";
import { TPL, safeName } from "@/lib/notes";
import { useApp } from "./AppProvider";
import { useNav } from "./board";
import { Btn, Empty, Ico, Modal } from "./ui";

export default function SearchDialog({ close }) {
  const { pages, files, resolve, ensureNote } = useApp();
  const { openPath } = useNav();
  const [q, setQ] = useState("");
  const hits = useMemo(() => {
    const query = q.trim().toLowerCase();
    const all = pages.filter((p) => !p.file.path.startsWith(TPL + "/"));
    if (!query) return [...all].sort((a, b) => b.file.mtime - a.file.mtime).slice(0, 40).map((p) => ({ p, snip: "" }));
    return all
      .map((p) => {
        const inName = p.file.name.toLowerCase().includes(query);
        const text = files.get(p.file.path).content;
        const at = text.toLowerCase().indexOf(query);
        return { p, score: inName ? 2 : at >= 0 ? 1 : 0, snip: at >= 0 && !inName ? text.slice(Math.max(0, at - 30), at + 70).replace(/\s+/g, " ") : "" };
      })
      .filter((x) => x.score)
      .sort((a, b) => b.score - a.score || a.p.file.name.localeCompare(b.p.file.name))
      .slice(0, 40);
  }, [q, pages, files]);
  const name = safeName(q);
  const go = (path) => { close(); openPath(path); };
  return (
    <Modal title="Search notes" wide onClose={close}>
      <input className="b-input" type="search" autoFocus value={q} placeholder="Note name or text…" onChange={(e) => setQ(e.target.value)} />
      <div className="b-results">
        {hits.map(({ p, snip }) => (
          <div key={p.file.path} className="b-result" onClick={() => go(p.file.path)}>
            <Ico name="file-text" />
            <div>
              <div className="b-result-t">{p.file.name}</div>
              <div className="b-result-s">{snip ? "…" + snip + "…" : p.file.folder || "notes"}</div>
            </div>
          </div>
        ))}
        {!hits.length && <Empty>No notes found.</Empty>}
        {name && !resolve(name) && (
          <Btn icon="plus" style={{ marginTop: 10 }} onClick={async () => go(await ensureNote("", name, "none"))}>New note &quot;{name}&quot;</Btn>
        )}
      </div>
    </Modal>
  );
}
