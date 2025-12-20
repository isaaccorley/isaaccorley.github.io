# Planetary Computer MCP Site

Static Next.js site showcasing the Planetary Computer MCP server with a Globe.gl hero. This repo now uses [Bun](https://bun.sh/) for dependency management and scripts.

## Prerequisites

- [Bun 1.1+](https://bun.sh/docs/installation)
- Node 20+ is recommended for local Next.js builds (Bun will install it automatically in CI).

## Install

```bash
bun install
```

This creates `bun.lockb` the first time you run it.

## Development

```bash
bun dev        # start Next.js locally on http://localhost:3000
bun lint       # run eslint
bun run build  # production build
bun start      # serve the production build (after bun run build)
```

## Deployment

GitHub Actions uses Bun to install dependencies and run `bun run build`, then deploys the static export (`out/`) to GitHub Pages. See `.github/workflows/nextjs.yml` for details.
