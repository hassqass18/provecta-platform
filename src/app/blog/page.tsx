import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { MarketingShell } from "@/components/marketing-shell";
import { shortDate } from "@/lib/types";

export const metadata: Metadata = {
  title: "Blog — Provecta Group",
  description: "Notes on business operations, organization-wide AI implementation, and bRRAIn.",
};

export default async function BlogIndex() {
  const posts = await prisma.blogPost.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
  });
  return (
    <MarketingShell>
      <section className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-3xl font-bold text-slate-900">Blog</h1>
        <p className="mt-2 text-slate-600">Operations, AI implementation, and the brain.</p>
        <div className="mt-10 space-y-8">
          {posts.map((p) => (
            <article key={p.id} className="border-b border-slate-100 pb-8">
              <div className="text-xs uppercase tracking-wide text-slate-400">{shortDate(p.publishedAt)}</div>
              <h2 className="mt-1 text-xl font-semibold text-slate-900">
                <Link href={`/blog/${p.slug}`} className="hover:text-[var(--color-brand)]">{p.title}</Link>
              </h2>
              <p className="mt-2 text-slate-600">{p.excerpt}</p>
              <div className="mt-3 flex gap-2">
                {p.tags.split(",").filter(Boolean).map((t) => (
                  <span key={t} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-500">{t}</span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    </MarketingShell>
  );
}
