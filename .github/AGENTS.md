# AGENTS.md

Personal website for Isaac Corley. Next.js 15 + React 19 + Tailwind + TypeScript. Static export to GitHub Pages.

## Build Commands

```bash
bun install          # install deps
bun dev              # dev server http://localhost:3000
bun lint             # eslint
bun run format       # prettier --write
bun run build        # prod build -> ./out/
bun start            # serve prod build
```

No test suite. Validate with `bun lint && bun run build`.

## Project Structure

```
src/
  app/              # Next.js App Router pages
    page.tsx        # landing page
    layout.tsx      # root layout + fonts
    globals.css     # tailwind + css vars
    ftw/            # field-the-world demo app
    bioacoustics/   # bioacoustics demo app
    planetary-computer-mcp/  # MCP landing page
  components/       # reusable React components
  data/             # static data (publications, experience, etc.)
  styles/           # additional CSS (globe.css)
public/             # static assets (images, icons)
types/              # custom type declarations
```

## Code Style

### General

- NO COMMENTS in code
- NO try/catch blocks
- NO defensive coding
- NO for loops (use map/filter/reduce)
- Minimal code > verbose code
- Clean readable code with few lines

### TypeScript

- Strict mode enabled (`tsconfig.json`)
- Use `@/*` path alias for src imports
- Export interfaces from data files
- Props interfaces inline or colocated

### Imports

```typescript
// 1. External packages
import Image from "next/image";
import { Github, Mail } from "lucide-react";

// 2. Internal aliases
import { Publication } from "@/data/publication";
import { ProfileSection } from "@/components/profile-section";
```

### Components

- Named exports: `export function ComponentName() {}`
- Props interface: `interface ComponentNameProps {}`
- Inline destructuring: `function Foo({ bar }: { bar: string }) {}`
- File naming: kebab-case (`profile-section.tsx`)
- Component naming: PascalCase (`ProfileSection`)

### Tailwind

- Inline classes via `className`
- Color palette: `zinc-*` grays, `bg-[#FFFCF8]` cream background
- Typography: `font-serif` for headings, default sans for body
- Responsive: mobile-first (`md:` breakpoint for desktop)
- Spacing: consistent scale (`gap-6`, `space-y-12`, `mb-8`)

### Data Files

```typescript
// src/data/example.ts
export interface Example {
  title: string;
  url?: string; // optional fields use ?
}

export const exampleData: Example[] = [{ title: "Foo", url: "https://..." }];
```

### Formatting (Prettier)

- Print width: 100
- Semicolons: yes
- Single quotes: no (double quotes)
- Trailing commas: all

## Patterns

### Page Component

```typescript
export default function PageName() {
  return (
    <div className="min-h-screen bg-[#FFFCF8]">
      <div className="max-w-screen-lg mx-auto px-8 py-24">
        {/* content */}
      </div>
    </div>
  );
}
```

### Entry Component

```typescript
import { ArrowUpRight } from "lucide-react";
import { DataType } from "@/data/datatype";

export function DataTypeEntry({ item }: { item: DataType }) {
  return (
    <div className="flex flex-col">
      <h3 className="font-serif text-md mb-3">{item.title}</h3>
      {item.url && (
        <a href={item.url} className="group inline-flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-900 transition-colors duration-300">
          <ArrowUpRight size={12} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform duration-300" />
          <span className="tracking-wider uppercase">Link</span>
        </a>
      )}
    </div>
  );
}
```

### External Links

Always include `target="_blank" rel="noopener noreferrer"` for external links.

## Stack

- Runtime: Bun 1.1.9
- Framework: Next.js 15 (App Router, static export)
- React: 19
- Styling: Tailwind 3.4
- Icons: lucide-react
- Fonts: Geist, Noto Serif, PT Serif (via next/font)
- ML: TensorFlow.js, ONNX Runtime Web (demo apps)
- Maps: globe.gl, three.js

## Deployment

GitHub Actions on push to `main`:

1. `bun install`
2. `bun run build`
3. Deploy `./out/` to GitHub Pages

Config: `next.config.ts` sets `output: "export"` for static generation.

## Response Style

When providing assistance:

- Max signal density
- Short sentences
- No filler or prompt restatement
- Formal notation where applicable
- List unresolved questions at end
