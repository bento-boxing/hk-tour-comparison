// How many tours one page of results holds: the website's rows-per-page choices. Here, not in @hktours/db, so the
// browser code that reads and writes the address (`size=`) can use them without bundling the database driver.

/** The rows a page can hold. The first is the default. */
export const PAGE_SIZES = [24, 48, 96] as const;
export type PageSize = (typeof PAGE_SIZES)[number];
/** The default page size. */
export const PAGE_SIZE: PageSize = PAGE_SIZES[0];

/** True for one of PAGE_SIZES. */
export function isPageSize(n: unknown): n is PageSize {
  return (PAGE_SIZES as readonly unknown[]).includes(n);
}
