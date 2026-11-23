import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { NoteT } from "./types.ts";

type Props = {
  note: NoteT;
  onDragStart: (id: number, e: React.PointerEvent) => void;
  onSave: (id: number, body: string) => void;
  onDelete: (id: number) => void;
};

export default function StickyNote(p: Props) {
  const { note: n } = p;
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(n.body ?? "");
  const [hover, setHover] = useState(false);

  useEffect(() => { setBody(n.body ?? ""); }, [n.body]);

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onPointerDown={(e) => {
        e.stopPropagation();
        if (editing) return;
        const t = e.target as HTMLElement;
        if (t.closest("button, textarea")) return;
        p.onDragStart(n.id, e);
      }}
      onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}
      className="absolute rounded-xl border border-yellow-200 p-3 shadow-sm select-none"
      style={{
        left: n.posX ?? 0, top: n.posY ?? 0,
        width: n.width ?? 220, minHeight: n.height ?? 140,
        background: n.color ?? "#fef9c3",
        cursor: editing ? "text" : "grab",
        zIndex: hover || editing ? 25 : 5,
      }}
    >
      {editing ? (
        <textarea
          autoFocus
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onBlur={() => { setEditing(false); p.onSave(n.id, body); }}
          className="h-28 w-full resize-none text-sm text-gray-800 outline-none"
          style={{ background: "transparent" }}
        />
      ) : (
        <p className="whitespace-pre-wrap text-sm text-gray-800">{n.body || "Double-click to edit…"}</p>
      )}
      {hover && !editing && (
        <button
          onClick={(e) => { e.stopPropagation(); p.onDelete(n.id); }}
          className="absolute right-2 top-2 rounded-md bg-white p-1 text-gray-500 shadow hover:text-red-600"
          title="Delete note"
        ><Trash2 size={13} /></button>
      )}
    </div>
  );
}
