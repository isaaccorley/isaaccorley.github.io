import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Footer } from "@/components/footer";
import { blogPosts } from "@/data/blog";

export const metadata: Metadata = {
  title: "Blog | Isaac Corley",
  description: "Writings on geospatial AI, remote sensing, and machine learning.",
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function BlogPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-slate-100">
      <main className="max-w-3xl mx-auto px-6 py-16">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-emerald-400 transition-colors mb-12"
        >
          <ArrowLeft size={16} />
          Back
        </Link>

        <header className="mb-16">
          <h1 className="text-4xl font-serif font-medium mb-4">Blog</h1>
          <p className="text-slate-400">
            Writings on geospatial AI, remote sensing, and machine learning.
          </p>
        </header>

        <section className="space-y-8">
          {blogPosts.map((post) => (
            <article key={post.slug} className="group">
              <Link href={`/${post.slug}`} className="block">
                <div className="flex flex-col gap-2 p-6 -mx-6 rounded-xl hover:bg-slate-800/30 transition-colors">
                  <time className="text-sm text-slate-500">{formatDate(post.date)}</time>
                  <h2 className="text-xl font-serif font-medium text-slate-100 group-hover:text-emerald-400 transition-colors">
                    {post.title}
                  </h2>
                  <p className="text-slate-400 text-sm leading-relaxed">{post.description}</p>
                  <span className="inline-flex items-center gap-1 text-sm text-emerald-400 mt-2">
                    Read more
                    <ArrowRight
                      size={14}
                      className="group-hover:translate-x-1 transition-transform"
                    />
                  </span>
                </div>
              </Link>
            </article>
          ))}
        </section>
      </main>
      <Footer />
    </div>
  );
}
