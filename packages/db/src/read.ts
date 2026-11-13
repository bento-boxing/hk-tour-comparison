// What the website needs: a pg-backed handle and the read queries. Nothing here reads files or
// loads PGlite, so a web bundle that imports `@hktours/db/read` carries neither the migration runner nor the test database.
export { createPgDb, normaliseCaCert, type Db, type PgDbOptions } from './db';
export {
  searchTours, getToursByKeys, getOperators, PAGE_SIZE,
  type TourFilters, type SortKey, type TourCardData, type SearchInput, type OperatorInfo,
} from './search';
