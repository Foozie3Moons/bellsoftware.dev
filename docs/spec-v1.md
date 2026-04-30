# personal-site Architecture Spec v1

## 1. Overview

Static blog deployed to Cloudflare Pages. Astro + Markdown content collections + Shiki code highlighting. All-sans modernist aesthetic, warm terracotta accent, system-preference dark mode. No CMS, no DB, no client-side JS beyond Astro defaults.

## 2. Stack

| Concern             | Choice                                                                  |
| ------------------- | ----------------------------------------------------------------------- |
| Framework           | Astro (latest stable)                                                   |
| Language            | TypeScript strict                                                       |
| Content             | Markdown via content collections, Zod-validated frontmatter             |
| Syntax highlighting | Shiki (build-time, theme matched to palette)                            |
| Fonts               | Inter (Fontsource) + JetBrains Mono (Fontsource), self-hosted           |
| Build               | `astro build` → static `dist/`                                          |
| Deploy              | Cloudflare Pages, GitHub integration                                    |
| Plugins             | `@astrojs/sitemap`, `@astrojs/rss`, `@astrojs/mdx` (defer until needed) |

## 3. Architecture

```
                          ┌────────────────────────────┐
                          │  src/content/writing/*.md  │
                          └─────────────┬──────────────┘
                                        │ getCollection('writing')
                                        ▼
┌──────────────┐      ┌──────────────────────────────────┐
│ src/pages/   │ ───► │ src/layouts + src/components     │
│  *.astro     │      │ (Layout, Header, Footer, Prose)  │
└──────────────┘      └──────────────────────────────────┘
                                        │
                                        ▼ astro build
                          ┌────────────────────────────┐
                          │ dist/  (static HTML/CSS)   │
                          └─────────────┬──────────────┘
                                        │
                                        ▼ git push origin main
                          ┌────────────────────────────┐
                          │ Cloudflare Pages           │
                          └────────────────────────────┘
```

## 4. Packages

Single Astro app. Logical sub-areas below.

### 4.1 styles

**Exports:** CSS custom properties (design tokens), prose typography

**Structure:**

```
src/styles/
├── tokens.css     # color, type, space, motion
├── reset.css
├── global.css     # body defaults, ::selection, focus rings
└── prose.css      # long-form article typography
```

### 4.2 components

**Exports:** `Layout`, `Header`, `Footer`, `PostCard`, `PostList`, `ArticleHeader`, `Prose`

**Structure:**

```
src/components/
├── Layout.astro          # shell, head, theme tokens
├── Header.astro          # wordmark + nav
├── Footer.astro
├── PostCard.astro        # date + title + description, used in lists
├── PostList.astro        # wraps PostCard, takes entries[]
├── ArticleHeader.astro   # title + dateline + reading time
└── Prose.astro           # wraps <slot/> with prose styles
```

### 4.3 content

**Exports:** `writing` collection

**Structure:**

```
src/content/
├── config.ts
└── writing/
    └── the-work-isnt-prompting.md
```

**Key Types:**

```typescript
import { defineCollection, z } from 'astro:content';

const writing = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updated: z.coerce.date().optional(),
    tags: z.array(z.string()).optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { writing };
```

### 4.4 pages

**Structure:**

```
src/pages/
├── index.astro              # homepage: bio + recent posts
├── about.astro
├── 404.astro
├── rss.xml.ts               # @astrojs/rss
└── writing/
    ├── index.astro          # archive, reverse chronological
    └── [...slug].astro      # individual article
```

## 5. Design Tokens

### 5.1 Color

| Token            | Light     | Dark      |
| ---------------- | --------- | --------- |
| `--bg`           | `#FAFAF7` | `#0F0F0E` |
| `--fg`           | `#1A1A1A` | `#ECECE7` |
| `--muted`        | `#6B6B6B` | `#888884` |
| `--border`       | `#E5E5E0` | `#2A2A28` |
| `--accent`       | `#C65D3F` | `#E07856` |
| `--accent-hover` | `#A84A2F` | `#F08866` |
| `--code-bg`      | `#F2F2EC` | `#1A1A18` |
| `--selection`    | `#F5D4C5` | `#5A2E1F` |

Mode switch via `@media (prefers-color-scheme: dark)`. No JS toggle in v1.

### 5.2 Typography

| Token             | Value                                              |
| ----------------- | -------------------------------------------------- |
| Body family       | `Inter`, system-ui fallback                        |
| Mono family       | `JetBrains Mono`, `ui-monospace` fallback          |
| Body size         | `17px` desktop / `16px` mobile                     |
| Body line-height  | `1.65`                                             |
| Prose body size   | `18px`                                             |
| Prose line-height | `1.7`                                              |
| Scale ratio       | 1.25 (major third)                                 |
| Sizes (px)        | 14, 17, 21, 26, 33, 41, 51                         |
| Display tracking  | `-0.022em` (h1), `-0.014em` (h2), `-0.012em` (h3+) |
| Display weights   | 700 (h1), 600 (h2–h4)                              |

Apply `font-feature-settings: 'cv11', 'ss01', 'ss03'` globally.

### 5.3 Spacing

4px base. Scale: `4, 8, 12, 16, 24, 32, 48, 64, 96, 128`.

### 5.4 Layout

| Token                      | Value    |
| -------------------------- | -------- |
| Page max width             | `1280px` |
| Prose max width            | `680px`  |
| Page padding (desktop)     | `24px`   |
| Page padding (mobile ≤640) | `16px`   |

## 6. API

| Method | Path             | Response                            |
| ------ | ---------------- | ----------------------------------- |
| GET    | `/rss.xml`       | `application/rss+xml`               |
| GET    | `/sitemap-*.xml` | `application/xml` (auto via plugin) |

## 7. Data Flow

1. Markdown file added under `src/content/writing/`.
2. Astro build runs: `getCollection('writing')` returns typed entries.
3. `[...slug].astro` generates static page per entry; `index.astro` and `writing/index.astro` render lists.
4. Shiki processes fenced code blocks at build time.
5. RSS feed regenerates at build.
6. `dist/` deployed by Cloudflare Pages on push to `main`.

## 8. Migration

N/A — greenfield.

## 9. Open Decisions

| Decision        | Default                                 | Status        |
| --------------- | --------------------------------------- | ------------- |
| Repo visibility | Public on GitHub                        | Confirm       |
| Domain          | (user has one)                          | Pending share |
| Comments        | None                                    | Confirm       |
| Newsletter      | None                                    | Confirm       |
| Analytics       | None                                    | Confirm       |
| MDX             | Defer until first post needs components | OK            |

## 10. Out of Scope (v1)

- `/now` page
- `/projects` page
- Comments / webmentions
- Newsletter signup
- Analytics
- Theme toggle (system preference only)
- Search
- Tag pages
- Author/multi-author support

## 11. Acceptance

- [ ] `pnpm build` produces clean `dist/` with no warnings
- [ ] Lighthouse ≥ 95 on Performance, Accessibility, Best Practices, SEO for homepage and article page
- [ ] Total page weight (homepage) under 100KB excluding fonts; under 250KB including
- [ ] No client-side JS shipped from any page (verify in Network tab)
- [ ] Dark mode renders correctly via OS preference toggle, no flash
- [ ] RSS feed validates (W3C feed validator)
- [ ] Sitemap includes all routes
- [ ] Article body renders all prose elements correctly: h2, h3, p, strong, em, a, ul, ol, blockquote, pre/code, inline code, hr

## 12. References

- HTML rough draft (homepage): `blog-rough-draft.html`
- HTML rough draft (article): `blog-article-rough-draft.html`
- Flagship post content: `blog-the-work-isnt-prompting.md`

The HTML drafts are reference for visual fidelity. Implementation does not need to match pixel-perfect, but design tokens (§5) are authoritative.

## Next steps for the fleet

1. Run `task-generator` against this spec to produce a parallelizable task document.
2. Recommended slim fleet for this project (existing Xander agents don't fit well):

- `architect` (already used to produce this spec)
- `decomposer` (will produce the task list)
- `frontend-engineer` (new agent — Astro components, styles, pages)
- `infra-engineer` (config, build, deploy wiring)

3. Suggested phasing for `task-generator`:

- Phase 1 (parallel): scaffold + tokens + content schema
- Phase 2 (parallel): components (Layout/Header/Footer, PostCard/PostList, ArticleHeader/Prose)
- Phase 3 (parallel): pages (index, writing index, [slug], about, 404)
- Phase 4 (sequential): RSS, sitemap, deploy config
