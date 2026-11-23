import {
  Activity, BarChart3, Building2, Clock, Gauge, Headphones, KeyRound, Layers, Smile, Ticket,
  TrendingDown, TrendingUp, Users, X, Zap,
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, ResponsiveContainer, Tooltip,
  XAxis, YAxis,
} from "recharts";
import {
  AccountMonth, AccountUsage, Contact, FeatureUse, ProductUsage, UsageDay, ACCENT, compactNumber,
  healthColor, relativeDay, SEAT_LABEL, signedPct, sparklinePath,
} from "./types.ts";

// ---------------------------------------------------------------- card preview

/**
 * The three-metric strip on a contact card. Deliberately small: it answers "is this person
 * actually using the product" at a glance, and defers everything else to the detail view.
 */
export function UsageStrip({
  usage, days, onOpen,
}: {
  usage: ProductUsage | undefined;
  days: UsageDay[];
  onOpen: () => void;
}) {
  const seat = usage?.seatStatus ?? "none";
  const health = usage?.healthScore ?? 0;
  const hc = healthColor(usage?.healthScore);
  const series = days.map((d) => d.sessions ?? 0);
  const path = sparklinePath(series, 92, 18);
  const trend = usage?.trendPct ?? 0;

  if (!usage || seat === "none") {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); onOpen(); }}
        className="mt-2 flex w-full items-center justify-between rounded-md border border-dashed border-slate-300 bg-slate-50 px-2 py-1.5 text-left transition hover:border-slate-400 hover:bg-slate-100"
        title="No product seat. Click for the full usage view."
      >
        <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
          <Gauge className="h-3 w-3" /> No product seat
        </span>
        <span className="text-xs text-slate-400">View</span>
      </button>
    );
  }

  return (
    <button
      onClick={(e) => { e.stopPropagation(); onOpen(); }}
      className="mt-2 w-full rounded-md border border-slate-200 bg-slate-50/80 px-2 py-1.5 text-left transition hover:border-slate-300 hover:bg-white"
      title="Click for full product usage"
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <Gauge className="h-3 w-3" /> Product usage
        </span>
        <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: hc }}>
          {health}
          <span className="font-normal text-slate-400">health</span>
        </span>
      </div>

      <div className="mt-1 flex items-end gap-2">
        {path && (
          <svg width="92" height="18" className="shrink-0 overflow-visible">
            <path d={path} fill="none" stroke={hc} strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
        )}
        <span className="flex items-center gap-0.5 text-xs font-semibold"
          style={{ color: trend >= 0 ? "#059669" : "#dc2626" }}
        >
          {trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {signedPct(trend)}
        </span>
      </div>

      <div className="mt-1 flex items-center gap-2 text-xs text-slate-600">
        <span><b className="font-semibold text-slate-800">{usage.sessions30d ?? 0}</b> sessions</span>
        <span className="text-slate-300">|</span>
        <span><b className="font-semibold text-slate-800">{usage.activeDays30d ?? 0}</b>/30 days</span>
        <span className="text-slate-300">|</span>
        <span className="truncate" title={SEAT_LABEL[seat]}>{seat === "active" ? "Active" : seat === "churned" ? "Lapsed" : "Idle"}</span>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------- shared bits

function Metric({
  icon, label, value, sub, color,
}: { icon: React.ReactNode; label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
        {icon}{label}
      </div>
      <div className="mt-1 text-xl font-semibold" style={{ color: color ?? "#0f172a" }}>{value}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

function Modal({
  title, subtitle, onClose, children, wide,
}: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 p-4 pt-10" onClick={onClose}>
      <div
        className={`flex max-h-full w-full flex-col overflow-hidden rounded-xl bg-white shadow-2xl ${wide ? "max-w-4xl" : "max-w-2xl"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-3.5">
          <div>
            <div className="text-base font-semibold text-slate-900">{title}</div>
            {subtitle && <div className="text-xs text-slate-500">{subtitle}</div>}
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

const tipStyle = {
  contentStyle: { fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" },
  labelStyle: { fontSize: 11, color: "#64748b" },
};

// ---------------------------------------------------------------- contact detail

export function ContactUsageModal({
  contact, usage, days, features, onClose,
}: {
  contact: Contact;
  usage: ProductUsage | undefined;
  days: UsageDay[];
  features: FeatureUse[];
  onClose: () => void;
}) {
  const seat = usage?.seatStatus ?? "none";
  const hc = healthColor(usage?.healthScore);
  const trend = usage?.trendPct ?? 0;
  const chartData = days.map((d) => ({
    day: (d.day ?? "").slice(5),
    sessions: d.sessions ?? 0,
    minutes: d.minutes ?? 0,
  }));
  const featureData = features
    .map((f) => ({ feature: f.feature ?? "", uses: f.uses30d ?? 0, adoption: f.adoptionPct ?? 0 }))
    .sort((a, b) => b.uses - a.uses);

  return (
    <Modal
      title={`${contact.name ?? "Contact"} · product usage`}
      subtitle={[contact.jobTitle, usage?.licenseTier, SEAT_LABEL[seat]].filter(Boolean).join(" · ")}
      onClose={onClose}
      wide
    >
      {seat === "none" ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
          <Gauge className="mx-auto h-6 w-6 text-slate-400" />
          <div className="mt-2 text-sm font-medium text-slate-700">No product seat</div>
          <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">
            {contact.name ?? "This contact"} has never been provisioned. There is no adoption story
            to tell here yet, which makes them a pure relationship play rather than an expansion one.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
            <Metric icon={<Gauge className="h-3 w-3" />} label="Health score" value={`${usage?.healthScore ?? 0}`}
              sub={`${signedPct(trend)} vs prior 30d`} color={hc} />
            <Metric icon={<Activity className="h-3 w-3" />} label="Sessions 30d" value={`${usage?.sessions30d ?? 0}`}
              sub={`${usage?.sessions90d ?? 0} over 90d`} />
            <Metric icon={<Clock className="h-3 w-3" />} label="Time in product" value={`${compactNumber(usage?.minutes30d)}m`}
              sub={`${usage?.activeDays30d ?? 0} of 30 days active`} />
            <Metric icon={<Zap className="h-3 w-3" />} label="Actions 30d" value={compactNumber(usage?.actions30d)}
              sub={usage?.topFeature ? `Top: ${usage.topFeature}` : undefined} />
            <Metric icon={<KeyRound className="h-3 w-3" />} label="API calls 30d" value={compactNumber(usage?.apiCalls30d)} />
            <Metric icon={<Users className="h-3 w-3" />} label="Seats in their org" value={`${usage?.seatsManaged ?? 0}`} />
            <Metric icon={<Clock className="h-3 w-3" />} label="Last seen" value={relativeDay(usage?.lastSeenAt) ?? "never"}
              sub={usage?.firstSeenAt ? `First seen ${relativeDay(usage.firstSeenAt)}` : undefined} />
            <Metric icon={<Smile className="h-3 w-3" />} label="NPS" value={usage?.nps != null ? `${usage.nps}` : "no response"} />
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
              <BarChart3 className="h-3.5 w-3.5" style={{ color: ACCENT }} /> Daily sessions, last 30 days
            </div>
            <ResponsiveContainer width="100%" height={190}>
              <AreaChart data={chartData} margin={{ top: 8, right: 16, left: -8, bottom: 4 }}>
                <defs>
                  <linearGradient id="sessGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={ACCENT} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={ACCENT} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} interval={4} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" allowDecimals={false} />
                <Tooltip {...tipStyle} formatter={(value, name) => [value, name === "sessions" ? "Sessions" : "Minutes"]} />
                <Area type="monotone" dataKey="sessions" stroke={ACCENT} strokeWidth={2} fill="url(#sessGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {featureData.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                <Layers className="h-3.5 w-3.5" style={{ color: ACCENT }} /> Feature adoption, last 30 days
              </div>
              <ResponsiveContainer width="100%" height={Math.max(150, featureData.length * 34)}>
                <BarChart data={featureData} layout="vertical" margin={{ top: 4, right: 28, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} stroke="#94a3b8" allowDecimals={false} />
                  <YAxis type="category" dataKey="feature" width={135} tick={{ fontSize: 10 }} stroke="#94a3b8" />
                  <Tooltip {...tipStyle} formatter={(value, name) => [value, name === "uses" ? "Uses" : "Adoption %"]} />
                  <Bar dataKey="uses" radius={[0, 4, 4, 0]}>
                    {featureData.map((f, i) => (
                      <Cell key={f.feature} fill={i === 0 ? ACCENT : "#c4b5fd"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------- account rollup

/** Compact top-bar button: health, seat coverage and a trend sparkline. */
export function AccountUsageBadge({
  account, monthly, onOpen,
}: { account: AccountUsage | null; monthly: AccountMonth[]; onOpen: () => void }) {
  if (!account) return null;
  const hc = healthColor(account.healthScore);
  const path = sparklinePath(monthly.map((m) => m.activeUsers ?? 0), 46, 16);
  const trend = account.trendPct ?? 0;
  const seatPct = account.seatsLicensed
    ? Math.round(((account.seatsActive ?? 0) / account.seatsLicensed) * 100)
    : 0;

  return (
    <button
      onClick={onOpen}
      title="Account product usage. Click for the full view."
      className="flex items-center gap-2.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 transition hover:border-slate-300 hover:bg-slate-50"
    >
      <span className="flex items-center gap-1.5">
        <span className="relative flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white"
          style={{ backgroundColor: hc }}
        >
          {account.healthScore ?? 0}
        </span>
        <span className="hidden text-left leading-tight sm:block">
          <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">Product usage</span>
          <span className="block text-xs font-semibold text-slate-800">
            {account.seatsActive ?? 0}/{account.seatsLicensed ?? 0} seats · {seatPct}%
          </span>
        </span>
      </span>
      {path && (
        <svg width="46" height="16" className="hidden shrink-0 sm:block">
          <path d={path} fill="none" stroke={hc} strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      )}
      <span className="flex items-center gap-0.5 text-xs font-semibold"
        style={{ color: trend >= 0 ? "#059669" : "#dc2626" }}
      >
        {trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        {signedPct(trend)}
      </span>
    </button>
  );
}

export function AccountUsageModal({
  companyName, account, monthly, features, committee, onClose,
}: {
  companyName: string;
  account: AccountUsage;
  monthly: AccountMonth[];
  features: { feature: string; uses: number }[];
  committee: { role: string; color: string; health: number; people: number }[];
  onClose: () => void;
}) {
  const hc = healthColor(account.healthScore);
  const monthData = monthly.map((m) => ({
    month: (m.month ?? "").slice(2),
    activeUsers: m.activeUsers ?? 0,
    seatsLicensed: m.seatsLicensed ?? 0,
  }));
  const renewalIn = account.renewalDate
    ? Math.round((new Date(`${account.renewalDate}T00:00:00Z`).getTime() - Date.now()) / 86400000)
    : null;

  return (
    <Modal
      title={`${companyName} · account product usage`}
      subtitle={account.renewalDate
        ? `Renewal ${account.renewalDate}${renewalIn != null ? ` (${renewalIn} days)` : ""}`
        : undefined}
      onClose={onClose}
      wide
    >
      <div className="space-y-4">
        <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
          <Metric icon={<Gauge className="h-3 w-3" />} label="Account health" value={`${account.healthScore ?? 0}`}
            sub={`${signedPct(account.trendPct)} over 12 months`} color={hc} />
          <Metric icon={<Users className="h-3 w-3" />} label="Seats" value={`${account.seatsActive ?? 0}/${account.seatsLicensed ?? 0}`}
            sub="active of licensed" />
          <Metric icon={<Activity className="h-3 w-3" />} label="Weekly active" value={compactNumber(account.wau)}
            sub={`${compactNumber(account.mau)} monthly active`} />
          <Metric icon={<Building2 className="h-3 w-3" />} label="ARR" value={`$${compactNumber(account.arr)}`} color={ACCENT} />
          <Metric icon={<Ticket className="h-3 w-3" />} label="Open tickets" value={`${account.openTickets ?? 0}`} />
          <Metric icon={<Headphones className="h-3 w-3" />} label="CSAT" value={account.csat != null ? `${account.csat}/5` : "n/a"} />
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
            <TrendingUp className="h-3.5 w-3.5" style={{ color: ACCENT }} /> Active users vs licensed seats, 12 months
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={monthData} margin={{ top: 8, right: 20, left: -8, bottom: 4 }}>
              <defs>
                <linearGradient id="auGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={ACCENT} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={ACCENT} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" />
              <Tooltip {...tipStyle}
                formatter={(value, name) => [value, name === "activeUsers" ? "Active users" : "Licensed seats"]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="activeUsers" name="Active users" stroke={ACCENT} strokeWidth={2} fill="url(#auGrad)" />
              <Line type="monotone" dataKey="seatsLicensed" name="Licensed seats" stroke="#94a3b8" strokeWidth={2} strokeDasharray="4 4" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
          {features.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                <Layers className="h-3.5 w-3.5" style={{ color: ACCENT }} /> Top features across the account
              </div>
              <div className="space-y-1.5">
                {features.slice(0, 6).map((f, i) => {
                  const max = features[0].uses || 1;
                  return (
                    <div key={f.feature} className="flex items-center gap-2">
                      <span className="w-32 shrink-0 truncate text-xs text-slate-600" title={f.feature}>{f.feature}</span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <span className="block h-full rounded-full"
                          style={{ width: `${Math.round((f.uses / max) * 100)}%`, backgroundColor: i === 0 ? ACCENT : "#c4b5fd" }} />
                      </span>
                      <span className="w-10 shrink-0 text-right text-xs font-semibold text-slate-700">{compactNumber(f.uses)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {committee.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                <Gauge className="h-3.5 w-3.5" style={{ color: ACCENT }} /> Adoption by deal role
              </div>
              <div className="space-y-1.5">
                {committee.map((c) => (
                  <div key={c.role} className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
                    <span className="w-32 shrink-0 truncate text-xs text-slate-600" title={c.role}>{c.role}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <span className="block h-full rounded-full"
                        style={{ width: `${Math.max(2, c.health)}%`, backgroundColor: healthColor(c.health) }} />
                    </span>
                    <span className="w-14 shrink-0 text-right text-xs font-semibold text-slate-700">
                      {c.health} <span className="font-normal text-slate-400">({c.people})</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
