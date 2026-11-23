import { useState } from "react";
import Papa from "papaparse";
import { X } from "lucide-react";
import { DUST_LOGO_WHITE } from "./types.ts";

export function Dialog(p: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 z-50 flex items-start justify-center bg-black/30 pt-16" onClick={p.onClose}>
      <div className="mx-4 w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">{p.title}</h2>
          <button onClick={p.onClose} className="rounded-md p-1 text-gray-400 hover:text-gray-700"><X size={18} /></button>
        </div>
        {p.children}
      </div>
    </div>
  );
}

export function PasteLinkedInDialog(p: {
  onClose: () => void;
  onCreate: (fields: { name: string; jobTitle: string; linkedinUrl: string }) => void;
}) {
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  return (
    <Dialog title="Paste LinkedIn" onClose={p.onClose}>
      <p className="mb-3 text-sm text-gray-500">Paste a LinkedIn profile URL. Add the name and title, or leave them blank and ask the Pod agent to enrich the contact later.</p>
      <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.linkedin.com/in/…" className="mb-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (optional)" className="mb-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Job title (optional)" className="mb-3 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
      <button
        onClick={() => { if (url.trim()) p.onCreate({ name: name.trim(), jobTitle: title.trim(), linkedinUrl: url.trim() }); }}
        disabled={!url.trim()}
        className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
      >Add Contact</button>
    </Dialog>
  );
}

export type CsvRow = { name: string; jobTitle: string; email: string; linkedinUrl: string; notes: string; roleName: string };

export function ImportCsvDialog(p: { onClose: () => void; onImport: (rows: CsvRow[]) => void }) {
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  function parse() {
    const parsed = Papa.parse<Record<string, string>>(text.trim(), { header: true, skipEmptyLines: "greedy" });
    if (parsed.errors.length > 0) { setErr(parsed.errors[0].message); return; }
    const pick = (row: Record<string, string>, keys: string[]) => {
      for (const k of Object.keys(row)) {
        if (keys.includes(k.trim().toLowerCase())) return (row[k] ?? "").trim();
      }
      return "";
    };
    const rows = parsed.data
      .map((r) => ({
        name: pick(r, ["name", "full name", "contact"]),
        jobTitle: pick(r, ["title", "job title", "jobtitle", "role title", "position"]),
        email: pick(r, ["email", "e-mail"]),
        linkedinUrl: pick(r, ["linkedin", "linkedin url", "linkedinurl", "profile"]),
        notes: pick(r, ["notes", "note"]),
        roleName: pick(r, ["role", "deal role", "dealrole"]),
      }))
      .filter((r) => r.name);
    if (rows.length === 0) { setErr("No rows with a 'name' column found."); return; }
    p.onImport(rows);
  }
  return (
    <Dialog title="Import CSV" onClose={p.onClose}>
      <p className="mb-2 text-sm text-gray-500">Paste CSV with headers. Recognized columns: name, title, email, linkedin, notes, role.</p>
      <textarea value={text} onChange={(e) => { setText(e.target.value); setErr(null); }} rows={8} placeholder={"name,title,email\nJane Doe,VP Eng,jane@acme.com"} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs" />
      {err && <p className="mt-1 text-sm text-red-600">{err}</p>}
      <button onClick={parse} disabled={!text.trim()} className="mt-2 w-full rounded-lg px-3 py-2 text-sm font-medium text-white disabled:opacity-40" style={{ background: "#9333ea" }}>Import Contacts</button>
    </Dialog>
  );
}

export function AgentInfoDialog(p: { title: string; body: string; onClose: () => void }) {
  return (
    <Dialog title={p.title} onClose={p.onClose}>
      <p className="text-sm leading-relaxed text-gray-600">{p.body}</p>
      <button onClick={p.onClose} className="mt-4 w-full rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800">Got it</button>
    </Dialog>
  );
}

export type AgentTaskMode = "custom" | "research" | "avatars" | "strategy";

const AGENT_TASK_PRESETS: Record<AgentTaskMode, { title: string; description: string; prompt: string }> = {
  custom: {
    title: "Ask Dust Agent",
    description: "Write the work you want done. The agent will use the account-map backend and report back in a new Pod conversation.",
    prompt: "",
  },
  research: {
    title: "Research Account",
    description: "Ask the agent to research the account and write verified contacts and relationships into this map.",
    prompt: "Research this account and add the most relevant verified executives, AI leaders, RevOps and team-ops contacts to the account map. Preserve existing contacts and only add supported reporting lines.",
  },
  avatars: {
    title: "Find all profile pictures",
    description: "The agent will look for clearly matching public profile pictures and save only verified matches to the contact cards.",
    prompt: "Find a real public profile picture for every contact on this account map. Use the person's name, title, company, LinkedIn URL, and public sources. Only save a photo when it clearly matches the person. Update each verified contact with accountmap__save-contact, leave uncertain contacts unchanged, and report updated and unresolved contacts.",
  },
  strategy: {
    title: "Generate Strategy",
    description: "Ask the agent to turn the current map into an actionable account strategy.",
    prompt: "Generate an engagement strategy from the current account map. Use every contact, deal role, relationship edge, and note. Return concrete next steps and also write any clearly supported map updates.",
  },
};

export type ContactAgentQuickAction = "draft-email" | "set-15-min" | "find-profile-picture" | "other";

const CONTACT_AGENT_PRESETS: Array<{ id: ContactAgentQuickAction; label: string; prompt: string }> = [
  { id: "draft-email", label: "Draft email", prompt: "Draft a concise, personalized email to this contact. Do not send it. Ground it in the account context and give me a ready-to-review draft." },
  { id: "set-15-min", label: "Set 15 min", prompt: "Help set up a 15-minute meeting with this contact. Check the available context and prepare the right scheduling action or draft, but do not send anything without a review step." },
  { id: "find-profile-picture", label: "Find profile pic", prompt: "Find a real public profile picture for this contact. Only save it if the identity clearly matches. Leave the avatar unchanged if uncertain." },
  { id: "other", label: "Other", prompt: "" },
];

export function ContactAgentDialog(p: {
  contact: { id: number; name: string | null; jobTitle: string | null };
  mapName: string;
  onClose: () => void;
  onSubmit: (task: string, quickAction: ContactAgentQuickAction) => void;
  busy?: boolean;
}) {
  const [quickAction, setQuickAction] = useState<ContactAgentQuickAction>("draft-email");
  const [task, setTask] = useState(CONTACT_AGENT_PRESETS[0].prompt);
  const choose = (id: ContactAgentQuickAction) => {
    setQuickAction(id);
    setTask(CONTACT_AGENT_PRESETS.find((item) => item.id === id)?.prompt ?? "");
  };
  return (
    <Dialog title="Ask Dust about this contact" onClose={p.onClose}>
      <div className="rounded-xl border border-violet-100 bg-violet-50 px-3 py-2">
        <p className="text-sm font-semibold text-violet-900">{p.contact.name || "New Contact"}</p>
        <p className="text-xs text-violet-700">{p.contact.jobTitle || "No title"} · {p.mapName || "Current account"}</p>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-gray-500">Pick a starting point, then edit the instruction before sending it to the agent.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {CONTACT_AGENT_PRESETS.map((item) => (
          <button key={item.id} onClick={() => choose(item.id)} className={`rounded-lg border px-3 py-2 text-left text-sm font-medium ${quickAction === item.id ? "border-violet-300 bg-violet-100 text-violet-800" : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"}`}>{item.label}</button>
        ))}
      </div>
      <textarea autoFocus value={task} onChange={(e) => setTask(e.target.value)} rows={6} placeholder="Describe the work for the Dust agent…" className="mt-3 w-full resize-y rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
      <div className="mt-3 flex items-center justify-end gap-2">
        <button onClick={p.onClose} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50">Cancel</button>
        <button onClick={() => { if (task.trim()) p.onSubmit(task.trim(), quickAction); }} disabled={!task.trim() || p.busy} className="flex items-center gap-2 rounded-lg bg-violet-700 px-4 py-2 text-sm font-medium text-white hover:bg-violet-800 disabled:opacity-40"><img src={DUST_LOGO_WHITE} alt="Dust" className="h-4 w-4" />{p.busy ? "Starting…" : "Send to agent"}</button>
      </div>
    </Dialog>
  );
}

export function AgentTaskDialog(p: {
  onClose: () => void;
  onSubmit: (task: string) => void;
  mapName: string;
  mode: AgentTaskMode;
  busy?: boolean;
}) {
  const preset = AGENT_TASK_PRESETS[p.mode];
  const [task, setTask] = useState(preset.prompt);
  return (
    <Dialog title={preset.title} onClose={p.onClose}>
      <p className="mb-3 text-sm leading-relaxed text-gray-500">{preset.description} Account: <span className="font-semibold text-gray-700">{p.mapName || "Current map"}</span>.</p>
      <textarea
        autoFocus
        value={task}
        onChange={(e) => setTask(e.target.value)}
        onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && task.trim() && !p.busy) p.onSubmit(task.trim()); }}
        rows={7}
        placeholder="Describe the work for the Dust agent…"
        className="w-full resize-y rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
      />
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-xs text-gray-400">⌘/Ctrl + Enter to send</span>
        <div className="flex gap-2">
          <button onClick={p.onClose} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50">Cancel</button>
          <button onClick={() => { if (task.trim()) p.onSubmit(task.trim()); }} disabled={!task.trim() || p.busy} className="flex items-center gap-2 rounded-lg bg-violet-700 px-4 py-2 text-sm font-medium text-white hover:bg-violet-800 disabled:opacity-40"><img src={DUST_LOGO_WHITE} alt="Dust" className="h-4 w-4" />{p.busy ? "Starting…" : "Send to agent"}</button>
        </div>
      </div>
    </Dialog>
  );
}

export function NewMapDialog(p: { onClose: () => void; onCreate: (name: string) => void }) {
  const [name, setName] = useState("");
  return (
    <Dialog title="New Map" onClose={p.onClose}>
      <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Account name (e.g. Acme Corp)" className="mb-3 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
      <button
        onClick={() => { if (name.trim()) p.onCreate(name.trim()); }}
        disabled={!name.trim()}
        className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
      >Create Map</button>
    </Dialog>
  );
}
