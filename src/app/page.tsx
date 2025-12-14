import { EducationEntry } from "@/components/education-entry";
import { ExperienceEntry } from "@/components/experience-entry";
import { NewsEntry } from "@/components/news-entry";
import { PortfolioEntry } from "@/components/portfolio-entry";
import { ProfileSection } from "@/components/profile-section";
import { PublicationEntry } from "@/components/publication-entry";
import { aboutMe } from "@/data/aboutme";
import { educationData } from "@/data/education";
import { experienceData } from "@/data/experience";
import { newsData } from "@/data/news";
import { portfolioData } from "@/data/portfolio";
import { publicationData } from "@/data/publication";
import { Section, sectionOrder } from "@/data/section-order";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#FFFCF8]">
      {/* Don't have a great call on whether max-w-screen-xl is better */}
      <div className="max-w-screen-lg mx-auto px-8 py-24">
        {/* Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
          {/* Left Column - Fixed Info */}
          <div className="col-span-12 md:col-span-4 space-y-12 mb-8 md:mb-0">
            {/* Profile */}
            <div className="md:sticky top-12 space-y-8">
              <ProfileSection aboutMe={aboutMe} />
            </div>
          </div>

          {/* Right Column - Scrolling Content */}
          <div className="col-span-12 md:col-span-7 md:col-start-6 space-y-24">
            {/* About section is typically first */}
            {aboutMe.description && (
              <section>
                <p
                  className="font-serif text-sm leading-relaxed text-zinc-700 [&_a]:underline [&_a]:text-zinc-900 [&_a:hover]:text-zinc-600"
                  dangerouslySetInnerHTML={{ __html: aboutMe.description }}
                />
              </section>
            )}

            {/* Latest Experiment card */}
            <section>
              <div className="rounded-xl border border-zinc-200 bg-white shadow-sm p-6 md:p-8">
                <div className="flex flex-col gap-4">
                  <span className="text-xs tracking-wide uppercase text-zinc-500">Latest Experiment</span>
                  <h3 className="font-serif text-lg text-zinc-900">Bioacoustic Bird Detection Live Demo</h3>
                  <p className="text-sm leading-relaxed text-zinc-700">
                    Real-time client-side ML inference for avian classification. Runs entirely in your browser using ONNX Runtime.
                  </p>
                  <div className="flex flex-wrap gap-3 pt-2">
                    <a
                      href="/bioacoustics"
                      className="inline-flex items-center gap-2 rounded-md bg-zinc-900 text-white px-4 py-2 text-sm hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-400"
                    >
                      Try the Demo →
                    </a>
                    <a
                      href="/ftw"
                      className="inline-flex items-center gap-2 rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-900 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-300"
                    >
                      FTW Experiment
                    </a>
                  </div>
                </div>
              </div>
            </section>

            {/* Map through sectionOrder to render sections in correct order */}
            {sectionOrder.map((sectionName) => {
              // Most of this is redundant... but in case it needs to be unique.
              switch (sectionName) {
                case Section.News:
                  return (
                    newsData.length > 0 && (
                      <section key={sectionName}>
                        <h2 className="font-serif text-l mb-12 tracking-wide uppercase">
                          News
                        </h2>
                        <div className="space-y-12">
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
                      <section key={sectionName}>
                        <h2 className="font-serif text-zinc-700 mb-12 tracking-wide uppercase">
                          Education
                        </h2>
                        <div className="space-y-12">
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
                      <section key={sectionName}>
                        <h2 className="font-serif text-l mb-12 tracking-wide uppercase">
                          Selected Publications
                        </h2>
                        <div className="space-y-12">
                          {publicationData.map((publication, index) => (
                            <div key={index}>
                              <PublicationEntry publication={publication} />
                              {index < publicationData.length - 1 && (
                                <div className="h-px bg-zinc-200 my-8" />
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
                      <section key={sectionName}>
                        <h2 className="font-serif text-md mb-12 tracking-wide uppercase">
                          Experience
                        </h2>
                        <div className="space-y-12">
                          {experienceData.map((experience, index) => (
                            <ExperienceEntry
                              key={index}
                              experience={experience}
                            />
                          ))}
                        </div>
                      </section>
                    )
                  );
                case Section.Portfolio:
                  return (
                    portfolioData.length > 0 && (
                      <section key={sectionName}>
                        <h2 className="font-serif text-md mb-12 tracking-wide uppercase">
                          Open-Source Libraries
                        </h2>
                        <div className="space-y-12">
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
