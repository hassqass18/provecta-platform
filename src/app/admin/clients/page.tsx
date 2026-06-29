import Link from "next/link";
import { getClients } from "@/server/data";
import { Badge, Card, CardHeader } from "@/components/ui";
import { NewForm, AINPUT, ABTN } from "@/components/admin-form";
import { createClient } from "@/server/crud";

export default async function ClientsPage() {
  const clients = await getClients();
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-900">Clients</h1>
      <Card>
        <CardHeader title={`${clients.length} client workspaces`} />
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-2.5">Client</th>
              <th className="px-2 py-2.5">Engagements</th>
              <th className="px-2 py-2.5">Users</th>
              <th className="px-2 py-2.5">Tickets</th>
              <th className="px-2 py-2.5">Main channel</th>
              <th className="px-5 py-2.5 text-right">Type</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {clients.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-5 py-3 font-medium text-slate-800">
                  <Link href={`/admin/clients/${c.id}`} className="text-[var(--color-brand)] hover:underline">
                    {c.name}
                  </Link>{" "}
                  {c.isDemo ? <Badge tone="info">DEMO</Badge> : null}
                </td>
                <td className="px-2 py-3 text-slate-600">{c._count.engagements}</td>
                <td className="px-2 py-3 text-slate-600">{c._count.users}</td>
                <td className="px-2 py-3 text-slate-600">{c._count.tickets}</td>
                <td className="px-2 py-3 text-slate-600">
                  {c.preferredChannel ? (
                    <Badge>{c.preferredChannel}</Badge>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-5 py-3 text-right text-slate-500">{c.type}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <NewForm label="Start a client engagement">
          <form action={createClient} className="flex flex-wrap items-end gap-2">
            <input name="name" required placeholder="Client / company name" className={`${AINPUT} max-w-xs`} />
            <input name="contactName" placeholder="Contact name" className={`${AINPUT} max-w-xs`} />
            <input name="contactEmail" type="email" placeholder="Contact email (creates their login)" className={`${AINPUT} max-w-xs`} />
            <select name="preferredChannel" defaultValue="" className={AINPUT} aria-label="Main communication channel">
              <option value="">Main channel…</option>
              <option value="WHATSAPP">WhatsApp</option>
              <option value="EMAIL">Email</option>
              <option value="SLACK">Slack</option>
              <option value="OPEN">Open / any</option>
            </select>
            <input name="channelAddress" placeholder="Channel address (phone / email / id)" className={`${AINPUT} max-w-xs`} />
            <textarea name="notes" placeholder="Consultation / discovery notes (optional) — captured as the first transcript" className={`${AINPUT} h-20 w-full`} />
            <label className="flex w-full flex-col gap-1 px-1 text-xs text-slate-500">
              Discovery transcripts (optional) — upload call transcripts / notes to seed the engagement
              <input
                name="transcriptFiles"
                type="file"
                multiple
                accept=".txt,.md,.markdown,.vtt,.srt,.csv,.json,.log,.pdf,.docx,.doc,text/*"
                className="block w-full max-w-md text-xs text-slate-600 file:mr-3 file:rounded-full file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-700 hover:file:bg-slate-200"
              />
            </label>
            <button className={ABTN}>Start engagement</button>
          </form>
          <p className="mt-1.5 px-1 text-xs text-slate-500">
            Creates the workspace, stages the onboarding engagement, and (with a contact email) the client&apos;s login.
            Uploaded transcripts seed the engagement — text files (.txt/.md/.vtt/.srt) are read in as transcripts that
            ground bRRAIn&apos;s plan &amp; proposals; PDFs/Word are attached as documents. The main channel is their single point of contact.
          </p>
        </NewForm>
      </Card>
    </div>
  );
}
