import {
  AlertTriangle, Crosshair, Loader2, Plus, RefreshCw, RotateCcw, ShieldCheck, Snowflake,
  Sparkles, X,
} from "lucide-react";
import {
  BlindSpot, bySeverity, KIND_LABEL, SEVERITY_LABEL, severityColor,
} from "./types.ts";

type Props = {
  spots: BlindSpot[];
  contactNameById: Map<number, string>;
  scanning: boolean;
  addingId: number | null;
  /** Whether the rest of the map is greyed out behind this panel. */
  spotlight: boolean;
  onToggleSpotlight: () => void;
  onClose: () => void;
  onScan: () => void;
  onFocus: (spot: BlindSpot) => void;
  onAdd: (spot: BlindSpot) => void;
  onDismiss: (spot: BlindSpot, dismissed: boolean) => void;
};

/**
 * The list view of everything the scanner found, next to a coverage read-out. The map shows
 * where the gaps are; this panel is for working through them.
 */
export default function CoveragePanel({
  spots, contactNameById, scanning, addingId, spotlight, onToggleSpotlight, onClose, onScan,
  onFocus, onAdd, onDismiss,
}: Props) {
  const open = spots.filter((s) => s.status === "open").sort(bySeverity);
  const dismissed = spots.filter((s) => s.status === "dismissed");
  const resolved = spots.filter((s) => s.status === "resolved");
  const critical = open.filter((s) => s.severity === "critical").length;

  // Coverage is the share of checked seats that came back clean.
  const checked = open.length + resolved.length;
  const coverage = checked === 0 ? 100 : Math.round((resolved.length / checked) * 100);

  return (
    <div className="absolute right-3 top-3 z-30 flex w-80 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl" style={{ maxHeight: "calc(100% - 24px)" }}>
      <div className="flex items-start justify-between border-b border-slate-200 px-3.5 py-3">
        <div>
          <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            Blind spots
            {open.length > 0 && (
              <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-xs font-bold text-white">{open.length}</span>
            )}
          </div>
          <div className="mt-0.5 text-xs text-slate-500">
            {critical > 0
              ? `${critical} critical gap${critical > 1 ? "s" : ""} on the route to signature`
              : open.length > 0 ? "No critical gaps, but coverage is incomplete" : "Committee coverage looks complete"}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={onToggleSpotlight}
            title={spotlight ? "Show the whole map in colour" : "Grey out everything except the blind spots"}
            aria-pressed={spotlight}
            className={`rounded-md p-1 transition ${spotlight ? "bg-red-50 text-red-600" : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"}`}
          >
            <Sparkles className="h-4 w-4" />
          </button>
          <button onClick={onScan} disabled={scanning} title="Rescan the map"
            className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
          >
            {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </button>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="border-b border-slate-200 px-3.5 py-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-slate-600">Committee coverage</span>
          <span className="font-semibold text-slate-900">{coverage}%</span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full transition-all"
            style={{ width: `${Math.max(2, coverage)}%`, backgroundColor: coverage >= 70 ? "#059669" : coverage >= 40 ? "#ca8a04" : "#dc2626" }} />
        </div>
        <div className="mt-1.5 flex gap-3 text-xs text-slate-500">
          <span>{resolved.length} filled</span>
          <span>{open.length} open</span>
          <span>{dismissed.length} dismissed</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2.5 py-2">
        {open.length === 0 && (
          <div className="px-2 py-6 text-center">
            <ShieldCheck className="mx-auto h-6 w-6 text-emerald-600" />
            <div className="mt-1.5 text-xs font-medium text-slate-700">No open blind spots</div>
            <p className="mt-0.5 text-xs text-slate-500">Rescan after the map changes.</p>
          </div>
        )}

        {open.map((s) => {
          const color = severityColor(s.severity);
          const anchor = s.anchorContactId != null ? contactNameById.get(s.anchorContactId) : null;
          const isGhostSpot = s.posX != null && s.posY != null;
          return (
            <div key={s.id} className="mb-1.5 rounded-lg border border-slate-200 bg-white p-2.5 transition hover:border-slate-300">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                    <span className="truncate text-xs font-semibold text-slate-900">{s.gapTitle}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-xs uppercase tracking-wide" style={{ color }}>
                    {s.kind === "engagement_decay" ? <Snowflake className="h-2.5 w-2.5" /> : <AlertTriangle className="h-2.5 w-2.5" />}
                    {SEVERITY_LABEL[s.severity ?? ""] ?? "Gap"} · {KIND_LABEL[s.kind ?? ""] ?? "Blind spot"}
                  </div>
                </div>
                <button onClick={() => onDismiss(s, true)} title="Dismiss"
                  className="shrink-0 rounded p-0.5 text-slate-300 transition hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <p className="mt-1.5 text-xs leading-snug text-slate-600">{s.rationale}</p>

              {s.suggestedName && (
                <div className="mt-1.5 rounded-md bg-slate-50 px-2 py-1.5">
                  <div className="text-xs font-medium text-slate-800">
                    {s.suggestedName} <span className="font-normal text-slate-500">· {s.suggestedTitle}</span>
                  </div>
                  {s.warmVia && (
                    <div className="mt-0.5 text-xs text-emerald-700">
                      Warm path via {s.warmVia}: {s.warmDetail}
                    </div>
                  )}
                </div>
              )}

              <div className="mt-2 flex items-center gap-1.5">
                <button onClick={() => onFocus(s)}
                  className="flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                >
                  <Crosshair className="h-3 w-3" />
                  {isGhostSpot ? "Show on map" : anchor ? `Go to ${anchor.split(" ")[0]}` : "Show on map"}
                </button>
                {isGhostSpot && (
                  <button onClick={() => onAdd(s)} disabled={addingId === s.id}
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-white transition disabled:opacity-60"
                    style={{ backgroundColor: "#065f46" }}
                  >
                    {addingId === s.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                    Add to map
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {dismissed.length > 0 && (
          <div className="mt-2 border-t border-slate-100 pt-2">
            <div className="px-1 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Dismissed
            </div>
            {dismissed.map((s) => (
              <div key={s.id} className="mb-1 flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-slate-50">
                <span className="truncate text-xs text-slate-500">{s.gapTitle}</span>
                <button onClick={() => onDismiss(s, false)} title="Restore"
                  className="flex shrink-0 items-center gap-1 rounded p-0.5 text-slate-400 hover:text-slate-700"
                >
                  <RotateCcw className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
