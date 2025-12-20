'use client';

import Image from 'next/image';
import { useState } from 'react';

interface McpJsonCardProps {
  text: string;
}

export function McpJsonCard({ text }: McpJsonCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy MCP config', error);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="border border-white/10 rounded-2xl p-4 bg-black/20 backdrop-blur flex flex-col gap-3 text-left hover:border-emerald-400/60 transition"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
          <Image
            src="/planetary-computer-mcp/icons/mcp-logo.png"
            alt="MCP logo"
            width={28}
            height={28}
            className="object-contain"
          />
        </div>
        <p className="text-[0.65rem] uppercase tracking-[0.35em] text-emerald-300">mcp.json entry</p>
      </div>
      <p className="text-xs text-slate-300/80">
        {copied ? 'Copied mcp.json to clipboard' : 'Click to copy config'}
      </p>
    </button>
  );
}
