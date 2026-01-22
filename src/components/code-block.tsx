"use client";

import { useState } from "react";
import { Highlight, themes } from "prism-react-renderer";
import { Check, Copy, FileCode } from "lucide-react";

interface CodeBlockProps {
  code: string;
  language?: string;
  filename?: string;
}

// GitHub dark theme colors
const githubDarkTheme = {
  plain: {
    color: "#e6edf3",
    backgroundColor: "#0d1117",
  },
  styles: [
    { types: ["comment", "prolog", "doctype", "cdata"], style: { color: "#8b949e" } },
    { types: ["punctuation"], style: { color: "#e6edf3" } },
    { types: ["namespace"], style: { opacity: 0.7 } },
    {
      types: ["property", "tag", "boolean", "number", "constant", "symbol"],
      style: { color: "#79c0ff" },
    },
    {
      types: ["selector", "attr-name", "string", "char", "builtin", "inserted"],
      style: { color: "#a5d6ff" },
    },
    { types: ["operator", "entity", "url"], style: { color: "#e6edf3" } },
    { types: ["atrule", "attr-value", "keyword"], style: { color: "#ff7b72" } },
    { types: ["function", "class-name"], style: { color: "#d2a8ff" } },
    { types: ["regex", "important", "variable"], style: { color: "#a5d6ff" } },
    { types: ["deleted"], style: { color: "#ffa198" } },
  ],
};

export function CodeBlock({ code, language = "python", filename }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="overflow-hidden rounded-lg border border-[#30363d] bg-[#0d1117]">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-[#30363d] bg-[#161b22] px-4 py-2">
        <div className="flex items-center gap-2 text-xs text-[#8b949e]">
          <FileCode className="h-4 w-4" />
          <span className="font-mono">
            {filename ?? `snippet.${language === "python" ? "py" : language}`}
          </span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-[#8b949e] transition hover:bg-[#30363d] hover:text-[#e6edf3]"
          aria-label="Copy code"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-green-500" />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code content */}
      <Highlight
        theme={githubDarkTheme as typeof themes.nightOwl}
        code={code.trim()}
        language={language}
      >
        {({ style, tokens, getLineProps, getTokenProps }) => (
          <pre
            className="overflow-x-auto p-4 text-[13px] leading-[1.5]"
            style={{
              ...style,
              fontFamily:
                "'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, Monaco, 'Courier New', monospace",
            }}
          >
            <code>
              {tokens.map((line, lineIdx) => (
                <div key={`line-${lineIdx}`} {...getLineProps({ line })} className="table-row">
                  {/* Line number */}
                  <span className="table-cell select-none pr-4 text-right text-[#6e7681]">
                    {lineIdx + 1}
                  </span>
                  {/* Code content */}
                  <span className="table-cell">
                    {line.map((token, tokenIdx) => (
                      <span key={`token-${lineIdx}-${tokenIdx}`} {...getTokenProps({ token })} />
                    ))}
                  </span>
                </div>
              ))}
            </code>
          </pre>
        )}
      </Highlight>
    </div>
  );
}
