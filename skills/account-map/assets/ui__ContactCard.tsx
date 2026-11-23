import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ExternalLink,
  Image as ImageIcon, Link as LinkIcon, Mail, Pencil, Plus, Sparkles, Trash2, UserRound,
} from "lucide-react";
import {
  ACCENT, BlindSpot, CARD_W, Contact, ProductUsage, Role,
  UsageDay, DUST_LOGO_WHITE, roleColor, severityColor, tint, isDark,
  relativeDay,
} from "./types.ts";
import { UsageStrip } from "./usage.tsx";

export type Dir = "up" | "down" | "left" | "right";

type Props = {
  contact: Contact;
  roles: Role[];
  companyName: string;
  editing: boolean;
  selected: boolean;
  connectSource: number | null; // id of the card a connection is being drawn from
  zoom: number;
  /** This person's usage of the product we are selling them. */
  productUsage: ProductUsage | undefined;
  /** 30-day daily series behind the sparkline on the card. */
  usageDays: UsageDay[];
  /** Open blind spots anchored to this contact (going cold, seat filled but never engaged). */
  warnings: BlindSpot[];
  onOpenUsage: (c: Contact) => void;
  /** True when a filter or search is active and this card is not part of the result set.
      Dimmed rather than hidden so the map keeps its shape and spatial memory. */
  dimmed: boolean;
  /** Greyed out by the blind-spot spotlight rather than by a filter: softer, desaturated. */
  dimSoft?: boolean;
  onMeasure: (id: number, h: number) => void;
  onDragStart: (id: number, e: React.PointerEvent) => void;
  onSelect: (id: number) => void;
  onStartEdit: (id: number) => void;
  onCancelEdit: () => void;
  onSaveEdit: (id: number, fields: Partial<Contact>) => void;
  onDelete: (id: number) => void;
  onToggleContacted: (c: Contact) => void;
  onAssignRole: (c: Contact, roleId: number | null) => void;
  onAddDirectional: (c: Contact, dir: Dir) => void;
  onStartConnect: (id: number) => void;
  onCompleteConnect: (id: number) => void;
  onOpenAgent: (c: Contact) => void;
};

/** A brand mark plus a hyperlink cue, sized to sit three-across on a card. */
function LinkChip({
  href, label, onClick,
}: { href: string; label: string; onClick: (e: React.MouseEvent) => void }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-1.5 py-1 transition hover:border-gray-300 hover:bg-gray-50"
    >
      <span className="text-xs">{label}</span>
      <ExternalLink size={9} className="text-gray-400" />
    </a>
  );
}

export default function ContactCard(p: Props) {
  const { contact: c } = p;
  const role = p.roles.find((r) => r.id === c.roleId);
  const color = c.roleId != null ? roleColor(role) : null;
  const roleColorForPill = color;
  // Worst open blind spot pinned to this person, shown inline under the title.
  const topWarning: BlindSpot | undefined = [...p.warnings]
    .sort((a, b) => (a.severity === "critical" ? 0 : a.severity === "high" ? 1 : 2)
      - (b.severity === "critical" ? 0 : b.severity === "high" ? 1 : 2))[0];
  const ref = useRef<HTMLDivElement | null>(null);
  const [hover, setHover] = useState(false);
  const [rolePickerOpen, setRolePickerOpen] = useState(false);
  const [ctxOpen, setCtxOpen] = useState(false);
  const hoverTimer = useRef<number | null>(null);
  const hoverOn = () => {
    if (hoverTimer.current != null) { clearTimeout(hoverTimer.current); hoverTimer.current = null; }
    setHover(true);
  };
  const hoverOff = () => {
    if (hoverTimer.current != null) clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => { setHover(false); setRolePickerOpen(false); hoverTimer.current = null; }, 180);
  };
  useEffect(() => () => { if (hoverTimer.current != null) clearTimeout(hoverTimer.current); }, []);

  // edit form state
  const [fName, setFName] = useState(c.name ?? "");
  const [fTitle, setFTitle] = useState(c.jobTitle ?? "");
  const [fEmail, setFEmail] = useState(c.email ?? "");
  const [fLinkedin, setFLinkedin] = useState(c.linkedinUrl ?? "");
  const [fCrm, setFCrm] = useState(c.crmUrl ?? "");
  const [fOwner, setFOwner] = useState(c.ownerName ?? "");
  const [fNotes, setFNotes] = useState(c.notes ?? "");
  const [fCustom, setFCustom] = useState(c.customContext ?? "");
  const [fAvatar, setFAvatar] = useState(c.avatarUrl ?? "");
  const [fRoleId, setFRoleId] = useState<number | null>(c.roleId);
  const [avatarMode, setAvatarMode] = useState<"upload" | "link" | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [editRoleOpen, setEditRoleOpen] = useState(false);

  useEffect(() => {
    if (p.editing) {
      setFName(c.name ?? "");
      setFTitle(c.jobTitle ?? "");
      setFEmail(c.email ?? "");
      setFLinkedin(c.linkedinUrl ?? "");
      setFCrm(c.crmUrl ?? "");
      setFOwner(c.ownerName ?? "");
      setFNotes(c.notes ?? "");
      setFCustom(c.customContext ?? "");
      setFAvatar(c.avatarUrl ?? "");
      setFRoleId(c.roleId);
      setAvatarMode(null);
      setAvatarError(null);
      setEditRoleOpen(false);
    }
  }, [p.editing, c.id]);

  useEffect(() => {
    if (ref.current) p.onMeasure(c.id, ref.current.offsetHeight);
  });

  const connecting = p.connectSource != null;
  const isConnectSource = p.connectSource === c.id;
  const isConnectTarget = connecting && !isConnectSource;
  const borderColor = isConnectTarget ? "#34d399" : isConnectSource ? "#14b8a6" : color ?? "#e5e7eb";
  const bg = color ? tint(color, 0.18) : "#ffffff";
  const editRole = p.roles.find((r) => r.id === fRoleId);

  const stop = (e: React.SyntheticEvent) => e.stopPropagation();


  function handleAvatarFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setAvatarError("Choose an image file.");
      return;
    }
    if (file.size > 8_000_000) {
      setAvatarError("That image is too large. Choose one under 8 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const side = 256;
        const scale = Math.min(side / image.width, side / image.height, 1);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) { setAvatarError("Could not process that image."); return; }
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        setFAvatar(canvas.toDataURL("image/jpeg", 0.78));
        setAvatarMode("upload");
        setAvatarError(null);
      };
      image.onerror = () => setAvatarError("Could not read that image.");
      image.src = String(reader.result ?? "");
    };
    reader.onerror = () => setAvatarError("Could not read that image.");
    reader.readAsDataURL(file);
  }

  return (
    <div
      ref={ref}
      onMouseEnter={hoverOn}
      onMouseLeave={hoverOff}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (p.editing || isConnectTarget) return;
        const t = e.target as HTMLElement;
        if (t.closest("button, a, input, textarea, select")) return;
        p.onStartEdit(c.id);
      }}
      onPointerDown={(e) => {
        e.stopPropagation();
        if (isConnectTarget) return;
        const t = e.target as HTMLElement;
        if (t.closest("button, a, input, textarea, select")) return;
        p.onSelect(c.id);
        if (!p.editing) p.onDragStart(c.id, e);
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (isConnectTarget) p.onCompleteConnect(c.id);
      }}
      className="absolute rounded-2xl border-2 bg-white shadow-sm select-none"
      style={{
        left: c.posX ?? 0,
        top: c.posY ?? 0,
        width: CARD_W,
        borderColor,
        background: bg,
        boxShadow: isConnectSource
          ? "0 0 0 4px rgba(20,184,166,0.45)"
          : isConnectTarget
            ? "0 0 0 3px rgba(52,211,153,0.35)"
            : p.selected ? "0 0 0 3px rgba(59,130,246,0.35)" : undefined,
        cursor: isConnectTarget ? "crosshair" : "grab",
        zIndex: p.editing || hover || rolePickerOpen ? 30 : p.dimmed ? 5 : 10,
        opacity: p.dimmed ? (p.dimSoft ? 0.45 : 0.2) : 1,
        filter: p.dimmed ? (p.dimSoft ? "grayscale(1)" : "saturate(0.25)") : undefined,
        transition: "opacity 180ms ease, filter 180ms ease",
      }}
    >
      {isConnectTarget && (
        <div
          className={`absolute left-1/2 z-40 whitespace-nowrap rounded-md px-3 py-1 text-xs font-medium text-white shadow ${hover ? "bg-emerald-500" : "bg-emerald-400"}`}
          style={{ top: -32, transform: "translateX(-50%)", pointerEvents: "none" }}
        >
          Click to connect
        </div>
      )}
      {isConnectSource && (
        <div
          className="absolute left-1/2 z-40 whitespace-nowrap rounded-md bg-teal-600 px-3 py-1 text-xs font-medium text-white shadow"
          style={{ top: -32, transform: "translateX(-50%)", pointerEvents: "none" }}
        >
          Connecting from here
        </div>
      )}

      {/* Deal role, as a pill straddling the top edge. It sits at -10 so it clears the
          hover controls above (which end at -14) and reads as the card's headline fact
          rather than something buried in the body. Doubles as the role picker. */}
      {!connecting && (
        <div className="absolute left-1/2 flex flex-col items-center" style={{ top: -10, transform: "translateX(-50%)", zIndex: rolePickerOpen ? 60 : 25 }}>
          <button
            onClick={(e) => { e.stopPropagation(); setRolePickerOpen(!rolePickerOpen); }}
            onPointerDown={stop}
            className="flex max-w-full items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide shadow-sm transition hover:brightness-95"
            style={roleColorForPill
              ? { backgroundColor: roleColorForPill, borderColor: roleColorForPill, color: isDark(roleColorForPill) ? "#ffffff" : "#1f2937" }
              : { backgroundColor: "#ffffff", borderColor: "#d1d5db", color: "#6b7280" }}
            title={role?.name ? `Deal role: ${role.name}. Click to change.` : "Assign a deal role"}
          >
            <span className="truncate">{role?.name ?? "No role"}</span>
            <ChevronDown size={10} className="shrink-0 opacity-70" />
          </button>
          {rolePickerOpen && (
            <div
              onPointerDown={stop}
              className="mt-1 max-h-64 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-xl"
              style={{ width: CARD_W - 40 }}
            >
              <button onClick={(e) => { e.stopPropagation(); p.onAssignRole(c, null); setRolePickerOpen(false); }} className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50">No Role Assigned</button>
              {p.roles.map((r) => (
                <button key={r.id} onClick={(e) => { e.stopPropagation(); p.onAssignRole(c, r.id); setRolePickerOpen(false); }} className="block w-full px-3 py-2 text-left text-sm" style={{ background: tint(roleColor(r), 0.35) }}>
                  {r.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {p.editing ? (
        <div className="p-4" onPointerDown={stop}>
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-1" style={{ width: 150 }}>
              <button onClick={(e) => { e.stopPropagation(); setAvatarMode("upload"); setAvatarError(null); avatarInputRef.current?.click(); }} className="flex items-center justify-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-xs text-blue-600 hover:bg-blue-100">
                <ImageIcon size={12} /> Upload
              </button>
              <button onClick={(e) => { e.stopPropagation(); setAvatarMode("link"); setAvatarError(null); }} className="flex items-center justify-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs text-emerald-600 hover:bg-emerald-100">
                <LinkIcon size={12} /> Link
              </button>
              <input ref={avatarInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={handleAvatarFile} />
            </div>
            <div className="flex flex-col items-center">
              <button
                onClick={(e) => { e.stopPropagation(); p.onToggleContacted(c); }}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${c.isContacted ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-gray-200 bg-gray-50 text-gray-500"}`}
                title={c.isContacted ? "Mark not contacted" : "Mark contacted"}
              >
                {c.isContacted ? "Contacted" : "Not contacted"}
              </button>
            </div>
          </div>
          {avatarMode === "link" && (
            <input value={fAvatar} onChange={(e) => setFAvatar(e.target.value)} placeholder="Image URL…" className="mt-2 w-full rounded-lg border border-gray-200 px-2 py-1 text-xs" />
          )}
          {avatarMode === "upload" && <p className="mt-2 text-xs text-gray-500">Uploaded image ready to save.</p>}
          {avatarError && <p className="mt-1 text-xs text-red-600">{avatarError}</p>}
          <div className="mt-2 flex justify-center">
            {fAvatar ? (
              <img src={fAvatar} alt="" className="h-14 w-14 rounded-full object-cover" />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-gray-400"><UserRound size={26} /></div>
            )}
          </div>
          <div className="relative mt-3">
            <button
              onClick={() => setEditRoleOpen(!editRoleOpen)}
              className="flex w-full items-center justify-between rounded-lg bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-800"
            >
              <span>{editRole?.name ?? "No Role Assigned"}</span>
              <ChevronDown size={16} />
            </button>
            {editRoleOpen && (
              <div className="absolute left-0 right-0 z-50 mt-1 max-h-64 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                <button onClick={() => { setFRoleId(null); setEditRoleOpen(false); }} className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50">No Role Assigned</button>
                {p.roles.map((r) => (
                  <button key={r.id} onClick={() => { setFRoleId(r.id); setEditRoleOpen(false); }} className="block w-full px-3 py-2 text-left text-sm" style={{ background: tint(roleColor(r), 0.35) }}>
                    {r.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <input value={fName} onChange={(e) => setFName(e.target.value)} placeholder="Name" className="mt-2 w-full rounded-lg border-2 border-gray-800 px-3 py-2 text-sm font-medium" />
          <input value={fTitle} onChange={(e) => setFTitle(e.target.value)} placeholder="Job title" className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
          <div className="mt-2 flex items-center gap-1 rounded-lg border border-gray-200 px-2">
            <Mail size={13} className="shrink-0 text-gray-400" />
            <input value={fEmail} onChange={(e) => setFEmail(e.target.value)} placeholder="Email" className="w-full py-2 text-sm outline-none" style={{ background: "transparent" }} />
          </div>
          <div className="mt-2 flex items-center gap-1 rounded-lg border border-gray-200 px-2">
            <span className="text-sm font-bold text-sky-600">in</span>
            <input value={fLinkedin} onChange={(e) => setFLinkedin(e.target.value)} placeholder="LinkedIn URL" className="w-full py-2 text-sm outline-none" style={{ background: "transparent" }} />
          </div>
          <div className="mt-2 flex items-center gap-1 rounded-lg border border-gray-200 px-2">
            <LinkIcon size={13} className="shrink-0 text-gray-400" />
            <input value={fCrm} onChange={(e) => setFCrm(e.target.value)} placeholder="CRM record URL" className="w-full py-2 text-sm outline-none" style={{ background: "transparent" }} />
          </div>
          <div className="mt-2 flex items-center gap-1 rounded-lg border border-gray-200 px-2">
            <UserRound size={13} className="shrink-0 text-gray-400" />
            <input value={fOwner} onChange={(e) => setFOwner(e.target.value)} placeholder="Relationship owner (our side)" className="w-full py-2 text-sm outline-none" style={{ background: "transparent" }} />
          </div>
          <div className="mt-3">
            <p className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
              <Sparkles size={11} /> Research
            </p>
            <textarea value={fNotes} onChange={(e) => setFNotes(e.target.value)} placeholder="What research found…" rows={3} className="w-full resize-y rounded-lg border border-gray-200 px-3 py-2 text-sm" />
          </div>
          <div className="mt-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: ACCENT }}>
              Your context
            </p>
            <textarea value={fCustom} onChange={(e) => setFCustom(e.target.value)} placeholder="What you know that no research will find…" rows={3} className="w-full resize-y rounded-lg px-3 py-2 text-sm" style={{ border: `1px solid ${ACCENT}55`, background: `${ACCENT}0a` }} />
            <p className="mt-1 text-xs text-gray-400">Yours only. Agents never overwrite this.</p>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button onClick={p.onCancelEdit} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50">Cancel</button>
            <button
              onClick={() => p.onSaveEdit(c.id, { name: fName, jobTitle: fTitle, email: fEmail, linkedinUrl: fLinkedin, crmUrl: fCrm, ownerName: fOwner, notes: fNotes, customContext: fCustom, avatarUrl: fAvatar, roleId: fRoleId })}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >Save</button>
          </div>
        </div>
      ) : (
        <div className="p-4">
          <div className="flex items-start justify-between">
            {c.avatarUrl ? (
              <img src={c.avatarUrl} alt="" className="h-12 w-12 rounded-full object-cover" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400"><UserRound size={22} /></div>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); p.onToggleContacted(c); }}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${c.isContacted ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-gray-200 bg-gray-50 text-gray-500"}`}
              title={c.isContacted ? "Mark not contacted" : "Mark contacted"}
            >
              {c.isContacted ? "Contacted" : "Not contacted"}
            </button>
          </div>
          <h3 className="mt-2 text-2xl font-bold leading-tight text-gray-900">{c.name || "New Contact"}</h3>
          <p className="mt-1 text-base text-gray-500">{c.jobTitle || "No Title"}</p>
          {topWarning && (
            <div
              className="mt-1.5 rounded-r-md py-1 pl-2 pr-1.5"
              style={{ background: `${severityColor(topWarning.severity)}12`, borderLeft: `2px solid ${severityColor(topWarning.severity)}` }}
              title={topWarning.rationale ?? undefined}
            >
              <p className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide" style={{ color: severityColor(topWarning.severity) }}>
                <AlertTriangle size={10} /> {topWarning.gapTitle}
              </p>
              <p className="mt-0.5 text-xs leading-snug text-gray-600">{topWarning.rationale}</p>
            </div>
          )}
          {c.email && (
            <a href={`mailto:${c.email}`} target="_blank" onClick={stop} className="mt-1 block truncate text-sm text-blue-600 underline">{c.email}</a>
          )}
          {/* One links row: profile, a web search scoped to the account, and the CRM record.
              Logos rather than words: three destinations are recognised faster by mark than
              by label, and it buys back a line of card height. */}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {c.linkedinUrl && (
              <LinkChip href={c.linkedinUrl} label="LinkedIn profile" onClick={stop} />
            )}
            {c.name && (
              <LinkChip
                href={`https://www.google.com/search?q=${encodeURIComponent([c.name, c.jobTitle, p.companyName].filter(Boolean).join(" "))}`}
                label="Search Google"
                onClick={stop}
              />
            )}
            {c.crmUrl && (
              <LinkChip href={c.crmUrl} label="Salesforce record" onClick={stop} />
            )}
          </div>
          {(c.ownerName || c.lastContactedAt) && (
            <p className="mt-1 truncate text-xs text-gray-400">
              {[c.ownerName ? `Owned by ${c.ownerName}` : null,
                c.lastContactedAt ? `last touch ${relativeDay(c.lastContactedAt) ?? c.lastContactedAt}` : null]
                .filter(Boolean).join(" · ")}
            </p>
          )}
          {(c.notes || c.customContext) && (
            <div className="mt-2 space-y-1.5">
              {c.notes && (
                <div>
                  <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    <Sparkles size={10} /> Research
                  </p>
                  <p
                    className="text-sm leading-snug text-gray-600"
                    style={ctxOpen ? undefined : { display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}
                  >
                    {c.notes}
                  </p>
                </div>
              )}
              {c.customContext && (
                <div className="rounded-lg px-2 py-1.5" style={{ background: `${ACCENT}0f`, borderLeft: `2px solid ${ACCENT}` }}>
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: ACCENT }}>Your context</p>
                  <p
                    className="text-sm leading-snug text-gray-800"
                    style={ctxOpen ? undefined : { display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}
                  >
                    {c.customContext}
                  </p>
                </div>
              )}
              {((c.notes ?? "").length > 120 || (c.customContext ?? "").length > 120) && (
                <button
                  onClick={(e) => { e.stopPropagation(); setCtxOpen(!ctxOpen); }}
                  className="text-xs font-medium text-gray-400 hover:text-gray-700"
                >
                  {ctxOpen ? "Show less" : "Show more"}
                </button>
              )}
            </div>
          )}

          <UsageStrip
            usage={p.productUsage}
            days={p.usageDays}
            onOpen={() => p.onOpenUsage(c)}
          />
          <div className="mt-3 flex items-center gap-1.5 border-t border-gray-200 pt-2">
            <button onClick={(e) => { e.stopPropagation(); p.onOpenAgent(c); }} className="flex h-8 min-w-0 flex-1 items-center justify-center gap-1 rounded-lg px-2 text-xs font-semibold text-white" style={{ backgroundColor: "#7A36C7", transition: "opacity 160ms ease" }} onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.9"; }} onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }} title="Ask Dust to work on this contact" aria-label="Ask Dust to work on this contact"><img src={DUST_LOGO_WHITE} alt="Dust" className="h-4 w-4" /> <span className="truncate">Ask Dust</span></button>
            <button onClick={(e) => { e.stopPropagation(); p.onStartEdit(c.id); }} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200" title="Edit" aria-label="Edit"><Pencil size={14} /></button>
            <button onClick={(e) => { e.stopPropagation(); p.onDelete(c.id); }} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600 hover:bg-red-100 hover:text-red-600" title="Delete" aria-label="Delete"><Trash2 size={14} /></button>
          </div>
        </div>
      )}

      {/* hover affordances (directional controls only; footer owns card actions) */}
      {!p.editing && hover && !connecting && (
        <>
          {/* top */}
          <div className="absolute left-1/2 z-30 flex gap-2" style={{ top: -50, transform: "translateX(-50%)", paddingBottom: 18, paddingLeft: 24, paddingRight: 24 }}>
            <button onClick={(e) => { e.stopPropagation(); p.onStartConnect(c.id); }} className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-500 text-white shadow hover:bg-teal-600" title="Connect to another contact"><ChevronUp size={17} /></button>
            <button onClick={(e) => { e.stopPropagation(); p.onAddDirectional(c, "up"); }} className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-500 text-white shadow hover:bg-blue-600" title="Add manager above"><Plus size={17} /></button>
          </div>
          {/* bottom */}
          <div className="absolute left-1/2 z-30 flex gap-2" style={{ bottom: -50, transform: "translateX(-50%)", paddingTop: 18, paddingLeft: 24, paddingRight: 24 }}>
            <button onClick={(e) => { e.stopPropagation(); p.onAddDirectional(c, "down"); }} className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-500 text-white shadow hover:bg-blue-600" title="Add report below"><Plus size={17} /></button>
            <button onClick={(e) => { e.stopPropagation(); p.onStartConnect(c.id); }} className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-500 text-white shadow hover:bg-teal-600" title="Connect to another contact"><ChevronDown size={17} /></button>
          </div>
          {/* left */}
          <div className="absolute z-30 flex flex-col gap-2" style={{ left: -50, top: "50%", transform: "translateY(-50%)", paddingRight: 18, paddingTop: 24, paddingBottom: 24 }}>
            <button onClick={(e) => { e.stopPropagation(); p.onAddDirectional(c, "left"); }} className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-500 text-white shadow hover:bg-blue-600" title="Add peer (influence)"><Plus size={17} /></button>
            <button onClick={(e) => { e.stopPropagation(); p.onStartConnect(c.id); }} className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-500 text-white shadow hover:bg-teal-600" title="Connect to another contact"><ChevronLeft size={17} /></button>
          </div>
          {/* right */}
          <div className="absolute z-30 flex flex-col gap-2" style={{ right: -50, top: "50%", transform: "translateY(-50%)", paddingLeft: 18, paddingTop: 24, paddingBottom: 24 }}>
            <button onClick={(e) => { e.stopPropagation(); p.onAddDirectional(c, "right"); }} className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-500 text-white shadow hover:bg-blue-600" title="Add peer (influence)"><Plus size={17} /></button>
            <button onClick={(e) => { e.stopPropagation(); p.onStartConnect(c.id); }} className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-500 text-white shadow hover:bg-teal-600" title="Connect to another contact"><ChevronRight size={17} /></button>
          </div>
        </>
      )}

      {/* connect-target hit layer: the whole card completes the connection, so inner
          buttons and links can no longer swallow the click */}
      {isConnectTarget && (
        <div
          className="absolute inset-0 z-50 rounded-2xl"
          style={{ background: "rgba(52,211,153,0.12)", cursor: "crosshair" }}
          onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
          onMouseEnter={hoverOn}
          onMouseLeave={hoverOff}
          onClick={(e) => { e.stopPropagation(); p.onCompleteConnect(c.id); }}
        />
      )}
    </div>
  );
}
