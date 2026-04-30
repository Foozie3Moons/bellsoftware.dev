---
layout: ../layouts/ProseLayout.astro
title: Style guide
description: Visual reference for every prose element.
---

This page exercises every element the prose styles target. It exists to verify rendering at a glance after design changes.

## Heading 2

A second-level heading. Followed by a paragraph with **strong text**, _emphasised text_, an [external link](https://example.com), and `inline code`.

### Heading 3

Third-level heading. Used for subsections within an article.

#### Heading 4

Fourth-level heading. Rare, but supported.

## Lists

Unordered:

- First item with a [link](https://example.com)
- Second item with **strong** and `inline code`
- Third item, plain

Ordered:

1. First numbered item
2. Second numbered item
3. Third numbered item

## Blockquote

> The work isn't prompting. It's specs, interfaces, and knowing what good looks like — encoded well enough that other actors can execute against it.

## Code

Inline `const x = 1` reads as code.

A fenced block with a language hint, highlighted by Shiki at build time:

```typescript
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const writing = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/writing' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { writing };
```

A shell block:

```sh
pnpm install
pnpm dev
pnpm build
```

## Horizontal rule

Above the rule.

---

Below the rule. Section breaks like this work for marking shifts in topic without a heading.

## Long paragraphs

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
