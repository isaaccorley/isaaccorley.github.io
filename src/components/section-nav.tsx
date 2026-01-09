"use client";

import { useState, useEffect } from "react";

const SECTION_NAV_ROOT_MARGIN = "-20% 0px -70% 0px";

interface SectionNavProps {
  sections: { id: string; label: string }[];
}

export function SectionNav({ sections }: SectionNavProps) {
  const [activeSection, setActiveSection] = useState<string>("");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: SECTION_NAV_ROOT_MARGIN },
    );

    sections.forEach(({ id }) => {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, [sections]);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <>
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--background)]/90 backdrop-blur-sm border-t border-zinc-200 dark:border-zinc-700"
        aria-label="Section navigation"
      >
        <ul className="flex overflow-x-auto gap-1 px-4 py-3 scrollbar-hide">
          {sections.map(({ id, label }) => (
            <li key={id} className="flex-shrink-0">
              <button
                onClick={() => scrollToSection(id)}
                className={`px-3 py-1.5 text-xs tracking-wider uppercase rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] ${
                  activeSection === id
                    ? "bg-[var(--accent)] text-white font-medium"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                {label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <nav
        className="hidden md:block mt-8 pt-8 border-t border-zinc-200 dark:border-zinc-700"
        aria-label="Section navigation"
      >
        <ul className="space-y-2">
          {sections.map(({ id, label }) => (
            <li key={id}>
              <button
                onClick={() => scrollToSection(id)}
                className={`text-xs tracking-wider uppercase transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 rounded ${
                  activeSection === id
                    ? "text-[var(--accent)] font-medium"
                    : "text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300"
                }`}
              >
                {label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
