import type { SearchStatus } from './status';

export type SearchType = 'lead' | 'account' | 'unknown';

export type ParsedSearchFilter = {
  key: string;
  label: string;
  values: string[];
};

export type SavedSearch = {
  id: string;
  projectId: string;
  originalUrl: string;
  normalizedUrl: string;
  searchType: SearchType;
  summary: string;
  parsedFilters: ParsedSearchFilter[];
  status: SearchStatus;
  textNote?: string;
  similarityFingerprint: string;
  createdAt: string;
  updatedAt: string;
};
