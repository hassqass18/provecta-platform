import { notFound } from "next/navigation";
import { getEngagementDetail } from "@/server/data";
import {
  advanceMilestone,
  setEngagementStatus,
  generateEngagementPlanAction,
  draftDeliverableAction,
} from "@/server/actions";
import {
  addMilestone,
  addTask,
  addKpi,
  addSla,
  createInvoice,
  addDeliverable,
  publishDeliverable,
  deleteDeliverable,
} from "@/server/crud";
import {
  editEngagementFull,
  upsertCharter,
  editMilestone,
  deleteMilestone,
  editKpi,
  deleteKpi,
  editSla,
  deleteSla,
  editTask,
  deleteTask,
} from "@/server/edit-actions";
import { Badge, Card, CardHeader, Stat } from "@/components/ui";
import { NewForm, AINPUT, ALABEL, ABTN } from "@/components/admin-form";
import {
  ENGAGEMENT_STATUS,
  MILESTONE_STATUS,
  TASK_STATUS,
  SLA_STATUS,
  toneFor,
  money,
  shortDate,
} from "@/lib/types";

const ENGAGEMENT_STATUSES = ["PROPOSED", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"];
const MILESTONE_STATUSES = ["PENDING", "IN_PROGRESS", "COMPLETED", "BLOCKED"];
const TASK_STATUSES = ["TODO", "IN_PROGRESS", "DONE"];
const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH"];
const SLA_STATUSES = ["MEETING", "AT_RISK", "BREACHED"];
const KPI_UNITS = ["%", "days", "count", "$", "hours", "score"];
const DELIVERABLE_KINDS = ["DELIVERABLE", "AUDIT", "ARCHITECTURE", "BUILD", "REPORT"];
const SLA_TARGETS = ["< 1h", "< 4h", "< 24h", "99.9%", "Same day", "Next business day"];

// yyyy-MM-dd for <input type="date" defaultValue>
function dateInput(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

const DEL_BTN =
  "rounded-lg border border-[#ff3b30]/30 px-3 py-2 text-sm font-medium text-[#d70015] hover:bg-[#ff3b30]/10";

// bRRAIn plan generation can call the LLM — give the server action room to run.
export const maxDuration = 60;

export default async function EngagementDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const e = await getEngagementDetail(id);
  if (!e) notFound();

  const planExists = e.milestones.some((m) => m.source === "BRAIN");
  const phaseTitle = new Map(e.milestones.map((m) => [m.id, m.title]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{e.name}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {e.tenant.name} · {e.code} ·{" "}
            <Badge tone={toneFor(ENGAGEMENT_STATUS, e.status)}>{e.status}</Badge>
          </p>
        </div>
        <form action={setEngagementStatus} className="flex items-center gap-2">
          <input type="hidden" name="id" value={e.id} />
          <select
            name="status"
            defaultValue={e.status}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
          >
            {ENGAGEMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button className="rounded-lg bg-[var(--color-brand)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90">
            Update status
          </button>
        </form>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Budget" value={money(e.budgetMinor, e.currency)} />
        <Stat label="Start" value={shortDate(e.startDate)} />
        <Stat label="Target end" value={shortDate(e.targetEndDate)} />
      </div>

      {/* ── Generate the delivery plan with bRRAIn (P3) ── */}
      <Card>
        <CardHeader title="bRRAIn delivery plan" />
        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <p className="max-w-xl text-sm text-slate-500">
            {planExists
              ? "A tailored plan has been generated for this engagement. Re-generating is blocked while a bRRAIn plan exists — edit the phases/KPIs below, or clear them first."
              : "Generate phases, deliverables, tasks and KPIs tailored to this engagement's scope — from its proposal, charter and discovery notes. Review and adjust before sharing with the client."}
          </p>
          <form action={generateEngagementPlanAction}>
            <input type="hidden" name="id" value={e.id} />
            <button
              className="rounded-lg bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
              disabled={planExists}
            >
              Generate plan with bRRAIn
            </button>
          </form>
        </div>
      </Card>

      {/* ── Edit engagement (full: dates, budget, currency, status) ── */}
      <Card>
        <CardHeader title="Edit engagement" />
        <form action={editEngagementFull} className="grid gap-3 p-5 sm:grid-cols-2">
          <input type="hidden" name="id" value={e.id} />
          <div>
            <label className={ALABEL}>Name</label>
            <input name="name" defaultValue={e.name} className={AINPUT} />
          </div>
          <div>
            <label className={ALABEL}>Status</label>
            <select name="status" defaultValue={e.status} className={AINPUT}>
              {ENGAGEMENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={ALABEL}>Summary</label>
            <input name="summary" defaultValue={e.summary ?? ""} className={AINPUT} />
          </div>
          <div>
            <label className={ALABEL}>Budget (major units)</label>
            <input name="budget" type="number" step="0.01" defaultValue={e.budgetMinor / 100} className={AINPUT} />
          </div>
          <div>
            <label className={ALABEL}>Currency</label>
            <input name="currency" defaultValue={e.currency} className={AINPUT} />
          </div>
          <div>
            <label className={ALABEL}>Start date</label>
            <input name="startDate" type="date" defaultValue={dateInput(e.startDate)} className={AINPUT} />
          </div>
          <div>
            <label className={ALABEL}>Target end date</label>
            <input name="targetEndDate" type="date" defaultValue={dateInput(e.targetEndDate)} className={AINPUT} />
          </div>
          <div className="sm:col-span-2">
            <button className={ABTN}>Save changes</button>
          </div>
        </form>
      </Card>

      {/* ── Project charter (editable upsert; works with no charter yet) ── */}
      <Card>
        <CardHeader title="Project charter" />
        <form action={upsertCharter} className="grid gap-3 p-5 sm:grid-cols-2">
          <input type="hidden" name="engagementId" value={e.id} />
          <div className="sm:col-span-2">
            <label className={ALABEL}>Objectives</label>
            <textarea name="objectives" defaultValue={e.charter?.objectives ?? ""} rows={2} className={AINPUT} />
          </div>
          <div className="sm:col-span-2">
            <label className={ALABEL}>Scope</label>
            <textarea name="scope" defaultValue={e.charter?.scope ?? ""} rows={2} className={AINPUT} />
          </div>
          <div className="sm:col-span-2">
            <label className={ALABEL}>Out of scope</label>
            <textarea name="outOfScope" defaultValue={e.charter?.outOfScope ?? ""} rows={2} className={AINPUT} />
          </div>
          <div>
            <label className={ALABEL}>Sponsor</label>
            <input name="sponsor" defaultValue={e.charter?.sponsor ?? ""} className={AINPUT} />
          </div>
          <div>
            <label className={ALABEL}>Success criteria</label>
            <input name="successCriteria" defaultValue={e.charter?.successCriteria ?? ""} className={AINPUT} />
          </div>
          <div className="sm:col-span-2">
            <button className={ABTN}>Save charter</button>
          </div>
        </form>
      </Card>

      {/* ── Milestones ── */}
      <Card>
        <CardHeader title="Milestones — full control" />
        <ul className="divide-y divide-slate-100">
          {e.milestones.map((m) => (
            <li key={m.id} className="px-5 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-slate-800">{m.title}</div>
                  <div className="text-xs text-slate-500">
                    {m.tasks.length} tasks · due {shortDate(m.dueDate)}
                    {m.clientVisible ? "" : " · internal"}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge tone={toneFor(MILESTONE_STATUS, m.status)}>{m.status.replace("_", " ")}</Badge>
                  {m.status !== "COMPLETED" ? (
                    <form action={advanceMilestone}>
                      <input type="hidden" name="id" value={m.id} />
                      <button className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">
                        Advance →
                      </button>
                    </form>
                  ) : null}
                </div>
              </div>
              <details className="mt-2">
                <summary className="cursor-pointer list-none text-xs font-medium text-[#5ab0ff]">Edit</summary>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <form action={editMilestone} className="grid gap-3 sm:col-span-3 sm:grid-cols-3">
                    <input type="hidden" name="id" value={m.id} />
                    <input type="hidden" name="engagementId" value={e.id} />
                    <input name="title" defaultValue={m.title} className={`${AINPUT} sm:col-span-2`} />
                    <select name="status" defaultValue={m.status} className={AINPUT}>
                      {MILESTONE_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <input
                      name="description"
                      defaultValue={m.description ?? ""}
                      placeholder="Description"
                      className={`${AINPUT} sm:col-span-2`}
                    />
                    <input name="dueDate" type="date" defaultValue={dateInput(m.dueDate)} className={AINPUT} />
                    <label className="flex items-center gap-2 text-sm text-slate-600">
                      <input type="checkbox" name="clientVisible" defaultChecked={m.clientVisible} />
                      Client visible
                    </label>
                    <button className={ABTN}>Save milestone</button>
                  </form>
                  <form action={deleteMilestone}>
                    <input type="hidden" name="id" value={m.id} />
                    <input type="hidden" name="engagementId" value={e.id} />
                    <button className={DEL_BTN}>Delete</button>
                  </form>
                </div>
              </details>
            </li>
          ))}
        </ul>
        <NewForm label="Add milestone">
          <form action={addMilestone} className="grid gap-3 sm:grid-cols-3">
            <input type="hidden" name="engagementId" value={e.id} />
            <input name="title" required placeholder="Milestone title" className={`${AINPUT} sm:col-span-2`} />
            <input name="dueDate" type="date" className={AINPUT} />
            <input name="description" placeholder="Description (optional)" className={`${AINPUT} sm:col-span-2`} />
            <button className={ABTN}>Add milestone</button>
          </form>
        </NewForm>
      </Card>

      {/* ── Tasks ── */}
      <Card>
        <CardHeader title="Tasks" />
        <ul className="divide-y divide-slate-100">
          {e.tasks.map((t) => (
            <li key={t.id} className="px-5 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm text-slate-700">{t.title}</div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500">{t.assignee?.name ?? "—"}</span>
                  <Badge tone={toneFor(TASK_STATUS, t.status)}>{t.status.replace("_", " ")}</Badge>
                </div>
              </div>
              <details className="mt-2">
                <summary className="cursor-pointer list-none text-xs font-medium text-[#5ab0ff]">Edit</summary>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <form action={editTask} className="grid gap-3 sm:col-span-3 sm:grid-cols-3">
                    <input type="hidden" name="id" value={t.id} />
                    <input type="hidden" name="engagementId" value={e.id} />
                    <input name="title" defaultValue={t.title} className={AINPUT} />
                    <select name="status" defaultValue={t.status} className={AINPUT}>
                      {TASK_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <select name="priority" defaultValue={t.priority} className={AINPUT}>
                      {TASK_PRIORITIES.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                    <button className={ABTN}>Save task</button>
                  </form>
                  <form action={deleteTask}>
                    <input type="hidden" name="id" value={t.id} />
                    <input type="hidden" name="engagementId" value={e.id} />
                    <button className={DEL_BTN}>Delete</button>
                  </form>
                </div>
              </details>
            </li>
          ))}
        </ul>
        <NewForm label="Add task">
          <form action={addTask} className="grid gap-3 sm:grid-cols-3">
            <input type="hidden" name="engagementId" value={e.id} />
            <input name="title" required placeholder="Task title" className={`${AINPUT} sm:col-span-2`} />
            <select name="priority" className={AINPUT} defaultValue="MEDIUM">
              {TASK_PRIORITIES.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
            <select name="milestoneId" className={`${AINPUT} sm:col-span-2`} defaultValue="">
              <option value="">No milestone</option>
              {e.milestones.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </select>
            <button className={ABTN}>Add task</button>
          </form>
        </NewForm>
      </Card>

      {/* ── Deliverables — draft content with bRRAIn, review, publish (P4) ── */}
      <Card>
        <CardHeader title="Deliverables — draft with bRRAIn" />
        <ul className="divide-y divide-slate-100">
          {e.deliverables.map((d) => (
            <li key={d.id} className="px-5 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-slate-800">{d.title}</div>
                  <div className="text-xs text-slate-500">
                    {d.kind}
                    {d.milestoneId && phaseTitle.has(d.milestoneId) ? ` · ${phaseTitle.get(d.milestoneId)}` : ""} ·{" "}
                    {d.detail ? `${d.detail.length} chars` : "no content yet"}
                    {d.clientVisible ? "" : " · internal"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={d.status === "DELIVERED" ? "success" : "neutral"}>{d.status}</Badge>
                  <form action={draftDeliverableAction}>
                    <input type="hidden" name="id" value={d.id} />
                    <button className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">
                      {d.detail ? "Re-draft" : "Draft with bRRAIn"}
                    </button>
                  </form>
                  {d.status !== "DELIVERED" ? (
                    <form action={publishDeliverable}>
                      <input type="hidden" name="id" value={d.id} />
                      <input type="hidden" name="engagementId" value={e.id} />
                      <button className="rounded-lg bg-[var(--color-brand)] px-3 py-1 text-xs font-medium text-white hover:opacity-90">
                        Publish →
                      </button>
                    </form>
                  ) : null}
                </div>
              </div>
              {d.detail ? (
                <details className="mt-2">
                  <summary className="cursor-pointer list-none text-xs font-medium text-[#5ab0ff]">
                    Preview content
                  </summary>
                  <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
                    {d.detail}
                  </pre>
                  <form action={deleteDeliverable} className="mt-2">
                    <input type="hidden" name="id" value={d.id} />
                    <input type="hidden" name="engagementId" value={e.id} />
                    <button className={DEL_BTN}>Delete deliverable</button>
                  </form>
                </details>
              ) : null}
            </li>
          ))}
          {e.deliverables.length === 0 ? (
            <li className="px-5 py-4 text-sm text-slate-400">
              No deliverables yet — generate the plan above, or add one below.
            </li>
          ) : null}
        </ul>
        <NewForm label="Add deliverable">
          <form action={addDeliverable} className="grid gap-3 sm:grid-cols-3">
            <input type="hidden" name="engagementId" value={e.id} />
            <input name="title" required placeholder="Deliverable title" className={`${AINPUT} sm:col-span-2`} />
            <select name="kind" className={AINPUT} defaultValue="DELIVERABLE">
              {DELIVERABLE_KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            <select name="milestoneId" className={`${AINPUT} sm:col-span-2`} defaultValue="">
              <option value="">No phase</option>
              {e.milestones.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </select>
            <button className={ABTN}>Add deliverable</button>
          </form>
        </NewForm>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Invoices" />
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100">
              {e.invoices.map((i) => (
                <tr key={i.id}>
                  <td className="px-5 py-3 text-slate-700">{i.number}</td>
                  <td className="px-2 py-3 text-slate-600">{money(i.amountMinor, i.currency)}</td>
                  <td className="px-5 py-3 text-right text-slate-500">{i.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <NewForm label="Add invoice">
            <form action={createInvoice} className="grid gap-3">
              <input type="hidden" name="tenantId" value={e.tenantId} />
              <input type="hidden" name="engagementId" value={e.id} />
              <input name="amount" type="number" required placeholder="Amount (USD)" className={AINPUT} />
              <input name="dueAt" type="date" className={AINPUT} />
              <button className={ABTN}>Create invoice</button>
            </form>
          </NewForm>
        </Card>
        <Card>
          <CardHeader title="Documents" />
          <ul className="divide-y divide-slate-100">
            {e.documents.map((d) => (
              <li key={d.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <span className="text-slate-700">{d.name}</span>
                <span className="text-xs text-slate-400">{d.kind}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── KPIs ── */}
        <Card>
          <CardHeader title="KPIs" />
          <ul className="divide-y divide-slate-100">
            {e.kpis.map((k) => (
              <li key={k.id} className="px-5 py-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-700">{k.label}</span>
                  <span className="font-medium text-slate-900">
                    {k.value}
                    {k.unit === "%" ? "%" : k.unit ? ` ${k.unit}` : ""}
                  </span>
                </div>
                <details className="mt-2">
                  <summary className="cursor-pointer list-none text-xs font-medium text-[#5ab0ff]">Edit</summary>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <form action={editKpi} className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
                      <input type="hidden" name="id" value={k.id} />
                      <input type="hidden" name="engagementId" value={e.id} />
                      <input name="label" defaultValue={k.label} className={`${AINPUT} sm:col-span-2`} />
                      <input name="value" type="number" step="any" defaultValue={k.value} className={AINPUT} />
                      <select name="unit" defaultValue={k.unit ?? ""} className={AINPUT}>
                        <option value="">No unit</option>
                        {KPI_UNITS.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                      <input
                        name="target"
                        type="number"
                        step="any"
                        defaultValue={k.target ?? ""}
                        placeholder="Target (optional)"
                        className={`${AINPUT} sm:col-span-2`}
                      />
                      <button className={ABTN}>Save KPI</button>
                    </form>
                    <form action={deleteKpi}>
                      <input type="hidden" name="id" value={k.id} />
                      <input type="hidden" name="engagementId" value={e.id} />
                      <button className={DEL_BTN}>Delete</button>
                    </form>
                  </div>
                </details>
              </li>
            ))}
          </ul>
          <NewForm label="Add KPI">
            <form action={addKpi} className="grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="engagementId" value={e.id} />
              <input name="label" required placeholder="KPI label" className={`${AINPUT} sm:col-span-2`} />
              <input name="value" type="number" required placeholder="Value" className={AINPUT} />
              <select name="unit" className={AINPUT} defaultValue="">
                <option value="">No unit</option>
                {KPI_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
              <input name="target" type="number" placeholder="Target (optional)" className={`${AINPUT} sm:col-span-2`} />
              <button className={ABTN}>Add KPI</button>
            </form>
          </NewForm>
        </Card>

        {/* ── SLAs ── */}
        <Card>
          <CardHeader title="SLAs" />
          <ul className="divide-y divide-slate-100">
            {e.slas.map((s) => (
              <li key={s.id} className="px-5 py-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-700">{s.metric}</span>
                  <span className="flex items-center gap-2 text-slate-500">
                    {s.target}
                    <Badge tone={toneFor(SLA_STATUS, s.status)}>{s.status.replace("_", " ")}</Badge>
                  </span>
                </div>
                <details className="mt-2">
                  <summary className="cursor-pointer list-none text-xs font-medium text-[#5ab0ff]">Edit</summary>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <form action={editSla} className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
                      <input type="hidden" name="id" value={s.id} />
                      <input type="hidden" name="engagementId" value={e.id} />
                      <input name="metric" defaultValue={s.metric} className={`${AINPUT} sm:col-span-2`} />
                      <input
                        name="target"
                        list="sla-targets"
                        defaultValue={s.target}
                        placeholder="Target"
                        className={AINPUT}
                      />
                      <select name="status" defaultValue={s.status} className={AINPUT}>
                        {SLA_STATUSES.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                      <input
                        name="actual"
                        defaultValue={s.actual ?? ""}
                        placeholder="Actual (optional)"
                        className={`${AINPUT} sm:col-span-2`}
                      />
                      <button className={ABTN}>Save SLA</button>
                    </form>
                    <form action={deleteSla}>
                      <input type="hidden" name="id" value={s.id} />
                      <input type="hidden" name="engagementId" value={e.id} />
                      <button className={DEL_BTN}>Delete</button>
                    </form>
                  </div>
                </details>
              </li>
            ))}
          </ul>
          <NewForm label="Add SLA">
            <form action={addSla} className="grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="engagementId" value={e.id} />
              <input
                name="metric"
                required
                placeholder="Metric (e.g. Ticket first response)"
                className={`${AINPUT} sm:col-span-2`}
              />
              <input name="target" list="sla-targets" placeholder="Target (e.g. < 4h)" className={AINPUT} />
              <select name="status" className={AINPUT} defaultValue="MEETING">
                {SLA_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
              <button className={ABTN}>Add SLA</button>
            </form>
          </NewForm>
        </Card>
      </div>

      {/* Shared datalist for SLA target suggestions (pick-or-type). */}
      <datalist id="sla-targets">
        {SLA_TARGETS.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
    </div>
  );
}
