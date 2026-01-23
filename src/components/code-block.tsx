"use client";

import { Highlight, themes } from "prism-react-renderer";

interface CodeBlockProps {
  code: string;
  language?: string;
  small?: boolean;
}

export function CodeBlock({ code, language = "python", small = false }: CodeBlockProps) {
  return (
    <Highlight theme={themes.nightOwl} code={code.trim()} language={language}>
      {({ style, tokens, getLineProps, getTokenProps }) => (
        <pre
          className={`rounded-2xl leading-relaxed p-4 overflow-x-auto ${small ? "text-[10px]" : "text-xs"}`}
          style={{ ...style, background: "#011627" }}
        >
          <code>
            {tokens.map((line, lineIdx) => (
              <div key={`line-${lineIdx}`} {...getLineProps({ line })}>
                {line.map((token, tokenIdx) => (
                  <span key={`token-${lineIdx}-${tokenIdx}`} {...getTokenProps({ token })} />
                ))}
              </div>
            ))}
          </code>
        </pre>
      )}
    </Highlight>
  );
}
