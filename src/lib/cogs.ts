import { prisma } from "./db";

// Cost-to-serve (COGS) ledger. Posts the variable cost of delivering an
// engagement — LLM tokens, bRRAIn compute, storage, payment processor fees —
// as balanced double-entry journal lines against cash. With revenue already on
// the ledger, contribution margin per engagement = revenue − summed COGS is a
// straight ledger query. Every entry point is gated/no-op-safe: zero-or-negative
// amounts post nothing, and account setup is idempotent.

export const COGS_ACCOUNTS = [
  { code: "cogs_llm", name: "COGS — LLM" },
  { code: "cogs_brrain", name: "COGS — bRRAIn" },
  { code: "cogs_storage", name: "COGS — Storage" },
  { code: "cogs_payment_fees", name: "COGS — Payment fees" },
];

const CASH_ACCOUNT = { code: "cash", name: "Cash", type: "ASSET" };

/**
 * Idempotently ensure all COGS expense accounts and the cash asset account
 * exist. Safe to call on every post.
 */
export async function ensureCogsAccounts(): Promise<void> {
  for (const a of COGS_ACCOUNTS) {
    await prisma.ledgerAccount.upsert({
      where: { code: a.code },
      create: { code: a.code, name: a.name, type: "EXPENSE" },
      update: {},
    });
  }
  await prisma.ledgerAccount.upsert({
    where: { code: CASH_ACCOUNT.code },
    create: CASH_ACCOUNT,
    update: {},
  });
}

/**
 * Post a single cost-to-serve entry: debit the named COGS account, credit cash,
 * for the same minor-unit amount (a balanced two-line journal entry).
 *
 * No-op when `amountMinor <= 0`, so callers can post unconditionally without
 * guarding against zero-cost events.
 */
export async function postCogs(args: {
  engagementId?: string | null;
  accountCode: string;
  amountMinor: number;
  memo: string;
}): Promise<void> {
  if (args.amountMinor <= 0) return;
  await ensureCogsAccounts();
  await prisma.journalEntry.create({
    data: {
      memo: args.memo,
      source: "FEE",
      engagementId: args.engagementId ?? undefined,
      lines: {
        create: [
          {
            accountCode: args.accountCode,
            debitMinor: args.amountMinor,
            creditMinor: 0,
            currency: "USD",
          },
          {
            accountCode: CASH_ACCOUNT.code,
            debitMinor: 0,
            creditMinor: args.amountMinor,
            currency: "USD",
          },
        ],
      },
    },
  });
}
