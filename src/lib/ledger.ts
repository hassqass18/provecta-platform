import { prisma } from "./db";

// Minimal double-entry ledger. Balances are derived, never stored. In prod this
// migrates to a Postgres/TigerBeetle ledger; here it proves the discipline.

export const CHART_OF_ACCOUNTS: { code: string; name: string; type: string }[] = [
  { code: "1000", name: "Cash / Bank", type: "ASSET" },
  { code: "1100", name: "Accounts Receivable", type: "ASSET" },
  { code: "4000", name: "Consulting Revenue", type: "INCOME" },
  { code: "2100", name: "Taxes Payable", type: "LIABILITY" },
];

export async function ensureChartOfAccounts() {
  for (const a of CHART_OF_ACCOUNTS) {
    await prisma.ledgerAccount.upsert({
      where: { code: a.code },
      create: a,
      update: {},
    });
  }
}

export async function postEntry(input: {
  memo: string;
  source?: string;
  engagementId?: string | null;
  invoiceId?: string | null;
  lines: { accountCode: string; debitMinor?: number; creditMinor?: number; currency?: string }[];
}) {
  const debit = input.lines.reduce((s, l) => s + (l.debitMinor ?? 0), 0);
  const credit = input.lines.reduce((s, l) => s + (l.creditMinor ?? 0), 0);
  if (debit !== credit) {
    throw new Error(`Unbalanced entry: debit ${debit} != credit ${credit}`);
  }
  return prisma.journalEntry.create({
    data: {
      memo: input.memo,
      source: input.source ?? "MANUAL",
      engagementId: input.engagementId ?? undefined,
      invoiceId: input.invoiceId ?? undefined,
      lines: {
        create: input.lines.map((l) => ({
          accountCode: l.accountCode,
          debitMinor: l.debitMinor ?? 0,
          creditMinor: l.creditMinor ?? 0,
          currency: l.currency ?? "USD",
        })),
      },
    },
  });
}

export async function trialBalance() {
  const lines = await prisma.journalLine.findMany();
  const byAccount = new Map<string, number>();
  for (const l of lines) {
    byAccount.set(l.accountCode, (byAccount.get(l.accountCode) ?? 0) + l.debitMinor - l.creditMinor);
  }
  const accounts = await prisma.ledgerAccount.findMany({ orderBy: { code: "asc" } });
  return accounts.map((a) => ({ ...a, balanceMinor: byAccount.get(a.code) ?? 0 }));
}
