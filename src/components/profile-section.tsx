import Image from "next/image";
import { Github, Linkedin, Mail, Twitter, ArrowUpRight, GraduationCap } from "lucide-react";
import { AboutMe } from "@/data/aboutme";

interface ProfileSectionProps {
  aboutMe: AboutMe;
}

export function ProfileSection({ aboutMe }: ProfileSectionProps) {
  if (!aboutMe) {
    return null;
  }

  return (
    <div className="md:sticky top-12 flex flex-row-reverse md:flex-col gap-4 md:gap-6">
      {aboutMe.imageUrl && (
        <div className="w-1/3 md:w-full flex-shrink-0">
          <div className="relative max-h-[45vh] md:w-[65%] aspect-[3/4]">
            <Image
              src={aboutMe.imageUrl}
              alt={aboutMe.name}
              fill
              priority
              className="object-cover rounded-xl"
            />
          </div>
        </div>
      )}
      <div className="w-2/3 md:w-full">
        <div className="flex gap-6 mb-6">
          {aboutMe.blogUrl && (
            <a
              href={aboutMe.blogUrl}
              className="group inline-flex items-center gap-2 text-xs accent-link focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 rounded"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Visit blog"
            >
              <ArrowUpRight
                size={12}
                className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform duration-300"
                aria-hidden="true"
              />
              <span className="tracking-wider uppercase">Blog</span>
            </a>
          )}
          {aboutMe.cvUrl && (
            <a
              href={aboutMe.cvUrl}
              className="group inline-flex items-center gap-2 text-xs accent-link focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 rounded"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Download CV"
            >
              <ArrowUpRight
                size={12}
                className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform duration-300"
                aria-hidden="true"
              />
              <span className="tracking-wider uppercase">CV</span>
            </a>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <a
            href={`mailto:${aboutMe.email}`}
            className="inline-flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 rounded"
            aria-label={`Send email to ${aboutMe.email}`}
          >
            <Mail size={14} aria-hidden="true" />
            {aboutMe.email}
          </a>
          {aboutMe.googleScholarUrl && (
            <a
              href={aboutMe.googleScholarUrl}
              className="inline-flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 rounded"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="View Google Scholar profile"
            >
              <GraduationCap size={14} aria-hidden="true" />
              Google Scholar
            </a>
          )}
          {aboutMe.twitterUsername && (
            <a
              href={`https://twitter.com/${aboutMe.twitterUsername}`}
              className="inline-flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 rounded"
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Follow @${aboutMe.twitterUsername} on Twitter`}
            >
              <Twitter size={14} aria-hidden="true" />@{aboutMe.twitterUsername}
            </a>
          )}
          {aboutMe.githubUsername && (
            <a
              href={`https://github.com/${aboutMe.githubUsername}`}
              className="inline-flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 rounded"
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`View ${aboutMe.githubUsername} on GitHub`}
            >
              <Github size={14} aria-hidden="true" />
              github.com/{aboutMe.githubUsername}
            </a>
          )}
          {aboutMe.linkedinUsername && (
            <a
              href={`https://www.linkedin.com/in/${aboutMe.linkedinUsername}`}
              className="inline-flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 rounded"
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`View ${aboutMe.linkedinUsername} on LinkedIn`}
            >
              <Linkedin size={14} aria-hidden="true" />
              linkedin.com/in/{aboutMe.linkedinUsername}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
