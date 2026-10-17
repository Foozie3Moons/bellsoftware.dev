import type { CollectionEntry } from 'astro:content';

const branch = process.env.WORKERS_CI_BRANCH;

/**
 * Drafts render on preview builds only: any Workers Builds branch other than
 * `main`, `astro dev`, or a build run with SHOW_DRAFTS=true. A `main` build
 * never includes them.
 */
export const showDrafts =
  import.meta.env.DEV ||
  process.env.SHOW_DRAFTS === 'true' ||
  (branch !== undefined && branch !== '' && branch !== 'main');

/** Whether a post gets a page and appears in listings for this build. */
export const isVisible = (post: CollectionEntry<'writing'>): boolean =>
  showDrafts || !post.data.draft;
