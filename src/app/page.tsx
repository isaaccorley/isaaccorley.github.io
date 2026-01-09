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

const navSections = [
  { id: "about", label: "About" },
  { id: "news", label: "News" },
  { id: "projects", label: "Projects" },
  { id: "publications", label: "Publications" },
  { id: "education", label: "Education" },
  { id: "experience", label: "Experience" },
].filter(({ id }) => {
  if (id === "about") return !!aboutMe.description;
  if (id === "news") return newsData.length > 0;
  if (id === "publications") return publicationData.length > 0;
  if (id === "experience") return experienceData.length > 0;
  if (id === "education") return educationData.length > 0;
  if (id === "projects") return portfolioData.length > 0;
  return false;
});

export default function Home() {
  return (
    <div className="min-h-screen bg-[var(--background)] transition-colors duration-300">
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>
      <div className="max-w-screen-lg mx-auto px-8 py-24">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
          <div className="col-span-12 md:col-span-4 space-y-8 mb-8 md:mb-0">
            <div className="md:sticky top-12 space-y-6">
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
              switch (sectionName) {
                case Section.News:
                  return (
                    newsData.length > 0 && (
                      <section key={sectionName} id="news">
                        <h2 className="font-serif text-l mb-8 tracking-wide uppercase">News</h2>
                        <div className="space-y-8">
                          {newsData.map((news, index) => (
                            <div key={index}>
                              <NewsEntry news={news} />
                            </div>
                          ))}
                        </div>
                      </section>
                    )
                  );
                case Section.Education:
                  return (
                    educationData.length > 0 && (
                      <section key={sectionName} id="education">
                        <h2 className="font-serif text-l mb-8 tracking-wide uppercase">
                          Education
                        </h2>
                        <div className="space-y-8">
                          {educationData.map((education, index) => (
                            <EducationEntry key={index} education={education} />
                          ))}
                        </div>
                      </section>
                    )
                  );
                case Section.Publication:
                  return (
                    publicationData.length > 0 && (
                      <section key={sectionName} id="publications">
                        <h2 className="font-serif text-l mb-8 tracking-wide uppercase">
                          Selected Publications
                        </h2>
                        <div className="space-y-8">
                          {publicationData.map((publication, index) => (
                            <div key={index}>
                              <PublicationEntry publication={publication} />
                              {index < publicationData.length - 1 && (
                                <div className="h-px bg-zinc-200 dark:bg-zinc-700 my-6" />
                              )}
                            </div>
                          ))}
                        </div>
                      </section>
                    )
                  );
                case Section.Experience:
                  return (
                    experienceData.length > 0 && (
                      <section key={sectionName} id="experience">
                        <h2 className="font-serif text-l mb-8 tracking-wide uppercase">
                          Experience
                        </h2>
                        <div className="space-y-8">
                          {experienceData.map((experience, index) => (
                            <ExperienceEntry key={index} experience={experience} />
                          ))}
                        </div>
                      </section>
                    )
                  );
                case Section.Portfolio:
                  return (
                    portfolioData.length > 0 && (
                      <section key={sectionName} id="projects">
                        <h2 className="font-serif text-l mb-8 tracking-wide uppercase">Projects</h2>
                        <div className="space-y-8">
                          {portfolioData.map((portfolio, index) => (
                            <PortfolioEntry key={index} portfolio={portfolio} />
                          ))}
                        </div>
                      </section>
                    )
                  );
                default:
                  return null;
              }
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
