import { useState } from "react";
import {
  Building2, Download, ExternalLink, Map as MapIcon, Trash2, Upload, Users, X,
} from "lucide-react";
import { triggerUserFileDownload, captureScreenshot } from "@dust/react-hooks";
import { MapInfo, Role, Snapshot, roleColor } from "./types.ts";

type Tab = "company" | "maps" | "roles" | "export" | "integrations";

type Props = {
  snapshot: Snapshot;
  companyName: string;
  onCompanyName: (v: string) => void;
  onClose: () => void;
  onRenameMap: (id: number, name: string) => void;
  onTrashMap: (id: number) => void;
  onRestoreMap: (id: number) => void;
  onDestroyMap: (id: number) => void;
  onSaveRole: (id: number | null, name: string, color: string) => void;
  onDeleteRole: (id: number) => void;
  onImportJson: (parsed: unknown) => void;
  toast: (msg: string, err?: boolean) => void;
};

export default function SettingsModal(p: Props) {
  const [tab, setTab] = useState<Tab>("maps");
  const [mapView, setMapView] = useState<"active" | "trash">("active");
  const [mapNames, setMapNames] = useState<Record<number, string>>({});
  const [roleNames, setRoleNames] = useState<Record<number, string>>({});
  const [roleColors, setRoleColors] = useState<Record<number, string>>({});
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleColor, setNewRoleColor] = useState("#d1d5db");
  const [importText, setImportText] = useState("");

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "company", label: "My Company", icon: <Building2 size={15} /> },
    { id: "maps", label: "Account Maps", icon: <MapIcon size={15} /> },
    { id: "roles", label: "Deal Roles", icon: <Users size={15} /> },
    { id: "export", label: "Export & Import", icon: <Download size={15} /> },
    { id: "integrations", label: "Integrations", icon: <ExternalLink size={15} /> },
  ];

  const shownMaps = p.snapshot.maps.filter((m) => (mapView === "trash" ? m.deleted : !m.deleted));

  function exportJson() {
    const { maps, ...rest } = p.snapshot;
    void triggerUserFileDownload({
      content: JSON.stringify({ ...rest, exportedAt: new Date().toISOString() }, null, 2),
      filename: `${p.snapshot.map?.name ?? "account-map"}.json`,
    });
  }

  function doImport() {
    try {
      const parsed = JSON.parse(importText);
      p.onImportJson(parsed);
      setImportText("");
    } catch {
      p.toast("Invalid JSON", true);
    }
  }

  return (
    <div className="absolute inset-0 z-50 flex items-start justify-center bg-black/30 pt-10" onClick={p.onClose}>
      <div className="mx-4 w-full max-w-3xl rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between px-6 pt-5">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Settings</h2>
            <p className="text-sm text-gray-500">Manage your account maps, deal roles, and export options</p>
          </div>
          <button onClick={p.onClose} className="rounded-md p-1 text-gray-400 hover:text-gray-700"><X size={18} /></button>
        </div>
        <div className="mt-4 flex gap-1 border-b border-gray-200 px-6">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1 px-3 py-2 text-sm font-medium ${tab === t.id ? "border-b-2 border-gray-900 text-gray-900" : "text-gray-500 hover:text-gray-800"}`}
            >{t.icon}{t.label}</button>
          ))}
        </div>
        <div className="max-h-96 overflow-y-auto px-6 py-5">
          {tab === "company" && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900">My Company</h3>
              <p className="mb-3 text-sm text-gray-500">Used for contact web searches and strategy prompts.</p>
              <input
                value={p.companyName}
                onChange={(e) => p.onCompanyName(e.target.value)}
                placeholder="Company name (e.g. Dust)"
                className="w-full max-w-sm rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </div>
          )}
          {tab === "maps" && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Manage Account Maps</h3>
              <p className="mb-3 text-sm text-gray-500">Create, rename, and manage your account maps. Deleted maps are moved to trash and can be restored.</p>
              <div className="mb-3 flex gap-2">
                <button onClick={() => setMapView("active")} className={`rounded-lg px-3 py-1 text-sm font-medium ${mapView === "active" ? "bg-gray-100 text-gray-900" : "border border-gray-200 text-gray-500"}`}>Active Maps</button>
                <button onClick={() => setMapView("trash")} className={`rounded-lg px-3 py-1 text-sm font-medium ${mapView === "trash" ? "bg-gray-100 text-gray-900" : "border border-gray-200 text-gray-500"}`}>Trash</button>
              </div>
              <div className="space-y-2">
                {shownMaps.length === 0 && <p className="text-sm text-gray-400">Nothing here.</p>}
                {shownMaps.map((m: MapInfo) => (
                  <div key={m.id} className="flex items-center gap-2 rounded-xl border border-gray-200 p-2">
                    <input
                      value={mapNames[m.id] ?? m.name ?? ""}
                      onChange={(e) => setMapNames({ ...mapNames, [m.id]: e.target.value })}
                      onBlur={() => {
                        const v = mapNames[m.id];
                        if (v && v !== m.name) p.onRenameMap(m.id, v);
                      }}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    />
                    {mapView === "active" ? (
                      <button onClick={() => p.onTrashMap(m.id)} className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600">Delete</button>
                    ) : (
                      <>
                        <button onClick={() => p.onRestoreMap(m.id)} className="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-600">Restore</button>
                        <button onClick={() => p.onDestroyMap(m.id)} className="rounded-lg bg-red-500 p-2 text-white hover:bg-red-600" title="Delete forever"><Trash2 size={15} /></button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {tab === "roles" && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Manage Deal Roles</h3>
              <p className="mb-3 text-sm text-gray-500">Create and organize deal roles. Roles help categorize contacts by their role in the deal.</p>
              <div className="mb-4 rounded-xl border border-gray-200 p-3">
                <p className="mb-2 text-sm font-semibold text-gray-800">Create New Role</p>
                <div className="flex items-center gap-2">
                  <input value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} placeholder="Role name" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                  <input type="color" value={newRoleColor} onChange={(e) => setNewRoleColor(e.target.value)} className="h-9 w-14 cursor-pointer rounded-md border border-gray-200" />
                  <button
                    onClick={() => { if (newRoleName.trim()) { p.onSaveRole(null, newRoleName.trim(), newRoleColor); setNewRoleName(""); } }}
                    className="whitespace-nowrap rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
                  >Add Role</button>
                </div>
              </div>
              <p className="mb-2 text-sm font-semibold text-gray-800">Existing Roles</p>
              <div className="space-y-2">
                {p.snapshot.roles.map((r: Role) => (
                  <div key={r.id} className="flex items-center gap-2 rounded-xl border border-gray-200 p-2">
                    <input
                      value={roleNames[r.id] ?? r.name ?? ""}
                      onChange={(e) => setRoleNames({ ...roleNames, [r.id]: e.target.value })}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    />
                    <input
                      type="color"
                      value={roleColors[r.id] ?? roleColor(r)}
                      onChange={(e) => setRoleColors({ ...roleColors, [r.id]: e.target.value })}
                      className="h-9 w-14 cursor-pointer rounded-md border border-gray-200"
                    />
                    <button
                      onClick={() => p.onSaveRole(r.id, roleNames[r.id] ?? r.name ?? "", roleColors[r.id] ?? roleColor(r))}
                      className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50"
                    >Save</button>
                    <button onClick={() => p.onDeleteRole(r.id)} className="rounded-lg bg-red-500 px-3 py-2 text-sm font-medium text-white hover:bg-red-600">Delete</button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {tab === "export" && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Export & Import</h3>
              <p className="mb-3 text-sm text-gray-500">Export your maps in various formats or import previously exported maps.</p>
              <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
                <div className="rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center gap-2"><Download size={16} className="text-gray-600" /><span className="font-semibold text-gray-900">Export as JSON</span></div>
                  <p className="mb-3 mt-1 text-sm text-gray-500">Export map data for backup or sharing</p>
                  <button onClick={exportJson} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50">Export JSON</button>
                </div>
                <div className="rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center gap-2"><Download size={16} className="text-gray-600" /><span className="font-semibold text-gray-900">Export as PNG</span></div>
                  <p className="mb-3 mt-1 text-sm text-gray-500">Export map as an image file</p>
                  <button
                    onClick={async () => { p.onClose(); setTimeout(() => { void captureScreenshot(`${p.snapshot.map?.name ?? "account-map"}.png`); }, 300); }}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50"
                  >Export PNG</button>
                </div>
                <div className="rounded-xl border border-gray-200 p-4" style={{ gridColumn: "1 / -1" }}>
                  <div className="flex items-center gap-2"><Upload size={16} className="text-gray-600" /><span className="font-semibold text-gray-900">Import JSON</span></div>
                  <p className="mb-2 mt-1 text-sm text-gray-500">Paste a previously exported map JSON below</p>
                  <textarea value={importText} onChange={(e) => setImportText(e.target.value)} rows={4} placeholder='{"map": {...}, "contacts": [...] }' className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs" />
                  <button onClick={doImport} disabled={!importText.trim()} className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-40">Import JSON</button>
                </div>
              </div>
            </div>
          )}
          {tab === "integrations" && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Integrations</h3>
              <p className="mt-1 text-sm text-gray-500">
                This app runs on a Dust Pod. To enrich contacts, sync with HubSpot, research a company, or extract contacts
                from a screenshot, open the Pod conversation and ask the agent — it can read and write this map directly
                through the <span className="font-mono">accountmap__*</span> pod functions.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
