import Link from "next/link";

// Server-side search + status filter (GET navigation; themes via .appdark/.applight overrides).
export function FilterBar({
  basePath,
  q,
  statuses,
  activeStatus,
  placeholder = "Search…",
}: {
  basePath: string;
  q?: string;
  statuses: string[];
  activeStatus?: string;
  placeholder?: string;
}) {
  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1 text-xs font-medium ${
      active ? "border-[#0071e3] bg-[#0071e3] text-white" : "border-slate-200 bg-white text-slate-600"
    }`;

  const qs = (s?: string) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (s) p.set("status", s);
    const str = p.toString();
    return str ? `${basePath}?${str}` : basePath;
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form method="get" action={basePath} className="flex gap-2">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder={placeholder}
          className="w-48 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#0071e3] focus:outline-none"
        />
        {activeStatus ? <input type="hidden" name="status" value={activeStatus} /> : null}
        <button className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700">Search</button>
      </form>
      <div className="flex flex-wrap gap-1.5">
        <Link href={qs()} className={chip(!activeStatus)}>All</Link>
        {statuses.map((s) => (
          <Link key={s} href={qs(s)} className={chip(activeStatus === s)}>
            {s.replace(/_/g, " ")}
          </Link>
        ))}
      </div>
    </div>
  );
}
