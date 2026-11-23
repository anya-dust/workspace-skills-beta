import { useState } from "react";
import {
  ArrowUpRight, Check, Clock, Handshake, Layers, Loader2, RefreshCw, Snowflake, Sparkles,
  TrendingUp, UserPlus, Wallet, X, Zap,
} from "lucide-react";
import { ACCENT, DUST_LOGO_WHITE, severityColor } from "./types.ts";

export type QueueAction = {
  key: string;
  category: string;
  severity: string;
  score: number;
  title: string;
  why: string;
  contactId: number | null;
  blindSpotId: number | null;
  agentPrompt: string;
  agentTitle: string;
  cta: string;
  status: string;
  agentConversationUrl: string | null;
};

const CATEGORY_META: Record<string, { label: string; icon: React.ReactNode }> = {
  intro: { label: "Warm intro", icon: <Handshake className="h-3 w-3" /> },
  reengage: { label: "Going cold", icon: <Snowflake className="h-3 w-3" /> },
  "first-touch": { label: "First touch", icon: <UserPlus className="h-3 w-3" /> },
  expand: { label: "Expansion", icon: <TrendingUp className="h-3 w-3" /> },
  renewal: { label: "Renewal", icon: <Wallet className="h-3 w-3" /> },
  hygiene: { label: "Map hygiene", icon: <Layers className="h-3 w-3" /> },
};

type Props = {
  actions: QueueAction[];
  loading: boolean;
  busyKey: string | null;
  onClose: () => void;
  onRefresh: () => void;
  onAsk: (a: QueueAction) => void;
  onSetStatus: (a: QueueAction, status: "open" | "done" | "snoozed") => void;
  onFocus: (a: QueueAction) => void;
};

/**
 * The whole-map action queue. Ranked, so the rep works top-down instead of deciding what to
 * do next, and every row hands off to an agent conversation carrying the full context rather
 * than making them retype it.
 */
export default function ActionQueue({
  actions, loading, busyKey, onClose, onRefresh, onAsk, onSetStatus, onFocus,
}: Props) {
  const [showDone, setShowDone] = useState(false);
  const open = actions.filter((a) => a.status === "open");
  const closed = actions.filter((a) => a.status !== "open");
  const shown = showDone ? closed : open;
  const critical = open.filter((a) => a.severity === "critical").length;

  return (
    <div className="absolute right-3 top-3 z-30 flex w-96 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl" style={{ maxHeight: "calc(100% - 24px)" }}>
      <div className="flex items-start justify-between border-b border-slate-200 px-3.5 py-3">
        <div>
          <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
            <Zap className="h-4 w-4" style={{ color: ACCENT }} />
            Next best actions
            {open.length > 0 && (
              <span className="rounded-full px-1.5 py-0.5 text-xs font-bold text-white" style={{ backgroundColor: ACCENT }}>
                {open.length}
              </span>
            )}
          </div>
          <div className="mt-0.5 text-xs text-slate-500">
            {critical > 0
              ? `${critical} action${critical > 1 ? "s" : ""} that decide whether this deal moves`
              : open.length > 0 ? "Ranked by impact on the deal" : "Queue is clear"}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button onClick={onRefresh} disabled={loading} title="Recompute the queue"
            className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </button>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex gap-1 border-b border-slate-200 px-2.5 py-1.5">
        <button onClick={() => setShowDone(false)}
          className={`rounded-md px-2 py-1 text-xs font-medium transition ${!showDone ? "text-white" : "text-slate-600 hover:bg-slate-100"}`}
          style={!showDone ? { backgroundColor: ACCENT } : undefined}>
          Open ({open.length})
        </button>
        <button onClick={() => setShowDone(true)}
          className={`rounded-md px-2 py-1 text-xs font-medium transition ${showDone ? "text-white" : "text-slate-600 hover:bg-slate-100"}`}
          style={showDone ? { backgroundColor: ACCENT } : undefined}>
          Handled ({closed.length})
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2.5 py-2">
        {shown.length === 0 && (
          <div className="px-2 py-8 text-center">
            <Check className="mx-auto h-6 w-6 text-emerald-600" />
            <div className="mt-1.5 text-xs font-medium text-slate-700">
              {showDone ? "Nothing handled yet" : "Nothing queued"}
            </div>
          </div>
        )}

        {shown.map((a, i) => {
          const color = severityColor(a.severity === "low" ? "medium" : a.severity);
          const meta = CATEGORY_META[a.category] ?? { label: a.category, icon: <Sparkles className="h-3 w-3" /> };
          const busy = busyKey === a.key;
          return (
            <div key={a.key} className="mb-1.5 rounded-lg border border-slate-200 bg-white p-2.5 transition hover:border-slate-300">
              <div className="flex items-start gap-2">
                {!showDone && (
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: color }}>
                    {i + 1}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-semibold text-slate-900" title={a.title}>{a.title}</div>
                  <div className="mt-0.5 flex items-center gap-1 text-xs font-medium uppercase tracking-wide" style={{ color }}>
                    {meta.icon}{meta.label}
                  </div>
                  <p className="mt-1 text-xs leading-snug text-slate-600">{a.why}</p>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <button onClick={() => onAsk(a)} disabled={busy}
                  className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold text-white transition disabled:opacity-60"
                  style={{ backgroundColor: ACCENT }}
                  title="Open a Dust conversation preloaded with the full context">
                  {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <img src={DUST_LOGO_WHITE} alt="" className="h-3 w-3" />}
                  {busy ? "Starting…" : a.cta}
                </button>

                {a.agentConversationUrl && (
                  <a href={a.agentConversationUrl} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                    title="Open the conversation this action started">
                    <ArrowUpRight className="h-3 w-3" /> Conversation
                  </a>
                )}

                {a.contactId != null && (
                  <button onClick={() => onFocus(a)}
                    className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50">
                    Show on map
                  </button>
                )}

                {a.status === "open" ? (
                  <>
                    <button onClick={() => onSetStatus(a, "done")} title="Mark done"
                      className="ml-auto rounded-md border border-slate-200 p-1 text-slate-400 transition hover:bg-emerald-50 hover:text-emerald-700">
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => onSetStatus(a, "snoozed")} title="Snooze"
                      className="rounded-md border border-slate-200 p-1 text-slate-400 transition hover:bg-slate-50 hover:text-slate-700">
                      <Clock className="h-3.5 w-3.5" />
                    </button>
                  </>
                ) : (
                  <button onClick={() => onSetStatus(a, "open")}
                    className="ml-auto rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-500 transition hover:bg-slate-50">
                    Reopen
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
