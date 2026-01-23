import { EducationEntry } from "@/components/education-entry";
import { educationData } from "@/data/education";
import { PublicationEntry } from "@/components/publication-entry";
import { publicationData } from "@/data/publication";
import { ProfileSection } from "@/components/profile-section";
import { aboutMe } from "@/data/aboutme";
import { NewsEntry } from "@/components/news-entry";
import { newsData } from "@/data/news";
import { ExperienceEntry } from "@/components/experience-entry";
import { experienceData } from "@/data/experience";
import { PortfolioEntry } from "@/components/portfolio-entry";
import { portfolioData } from "@/data/portfolio";
import { sectionOrder, Section } from "@/data/section-order";
import { ThemeToggle } from "@/components/theme-toggle";
import { SectionNav } from "@/components/section-nav";
import { AnimateOnScroll } from "@/components/animate-on-scroll";
import { Footer } from "@/components/footer";
import { ReactNode } from "react";

interface SectionConfig {
  id: string;
  navLabel: string;
  title: string;
  data: unknown[];
  spacing: string;
  renderItem: (item: unknown, index: number) => ReactNode;
}

const sectionConfigs: Record<Section, SectionConfig> = {
  [Section.News]: {
    id: "news",
    navLabel: "News",
    title: "News",
    data: newsData,
    spacing: "space-y-6",
    renderItem: (item, index) => (
      <AnimateOnScroll key={index} delay={index * 100}>
        <NewsEntry news={item as (typeof newsData)[0]} />
      </AnimateOnScroll>
    ),
  },
  [Section.Education]: {
    id: "education",
    navLabel: "Education",
    title: "Education",
    data: educationData,
    spacing: "space-y-6",
    renderItem: (item, index) => (
      <AnimateOnScroll key={index} delay={index * 100}>
        <EducationEntry education={item as (typeof educationData)[0]} />
      </AnimateOnScroll>
    ),
  },
  [Section.Publication]: {
    id: "publications",
    navLabel: "Publications",
    title: "Selected Publications",
    data: publicationData,
    spacing: "space-y-6",
    renderItem: (item, index) => (
      <AnimateOnScroll key={index} delay={index * 100}>
        <PublicationEntry publication={item as (typeof publicationData)[0]} />
      </AnimateOnScroll>
    ),
  },
  [Section.Experience]: {
    id: "experience",
    navLabel: "Experience",
    title: "Experience",
    data: experienceData,
    spacing: "space-y-6",
    renderItem: (item, index) => (
      <AnimateOnScroll key={index} delay={index * 100}>
        <ExperienceEntry experience={item as (typeof experienceData)[0]} />
      </AnimateOnScroll>
    ),
  },
  [Section.Portfolio]: {
    id: "projects",
    navLabel: "Projects",
    title: "Projects",
    data: portfolioData,
    spacing: "space-y-6",
    renderItem: (item, index) => (
      <AnimateOnScroll key={index} delay={index * 100}>
        <PortfolioEntry portfolio={item as (typeof portfolioData)[0]} />
      </AnimateOnScroll>
    ),
  },
};

const navSections = [
  { id: "about", label: "About" },
  ...sectionOrder
    .filter((section) => sectionConfigs[section].data.length > 0)
    .map((section) => ({
      id: sectionConfigs[section].id,
      label: sectionConfigs[section].navLabel,
    })),
].filter(({ id }) => (id === "about" ? !!aboutMe.description : true));

const hasAnyContent =
  aboutMe.description || sectionOrder.some((section) => sectionConfigs[section].data.length > 0);

export default function Home() {
  if (!hasAnyContent) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="text-center px-4">
          <h1 className="font-serif text-2xl mb-4">Coming Soon</h1>
          <p className="text-zinc-500 dark:text-zinc-400">
            This site is currently under construction.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[var(--background)] transition-colors duration-300">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[400px] bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.15),_transparent_70%)]"
        aria-hidden="true"
      />
      <div className="fixed top-4 right-4 sm:right-6 md:right-8 z-50">
        <ThemeToggle />
      </div>
      <div className="max-w-screen-lg mx-auto px-4 md:px-8 py-12 md:py-24 pb-24 md:pb-24">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12">
          <div className="col-span-12 md:col-span-4 space-y-8 mb-8 md:mb-0">
            <div className="md:sticky top-14 space-y-6">
              <ProfileSection aboutMe={aboutMe} />
              <SectionNav sections={navSections} />
            </div>
          </div>

          <div className="col-span-12 md:col-span-7 md:col-start-6 space-y-16">
            {aboutMe.description && (
              <section id="about">
                <p
                  className="font-serif text-sm leading-relaxed text-zinc-700 dark:text-zinc-300 [&_a]:underline [&_a]:text-zinc-900 dark:[&_a]:text-zinc-100 [&_a:hover]:text-zinc-600 dark:[&_a:hover]:text-zinc-400"
                  dangerouslySetInnerHTML={{ __html: aboutMe.description }}
                />
              </section>
            )}

            {sectionOrder.map((sectionName) => {
              const config = sectionConfigs[sectionName];
              if (config.data.length === 0) return null;

              return (
                <section key={sectionName} id={config.id}>
                  <h2 className="font-serif text-lg mb-4 md:mb-8 tracking-wide uppercase">
                    {config.title}
                  </h2>
                  <div className={config.spacing}>
                    {config.data.map((item, index) => config.renderItem(item, index))}
                  </div>
                </section>
              );
            })}
            <Footer />
          </div>
        </div>
      </div>
    </div>
  );
}
