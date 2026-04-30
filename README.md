# bellsoftware.dev

Personal blog. Static site, deployed to Cloudflare Pages.

## Stack

- [Astro](https://astro.build) 5 (TypeScript strict)
- Markdown content collections, Zod-validated frontmatter
- Shiki syntax highlighting (build-time, dual `vitesse-light` / `vitesse-dark`)
- [Inter](https://rsms.me/inter/) and [JetBrains Mono](https://www.jetbrains.com/lp/mono/) self-hosted via Fontsource (latin subset)
- `prefers-color-scheme` dark mode, no JS toggle
- No client-side JavaScript shipped from any page

## Quick start

```sh
pnpm install
pnpm dev      # http://localhost:4321
pnpm build    # → dist/
pnpm preview  # serve dist/
pnpm check    # astro check (TS + content schema)
```

## Project layout

```
src/
├── components/    Layout primitives (Header, Footer, PostCard, ...)
├── content/       Markdown content + collection schema
│   └── writing/   Posts
├── layouts/       Page wrappers (Layout, ProseLayout)
├── pages/         Routes (file-based)
├── styles/        Tokens, reset, global, prose
└── utils/         Date formatting, reading time
public/            Static passthrough (favicon.svg, _headers)
docs/              Spec + reference HTML drafts
```

Reference visuals (HTML drafts) and the architecture spec live in `docs/`. The visual `/style-guide` route exercises every prose element for design QA.

## Adding a post

Drop a Markdown file in `src/content/writing/`. The filename (minus `.md`) becomes the slug.

```markdown
---
title: A clear title
description: One-sentence summary used in lists, RSS, and OG tags.
pubDate: 2026-05-01
tags: [systems, agents]   # optional
draft: false              # optional, defaults to false
---

Body in Markdown. Code fences are highlighted by Shiki at build time.
```

The schema is enforced by Zod in `src/content.config.ts`. Missing or malformed frontmatter fails the build.

Drafts (`draft: true`) are excluded from the homepage, the writing index, the RSS feed, and route generation.

## Design tokens

CSS custom properties in `src/styles/tokens.css`. Light values are at `:root`; dark values are inside `@media (prefers-color-scheme: dark)`. Adjust there to tune the palette.

## Deploy (Cloudflare Pages)

Connect the repo in the Cloudflare dashboard with:

- **Build command**: `pnpm build`
- **Build output directory**: `dist`
- **Root directory**: (repo root)
- **Node version**: 22

Headers and cache rules are configured in `public/_headers` (served verbatim from `dist/`).

## License

Site code: MIT. Content (`src/content/`, `docs/`): all rights reserved unless stated otherwise.
