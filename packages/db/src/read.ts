// What the website needs: a pg-backed handle and the read queries. Nothing here reads files or
// loads PGlite, so a web bundle that imports `@hktours/db/read` carries neither the migration runner nor the test database.
export { createPgDb, normaliseCaCert, type Db, type PgDbOptions } from './db';
export {
  searchTours, getToursByKeys, getOperators, PAGE_SIZE, PAGE_SIZES, isPageSize,
  type TourFilters, type SortKey, type PageSize, type TourCardData, type SearchInput, type OperatorInfo,
} from './search';
export { countToursByDestination, type DestinationCount, type DestinationCounts, type ListedCount } from './destinations';
export { getOperatorListings, type OperatorListing } from './operators';
