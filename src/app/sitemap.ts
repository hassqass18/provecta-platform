import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const posts = await prisma.blogPost.findMany({ where: { status: "PUBLISHED" } });
  const tools = [
    "/tools/revops-audit",
    "/tools/ai-readiness",
    "/tools/revenue-leakage",
    "/tools/operations-drag",
    "/tools/os-health",
  ];
  return [
    { url: base, priority: 1 },
    { url: `${base}/portfolio`, priority: 0.8 },
    { url: `${base}/blog`, priority: 0.8 },
    ...tools.map((t) => ({ url: `${base}${t}`, priority: 0.7 })),
    ...posts.map((p) => ({ url: `${base}/blog/${p.slug}`, priority: 0.6 })),
  ];
}
