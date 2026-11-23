import { AlertTriangle, Check, Loader2, Plus, X } from "lucide-react";
import {
  BlindSpot, CARD_W, KIND_LABEL, initials, SEVERITY_LABEL, severityColor,
} from "./types.ts";

type Props = {
  spot: BlindSpot;
  roleName: string | null;
  anchorName: string | null;
  open: boolean;
  adding: boolean;
  onOpen: () => void;
  onClose: () => void;
  onAdd: () => void;
  onDismiss: () => void;
  /** The spotlight is on: the rest of the map is grey, so make the gap itself glow. */
  spotlit?: boolean;
  onDragStart: (e: React.PointerEvent<HTMLDivElement>) => void;
};

/**
 * A gap in the map, drawn where the missing person would sit. The card itself is a dashed
 * placeholder; the suggestion and the warm path live in a popover so the canvas stays calm
 * until the rep actually asks who fills the seat.
 */
export default function BlindSpotCard({
  spot, roleName, anchorName, open, adding, spotlit, onOpen, onClose, onAdd, onDismiss, onDragStart,
}: Props) {
  const color = severityColor(spot.severity);
  const kind = KIND_LABEL[spot.kind ?? ""] ?? "Blind spot";
  const seatLabel = spot.kind === "org_hole" && anchorName
    ? `Reports to ${anchorName}`
    : spot.gapTitle ?? "Unknown";

  return (
    <div className="absolute" style={{ width: CARD_W }}>
      {/* Severity + gap type, floating clear of the card so the dashed outline stays clean. */}
      <div className="absolute left-1/2 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-white shadow-sm"
        style={{ top: -11, backgroundColor: color, zIndex: 2 }}
      >
        <AlertTriangle className="h-3 w-3" />
        {SEVERITY_LABEL[spot.severity ?? ""] ?? "Gap"} · {kind}
      </div>

      <div
        onPointerDown={onDragStart}
        onClick={(e) => { e.stopPropagation(); open ? onClose() : onOpen(); }}
        className={`cursor-pointer rounded-xl px-3 pb-3 pt-5 transition hover:bg-white ${spotlit ? "bg-white" : "bg-white/70"}`}
        style={{
          border: `2px dashed ${color}`,
          boxShadow: spotlit ? `0 0 0 6px ${color}22, 0 8px 24px ${color}33` : undefined,
        }}
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-dashed text-base font-semibold"
            style={{ borderColor: color, color }}
          >
            ?
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-500">Unknown</div>
            <div className="truncate text-xs text-slate-500" title={seatLabel}>{seatLabel}</div>
          </div>
        </div>
        <div className="mt-2 line-clamp-2 text-xs leading-snug text-slate-500">
          {spot.rationale}
        </div>
      </div>

      {open && (
        <div
          className="absolute left-0 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
          style={{ top: -12, zIndex: 40 }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-2 px-3 pb-2 pt-2.5">
            <div className="text-xs font-semibold uppercase tracking-wide" style={{ color }}>
              Fix the blind spot on your route
            </div>
            <button onClick={onClose} className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600" title="Close">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {spot.suggestedName ? (
            <div className="flex items-center gap-2.5 px-3 pb-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                style={{ backgroundColor: color }}
              >
                {initials(spot.suggestedName)}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-semibold text-slate-800">{spot.suggestedName}</span>
                  {spot.suggestedLinkedinUrl && (
                    <a href={spot.suggestedLinkedinUrl} target="_blank" rel="noreferrer" title="Open LinkedIn profile"
                      className="shrink-0 rounded hover:opacity-70"
                    >
                      <span>LinkedIn</span>
                    </a>
                  )}
                </div>
                <div className="truncate text-xs text-slate-500">
                  {spot.suggestedTitle}{roleName ? ` · ${roleName}` : ""}
                </div>
              </div>
            </div>
          ) : (
            <div className="px-3 pb-3 text-xs text-slate-600">{spot.rationale}</div>
          )}

          {spot.warmVia && (
            <div className="border-t border-slate-100 bg-slate-50 px-3 py-2.5">
              <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                Warm connection found
              </div>
              <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2 py-1">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-xs font-semibold text-white">
                  {initials(spot.warmVia)}
                </span>
                <span className="text-xs font-medium text-slate-800">{spot.warmVia}</span>
                {spot.warmViaTitle && <span className="text-xs text-slate-500">· {spot.warmViaTitle}</span>}
              </div>
              <div className="mt-1.5 text-xs leading-snug text-slate-600">{spot.warmDetail}</div>
            </div>
          )}

          <div className="flex items-stretch gap-px border-t border-slate-100">
            <button
              onClick={onAdd}
              disabled={adding}
              className="flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-white transition disabled:opacity-60"
              style={{ backgroundColor: "#065f46" }}
            >
              {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              {adding ? "Adding…" : "Add to map"}
            </button>
            <button
              onClick={onDismiss}
              className="flex items-center gap-1 bg-slate-100 px-3 text-xs font-medium text-slate-600 transition hover:bg-slate-200"
              title="Dismiss this blind spot"
            >
              <Check className="h-3.5 w-3.5" />
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
