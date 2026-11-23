import { Role, roleColor, ACCENT } from "./types.ts";

/** Compact segmented/toggle chip used by the filter row. */
export function Chip({ active, onClick, children, title }: { active: boolean; onClick: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="shrink-0 rounded-full px-2.5 py-1 text-xs font-medium transition-colors"
      style={
        active
          ? { background: `${ACCENT}14`, color: ACCENT, boxShadow: `inset 0 0 0 1px ${ACCENT}59` }
          : { color: "#64748b", boxShadow: "inset 0 0 0 1px #e2e8f0" }
      }
    >
      {children}
    </button>
  );
}

type FilterMenuProps = {
  open: boolean;
  onClose: () => void;
  contactedFilter: "all" | "contacted" | "not";
  setContactedFilter: (v: "all" | "contacted" | "not") => void;
  roleFilter: number | "none" | null;
  setRoleFilter: (v: number | "none" | null) => void;
  roles: Role[];
  total: number;
  matched: number;
  filterActive: boolean;
  onClear: () => void;
};

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-3 py-2">
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

/**
 * Filters are secondary to search, so they sit behind one button instead of costing the
 * canvas a permanent row. Groups combine with AND; the canvas dims non-matching cards.
 */
export function FilterMenu(p: FilterMenuProps) {
  if (!p.open) return null;
  return (
    <div className="absolute left-0 z-50 mt-1 w-80 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
      <Group label="Relationship">
      <Chip active={p.contactedFilter === "contacted"} onClick={() => p.setContactedFilter(p.contactedFilter === "contacted" ? "all" : "contacted")}>
        Contacted
      </Chip>
      <Chip active={p.contactedFilter === "not"} onClick={() => p.setContactedFilter(p.contactedFilter === "not" ? "all" : "not")}>
        Not contacted
      </Chip>
      </Group>
      {p.roles.length > 0 && (
        <>
          <div className="h-px bg-gray-100" />
          <Group label="Deal role">
        {p.roles.map((r) => (
          <Chip key={r.id} active={p.roleFilter === r.id} onClick={() => p.setRoleFilter(p.roleFilter === r.id ? null : r.id)}>
            <span className="mr-1 inline-block h-2 w-2 rounded-full align-middle" style={{ background: roleColor(r) }} />
            {r.name}
          </Chip>
        ))}
            <Chip active={p.roleFilter === "none"} onClick={() => p.setRoleFilter(p.roleFilter === "none" ? null : "none")}>No role</Chip>
          </Group>
        </>
      )}
      <div className="h-px bg-gray-100" />
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-xs text-gray-500">
          {p.filterActive ? `${p.matched} of ${p.total} match` : `${p.total} contacts`}
        </span>
        <div className="flex items-center gap-1">
          {p.filterActive && (
            <button onClick={p.onClear} className="rounded px-2 py-1 text-xs font-semibold hover:bg-gray-100" style={{ color: ACCENT }}>
              Clear all
            </button>
          )}
          <button onClick={p.onClose} className="rounded px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100">Done</button>
        </div>
      </div>
    </div>
  );
}
