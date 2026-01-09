import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { Portfolio } from "@/data/portfolio";

export function PortfolioEntry({ portfolio }: { portfolio: Portfolio }) {
  return (
    <div className="glass-card p-5 flex flex-col md:flex-row gap-4 md:gap-6 items-start md:items-center">
      {portfolio.imageUrl && (
        <div className="w-full md:w-1/4 md:min-w-[160px] relative">
          <Image
            src={portfolio.imageUrl}
            alt={portfolio.title}
            width={160}
            height={200}
            sizes="(max-width: 768px) 100vw, 25vw"
            className="rounded-lg w-full md:w-auto"
          />
        </div>
      )}
      <div className="flex flex-col flex-1 w-full">
        <h3 className="font-serif text-base mb-3">{portfolio.title}</h3>

        {portfolio.technologies && (
          <div className="flex gap-2 mb-4 flex-wrap">
            {portfolio.technologies.map((tech, index) => (
              <span
                key={index}
                className="text-xs text-zinc-600 dark:text-zinc-400 px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-full"
              >
                {tech}
              </span>
            ))}
          </div>
        )}

        <div className="flex gap-6">
          {portfolio.projectUrl && (
            <a
              href={portfolio.projectUrl}
              className="group inline-flex items-center gap-2 text-xs accent-link"
            >
              <ArrowUpRight
                size={12}
                className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform duration-300"
              />
              <span className="tracking-wider uppercase">Project</span>
            </a>
          )}
          {portfolio.codeUrl && (
            <a
              href={portfolio.codeUrl}
              className="group inline-flex items-center gap-2 text-xs accent-link"
            >
              <ArrowUpRight
                size={12}
                className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform duration-300"
              />
              <span className="tracking-wider uppercase">Code</span>
            </a>
          )}
        </div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-4 italic">
          {portfolio.description}
        </p>
      </div>
    </div>
  );
}
