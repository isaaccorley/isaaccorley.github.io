import { Experience } from "@/data/experience";

export function ExperienceEntry({ experience }: { experience: Experience }) {
  return (
    <div className="group p-4 -mx-4 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors duration-200">
      <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-2 md:gap-6">
        <span className="text-xs text-zinc-500 dark:text-zinc-400 md:w-24">{experience.date}</span>
        <div className="flex flex-col">
          <h3 className="text-base font-serif">
            {experience.title} —{" "}
            {experience.companyUrl ? (
              <a
                href={experience.companyUrl}
                className="hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                {experience.company}
              </a>
            ) : (
              experience.company
            )}
          </h3>
          {experience.advisor && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed italic mt-2">
              Advisor: {experience.advisor}
            </p>
          )}
          {experience.manager && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed italic mt-2">
              Manager: {experience.manager}
            </p>
          )}
          {experience.description && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed mt-2">
              {experience.description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
