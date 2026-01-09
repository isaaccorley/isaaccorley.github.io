import { Education } from "@/data/education";

export function EducationEntry({ education }: { education: Education }) {
  return (
    <div className="group p-4 -mx-4 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors duration-200">
      <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-2 md:gap-6">
        <span className="text-xs text-zinc-500 dark:text-zinc-400 md:w-24">{education.year}</span>
        <div>
          <h3 className="text-base mb-1 font-serif">{education.institution}</h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{education.degree}</p>
          {education.advisor && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 italic">
              Advisor: {education.advisor}
            </p>
          )}
          {education.thesis && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 italic">
              Thesis:{" "}
              {education.thesisUrl ? (
                <a
                  href={education.thesisUrl}
                  className="hover:underline accent-link"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {education.thesis}
                </a>
              ) : (
                education.thesis
              )}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
