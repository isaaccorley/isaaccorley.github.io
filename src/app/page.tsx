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
import { BookOpen, Briefcase, GraduationCap, Megaphone, Quote } from "lucide-react";
import Image from "next/image";

export default function Home() {
  const aboutPlain = aboutMe.description
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const aboutSentences = aboutPlain.split(/(?<=\.)\s+/);
  const aboutHighlight =
    aboutSentences.find((s) => /train and deploy geospatial ai models/i.test(s)) ||
    aboutSentences.slice(0, 2).join(" ");
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
              {aboutHighlight && (
                <div className="relative overflow-hidden rounded-xl bg-white border border-zinc-200 p-4 md:p-5 shadow-sm">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-zinc-200" />
                  <div className="flex items-start gap-3">
                    <Quote className="h-4 w-4 text-zinc-400 mt-1" />
                    <p className="font-serif text-zinc-800 leading-relaxed italic text-sm">{aboutHighlight}</p>
                  </div>
                </div>
              )}
            </div>
            {/* left column ends */}

          </div>

          {/* Right Column - Scrolling Content */}
          <div className="col-span-12 md:col-span-7 md:col-start-6 space-y-24">
            {/* About section is typically first */}
            {aboutMe.description && (
              <section>
                <div className="rounded-xl bg-white border border-zinc-200 shadow-sm p-6 md:p-8">
                  <p
                    className="font-serif text-[15px] md:text-base leading-relaxed text-zinc-700 [&_a]:underline [&_a]:text-zinc-900 [&_a:hover]:text-zinc-600 transition-colors"
                    dangerouslySetInnerHTML={{ __html: aboutMe.description }}
                  />
                </div>
              </section>
            )}

            

            {/* Featured strip: image cards with hover overlays */}
            <section>
              <h2 className="font-serif text-2xl md:text-3xl mb-6 tracking-wider text-zinc-900">Featured</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Bioacoustics image card */}
                <a href="/bioacoustics" className="relative group overflow-hidden rounded-xl shadow-sm hover:shadow transition-all duration-300 block">
                  <Image
                    src="/images/bioacoustics-demo.png"
                    alt="Bioacoustic Bird Detection Live Demo"
                    width={400}
                    height={300}
                    className="w-full h-64 object-cover"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/60 transition-all duration-300 flex flex-col justify-end p-6 opacity-0 group-hover:opacity-100">
                    <h3 className="font-serif text-white text-lg mb-2">Bioacoustic Bird Detection</h3>
                    <p className="text-white/90 text-sm line-clamp-2">
                      Real-time ML inference for avian classification in your browser.
                    </p>
                  </div>
                </a>

                {/* FTW image card */}
                <a href="/ftw" className="relative group overflow-hidden rounded-xl shadow-sm hover:shadow transition-all duration-300 block">
                  <Image
                    src="/images/ftw-demo.png"
                    alt="Fields of the World (FTW) Demo"
                    width={400}
                    height={300}
                    className="w-full h-64 object-cover"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/60 transition-all duration-300 flex flex-col justify-end p-6 opacity-0 group-hover:opacity-100">
                    <h3 className="font-serif text-white text-lg mb-2">Fields of the World (FTW)</h3>
                    <p className="text-white/90 text-sm line-clamp-2">
                      Upload GeoTIFF imagery and detect field boundaries live in your browser.
                    </p>
                  </div>
                </a>

                {/* TorchGeo image card */}
                <a href="https://torchgeo.readthedocs.io/en/latest/" target="_blank" rel="noopener noreferrer" className="relative group overflow-hidden rounded-xl shadow-sm hover:shadow transition-all duration-300 block">
                  <Image
                    src="/images/torchgeo.jpg"
                    alt="TorchGeo"
                    width={400}
                    height={300}
                    className="w-full h-64 object-cover"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/60 transition-all duration-300 flex flex-col justify-end p-6 opacity-0 group-hover:opacity-100">
                    <h3 className="font-serif text-white text-lg mb-2">TorchGeo</h3>
                    <p className="text-white/90 text-sm line-clamp-2">
                      PyTorch library for geospatial datasets, models, and transforms.
                    </p>
                  </div>
                </a>
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
                        <div className="rounded-xl bg-white border border-zinc-200 shadow-sm p-6 md:p-8">
                          <div className="flex items-center gap-2 mb-12">
                            <Megaphone className="h-5 w-5 text-zinc-500" />
                            <h2 className="font-serif text-2xl md:text-3xl tracking-wider uppercase text-zinc-900">News</h2>
                          </div>
                          <div className="space-y-12">
                            {newsData.map((news, index) => (
                              <div key={index} className="transition-all duration-200 hover:translate-y-[1px]">
                                <NewsEntry news={news} />
                              </div>
                            ))}
                          </div>
                        </div>
                      </section>
                    )
                  );
                case Section.Education:
                  return (
                    educationData.length > 0 && (
                      <section key={sectionName}>
                        <div className="rounded-xl bg-white border border-zinc-200 shadow-sm p-6 md:p-8">
                          <div className="flex items-center gap-2 mb-12">
                            <GraduationCap className="h-5 w-5 text-zinc-500" />
                            <h2 className="font-serif text-2xl md:text-3xl text-zinc-900 tracking-wider uppercase">Education</h2>
                          </div>
                        <div className="relative">
                          <div className="absolute left-2 top-0 bottom-0 w-px bg-zinc-200" />
                          <div className="space-y-12 pl-6">
                            {educationData.map((education, index) => (
                              <div className="relative" key={index}>
                                <span className="absolute -left-[6px] top-1.5 h-3 w-3 rounded-full bg-zinc-400 ring-2 ring-white" />
                                <EducationEntry education={education} />
                              </div>
                            ))}
                          </div>
                        </div>
                        </div>
                      </section>
                    )
                  );
                case Section.Publication:
                  return (
                    publicationData.length > 0 && (
                      <section key={sectionName}>
                        <div className="rounded-xl bg-white border border-zinc-200 shadow-sm p-6 md:p-8">
                          <div className="flex items-center gap-2 mb-12">
                            <BookOpen className="h-5 w-5 text-zinc-500" />
                            <h2 className="font-serif text-2xl md:text-3xl tracking-wider uppercase text-zinc-900">Selected Publications</h2>
                          </div>
                        <div className="rounded-lg border border-zinc-200">
                          <div className="max-h-[28rem] overflow-y-auto p-4 space-y-8">
                            {publicationData.map((publication, index) => (
                              <div key={`pub-all-${index}`}>
                                <PublicationEntry publication={publication} />
                                {index < publicationData.length - 1 && (
                                  <div className="h-px bg-zinc-200 my-6" />
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                        </div>
                      </section>
                    )
                  );
                case Section.Experience:
                  return (
                    experienceData.length > 0 && (
                      <section key={sectionName}>
                        <div className="rounded-xl bg-white border border-zinc-200 shadow-sm p-6 md:p-8">
                          <div className="flex items-center gap-2 mb-12">
                            <Briefcase className="h-5 w-5 text-zinc-500" />
                            <h2 className="font-serif text-2xl md:text-3xl tracking-wider uppercase text-zinc-900">Experience</h2>
                          </div>
                        <div className="relative">
                          <div className="absolute left-2 top-0 bottom-0 w-px bg-zinc-200" />
                          <div className="space-y-12 pl-6">
                            {experienceData.map((experience, index) => (
                              <div className="relative" key={index}>
                                <span className="absolute -left-[6px] top-1.5 h-3 w-3 rounded-full bg-zinc-400 ring-2 ring-white" />
                                <ExperienceEntry experience={experience} />
                              </div>
                            ))}
                          </div>
                        </div>
                        </div>
                      </section>
                    )
                  );
                case Section.Portfolio:
                  return (
                    portfolioData.length > 0 && (
                      <section key={sectionName}>
                        <h2 className="font-serif text-2xl md:text-3xl mb-6 tracking-wider text-zinc-900 flex items-center gap-2">
                          <BookOpen className="h-5 w-5 text-zinc-500" />
                          Open-Source Libraries
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {portfolioData.map((portfolio, index) => (
                            portfolio.imageUrl && portfolio.projectUrl ? (
                              <a
                                key={index}
                                href={portfolio.projectUrl}
                                target={portfolio.projectUrl.startsWith('http') && !portfolio.projectUrl.includes(window.location.hostname) ? '_blank' : undefined}
                                rel={portfolio.projectUrl.startsWith('http') && !portfolio.projectUrl.includes(window.location.hostname) ? 'noopener noreferrer' : undefined}
                                className="relative group overflow-hidden rounded-xl shadow-sm hover:shadow transition-all duration-300 block"
                              >
                                <Image
                                  src={portfolio.imageUrl}
                                  alt={portfolio.title}
                                  width={400}
                                  height={300}
                                  className="w-full h-64 object-cover"
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/60 transition-all duration-300 flex flex-col justify-end p-6 opacity-0 group-hover:opacity-100">
                                  <h3 className="font-serif text-white text-lg mb-2">{portfolio.title}</h3>
                                  <p className="text-white/90 text-sm line-clamp-2">
                                    {portfolio.description}
                                  </p>
                                </div>
                              </a>
                            ) : (
                              <div
                                key={index}
                                className="rounded-xl border border-zinc-200 bg-white p-5 hover:shadow transition-all duration-200 hover:translate-y-[1px]"
                              >
                                <PortfolioEntry portfolio={portfolio} />
                              </div>
                            )
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
