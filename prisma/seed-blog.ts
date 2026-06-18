import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Real insight content. Updates BlogPost bodies by slug (no user/data reset).
const POSTS: { slug: string; title: string; excerpt: string; tags: string; body: string }[] = [
  {
    slug: "first-business-operations-firm-on-brrain",
    title: "Why we became the first Business Operations firm built on bRRAIn",
    excerpt:
      "Operations is the new battleground for AI. Here's why Provecta rebuilt itself on bRRAIn — and runs its own firm on the same platform we sell.",
    tags: "bRRAIn,operations,AI",
    body: `Most firms sell software they don't use. We decided to do the opposite.

Provecta Group started as a revenue-operations consultancy. We were good at it — CRM architecture, lead-to-deal automation, the dashboards leadership actually opens. But we kept hitting the same wall with clients: the problem was rarely a missing tool. It was that the business had no single place where work, money, and knowledge lived together. Every answer required three logins and a phone call.

So we rebuilt ourselves. Today Provecta is a business-operations firm, and we run our entire back office — engagements, project charters, milestones, invoicing, support tickets, and an autonomous agent layer — on one platform, built on bRRAIn. The same platform every client is onboarded onto.

That choice changes the sales conversation. We are not pitching a slide of features. We are showing you the system we use to run a real firm with a small team: how a discovery transcript becomes a proposal, how a milestone update notifies a client without anyone lifting a finger, how a support request that arrives over WhatsApp becomes a tracked ticket with a proposed action.

bRRAIn is the brain underneath it. It is the difference between automation that follows rigid rules and a system that reads your operating context and proposes the next best action — then earns the right to act on its own as it learns your procedures. We gate it deliberately: regulated and irreversible actions stay human-approved. Everything else graduates.

Being first matters here, but not for the bragging rights. It means that when an organization wants AI implemented across operations — not bolted on as another chatbot — we have already made every mistake worth making, on ourselves. The toolkit on this site is a thin, honest slice of that. Run a tool, see the gap, and decide what to fix yourself and what to hand us.`,
  },
  {
    slug: "ai-implementation-without-the-60pct-failure",
    title: "AI implementation without the 60% failure rate",
    excerpt:
      "Most AI projects are abandoned. The difference between the ones that stick and the ones that don't is rarely the model — it's change management.",
    tags: "change-management,ADKAR,adoption",
    body: `The numbers are brutal. Depending on which study you read, somewhere between half and two-thirds of AI initiatives are abandoned before they return anything. Teams blame the technology. The technology is almost never the reason.

The reason is adoption. A model that nobody trusts, integrated into a process nobody documented, owned by nobody in particular, will be quietly worked around within a quarter. The pilot demos beautifully and then dies in the gap between "it works" and "we work this way now."

We treat that gap as the actual product. Before we deploy anything, we score readiness across five dimensions — awareness, desire, knowledge, ability, and reinforcement. It is the ADKAR model, and it is unglamorous on purpose. A team can be technically ready and organizationally nowhere. Knowing which one you are is the whole game.

The pattern that works looks like this. Start where AI removes manual, repeatable work — not where it adds a flashy new surface. Sequence the rollout so the first win is small, reversible, and obviously useful to the people doing the work, not just the executive who approved it. Instrument adoption, not just deployment: who is using it, for what, and is the manual fallback shrinking. And keep a human in the loop on anything regulated or irreversible until the system has earned trust with a track record you can see.

This is also why we built the readiness assessment on this site. It will not tell you that you are doomed, and it will not tell you that you are five clicks from transformation. It gives you a band and a sequenced first step, in your own numbers. The teams that succeed with AI are not the ones with the best model. They are the ones who treated adoption as engineering.`,
  },
  {
    slug: "single-source-of-truth-for-services-firms",
    title: "The single source of truth every services firm is missing",
    excerpt:
      "Engagement spine, client portal, autonomous back office — one record, many views. Here's the data model behind a firm that runs itself.",
    tags: "RevOps,portal,SSOT",
    body: `Ask a services firm where the truth lives and you will get a tour. The proposal is in a docs folder. The contract is in an inbox. The project plan is in one tool, the invoices in another, the client updates in a thread, and the actual status in someone's head. Each of these is a "source of truth," which is another way of saying there isn't one.

The fix is not another tool. It is a model. We treat the entire client lifecycle as a single spine: a proposal becomes a contract, which opens an engagement, which carries a charter, milestones, tasks, deliverables, invoices, and a support thread. One record. Every surface — the back-office board, the client's dashboard, the billing ledger, the support agent — is a view over that one record, not a copy of it.

When you build it this way, a few things stop being hard. A milestone moving to "complete" can notify the client automatically, because the dashboard they see and the board your team uses are the same object. Billing can show every payment intake on one screen regardless of method, because money posts to one ledger. A support request can attach itself to the engagement it concerns, because the engagement is a first-class thing the system understands.

It also makes a brain useful. An AI layer is only as good as the context it can query. Scatter your operations across ten tools and the brain sees fragments. Put them on one spine and it can reason about the whole client relationship — propose the next action, draft the status update, flag the invoice that is aging — and act on the low-risk ones once it has earned that trust.

This is the architecture under Provecta's own back office, and under every client engagement we deliver. The "single source of truth" is not a slogan you buy. It is a data model you commit to. The good news is that committing to it is mostly a decision, and the payoff compounds every week you live inside it.`,
  },
];

async function main() {
  for (const p of POSTS) {
    await prisma.blogPost.upsert({
      where: { slug: p.slug },
      create: { ...p, status: "PUBLISHED" },
      update: { title: p.title, excerpt: p.excerpt, tags: p.tags, body: p.body, status: "PUBLISHED" },
    });
    console.log("  upserted:", p.slug);
  }
  console.log("✓ Blog content updated.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
