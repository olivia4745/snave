import type { ParsedSearchFilter, SavedSearch } from '../domain/search';
import type { SearchStatus } from '../domain/status';
import type { ParsedSalesNavigatorUrl } from './salesNavigatorUrlParser';
import type { SearchSummary } from './searchSummaryService';
import { nowIso } from '../utils/dates';
import { createId } from '../utils/ids';
import { addSearch } from '../storage/repositories/searchRepository';

export type SaveSearchInput = {
  parsedUrl: ParsedSalesNavigatorUrl;
  projectId: string;
  status: SearchStatus;
  summary: SearchSummary;
  title: string;
  textNote?: string;
};

export async function saveSearch(input: SaveSearchInput) {
  const timestamp = nowIso();
  const savedSearch: SavedSearch = {
    id: createId('search'),
    projectId: input.projectId,
    originalUrl: input.parsedUrl.originalUrl,
    normalizedUrl: input.parsedUrl.normalizedUrl,
    searchType: input.parsedUrl.searchType,
    summary: input.title,
    parsedFilters: toParsedSearchFilters(input.parsedUrl.queryParameters),
    status: input.status,
    textNote: normalizeOptionalText(input.textNote),
    similarityFingerprint: input.parsedUrl.normalizedUrl,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  return addSearch(savedSearch);
}

function toParsedSearchFilters(queryParameters: ParsedSalesNavigatorUrl['queryParameters']): ParsedSearchFilter[] {
  return queryParameters.map((parameter) => ({
    key: parameter.key,
    label: parameter.key,
    values: parameter.values,
  }));
}

function normalizeOptionalText(value: string | undefined) {
  const normalizedValue = value?.trim();
  return normalizedValue ? normalizedValue : undefined;
}
