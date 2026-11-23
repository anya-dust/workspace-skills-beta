import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, Building2, ChevronDown, ChevronUp, FileText, Image as ImageIcon, Loader2,
  Maximize2, MessageSquare, Minus, Plus, RefreshCw, Search, Settings, SlidersHorizontal, X, Zap,
} from "lucide-react";
import { usePodFunction, usePodFunctionMutation } from "@dust/react-hooks";
import ContactCard, { Dir } from "./ui/ContactCard.tsx";
import StickyNote from "./ui/StickyNote.tsx";
import SettingsModal from "./ui/SettingsModal.tsx";
import { AgentInfoDialog, AgentTaskDialog, AgentTaskMode, ContactAgentDialog, ContactAgentQuickAction, CsvRow, ImportCsvDialog, NewMapDialog, PasteLinkedInDialog } from "./ui/dialogs.tsx";
import {
  ACCENT, BlindSpot, CARD_W, Contact, DUST_LOGO_WHITE, EdgeT, NoteT, Snapshot,
  groupByContact, relativeDay, roleColor, severityColor, tint,
} from "./ui/types.ts";
import { FilterMenu } from "./ui/FilterMenu.tsx";
import BlindSpotCard from "./ui/BlindSpotCard.tsx";
import CoveragePanel from "./ui/CoveragePanel.tsx";
import ActionQueue, { QueueAction } from "./ui/ActionQueue.tsx";
import { AccountUsageBadge, AccountUsageModal, ContactUsageModal } from "./ui/usage.tsx";

const CARD_H_FALLBACK = 230;
const TOPBAR_H = 57;
const ZOOM_MIN = 0.08;
const ZOOM_MAX = 2.5;

function clampZoom(k: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, k));
}

/**
 * Wheel events arrive in three very different flavours and a single exponential base
 * cannot serve all of them: a mouse notch reports |deltaY| ~= 100 while a trackpad
 * two-finger scroll reports 1-10 per event. The old base (1.0015) meant a trackpad
 * gesture moved the zoom by well under 1%, which read as "zoom is broken".
 * So: normalise the delta to pixels, then pick a sensitivity per gesture type.
 */
function wheelZoomFactor(e: WheelEvent, viewportHeight: number): number {
  let d = e.deltaY;
  if (e.deltaMode === 1) d *= 16;               // DOM_DELTA_LINE
  else if (e.deltaMode === 2) d *= viewportHeight; // DOM_DELTA_PAGE
  d = Math.max(-400, Math.min(400, d));

  let factor: number;
  if (e.ctrlKey) {
    factor = Math.exp(-d * 0.011);              // pinch-to-zoom: small deltas, direct control
  } else if (Math.abs(d) >= 40) {
    factor = Math.exp(-Math.sign(d) * 0.13);    // discrete mouse notch: one steady step
  } else {
    factor = Math.exp(-d * 0.005);              // trackpad scroll: continuous and responsive
  }
  return Math.min(1.6, Math.max(0.625, factor));
}

// Account-map placement key: X = functional zones (left to right), Y = seniority levels (pyramid).
// Zones and levels guide placement; keep spacing organic and compact (no painted grid).
const GRID_ZONES = [
  { n: 1, label: "AI" },
  { n: 2, label: "Sales · Customer-facing" },
  { n: 3, label: "Sales · Supporting (SE)" },
  { n: 4, label: "Sales Ops / Enablement" },
  { n: 5, label: "Support" },
  { n: 6, label: "IT / Biz Ops / Strategy" },
  { n: 7, label: "Recruiting / HR / Talent" },
  { n: 8, label: "Product" },
  { n: 9, label: "Engineering" },
  { n: 10, label: "Misc / Other" },
  { n: 11, label: "Legal / Procurement / Finance" },
];
const GRID_LEVELS = [
  { l: "A", label: "Top execs: CEO, CIO, CISO, CFO" },
  { l: "B", label: "C-suite with a boss: CTO, CRO, COO, CMO…" },
  { l: "C", label: "VPs & department heads" },
  { l: "D", label: "Directors / power players" },
  { l: "E", label: "Managers / team leads" },
  { l: "F", label: "ICs, users & super users" },
];

type Viewport = { x: number; y: number; k: number };
type ToastT = { msg: string; err: boolean } | null;

export default function AccountMap() {
  const [mapId, setMapId] = useState<number | null>(null);
  const query = usePodFunction(
    "get-map",
    mapId != null ? { mapId } : {}
  );

  const saveContactFn = usePodFunctionMutation("save-contact");
  const deleteContactFn = usePodFunctionMutation("delete-contact");
  const moveItemsFn = usePodFunctionMutation("move-items");
  const saveEdgeFn = usePodFunctionMutation("save-edge");
  const deleteEdgeFn = usePodFunctionMutation("delete-edge");
  const saveNoteFn = usePodFunctionMutation("save-note");
  const deleteNoteFn = usePodFunctionMutation("delete-note");
  const saveRoleFn = usePodFunctionMutation("save-role");
  const deleteRoleFn = usePodFunctionMutation("delete-role");
  const createMapFn = usePodFunctionMutation("create-map");
  const updateMapFn = usePodFunctionMutation("update-map");
  const importMapFn = usePodFunctionMutation("import-map");
  const sendAgentTaskFn = usePodFunctionMutation("send-agent-task");
  const scanBlindSpotsFn = usePodFunctionMutation("scan-blind-spots");
  const resolveBlindSpotFn = usePodFunctionMutation("resolve-blind-spot");
  const dismissBlindSpotFn = usePodFunctionMutation("dismiss-blind-spot");
  const updateActionFn = usePodFunctionMutation("update-action");

  const [model, setModel] = useState<Snapshot | null>(null);
  useEffect(() => {
    if (query.data) {
      setModel(query.data as Snapshot);
      const m = (query.data as Snapshot).map;
      if (m && mapId == null) setMapId(m.id);
    }
  }, [query.data]);

  const [vp, setVp] = useState<Viewport>({ x: 60, y: 80, k: 0.75 });
  const [heights, setHeights] = useState<Record<number, number>>({});
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [connectSource, setConnectSource] = useState<number | null>(null);
  const [connectPos, setConnectPos] = useState<{ x: number; y: number } | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<number | null>(null);
  const [legendOpen, setLegendOpen] = useState(false);
  const [legendTab, setLegendTab] = useState<"grid" | "roles">("grid");
  // The top bar's height is not a constant: a squeezed button wraps its label and the bar
  // grows. Measure it so the filter row and canvas can never end up underneath it.
  const topBarRef = useRef<HTMLDivElement | null>(null);
  const [topBarH, setTopBarH] = useState(TOPBAR_H);
  const [filterOpen, setFilterOpen] = useState(false);
  const [askMenuOpen, setAskMenuOpen] = useState(false);
  // Filters are a per-viewer lens on the map, not shared data, so they stay in component state.
  const [q, setQ] = useState("");
  const [contactedFilter, setContactedFilter] = useState<"all" | "contacted" | "not">("all");
  const [roleFilter, setRoleFilter] = useState<number | "none" | null>(null);
  const [mapMenuOpen, setMapMenuOpen] = useState(false);

  // Any top-bar menu closes when you click anywhere outside it. Capture phase so it
  // runs before the trigger button's own onClick; we skip the root that was clicked
  // so clicking the trigger again still toggles that menu shut.
  useEffect(() => {
    if (!mapMenuOpen && !askMenuOpen && !filterOpen) return;
    const onDown = (e: Event) => {
      const t = e.target as HTMLElement | null;
      const root = t && typeof t.closest === "function" ? (t.closest("[data-menu-root]") as HTMLElement | null) : null;
      const which = root?.dataset?.menuRoot;
      if (which !== "map") setMapMenuOpen(false);
      if (which !== "ask") setAskMenuOpen(false);
      if (which !== "filters") setFilterOpen(false);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [mapMenuOpen, askMenuOpen, filterOpen]);
  const [dialog, setDialog] = useState<null | "settings" | "linkedin" | "csv" | "screenshot" | "agent" | "contact-agent" | "newmap">(null);
  const [agentTaskMode, setAgentTaskMode] = useState<AgentTaskMode>("custom");
  const [agentTaskUrl, setAgentTaskUrl] = useState<string | null>(null);
  const [agentContactId, setAgentContactId] = useState<number | null>(null);
  const [agentContactBusy, setAgentContactBusy] = useState(false);
  const [toast, setToast] = useState<ToastT>(null);
  const [busy, setBusy] = useState(false);
  const agentSubmittingRef = useRef(false);
  const [companyName, setCompanyName] = useState<string>(() => {
    try { return localStorage.getItem("accountmap.company") ?? ""; } catch { return ""; }
  });

  // One right-hand panel at a time: coverage and the action queue occupy the same slot.
  const [panel, setPanel] = useState<"none" | "coverage" | "actions">("none");
  // Spotlight: with the blind-spot panel open, the rest of the map goes grey so the gaps
  // and the people they hang off are the only thing left in colour.
  const [spotlight, setSpotlight] = useState(true);
  const [openSpotId, setOpenSpotId] = useState<number | null>(null);
  const [addingSpotId, setAddingSpotId] = useState<number | null>(null);
  const [scanning, setScanning] = useState(false);
  const [usageContactId, setUsageContactId] = useState<number | null>(null);
  const [accountUsageOpen, setAccountUsageOpen] = useState(false);
  const [busyActionKey, setBusyActionKey] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<null | { kind: "contact" | "note"; id: number; px: number; py: number; moved: boolean }>(null);
  const panRef = useRef<null | { px: number; py: number }>(null);
  const miniDragRef = useRef(false);
  const [canvasSize, setCanvasSize] = useState({ width: 1, height: 1 });
  const didFit = useRef(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setCanvasSize({ width: Math.max(1, el.clientWidth), height: Math.max(1, el.clientHeight) });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const showToast = useCallback((msg: string, err = false) => {
    setToast({ msg, err });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), err ? 6000 : 3500);
  }, []);

  const cancelConnect = useCallback(() => {
    setConnectSource(null);
    setConnectPos(null);
  }, []);

  function setCompany(v: string) {
    setCompanyName(v);
    try { localStorage.setItem("accountmap.company", v); } catch { /* noop */ }
  }

  function openAgentTask(mode: AgentTaskMode) {
    if (mapId == null) { showToast("Create or select an account map first", true); return; }
    setAgentTaskMode(mode);
    setDialog("agent");
  }

  async function sendAgentTask(task: string) {
    if (mapId == null) return;
    setBusy(true);
    try {
      const res = await sendAgentTaskFn.trigger({ mapId, mapName: model?.map?.name ?? companyName, task, title: `Account map task: ${(model?.map?.name ?? companyName) || "Current map"}`, agentName: "dust" }) as { url?: string | null };
      setDialog(null);
      setAgentTaskUrl(res.url ?? null);
      showToast(res.url ? "Agent task started. Open the conversation below." : "Agent task started");
    } catch { showToast("Could not start the agent task", true); }
    finally { setBusy(false); }
  }

  function openContactAgent(contact: Contact) {
    if (mapId == null) { showToast("Create or select an account map first", true); return; }
    setAgentContactId(contact.id);
    setDialog("contact-agent");
  }

  async function sendContactAgent(task: string, quickAction: ContactAgentQuickAction) {
    if (mapId == null || agentContactId == null || agentSubmittingRef.current) return;
    agentSubmittingRef.current = true;
    setAgentContactBusy(true);
    try {
      const contact = contactById.get(agentContactId);
      const res = await sendAgentTaskFn.trigger({ mapId, contactId: agentContactId, quickAction, task, title: `Contact task: ${contact?.name ?? "Account contact"}` }) as { url?: string | null; conversationId?: string | null };
      setDialog(null);
      setAgentTaskUrl(res.url ?? null);
      showToast(res.conversationId ? `Agent task started (${res.conversationId})` : "Agent task started");
    } catch { showToast("Could not start the contact task", true); }
    finally { agentSubmittingRef.current = false; setAgentContactBusy(false); }
  }

  // ----- viewport helpers -----
  const fitView = useCallback((contacts: Contact[]) => {
    const el = containerRef.current;
    if (!el || contacts.length === 0) return;
    const xs = contacts.map((c) => c.posX ?? 0);
    const ys = contacts.map((c) => c.posY ?? 0);
    const minX = Math.min(...xs) - 60, maxX = Math.max(...xs) + CARD_W + 60;
    const minY = Math.min(...ys) - 60, maxY = Math.max(...ys) + CARD_H_FALLBACK + 60;
    const w = el.clientWidth, h = el.clientHeight;
    const k = clampZoom(Math.min(1, Math.min(w / (maxX - minX), h / (maxY - minY))));
    setVp({ k, x: (w - (maxX + minX) * k) / 2, y: (h - (maxY + minY) * k) / 2 });
  }, []);

  useEffect(() => {
    if (!didFit.current && model && model.contacts.length > 0) {
      didFit.current = true;
      fitView(model.contacts);
    }
  }, [model, fitView]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      setVp((v) => {
        const nk = clampZoom(v.k * wheelZoomFactor(e, el.clientHeight));
        const wx = (mx - v.x) / v.k, wy = (my - v.y) / v.k;
        return { k: nk, x: mx - wx * nk, y: my - wy * nk };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const worldCenter = useCallback((): { x: number; y: number } => {
    const el = containerRef.current;
    if (!el) return { x: 0, y: 0 };
    return {
      x: (el.clientWidth / 2 - vp.x) / vp.k - CARD_W / 2,
      y: (el.clientHeight / 2 - vp.y) / vp.k - 100,
    };
  }, [vp]);

  // ----- drag handling -----
  const onDragStart = useCallback((kind: "contact" | "note") => (id: number, e: React.PointerEvent) => {
    dragRef.current = { kind, id, px: e.clientX, py: e.clientY, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  }, []);

  function onPointerMove(e: React.PointerEvent) {
    if (connectSource != null) {
      const el = containerRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        setConnectPos({
          x: (e.clientX - rect.left - vp.x) / vp.k,
          y: (e.clientY - rect.top - vp.y) / vp.k,
        });
      }
    }
    const d = dragRef.current;
    if (d) {
      const dx = (e.clientX - d.px) / vp.k, dy = (e.clientY - d.py) / vp.k;
      if (Math.abs(e.clientX - d.px) + Math.abs(e.clientY - d.py) > 2) d.moved = true;
      d.px = e.clientX; d.py = e.clientY;
      setModel((m) => {
        if (!m) return m;
        if (d.kind === "contact") {
          return { ...m, contacts: m.contacts.map((c) => c.id === d.id ? { ...c, posX: (c.posX ?? 0) + dx, posY: (c.posY ?? 0) + dy } : c) };
        }
        return { ...m, notes: m.notes.map((n) => n.id === d.id ? { ...n, posX: (n.posX ?? 0) + dx, posY: (n.posY ?? 0) + dy } : n) };
      });
      return;
    }
    const pn = panRef.current;
    if (pn) {
      const dx = e.clientX - pn.px, dy = e.clientY - pn.py;
      pn.px = e.clientX; pn.py = e.clientY;
      setVp((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
    }
  }

  function onPointerUp() {
    const d = dragRef.current;
    dragRef.current = null;
    panRef.current = null;
    if (d && d.moved && model) {
      if (d.kind === "contact") {
        const c = model.contacts.find((x) => x.id === d.id);
        if (c) void moveItemsFn.trigger({ contacts: [{ id: c.id, x: c.posX ?? 0, y: c.posY ?? 0 }] }).catch(() => showToast("Failed to save position", true));
      } else {
        const n = model.notes.find((x) => x.id === d.id);
        if (n) void moveItemsFn.trigger({ notes: [{ id: n.id, x: n.posX ?? 0, y: n.posY ?? 0 }] }).catch(() => showToast("Failed to save position", true));
      }
    }
  }

  // ----- contact ops -----
  const mid = model?.map?.id ?? null;

  // The queue is derived server-side from the map, so it is a read that revalidates rather
  // than something the Frame keeps in sync by hand.
  const actionsQuery = usePodFunction("next-best-actions", mid != null ? { mapId: mid } : null);
  const queueActions: QueueAction[] = (actionsQuery.data as { actions?: QueueAction[] } | undefined)?.actions ?? [];
  const openActionCount = queueActions.filter((a) => a.status === "open").length;

  async function createContact(fields: Partial<Contact>, opts?: { edgeFrom?: number; edgeTo?: number; kind?: "default" | "influence"; edit?: boolean }) {
    if (mid == null) return;
    setBusy(true);
    try {
      const res = await saveContactFn.trigger({
        mapId: mid,
        name: fields.name ?? "New Contact",
        jobTitle: fields.jobTitle ?? null,
        email: fields.email ?? null,
        linkedinUrl: fields.linkedinUrl ?? null,
        notes: fields.notes ?? null,
        posX: fields.posX ?? 0,
        posY: fields.posY ?? 0,
      });
      const nc = (res as { contact: Contact }).contact;
      let newEdge: EdgeT | null = null;
      if (opts?.edgeFrom != null || opts?.edgeTo != null) {
        const sourceId = opts.edgeFrom ?? nc.id;
        const targetId = opts.edgeTo ?? nc.id;
        const er = await saveEdgeFn.trigger({ mapId: mid, sourceId, targetId, kind: opts.kind ?? "default" });
        newEdge = (er as { edge: EdgeT }).edge;
      }
      setModel((m) => m ? { ...m, contacts: [...m.contacts, nc], edges: newEdge ? [...m.edges, newEdge] : m.edges } : m);
      setSelectedId(nc.id);
      if (opts?.edit !== false) setEditingId(nc.id);
    } catch {
      showToast("Failed to create contact", true);
    } finally {
      setBusy(false);
    }
  }

  function addDirectional(c: Contact, dir: Dir) {
    const h = heights[c.id] ?? CARD_H_FALLBACK;
    const pos =
      dir === "up" ? { posX: c.posX ?? 0, posY: (c.posY ?? 0) - h - 120 }
      : dir === "down" ? { posX: c.posX ?? 0, posY: (c.posY ?? 0) + h + 120 }
      : dir === "left" ? { posX: (c.posX ?? 0) - CARD_W - 90, posY: c.posY ?? 0 }
      : { posX: (c.posX ?? 0) + CARD_W + 90, posY: c.posY ?? 0 };
    const opts =
      dir === "up" ? { edgeTo: c.id }
      : dir === "down" ? { edgeFrom: c.id }
      : { edgeFrom: c.id, kind: "influence" as const };
    void createContact(pos, opts);
  }

  function saveEdit(id: number, fields: Partial<Contact>) {
    if (mid == null) return;
    setModel((m) => m ? { ...m, contacts: m.contacts.map((c) => c.id === id ? { ...c, ...fields } : c) } : m);
    setEditingId(null);
    void saveContactFn.trigger({
      mapId: mid, id,
      name: fields.name ?? "",
      jobTitle: fields.jobTitle ?? null,
      email: fields.email ?? null,
      linkedinUrl: fields.linkedinUrl ?? null,
      crmUrl: fields.crmUrl ?? null,
      ownerName: fields.ownerName ?? null,
      notes: fields.notes ?? null,
      customContext: fields.customContext ?? null,
      avatarUrl: fields.avatarUrl ?? null,
      roleId: fields.roleId ?? null,
    }).catch(() => showToast("Failed to save contact", true));
  }

  function toggleContacted(c: Contact) {
    if (mid == null) return;
    const next = !c.isContacted;
    setModel((m) => m ? { ...m, contacts: m.contacts.map((x) => x.id === c.id ? { ...x, isContacted: next } : x) } : m);
    void saveContactFn.trigger({ mapId: mid, id: c.id, isContacted: next }).catch(() => showToast("Failed to save", true));
  }

  function assignRole(c: Contact, roleId: number | null) {
    if (mid == null) return;
    setModel((m) => m ? { ...m, contacts: m.contacts.map((x) => x.id === c.id ? { ...x, roleId } : x) } : m);
    void saveContactFn.trigger({ mapId: mid, id: c.id, roleId }).catch(() => showToast("Failed to save role", true));
  }

  function deleteContact(id: number) {
    setModel((m) => m ? {
      ...m,
      contacts: m.contacts.filter((c) => c.id !== id),
      edges: m.edges.filter((e) => e.sourceId !== id && e.targetId !== id),
    } : m);
    if (editingId === id) setEditingId(null);
    void deleteContactFn.trigger({ id }).catch(() => showToast("Failed to delete contact", true));
  }

  function completeConnect(targetId: number) {
    if (mid == null || connectSource == null || connectSource === targetId) { cancelConnect(); return; }
    const sourceId = connectSource;
    cancelConnect();
    void saveEdgeFn.trigger({ mapId: mid, sourceId, targetId, kind: "default" })
      .then((res) => {
        const edge = (res as { edge: EdgeT }).edge;
        setModel((m) => m && !m.edges.some((e) => e.id === edge.id) ? { ...m, edges: [...m.edges, edge] } : m);
        showToast("Connected");
      })
      .catch(() => showToast("Failed to connect", true));
  }

  function toggleEdgeKind(edge: EdgeT) {
    if (mid == null || edge.sourceId == null || edge.targetId == null) return;
    const nextKind = edge.kind === "influence" ? "default" : "influence";
    setModel((m) => m ? { ...m, edges: m.edges.map((e) => e.id === edge.id ? { ...e, kind: nextKind } : e) } : m);
    void deleteEdgeFn.trigger({ id: edge.id })
      .then(() => saveEdgeFn.trigger({ mapId: mid, sourceId: edge.sourceId as number, targetId: edge.targetId as number, kind: nextKind }))
      .then((res) => {
        const ne = (res as { edge: EdgeT }).edge;
        setModel((m) => m ? { ...m, edges: m.edges.map((e) => e.id === edge.id ? ne : e) } : m);
      })
      .catch(() => showToast("Failed to update edge", true));
    setSelectedEdgeId(null);
  }

  function deleteEdge(id: number) {
    setModel((m) => m ? { ...m, edges: m.edges.filter((e) => e.id !== id) } : m);
    setSelectedEdgeId(null);
    void deleteEdgeFn.trigger({ id }).catch(() => showToast("Failed to delete edge", true));
  }

  // ----- notes -----
  function createNote() {
    if (mid == null) return;
    const pos = worldCenter();
    void saveNoteFn.trigger({ mapId: mid, body: "", posX: pos.x, posY: pos.y })
      .then((res) => {
        const note = (res as { note: NoteT }).note;
        setModel((m) => m ? { ...m, notes: [...m.notes, note] } : m);
      })
      .catch(() => showToast("Failed to create note", true));
  }

  function saveNoteBody(id: number, body: string) {
    if (mid == null) return;
    setModel((m) => m ? { ...m, notes: m.notes.map((n) => n.id === id ? { ...n, body } : n) } : m);
    void saveNoteFn.trigger({ mapId: mid, id, body }).catch(() => showToast("Failed to save note", true));
  }

  function deleteNote(id: number) {
    setModel((m) => m ? { ...m, notes: m.notes.filter((n) => n.id !== id) } : m);
    void deleteNoteFn.trigger({ id }).catch(() => showToast("Failed to delete note", true));
  }

  // ----- maps / roles / import -----
  function createMap(name: string) {
    setBusy(true);
    void createMapFn.trigger({ name })
      .then((res) => {
        const snap = res as Snapshot;
        setModel(snap);
        if (snap.map) setMapId(snap.map.id);
        didFit.current = false;
        setDialog(null);
        showToast(`Created map "${name}"`);
      })
      .catch(() => showToast("Failed to create map", true))
      .finally(() => setBusy(false));
  }

  function mapAction(id: number, action: "rename" | "trash" | "restore" | "destroy", name?: string) {
    void updateMapFn.trigger({ mapId: id, action, name })
      .then((res) => {
        const maps = (res as { maps: Snapshot["maps"] }).maps;
        setModel((m) => m ? { ...m, maps, map: m.map && m.map.id === id ? (maps.find((x) => x.id === id && !x.deleted) ?? m.map) : m.map } : m);
        if ((action === "trash" || action === "destroy") && mapId === id) {
          const next = maps.find((x) => !x.deleted);
          setMapId(next ? next.id : null);
          didFit.current = false;
          void query.mutate();
        }
      })
      .catch(() => showToast("Failed to update map", true));
  }

  function saveRole(id: number | null, name: string, color: string) {
    void saveRoleFn.trigger(id != null ? { id, name, color } : { name, color })
      .then((res) => {
        const roles = (res as { roles: Snapshot["roles"] }).roles;
        setModel((m) => m ? { ...m, roles } : m);
        showToast("Role saved");
      })
      .catch(() => showToast("Failed to save role", true));
  }

  function deleteRole(id: number) {
    void deleteRoleFn.trigger({ id })
      .then((res) => {
        const roles = (res as { roles: Snapshot["roles"] }).roles;
        setModel((m) => m ? { ...m, roles, contacts: m.contacts.map((c) => c.roleId === id ? { ...c, roleId: null } : c) } : m);
      })
      .catch(() => showToast("Failed to delete role", true));
  }

  function importCsvRows(rows: CsvRow[]) {
    if (mid == null || !model) return;
    const start = worldCenter();
    const payload = rows.map((r, i) => ({
      ref: `csv-${i}`,
      name: r.name,
      jobTitle: r.jobTitle || null,
      email: r.email || null,
      linkedinUrl: r.linkedinUrl || null,
      notes: r.notes || null,
      roleName: r.roleName || null,
      posX: start.x + (i % 4) * (CARD_W + 60),
      posY: start.y + Math.floor(i / 4) * 320,
    }));
    setBusy(true);
    void importMapFn.trigger({ name: model.map?.name ?? "Import", mapId: mid, contacts: payload })
      .then((res) => { setModel(res as Snapshot); setDialog(null); showToast(`Imported ${rows.length} contacts`); })
      .catch(() => showToast("Import failed", true))
      .finally(() => setBusy(false));
  }

  function importJson(parsed: unknown) {
    const d = parsed as { map?: { name?: string }; contacts?: Contact[]; edges?: EdgeT[]; notes?: NoteT[]; roles?: { id: number; name: string | null }[] };
    if (!d || !Array.isArray(d.contacts)) { showToast("Unrecognized JSON format", true); return; }
    const roleName = (rid: number | null) => d.roles?.find((r) => r.id === rid)?.name ?? null;
    const contacts = d.contacts.map((c) => ({
      ref: String(c.id),
      name: c.name ?? "Unnamed",
      jobTitle: c.jobTitle ?? null,
      email: c.email ?? null,
      linkedinUrl: c.linkedinUrl ?? null,
      notes: c.notes ?? null,
      roleName: roleName(c.roleId ?? null),
      avatarUrl: c.avatarUrl ?? null,
      crmUrl: c.crmUrl ?? null,
      ownerName: c.ownerName ?? null,
      lastContactedAt: c.lastContactedAt ?? null,
      isContacted: c.isContacted ?? false,
      posX: c.posX ?? 0,
      posY: c.posY ?? 0,
    }));
    const edges = (d.edges ?? [])
      .filter((e) => e.sourceId != null && e.targetId != null)
      .map((e) => ({ sourceRef: String(e.sourceId), targetRef: String(e.targetId), kind: (e.kind === "influence" ? "influence" : "default") as "default" | "influence" }));
    const notes = (d.notes ?? []).map((n) => ({ body: n.body ?? "", color: n.color ?? undefined, posX: n.posX ?? 0, posY: n.posY ?? 0, width: n.width ?? undefined, height: n.height ?? undefined }));
    setBusy(true);
    void importMapFn.trigger({ name: `${d.map?.name ?? "Imported map"}`, contacts, edges, notes })
      .then((res) => {
        const snap = res as Snapshot;
        setModel(snap);
        if (snap.map) setMapId(snap.map.id);
        didFit.current = false;
        setDialog(null);
        showToast("Map imported");
      })
      .catch(() => showToast("Import failed", true))
      .finally(() => setBusy(false));
  }

  // ----- derived -----
  const contactById = useMemo(() => {
    const m = new Map<number, Contact>();
    model?.contacts.forEach((c) => m.set(c.id, c));
    return m;
  }, [model?.contacts]);

  const activeMaps = model?.maps.filter((m) => !m.deleted) ?? [];

  // Pick the anchor side on each card from their relative position, so a line never
  // loops back through a card when the target sits above or beside the source.
  function curveBetween(
    sx: number, sy: number, tx: number, ty: number, axis: "h" | "v"
  ): { d: string; mx: number; my: number } {
    if (axis === "h") {
      const off = Math.max(50, Math.abs(tx - sx) * 0.45) * (tx >= sx ? 1 : -1);
      return { d: `M ${sx} ${sy} C ${sx + off} ${sy}, ${tx - off} ${ty}, ${tx} ${ty}`, mx: (sx + tx) / 2, my: (sy + ty) / 2 };
    }
    const off = Math.max(50, Math.abs(ty - sy) * 0.45) * (ty >= sy ? 1 : -1);
    return { d: `M ${sx} ${sy} C ${sx} ${sy + off}, ${tx} ${ty - off}, ${tx} ${ty}`, mx: (sx + tx) / 2, my: (sy + ty) / 2 };
  }

  function cardBox(c: Contact) {
    const h = heights[c.id] ?? CARD_H_FALLBACK;
    const x = c.posX ?? 0, y = c.posY ?? 0;
    return { x, y, h, cx: x + CARD_W / 2, cy: y + h / 2 };
  }

  function edgePath(e: EdgeT): { d: string; mx: number; my: number } | null {
    const s = e.sourceId != null ? contactById.get(e.sourceId) : null;
    const t = e.targetId != null ? contactById.get(e.targetId) : null;
    if (!s || !t) return null;
    const a = cardBox(s), b = cardBox(t);
    const dx = b.cx - a.cx, dy = b.cy - a.cy;
    if (Math.abs(dx) > Math.abs(dy) * 1.2) {
      const right = dx >= 0;
      return curveBetween(
        a.x + (right ? CARD_W + 4 : -4), a.cy,
        b.x + (right ? -8 : CARD_W + 8), b.cy,
        "h"
      );
    }
    const down = dy >= 0;
    return curveBetween(
      a.cx, a.y + (down ? a.h + 4 : -4),
      b.cx, b.y + (down ? -8 : b.h + 8),
      "v"
    );
  }

  // rubber-band preview from the connect source to the cursor
  const connectPreview = useMemo(() => {
    if (connectSource == null || !connectPos) return null;
    const s = contactById.get(connectSource);
    if (!s) return null;
    const a = cardBox(s);
    const dx = connectPos.x - a.cx, dy = connectPos.y - a.cy;
    if (Math.abs(dx) > Math.abs(dy) * 1.2) {
      const right = dx >= 0;
      return curveBetween(a.x + (right ? CARD_W + 4 : -4), a.cy, connectPos.x, connectPos.y, "h").d;
    }
    const down = dy >= 0;
    return curveBetween(a.cx, a.y + (down ? a.h + 4 : -4), connectPos.x, connectPos.y, "v").d;
  }, [connectSource, connectPos, contactById, heights]);

  // minimap
  const miniW = 240, miniH = 140;
  const bounds = useMemo(() => {
    // Gaps count as content: the minimap has to cover the ghost cards too, or the rep
    // scrolls to a blind spot the overview never showed them.
    const pts = [
      ...(model?.contacts ?? []).map((c) => ({ x: c.posX ?? 0, y: c.posY ?? 0 })),
      ...(model?.blindSpots ?? [])
        .filter((b) => b.status === "open" && b.posX != null && b.posY != null)
        .map((b) => ({ x: b.posX as number, y: b.posY as number })),
    ];
    if (pts.length === 0) return { minX: 0, minY: 0, maxX: 1000, maxY: 700 };
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    return {
      minX: Math.min(...xs) - 100, maxX: Math.max(...xs) + CARD_W + 100,
      minY: Math.min(...ys) - 100, maxY: Math.max(...ys) + CARD_H_FALLBACK + 100,
    };
  }, [model?.contacts, model?.blindSpots]);
  const miniK = Math.min(miniW / (bounds.maxX - bounds.minX), miniH / (bounds.maxY - bounds.minY));
  const miniContentW = (bounds.maxX - bounds.minX) * miniK;
  const miniContentH = (bounds.maxY - bounds.minY) * miniK;
  const miniOffX = Math.max(0, (miniW - miniContentW) / 2);
  const miniOffY = Math.max(0, (miniH - miniContentH) / 2);
  const miniViewport = useMemo(() => {
    const leftWorld = (0 - vp.x) / vp.k;
    const topWorld = (0 - vp.y) / vp.k;
    const rightWorld = (canvasSize.width - vp.x) / vp.k;
    const bottomWorld = (canvasSize.height - vp.y) / vp.k;
    return {
      left: miniOffX + (leftWorld - bounds.minX) * miniK,
      top: miniOffY + (topWorld - bounds.minY) * miniK,
      width: Math.max(8, (rightWorld - leftWorld) * miniK),
      height: Math.max(8, (bottomWorld - topWorld) * miniK),
    };
  }, [bounds, canvasSize, miniK, miniOffX, miniOffY, vp]);
  const navigateMini = useCallback((e: React.PointerEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const wx = (e.clientX - rect.left - miniOffX) / miniK + bounds.minX;
    const wy = (e.clientY - rect.top - miniOffY) / miniK + bounds.minY;
    setVp((v) => ({ ...v, x: canvasSize.width / 2 - wx * v.k, y: canvasSize.height / 2 - wy * v.k }));
  }, [bounds.minX, bounds.minY, canvasSize, miniK, miniOffX, miniOffY]);

  // ----- filtering -----

  const roleNameById = useMemo(() => {
    const m = new Map<number, string>();
    for (const r of model?.roles ?? []) { if (r.name) m.set(r.id, r.name); }
    return m;
  }, [model?.roles]);

  const chipsActive = contactedFilter !== "all" || roleFilter !== null;
  const activeChipCount =
    (contactedFilter !== "all" ? 1 : 0) + (roleFilter !== null ? 1 : 0);
  const filterActive =
    q.trim() !== "" || contactedFilter !== "all" || roleFilter !== null;

  const matchIds = useMemo(() => {
    const ids = new Set<number>();
    if (!model) return ids;
    const needle = q.trim().toLowerCase();
    for (const c of model.contacts) {
      if (needle) {
        const haystack = [
          c.name, c.jobTitle, c.email, c.notes, c.customContext, c.ownerName,
          c.roleId != null ? roleNameById.get(c.roleId) : null,
        ].filter(Boolean).join(" ").toLowerCase();
        if (!haystack.includes(needle)) continue;
      }
      if (contactedFilter === "contacted" && c.isContacted !== true) continue;
      if (contactedFilter === "not" && c.isContacted === true) continue;
      if (roleFilter === "none" && c.roleId != null) continue;
      if (typeof roleFilter === "number" && c.roleId !== roleFilter) continue;
      ids.add(c.id);
    }
    return ids;
  }, [model, q, contactedFilter, roleFilter, roleNameById]);

  const isDimmed = useCallback(
    (id: number) => filterActive && !matchIds.has(id),
    [filterActive, matchIds],
  );

  const clearFilters = useCallback(() => {
    setQ(""); setContactedFilter("all"); setRoleFilter(null);
  }, []);

  // ----- blind spots and product usage -----
  const productUsageByContact = useMemo(
    () => new Map((model?.productUsage ?? []).map((u) => [u.contactId as number, u])),
    [model?.productUsage],
  );
  const usageDaysByContact = useMemo(() => groupByContact(model?.usageDaily ?? []), [model?.usageDaily]);
  const featuresByContact = useMemo(() => groupByContact(model?.featureUsage ?? []), [model?.featureUsage]);

  const ghostSpots = useMemo(
    () => (model?.blindSpots ?? []).filter((b) => b.status === "open" && b.posX != null && b.posY != null),
    [model?.blindSpots],
  );
  const warningsByContact = useMemo(() => {
    const out = new Map<number, BlindSpot[]>();
    for (const b of model?.blindSpots ?? []) {
      if (b.status !== "open" || b.posX != null || b.anchorContactId == null) continue;
      const list = out.get(b.anchorContactId);
      if (list) list.push(b); else out.set(b.anchorContactId, [b]);
    }
    return out;
  }, [model?.blindSpots]);
  const openSpotCount = useMemo(
    () => (model?.blindSpots ?? []).filter((b) => b.status === "open").length,
    [model?.blindSpots],
  );

  // ----- spotlight on the gaps -----
  const spotFocus = panel === "coverage" && spotlight;
  // Anything a gap touches stays lit: the ghost cards themselves, and the contacts they
  // hang off, since that is the pair the rep needs to read together.
  const spotContactIds = useMemo(() => {
    const ids = new Set<number>();
    for (const b of model?.blindSpots ?? []) {
      if (b.status !== "open" || b.anchorContactId == null) continue;
      ids.add(b.anchorContactId);
    }
    return ids;
  }, [model?.blindSpots]);
  const greyed = useCallback(
    (id: number) => spotFocus && !spotContactIds.has(id),
    [spotFocus, spotContactIds],
  );
  const contactNameById = useMemo(
    () => new Map((model?.contacts ?? []).map((c) => [c.id, c.name ?? "Unnamed"])),
    [model?.contacts],
  );

  // Account-wide feature totals and adoption per deal role, for the account usage modal.
  const accountFeatureTotals = useMemo(() => {
    const totals = new Map<string, number>();
    for (const f of model?.featureUsage ?? []) {
      if (!f.feature) continue;
      totals.set(f.feature, (totals.get(f.feature) ?? 0) + (f.uses30d ?? 0));
    }
    return [...totals.entries()].map(([feature, uses]) => ({ feature, uses })).sort((a, b) => b.uses - a.uses);
  }, [model?.featureUsage]);

  const committeeAdoption = useMemo(() => {
    const acc = new Map<string, { color: string; sum: number; n: number }>();
    for (const c of model?.contacts ?? []) {
      if (c.roleId == null) continue;
      const role = model?.roles.find((r) => r.id === c.roleId);
      const name = role?.name ?? "Unassigned";
      const u = productUsageByContact.get(c.id);
      const cur = acc.get(name) ?? { color: roleColor(role), sum: 0, n: 0 };
      cur.sum += u?.healthScore ?? 0;
      cur.n += 1;
      acc.set(name, cur);
    }
    return [...acc.entries()]
      .map(([role, v]) => ({ role, color: v.color, health: Math.round(v.sum / Math.max(1, v.n)), people: v.n }))
      .sort((a, b) => b.health - a.health);
  }, [model?.contacts, model?.roles, productUsageByContact]);

  const usageContact = useMemo(
    () => (usageContactId == null ? null : (model?.contacts ?? []).find((c) => c.id === usageContactId) ?? null),
    [usageContactId, model?.contacts],
  );

  // Centre the viewport on a world point without changing how zoomed in the rep is.
  const focusOn = useCallback((wx: number, wy: number) => {
    const el = containerRef.current;
    if (!el) return;
    setVp((v) => {
      const k = Math.max(v.k, 0.5);
      return { k, x: el.clientWidth / 2 - (wx + CARD_W / 2) * k, y: el.clientHeight / 2 - (wy + 100) * k };
    });
  }, []);


  // ----- blind spots -----
  const runScan = useCallback(async () => {
    if (mid == null) return;
    setScanning(true);
    try {
      const res = await scanBlindSpotsFn.trigger({ mapId: mid }) as {snapshot:Snapshot; ghosts:number; warnings:number};
      setModel(res.snapshot as Snapshot);
      showToast(`${res.ghosts} blind spot${res.ghosts === 1 ? "" : "s"} on the map, ${res.warnings} warning${res.warnings === 1 ? "" : "s"}`);
    } catch {
      showToast("Blind spot scan failed", true);
    } finally {
      setScanning(false);
    }
  }, [mid, scanBlindSpotsFn]);

  const addBlindSpot = useCallback(async (spot: BlindSpot) => {
    setAddingSpotId(spot.id);
    try {
      const res = await resolveBlindSpotFn.trigger({ id: spot.id }) as {snapshot:Snapshot; contactId:number};
      setModel(res.snapshot as Snapshot);
      setOpenSpotId(null);
      setSelectedId(res.contactId as number);
      showToast(`${spot.suggestedName ?? "Contact"} added to the map`);
      void actionsQuery.mutate();
    } catch {
      showToast("Could not add to the map", true);
    } finally {
      setAddingSpotId(null);
    }
  }, [resolveBlindSpotFn]);

  const setSpotDismissed = useCallback(async (spot: BlindSpot, dismissed: boolean) => {
    // Optimistic: the panel should react on click, not after the round trip.
    setModel((m) => m ? {
      ...m,
      blindSpots: m.blindSpots.map((b) => b.id === spot.id ? { ...b, status: dismissed ? "dismissed" : "open" } : b),
    } : m);
    setOpenSpotId(null);
    try {
      await dismissBlindSpotFn.trigger({ id: spot.id, dismissed });
    } catch {
      setModel((m) => m ? {
        ...m,
        blindSpots: m.blindSpots.map((b) => b.id === spot.id ? { ...b, status: dismissed ? "open" : "dismissed" } : b),
      } : m);
      showToast("Could not update the blind spot", true);
    }
  }, [dismissBlindSpotFn]);

  const focusSpot = useCallback((spot: BlindSpot) => {
    if (spot.posX != null && spot.posY != null) { focusOn(spot.posX, spot.posY); setOpenSpotId(spot.id); return; }
    const anchor = spot.anchorContactId != null ? model?.contacts.find((c) => c.id === spot.anchorContactId) : null;
    if (anchor) { focusOn(anchor.posX ?? 0, anchor.posY ?? 0); setSelectedId(anchor.id); }
  }, [focusOn, model?.contacts]);

  // ----- next best actions -----
  const askDust = useCallback(async (a: QueueAction) => {
    if (mid == null) return;
    setBusyActionKey(a.key);
    try {
      const res = await sendAgentTaskFn.trigger({
        mapId: mid,
        mapName: model?.map?.name ?? "",
        title: a.agentTitle,
        task: a.agentPrompt,
        contactId: a.contactId ?? undefined,
        quickAction: "other",
      });
      const url = (res as { url: string | null }).url ?? null;
      // Record the thread on the action, so the queue links back to where it was handled.
      await updateActionFn.trigger({ mapId: mid, actionKey: a.key, status: "open", agentConversationUrl: url });
      await actionsQuery.mutate();
      showToast(url ? "Conversation started in this Pod" : "Agent task started");
      if (url) window.open(url, "_blank");
    } catch {
      showToast("Could not start the agent conversation", true);
    } finally {
      setBusyActionKey(null);
    }
  }, [mid, model?.map?.name, sendAgentTaskFn, updateActionFn]);

  const setActionStatus = useCallback(async (a: QueueAction, status: "open" | "done" | "snoozed") => {
    if (mid == null) return;
    try {
      await updateActionFn.trigger({ mapId: mid, actionKey: a.key, status });
      await actionsQuery.mutate();
    } catch {
      showToast("Could not update the action", true);
    }
  }, [mid, updateActionFn]);

  const focusAction = useCallback((a: QueueAction) => {
    const c = a.contactId != null ? model?.contacts.find((x) => x.id === a.contactId) : null;
    if (c) { focusOn(c.posX ?? 0, c.posY ?? 0); setSelectedId(c.id); }
  }, [focusOn, model?.contacts]);

  // ----- zoom controls -----
  const zoomBy = useCallback((factor: number) => {
    const el = containerRef.current;
    setVp((v) => {
      const nk = clampZoom(v.k * factor);
      const cx = (el?.clientWidth ?? 0) / 2;
      const cy = (el?.clientHeight ?? 0) / 2;
      const wx = (cx - v.x) / v.k, wy = (cy - v.y) / v.k;
      return { k: nk, x: cx - wx * nk, y: cy - wy * nk };
    });
  }, []);

  /** Frames the current result set so a search on a large map actually navigates. */
  const zoomToMatches = useCallback(() => {
    const hits = (model?.contacts ?? []).filter((c) => matchIds.has(c.id));
    if (hits.length > 0) fitView(hits);
  }, [model?.contacts, matchIds]);


  useEffect(() => {
    const el = topBarRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setTopBarH(el.offsetHeight));
    ro.observe(el);
    setTopBarH(el.offsetHeight);
    return () => ro.disconnect();
  }, []);

  const selectedEdge = model?.edges.find((e) => e.id === selectedEdgeId) ?? null;
  const selectedEdgeGeom = selectedEdge ? edgePath(selectedEdge) : null;

  return (
    <div
      className="relative h-screen w-full overflow-hidden bg-white"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Escape") { cancelConnect(); setEditingId(null); setSelectedEdgeId(null); setMapMenuOpen(false); setAskMenuOpen(false); setFilterOpen(false); return; }
        // Ignore shortcuts while typing in the search box or an edit form.
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        if (e.key === "+" || e.key === "=") { e.preventDefault(); zoomBy(1.25); }
        else if (e.key === "-" || e.key === "_") { e.preventDefault(); zoomBy(1 / 1.25); }
        else if (e.key === "0") { e.preventDefault(); if (model?.contacts.length) fitView(model.contacts); }
        else if (e.key === "ArrowLeft") { e.preventDefault(); setVp((v) => ({ ...v, x: v.x + 80 })); }
        else if (e.key === "ArrowRight") { e.preventDefault(); setVp((v) => ({ ...v, x: v.x - 80 })); }
        else if (e.key === "ArrowUp") { e.preventDefault(); setVp((v) => ({ ...v, y: v.y + 80 })); }
        else if (e.key === "ArrowDown") { e.preventDefault(); setVp((v) => ({ ...v, y: v.y - 80 })); }
      }}
    >
      {/* top bar */}
      <div ref={topBarRef} className="absolute left-0 right-0 top-0 z-40 flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 bg-white px-4 py-3">
        <div className="flex shrink-0 items-center gap-2">
          <div className="relative" data-menu-root="map">
            <button
              onClick={() => setMapMenuOpen(!mapMenuOpen)}
              className="flex shrink-0 items-center gap-6 whitespace-nowrap rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
            >
              {model?.map?.name ?? "No map"} <ChevronDown size={15} className="text-gray-400" />
            </button>
            {mapMenuOpen && (
              <div className="absolute left-0 z-50 mt-1 max-h-72 w-56 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                {activeMaps.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => { setMapMenuOpen(false); if (m.id !== mapId) { setMapId(m.id); didFit.current = false; setModel(null); } }}
                    className={`block w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${m.id === model?.map?.id ? "font-semibold text-gray-900" : "text-gray-600"}`}
                  >{m.name}</button>
                ))}
                {activeMaps.length === 0 && <p className="px-3 py-2 text-sm text-gray-400">No maps yet</p>}
                <div className="my-1 h-px bg-gray-100" />
                <button
                  onClick={() => { setMapMenuOpen(false); setDialog("newmap"); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium hover:bg-gray-50"
                  style={{ color: ACCENT }}
                >
                  <Plus size={14} /> New map
                </button>
              </div>
            )}
          </div>

          {/* Search is the primary way into a large map, so it sits in the top bar. */}
          <div className="relative shrink-0">
            <Search size={15} className="absolute left-2.5 top-2.5 text-gray-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); zoomToMatches(); }
                if (e.key === "Escape") { e.preventDefault(); setQ(""); (e.target as HTMLInputElement).blur(); }
              }}
              placeholder="Search people, roles, context…"
              aria-label="Search the account map"
              className="rounded-lg border py-2 pl-8 pr-8 text-sm outline-none"
              style={{ width: 268, borderColor: q ? `${ACCENT}80` : "#d1d5db" }}
            />
            {q && (
              <button onClick={() => setQ("")} className="absolute right-2 top-2.5 text-gray-400 hover:text-gray-700" title="Clear search (Esc)">
                <X size={13} />
              </button>
            )}
          </div>

          {/* Filters are secondary to search, so they live behind one button. */}
          <div className="relative shrink-0" data-menu-root="filters">
            <button
              onClick={() => setFilterOpen(!filterOpen)}
              className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-2 text-sm font-medium"
              style={filterOpen || chipsActive
                ? { borderColor: `${ACCENT}59`, background: `${ACCENT}14`, color: ACCENT }
                : { borderColor: "#d1d5db", background: "#fff", color: "#1f2937" }}
              title="Filter by contact state, Dust adoption or deal role"
            >
              <SlidersHorizontal size={15} /> Filters
              {chipsActive && (
                <span className="rounded-full px-1.5 text-xs font-semibold text-white" style={{ background: ACCENT }}>
                  {activeChipCount}
                </span>
              )}
            </button>
            <FilterMenu
              open={filterOpen}
              onClose={() => setFilterOpen(false)}
              contactedFilter={contactedFilter}
              setContactedFilter={setContactedFilter}
              roleFilter={roleFilter}
              setRoleFilter={setRoleFilter}
              roles={model?.roles ?? []}
              total={model?.contacts.length ?? 0}
              matched={matchIds.size}
              filterActive={filterActive}
              onClear={clearFilters}
            />
          </div>

          {filterActive && (
            <span className="shrink-0 whitespace-nowrap text-xs text-gray-500">
              {matchIds.size} of {model?.contacts.length ?? 0}
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* Every agent action opens a Dust conversation, so they share one button. */}
          <div className="relative" data-menu-root="ask">
            <button
              onClick={() => setAskMenuOpen(!askMenuOpen)}
              disabled={mapId == null}
              className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg bg-violet-700 px-3 py-2 text-sm font-medium text-white hover:bg-violet-800 disabled:opacity-40"
            >
              <img src={DUST_LOGO_WHITE} alt="Dust" className="h-4 w-4" /> Ask Dust
              <ChevronDown size={14} className="opacity-70" />
            </button>
            {askMenuOpen && (
              <div className="absolute right-0 z-50 mt-1 w-64 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                {([
                  { mode: "custom" as AgentTaskMode, icon: <MessageSquare size={15} />, label: "Ask anything", hint: "Free-form task on this map" },
                  { mode: "research" as AgentTaskMode, icon: <Building2 size={15} />, label: "Research company", hint: "Find and enrich stakeholders" },
                  { mode: "avatars" as AgentTaskMode, icon: <ImageIcon size={15} />, label: "Find profile pictures", hint: "Fill in missing avatars" },
                  { mode: "strategy" as AgentTaskMode, icon: <FileText size={15} />, label: "Generate strategy", hint: "Draft an account plan" },
                ]).map((item) => (
                  <button
                    key={item.mode}
                    onClick={() => { setAskMenuOpen(false); openAgentTask(item.mode); }}
                    className="flex w-full items-start gap-2.5 px-3 py-2 text-left hover:bg-gray-50"
                  >
                    <span className="mt-0.5 text-gray-400">{item.icon}</span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-gray-800">{item.label}</span>
                      <span className="block text-xs text-gray-400">{item.hint}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="mx-1 h-6 w-px bg-gray-200" />
          <AccountUsageBadge
            account={model?.accountUsage ?? null}
            monthly={model?.accountMonthly ?? []}
            onOpen={() => setAccountUsageOpen(true)}
          />

          <button
            onClick={() => setPanel(panel === "actions" ? "none" : "actions")}
            className={`relative flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-2 text-sm font-medium transition ${panel === "actions" ? "text-white" : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"}`}
            style={panel === "actions" ? { backgroundColor: ACCENT, borderColor: ACCENT } : undefined}
            title="Next best actions for this account"
          >
            <Zap size={15} />
            <span className="hidden sm:inline">Actions</span>
            {openActionCount > 0 && (
              <span className={`rounded-full px-1.5 text-xs font-bold ${panel === "actions" ? "bg-white" : "text-white"}`}
                style={panel === "actions" ? { color: ACCENT } : { backgroundColor: ACCENT }}>
                {openActionCount}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              setSpotlight(true);
              setPanel(panel === "coverage" ? "none" : "coverage");
            }}
            className={`relative flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-2 text-sm font-medium transition ${panel === "coverage" ? "border-red-600 bg-red-600 text-white" : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"}`}
            title="Blind spots on this account map"
          >
            <AlertTriangle size={15} />
            <span className="hidden sm:inline">Blind spots</span>
            {openSpotCount > 0 && (
              <span className={`rounded-full px-1.5 text-xs font-bold ${panel === "coverage" ? "bg-white text-red-600" : "bg-red-600 text-white"}`}>
                {openSpotCount}
              </span>
            )}
          </button>

          <button onClick={() => setDialog("settings")} className="rounded-lg border border-gray-300 bg-white p-2 text-gray-600 hover:bg-gray-50" title="Settings"><Settings size={16} /></button>
        </div>
      </div>

      {/* canvas */}
      <div
        ref={containerRef}
        className="absolute inset-0"
        style={{
          top: topBarH,
          cursor: panRef.current ? "grabbing" : "default",
          backgroundImage: "radial-gradient(circle, #d4d4d8 1px, transparent 1px)",
          backgroundSize: `${24 * vp.k}px ${24 * vp.k}px`,
          backgroundPosition: `${vp.x}px ${vp.y}px`,
        }}
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) {
            panRef.current = { px: e.clientX, py: e.clientY };
            setSelectedId(null); setSelectedEdgeId(null); cancelConnect(); setMapMenuOpen(false);
          }
        }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <div className="absolute left-0 top-0" style={{ transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.k})`, transformOrigin: "0 0" }}>
          {/* edges */}
          <svg className="absolute overflow-visible" style={{ left: 0, top: 0, width: 1, height: 1, pointerEvents: "none" }}>
            <defs>
              <marker id="am-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M 0 1 L 8 5 L 0 9" fill="none" stroke="#64748b" strokeWidth="1.6" />
              </marker>
            </defs>
            {connectPreview && (
              <path d={connectPreview} fill="none" stroke="#14b8a6" strokeWidth={2} strokeDasharray="8 6" markerEnd="url(#am-arrow)" />
            )}
            {model?.edges.map((e) => {
              const g = edgePath(e);
              if (!g) return null;
              const influence = e.kind === "influence";
              // An edge stays lit only when both ends are in the result set, so a filtered
              // map does not leave lines dangling into dimmed cards.
              const edgeDimmed = spotFocus
                || (e.sourceId != null && isDimmed(e.sourceId)) || (e.targetId != null && isDimmed(e.targetId));
              return (
                <g key={e.id}>
                  <path d={g.d} fill="none" stroke="transparent" strokeWidth={16} style={{ pointerEvents: "stroke", cursor: "pointer" }}
                    onClick={(ev) => { ev.stopPropagation(); setSelectedEdgeId(e.id === selectedEdgeId ? null : e.id); }} />
                  <path d={g.d} fill="none"
                    stroke={spotFocus ? "#94a3b8" : selectedEdgeId === e.id ? "#3b82f6" : influence ? "#14b8a6" : "#64748b"}
                    strokeWidth={selectedEdgeId === e.id ? 2.5 : 1.8}
                    strokeDasharray={influence ? "7 5" : undefined}
                    opacity={edgeDimmed ? (spotFocus ? 0.2 : 0.12) : 1}
                    markerEnd="url(#am-arrow)" />
                </g>
              );
            })}
            {/* Dashed red run from a leader to the gap under them, tagged on the line so the
                break in the route is visible without opening anything. */}
            {ghostSpots.map((b) => {
              if (b.anchorContactId == null) return null;
              const a = model?.contacts.find((c) => c.id === b.anchorContactId);
              if (!a || b.posX == null || b.posY == null) return null;
              const sx = (a.posX ?? 0) + CARD_W / 2;
              const sy = (a.posY ?? 0) + (heights[a.id] ?? CARD_H_FALLBACK);
              const tx = b.posX + CARD_W / 2;
              const ty = b.posY - 4;
              const my = (sy + ty) / 2;
              const col = severityColor(b.severity);
              return (
                <g key={`bs-${b.id}`}>
                  <path d={`M ${sx} ${sy} C ${sx} ${my}, ${tx} ${my}, ${tx} ${ty}`}
                    fill="none" stroke={col} strokeWidth={1.8} strokeDasharray="6 5" />
                  <circle cx={tx} cy={ty} r={3} fill={col} />
                </g>
              );
            })}
          </svg>

          {/* edge menu */}
          {selectedEdge && selectedEdgeGeom && (
            <div className="absolute z-40 flex gap-1 rounded-lg border border-gray-200 bg-white p-1 shadow-lg" style={{ left: selectedEdgeGeom.mx - 70, top: selectedEdgeGeom.my - 20 }}>
              <button onClick={() => toggleEdgeKind(selectedEdge)} className="rounded-md px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100">
                {selectedEdge.kind === "influence" ? "Make reporting line" : "Make influence line"}
              </button>
              <button onClick={() => deleteEdge(selectedEdge.id)} className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50">Delete</button>
            </div>
          )}

          {/* sticky notes */}
          {model?.notes.map((n) => (
            <div
              key={n.id}
              style={{
                opacity: spotFocus ? 0.35 : 1,
                transition: "opacity 180ms ease",
              }}
            >
              <StickyNote note={n} onDragStart={onDragStart("note")} onSave={saveNoteBody} onDelete={deleteNote} />
            </div>
          ))}

          {/* contacts */}
          {model?.contacts.map((c) => (
            <ContactCard
              key={c.id}
              contact={c}
              roles={model.roles}
              companyName={model.map?.name ?? ""}
              editing={editingId === c.id}
              selected={selectedId === c.id}
              connectSource={connectSource}
              zoom={vp.k}
              productUsage={productUsageByContact.get(c.id)}
              usageDays={usageDaysByContact.get(c.id) ?? []}
              warnings={warningsByContact.get(c.id) ?? []}
              onOpenUsage={(ct) => setUsageContactId(ct.id)}
              dimmed={isDimmed(c.id) || greyed(c.id)}
              dimSoft={!isDimmed(c.id) && greyed(c.id)}
              onMeasure={(id, h) => setHeights((prev) => (prev[id] === h ? prev : { ...prev, [id]: h }))}
              onDragStart={onDragStart("contact")}
              onSelect={setSelectedId}
              onStartEdit={setEditingId}
              onCancelEdit={() => setEditingId(null)}
              onSaveEdit={saveEdit}
              onDelete={deleteContact}
              onToggleContacted={toggleContacted}
              onAssignRole={assignRole}
              onAddDirectional={addDirectional}
              onStartConnect={(id) => { setConnectSource(id); setConnectPos(null); showToast("Now click another card to connect"); }}
              onCompleteConnect={completeConnect}
               onOpenAgent={openContactAgent}
            />
          ))}

          {/* blind spots: the gaps, drawn where the missing person would sit */}
          {ghostSpots.map((b) => (
            <div key={`ghost-${b.id}`} className="absolute" style={{ left: b.posX ?? 0, top: b.posY ?? 0, zIndex: openSpotId === b.id ? 45 : 5 }}>
              <BlindSpotCard
                spot={b}
                roleName={model?.roles.find((r) => r.id === b.suggestedRoleId)?.name ?? null}
                anchorName={b.anchorContactId != null ? contactNameById.get(b.anchorContactId) ?? null : null}
                open={openSpotId === b.id}
                adding={addingSpotId === b.id}
                onOpen={() => setOpenSpotId(b.id)}
                onClose={() => setOpenSpotId(null)}
                onAdd={() => void addBlindSpot(b)}
                onDismiss={() => void setSpotDismissed(b, true)}
                spotlit={spotFocus}
                onDragStart={(e) => e.stopPropagation()}
              />
            </div>
          ))}
        </div>

        {/* loading / error / empty overlays */}
        {query.isLoading && !model && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600 shadow"><Loader2 size={16} className="animate-spin" /> Loading map…</div>
          </div>
        )}
        {query.error && !model && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="rounded-xl border border-red-200 bg-white px-4 py-3 text-sm text-red-600 shadow">
              Could not load the map. <button onClick={() => void query.mutate()} className="font-semibold underline">Retry</button>
            </div>
          </div>
        )}
        {model && !model.map && !query.isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow">
              <p className="text-lg font-semibold text-gray-900">No account maps yet</p>
              <p className="mt-1 text-sm text-gray-500">Create your first map to start mapping an account.</p>
              <button onClick={() => setDialog("newmap")} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">New Map</button>
            </div>
          </div>
        )}
      </div>

      {/* connect mode banner */}
      {connectSource != null && (
        <div className="absolute left-1/2 z-40 flex items-center gap-3 rounded-full border border-teal-200 bg-white px-4 py-2 shadow-lg" style={{ top: 70, transform: "translateX(-50%)" }}>
          <span className="text-sm font-medium text-teal-700">
            Connecting from {contactById.get(connectSource)?.name || "contact"}. Click the card you want to link to.
          </span>
          <button onClick={cancelConnect} className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-200">Cancel</button>
        </div>
      )}

      {/* direct creation controls; intake workflows run through agent conversations */}
      <div className="absolute bottom-4 left-4 z-40 flex flex-wrap gap-2">
        <button disabled={mid == null || busy} onClick={() => { const pos = worldCenter(); void createContact({posX:pos.x,posY:pos.y}); }} className="rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-40">New Contact</button>
        <button disabled={mid == null} onClick={createNote} className="rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow hover:bg-emerald-700 disabled:opacity-40">New Note</button>
      </div>

      {/* zoom controls, deal roles legend and minimap share one right-hand column */}
      <div className="absolute bottom-4 right-4 z-40 flex flex-col items-end gap-2">
        {/* zoom controls */}
        <div className="flex items-center gap-1 rounded-full border border-gray-200 bg-white px-1 py-1 shadow">
          <button onClick={() => zoomBy(1 / 1.25)} disabled={vp.k <= ZOOM_MIN + 0.001} className="rounded-full p-1.5 text-gray-600 hover:bg-gray-100 disabled:opacity-30" title="Zoom out (−)">
            <Minus size={15} />
          </button>
          <button
            onClick={() => { if (model?.contacts.length) fitView(model.contacts); }}
            className="min-w-12 rounded-full px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-100"
            title="Reset zoom to fit (0)"
          >
            {Math.round(vp.k * 100)}%
          </button>
          <button onClick={() => zoomBy(1.25)} disabled={vp.k >= ZOOM_MAX - 0.001} className="rounded-full p-1.5 text-gray-600 hover:bg-gray-100 disabled:opacity-30" title="Zoom in (+)">
            <Plus size={15} />
          </button>
          <div className="mx-0.5 h-5 w-px bg-gray-200" />
          <button onClick={() => { if (model?.contacts.length) fitView(model.contacts); }} className="rounded-full p-1.5 text-gray-600 hover:bg-gray-100" title="Fit to content (0)">
            <Maximize2 size={15} />
          </button>
        </div>

        {/* One legend, two tabs: the grid key and the deal roles were two stacked panels
            competing for the same corner as the minimap and the zoom control. */}
        {legendOpen ? (
          <div className="w-72 rounded-xl border border-gray-200 bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-gray-100 px-2 py-1.5">
              <div className="flex items-center gap-1">
                {(["grid", "roles"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setLegendTab(t)}
                    className="rounded-md px-2 py-1 text-xs font-semibold"
                    style={legendTab === t
                      ? { background: `${ACCENT}14`, color: ACCENT }
                      : { color: "#64748b" }}
                  >
                    {t === "grid" ? "Grid key" : "Deal roles"}
                  </button>
                ))}
              </div>
              <button onClick={() => setLegendOpen(false)} className="rounded p-1 text-gray-400 hover:bg-gray-100" title="Collapse legend">
                <ChevronDown size={15} />
              </button>
            </div>
            {legendTab === "grid" ? (
              <div className="max-h-72 overflow-y-auto px-3 py-2 text-xs text-gray-600">
                <p className="mb-1 font-semibold text-gray-800">Top to bottom = seniority</p>
                {GRID_LEVELS.map((l) => (
                  <p key={l.l} className="py-0.5"><span className="font-bold text-indigo-700">{l.l}</span> — {l.label}</p>
                ))}
                <p className="mb-1 mt-2 font-semibold text-gray-800">Left to right = function</p>
                {GRID_ZONES.map((z) => (
                  <p key={z.n} className="py-0.5"><span className="font-bold text-teal-700">{z.n}</span> — {z.label}</p>
                ))}
              </div>
            ) : (
              <div className="max-h-72 space-y-1 overflow-y-auto p-2">
                {(model?.roles ?? []).map((r) => (
                  <div key={r.id} className="rounded-md px-3 py-2 text-sm font-medium" style={{ background: roleColor(r), color: (r.color && ["#15803d", "#7c3aed", "#ef4444"].includes(r.color)) ? "#ffffff" : "#1f2937" }}>
                    {r.name}
                  </div>
                ))}
                <div className="rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700">No Role Assigned</div>
              </div>
            )}
          </div>
        ) : (
          <button onClick={() => setLegendOpen(true)} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-lg">
            Legend <ChevronUp size={15} />
          </button>
        )}
        {/* minimap */}
        <div
          className="relative rounded-lg border border-gray-200 bg-white shadow-lg"
          style={{ width: miniW, height: miniH, overflow: "hidden", cursor: miniDragRef.current ? "grabbing" : "crosshair", touchAction: "none" }}
          onPointerDown={(e) => { miniDragRef.current = true; e.currentTarget.setPointerCapture(e.pointerId); navigateMini(e); }}
          onPointerMove={(e) => { if (miniDragRef.current) navigateMini(e); }}
          onPointerUp={(e) => { miniDragRef.current = false; e.currentTarget.releasePointerCapture?.(e.pointerId); }}
          onPointerCancel={(e) => { miniDragRef.current = false; e.currentTarget.releasePointerCapture?.(e.pointerId); }}
        >
          {model?.contacts.map((c) => (
            <div key={c.id} className="absolute rounded-sm" style={{
              left: miniOffX + ((c.posX ?? 0) - bounds.minX) * miniK,
              top: miniOffY + ((c.posY ?? 0) - bounds.minY) * miniK,
              width: Math.max(4, CARD_W * miniK),
              height: Math.max(3, (heights[c.id] ?? CARD_H_FALLBACK) * miniK),
              background: roleColor(model.roles.find((r) => r.id === c.roleId)),
              opacity: greyed(c.id) ? 0.3 : 1,
              filter: greyed(c.id) ? "grayscale(1)" : undefined,
            }} />
          ))}
          {/* the gaps, so the overview says where coverage is missing too */}
          {ghostSpots.map((b) => (
            <div key={`mini-spot-${b.id}`} className="absolute rounded-sm" style={{
              left: miniOffX + ((b.posX ?? 0) - bounds.minX) * miniK,
              top: miniOffY + ((b.posY ?? 0) - bounds.minY) * miniK,
              width: Math.max(4, CARD_W * miniK),
              height: Math.max(3, CARD_H_FALLBACK * miniK),
              border: `1.5px dashed ${severityColor(b.severity)}`,
              background: `${severityColor(b.severity)}22`,
            }} />
          ))}
          {model?.notes.map((n) => (
            <div key={`mini-note-${n.id}`} className="absolute rounded-sm bg-amber-400" style={{
              left: miniOffX + ((n.posX ?? 0) - bounds.minX) * miniK,
              top: miniOffY + ((n.posY ?? 0) - bounds.minY) * miniK,
              width: Math.max(4, (n.width ?? 220) * miniK),
              height: Math.max(3, (n.height ?? 120) * miniK),
            }} />
          ))}
          <div className="pointer-events-none absolute border-2 border-blue-500 bg-blue-200/20" style={miniViewport} />
        </div>
      </div>

      {/* toast */}
      {toast && (
        <div className={`absolute bottom-4 left-1/2 z-50 rounded-lg px-4 py-2 text-sm font-medium text-white shadow-lg ${toast.err ? "bg-red-600" : "bg-gray-900"}`} style={{ transform: "translateX(-50%)" }}>
          {toast.msg}
        </div>
      )}
      {busy && (
        <div className="absolute right-4 top-16 z-50 flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 shadow">
          <Loader2 size={14} className="animate-spin" /> Working…
        </div>
      )}

        {panel === "coverage" && (
          <CoveragePanel
            spots={model?.blindSpots ?? []}
            contactNameById={contactNameById}
            scanning={scanning}
            addingId={addingSpotId}
            onClose={() => setPanel("none")}
            spotlight={spotlight}
            onToggleSpotlight={() => setSpotlight((v) => !v)}
            onScan={() => void runScan()}
            onFocus={focusSpot}
            onAdd={(sp) => void addBlindSpot(sp)}
            onDismiss={(sp, d) => void setSpotDismissed(sp, d)}
          />
        )}

        {panel === "actions" && (
          <ActionQueue
            actions={queueActions}
            loading={actionsQuery.isLoading || actionsQuery.isValidating}
            busyKey={busyActionKey}
            onClose={() => setPanel("none")}
            onRefresh={() => void actionsQuery.mutate()}
            onAsk={(a) => void askDust(a)}
            onSetStatus={(a, st) => void setActionStatus(a, st)}
            onFocus={focusAction}
          />
        )}

        {usageContact && (
          <ContactUsageModal
            contact={usageContact}
            usage={productUsageByContact.get(usageContact.id)}
            days={usageDaysByContact.get(usageContact.id) ?? []}
            features={featuresByContact.get(usageContact.id) ?? []}
            onClose={() => setUsageContactId(null)}
          />
        )}

        {accountUsageOpen && model?.accountUsage && (
          <AccountUsageModal
            companyName={model.map?.name ?? "Account"}
            account={model.accountUsage}
            monthly={model.accountMonthly ?? []}
            features={accountFeatureTotals}
            committee={committeeAdoption}
            onClose={() => setAccountUsageOpen(false)}
          />
        )}

      {/* dialogs */}
      {dialog === "settings" && model && (
<SettingsModal
          snapshot={model}
          companyName={companyName}
          onCompanyName={setCompany}
          onClose={() => setDialog(null)}
          onRenameMap={(id, name) => mapAction(id, "rename", name)}
          onTrashMap={(id) => mapAction(id, "trash")}
          onRestoreMap={(id) => mapAction(id, "restore")}
          onDestroyMap={(id) => mapAction(id, "destroy")}
          onSaveRole={saveRole}
          onDeleteRole={deleteRole}
          onImportJson={importJson}
          toast={showToast}
        />
      )}
      {dialog === "newmap" && <NewMapDialog onClose={() => setDialog(null)} onCreate={createMap} />}
      {dialog === "linkedin" && (
        <PasteLinkedInDialog
          onClose={() => setDialog(null)}
          onCreate={(f) => {
            const pos = worldCenter();
            setDialog(null);
            void createContact({ ...f, name: f.name || "New Contact", ...pos });
          }}
        />
      )}
      {dialog === "csv" && <ImportCsvDialog onClose={() => setDialog(null)} onImport={importCsvRows} />}
      {dialog === "contact-agent" && model?.map && agentContactId != null && contactById.get(agentContactId) && (
         <ContactAgentDialog
           contact={contactById.get(agentContactId)!}
           mapName={model.map.name ?? companyName}
           busy={agentContactBusy}
           onClose={() => setDialog(null)}
           onSubmit={sendContactAgent}
         />
       )}
       {dialog === "agent" && model?.map && (
         <AgentTaskDialog
           key={agentTaskMode}
           mode={agentTaskMode}
           mapName={model.map.name ?? companyName}
           busy={busy}
           onClose={() => setDialog(null)}
           onSubmit={sendAgentTask}
         />
       )}
       {dialog === "screenshot" && (
        <AgentInfoDialog
          title="Upload Screenshot"
          body="To extract contacts from an org-chart screenshot, open the Pod conversation, attach the screenshot, and ask the agent to add the contacts to this map. The agent reads the image and writes the contacts and reporting lines straight into this map — refresh to see them appear."
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
