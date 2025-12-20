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
      className="border border-white/10 rounded-3xl px-5 py-4 bg-black/25 backdrop-blur hover:border-emerald-400/60 transition flex items-center gap-4 text-left"
    >
      <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
        <Image
          src="/planetary-computer-mcp/icons/mcp-logo.png"
          alt="MCP logo"
          width={32}
          height={32}
          className="object-contain"
        />
      </div>
      <div className="flex items-center gap-3 flex-1">
        <p className="text-[0.65rem] uppercase tracking-[0.45em] text-emerald-200">mcp json</p>
      </div>
      <div className="relative">
        <div className="w-10 h-10 rounded-2xl bg-emerald-400/10 border border-emerald-300/40 flex items-center justify-center">
          <svg viewBox="0 0 24 24" className="w-4 h-4 text-emerald-200" role="img" aria-hidden="true">
            <rect x="9" y="9" width="10" height="10" rx="2" stroke="currentColor" fill="none" strokeWidth="1.5" />
            <path d="M6 15H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v1" stroke="currentColor" fill="none" strokeWidth="1.5" />
          </svg>
        </div>
        <div
          className={`absolute -top-4 left-1/2 -translate-x-1/2 text-[0.58rem] uppercase tracking-[0.35em] text-white transition-opacity duration-200 ${
            copied ? 'opacity-100' : 'opacity-0'
          }`}
        >
          copied
        </div>
      </div>
    </button>
  );
}
