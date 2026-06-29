import { prisma } from "@/lib/db";
import { mdToEmailHtml } from "@/lib/email/resend";
import AcceptForm from "./accept-form";

export const dynamic = "force-dynamic";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "#000", color: "#f5f5f7", fontFamily: "-apple-system,Segoe UI,Roboto,Arial,sans-serif" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "40px 20px" }}>
        <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 24 }}>Provecta Group</div>
        {children}
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <Shell>
      <div style={{ marginTop: 80, textAlign: "center", color: "#a1a1a6", fontSize: 16 }}>{children}</div>
    </Shell>
  );
}

export default async function PublicProposalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const proposal = await prisma.proposal.findUnique({
    where: { acceptToken: token },
    include: { engagement: { include: { tenant: { select: { name: true } } } } },
  });

  const expired = proposal?.acceptTokenExpiresAt ? proposal.acceptTokenExpiresAt < new Date() : true;
  if (!proposal || expired) return <Centered>This proposal link is invalid or has expired. Please contact Provecta Group.</Centered>;
  if (proposal.status === "APPROVED")
    return <Centered>You&apos;ve accepted this proposal. Check your email for your secure workspace login and engagement agreement.</Centered>;
  if (proposal.status === "DECLINED") return <Centered>This proposal has been declined. Reach out if you&apos;d like to revisit it.</Centered>;

  const company = proposal.engagement.tenant.name;
  const amount = (proposal.amountMinor / 100).toLocaleString("en-US", { style: "currency", currency: proposal.currency });
  const html = mdToEmailHtml(proposal.bodyMd ?? "");

  return (
    <Shell>
      <div style={{ border: "1px solid #2a2a2e", borderRadius: 16, padding: 28, background: "#0a0a0a" }}>
        <div style={{ fontSize: 13, color: "#0a84ff", fontWeight: 600 }}>PROPOSAL · {company}</div>
        <div style={{ fontSize: 13, color: "#a1a1a6", margin: "6px 0 20px" }}>Indicative investment: {amount}</div>
        <div style={{ color: "#e8e8ed" }} dangerouslySetInnerHTML={{ __html: html }} />
      </div>
      <AcceptForm token={token} company={company} />
      <p style={{ color: "#86868b", fontSize: 12, marginTop: 24 }}>Provecta Group, a Genius Co company.</p>
    </Shell>
  );
}
