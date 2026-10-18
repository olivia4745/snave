import type { SavedSearch } from '../domain/search';
import type { ParsedSalesNavigatorUrl } from './salesNavigatorUrlParser';

export type SimilarityLevel = 'exact' | 'high' | 'medium' | 'low';

export type SimilarSearchResult = {
  level: SimilarityLevel;
  score: number;
  search: SavedSearch;
};

const MIN_SIMILARITY_SCORE = 0.2;

export function findSimilarSearches(currentSearch: ParsedSalesNavigatorUrl, savedSearches: SavedSearch[]) {
  if (!currentSearch.isSalesNavigatorSearchPage) {
    return [];
  }

  return savedSearches
    .map((savedSearch): SimilarSearchResult | null => {
      const score = calculateSimilarityScore(currentSearch, savedSearch);

      if (score < MIN_SIMILARITY_SCORE) {
        return null;
      }

      return {
        level: getSimilarityLevel(score, currentSearch, savedSearch),
        score,
        search: savedSearch,
      };
    })
    .filter((result): result is SimilarSearchResult => Boolean(result))
    .sort((left, right) => right.score - left.score || right.search.createdAt.localeCompare(left.search.createdAt));
}

function calculateSimilarityScore(currentSearch: ParsedSalesNavigatorUrl, savedSearch: SavedSearch) {
  if (currentSearch.normalizedUrl === savedSearch.normalizedUrl) {
    return 1;
  }

  if (currentSearch.searchType !== savedSearch.searchType) {
    return 0;
  }

  const currentTokens = toSearchTokens(currentSearch);
  const savedTokens = new Set(
    savedSearch.parsedFilters.flatMap((filter) => [filter.key, filter.label, ...filter.values]).map(normalizeToken),
  );

  if (currentTokens.size === 0 || savedTokens.size === 0) {
    return 0;
  }

  const overlap = Array.from(currentTokens).filter((token) => savedTokens.has(token)).length;
  const union = new Set([...currentTokens, ...savedTokens]).size;

  return overlap / union;
}

function getSimilarityLevel(score: number, currentSearch: ParsedSalesNavigatorUrl, savedSearch: SavedSearch): SimilarityLevel {
  if (currentSearch.normalizedUrl === savedSearch.normalizedUrl || score === 1) {
    return 'exact';
  }

  if (score >= 0.75) {
    return 'high';
  }

  if (score >= 0.45) {
    return 'medium';
  }

  return 'low';
}

function toSearchTokens(search: ParsedSalesNavigatorUrl) {
  return new Set(search.queryParameters.flatMap((parameter) => [parameter.key, ...parameter.values]).map(normalizeToken));
}

function normalizeToken(value: string) {
  return value.trim().toLowerCase();
}
