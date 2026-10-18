import type { SearchType } from '../domain/search';
import { detectSalesNavigatorPage } from './salesNavigatorPageDetection';

export type ParsedSalesNavigatorUrl = {
  isSalesNavigatorSearchPage: boolean;
  originalUrl: string;
  normalizedUrl: string;
  searchType: SearchType;
  queryParameters: ParsedQueryParameter[];
};

export type ParsedQueryParameter = {
  key: string;
  values: string[];
};

const IGNORED_QUERY_PARAMETERS = new Set(['page', 'sessionId', 'viewAllFilters']);

export function parseSalesNavigatorUrl(url: string | undefined): ParsedSalesNavigatorUrl {
  const detection = detectSalesNavigatorPage(url);

  if (!url || !detection.isSalesNavigatorSearchPage) {
    return {
      isSalesNavigatorSearchPage: false,
      originalUrl: url ?? '',
      normalizedUrl: '',
      searchType: 'unknown',
      queryParameters: [],
    };
  }

  const parsedUrl = new URL(url);
  const hashSearchParams = parseHashSearchParams(parsedUrl.hash);
  const mergedSearchParams = mergeSearchParams(parsedUrl.searchParams, hashSearchParams);
  const normalizedSearchParams = normalizeSearchParams(mergedSearchParams);

  parsedUrl.search = normalizedSearchParams.toString();
  parsedUrl.hash = '';

  return {
    isSalesNavigatorSearchPage: true,
    originalUrl: url,
    normalizedUrl: parsedUrl.toString(),
    searchType: mapSearchType(detection.pageType),
    queryParameters: toParsedQueryParameters(normalizedSearchParams),
  };
}

function parseHashSearchParams(hash: string) {
  if (!hash || !hash.startsWith('#')) {
    return new URLSearchParams();
  }

  return new URLSearchParams(hash.slice(1));
}

function mergeSearchParams(...searchParams: URLSearchParams[]) {
  const merged = new URLSearchParams();

  for (const params of searchParams) {
    for (const [key, value] of params.entries()) {
      merged.append(key, value);
    }
  }

  return merged;
}

function normalizeSearchParams(searchParams: URLSearchParams) {
  const normalizedEntries = Array.from(searchParams.entries())
    .filter(([key, value]) => !IGNORED_QUERY_PARAMETERS.has(key) && value.trim() !== '')
    .sort(([leftKey, leftValue], [rightKey, rightValue]) => {
      if (leftKey === rightKey) {
        return leftValue.localeCompare(rightValue);
      }

      return leftKey.localeCompare(rightKey);
    });

  const normalizedSearchParams = new URLSearchParams();

  for (const [key, value] of normalizedEntries) {
    normalizedSearchParams.append(key, value);
  }

  return normalizedSearchParams;
}

function toParsedQueryParameters(searchParams: URLSearchParams): ParsedQueryParameter[] {
  const valuesByKey = new Map<string, string[]>();

  for (const [key, value] of searchParams.entries()) {
    valuesByKey.set(key, [...(valuesByKey.get(key) ?? []), value]);
  }

  return Array.from(valuesByKey.entries()).map(([key, values]) => ({ key, values }));
}

function mapSearchType(pageType: ReturnType<typeof detectSalesNavigatorPage>['pageType']): SearchType {
  if (pageType === 'lead-search') {
    return 'lead';
  }

  if (pageType === 'account-search') {
    return 'account';
  }

  return 'unknown';
}
