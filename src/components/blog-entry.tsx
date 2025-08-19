import { BlogPost } from "@/data/blog";
import { ArrowUpRight } from "lucide-react";

export function BlogEntry({ post }: { post: BlogPost }) {
  return (
    <div className="flex flex-row gap-6">
      <div className="flex flex-col flex-1">
        <p className="text-xs text-zinc-500 mb-2">{post.date}</p>
        <h3 className="font-serif text-md mb-3">
          <a
            href={`/blog/${post.slug}`}
            className="group inline-flex items-center gap-2 hover:text-zinc-600 transition-colors duration-300"
          >
            {post.title}
            <ArrowUpRight
              size={16}
              className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform duration-300"
            />
          </a>
        </h3>
        <p className="text-sm text-zinc-600">{post.description}</p>
        {post.tags && (
          <div className="flex gap-2 mt-3 flex-wrap">
            {post.tags.map((tag, index) => (
              <span
                key={index}
                className="text-xs text-zinc-600 px-2 py-1 bg-zinc-100 rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}