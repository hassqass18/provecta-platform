import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { MarketingShell } from "@/components/marketing-shell";
import { shortDate } from "@/lib/types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await prisma.blogPost.findUnique({ where: { slug } });
  if (!post) return { title: "Not found" };
  return { title: `${post.title} — Provecta Group`, description: post.excerpt };
}

export default async function BlogPost({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await prisma.blogPost.findUnique({ where: { slug } });
  if (!post || post.status !== "PUBLISHED") notFound();

  return (
    <MarketingShell>
      <article className="mx-auto max-w-2xl px-6 py-16">
        <Link href="/blog" className="text-sm text-[var(--color-brand)]">← Blog</Link>
        <div className="mt-6 text-xs uppercase tracking-wide text-slate-400">{shortDate(post.publishedAt)}</div>
        <h1 className="mt-1 text-3xl font-bold text-slate-900">{post.title}</h1>
        <p className="mt-4 text-lg text-slate-600">{post.excerpt}</p>
        <div className="mt-8 space-y-4 text-[1.05rem] leading-relaxed text-slate-700">
          {post.body.split("\n\n").map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
      </article>
    </MarketingShell>
  );
}
