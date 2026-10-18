import type { SavedSearch } from '../../domain/search';
import { db } from '../database';

export async function listSearches() {
  const searches = await db.searches.toArray();
  return sortNewestFirst(searches);
}

export async function listSearchesByProject(projectId: string) {
  const searches = await db.searches.where('projectId').equals(projectId).toArray();
  return sortNewestFirst(searches);
}

export async function searchSavedSearches(query: string, projectId?: string) {
  const normalizedQuery = normalizeSearchQuery(query);
  const searches = projectId ? await listSearchesByProject(projectId) : await listSearches();

  if (!normalizedQuery) {
    return searches;
  }

  const queryTokens = normalizedQuery.split(' ').filter(Boolean);

  const matchedSearches = searches.filter((search) => {
    const text = searchableText(search);
    return (
      matchesAllTokensInOrder(text.high, queryTokens)
      || matchesAllTokensInOrder(text.full, queryTokens)
      || matchesAllTokensInOrder(text.low, queryTokens)
    );
  });

  return matchedSearches.sort((left, right) => compareSearchResults(left, right, queryTokens, normalizedQuery));
}

export async function addSearch(search: SavedSearch) {
  await db.searches.add(search);
  return search;
}

export async function updateSearch(search: SavedSearch) {
  await db.searches.put(search);
  return search;
}

export async function deleteSearch(id: string) {
  await db.searches.delete(id);
}

export async function findSearchByNormalizedUrl(projectId: string, normalizedUrl: string) {
  return db.searches
    .where('projectId')
    .equals(projectId)
    .filter((search) => search.normalizedUrl === normalizedUrl)
    .first();
}

function searchableText(search: SavedSearch) {
  const highPriorityParts = [
    search.summary,
    search.textNote,
    search.status,
    search.searchType,
  ].filter(Boolean);

  const lowPriorityParts = [
    search.originalUrl,
    search.normalizedUrl,
    ...formatSearchDate(search.createdAt),
    ...search.parsedFilters.flatMap((filter) => [filter.label, filter.key, ...filter.values]),
  ].filter(Boolean);

  const high = highPriorityParts.join(' ').toLowerCase();
  const low = lowPriorityParts.join(' ').toLowerCase();
  const full = [high, low].filter(Boolean).join(' ').toLowerCase();

  return { high, low, full };
}

function normalizeSearchQuery(query: string) {
  return query
    .trim()
    .replace(/\bof\b/gi, '')
    .replace(/(\d+)(st|nd|rd|th)\b/gi, '$1')
    .replace(/[^\w\s/:-]/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function matchesAllTokensInOrder(text: string, tokens: string[]) {
  if (!text || tokens.length === 0) {
    return false;
  }

  let startIndex = 0;

  for (const token of tokens) {
    const tokenIndex = text.indexOf(token, startIndex);
    if (tokenIndex === -1) {
      return false;
    }
    startIndex = tokenIndex + token.length;
  }

  return true;
}

function compareSearchResults(left: SavedSearch, right: SavedSearch, queryTokens: string[], normalizedQuery: string) {
  const leftText = searchableText(left);
  const rightText = searchableText(right);

  const leftHighScore = getMatchScore(leftText.high, queryTokens, normalizedQuery);
  const rightHighScore = getMatchScore(rightText.high, queryTokens, normalizedQuery);
  if (leftHighScore !== rightHighScore) {
    return rightHighScore - leftHighScore;
  }

  const leftFullScore = getMatchScore(leftText.full, queryTokens, normalizedQuery);
  const rightFullScore = getMatchScore(rightText.full, queryTokens, normalizedQuery);
  if (leftFullScore !== rightFullScore) {
    return rightFullScore - leftFullScore;
  }

  const leftLowScore = getMatchScore(leftText.low, queryTokens, normalizedQuery);
  const rightLowScore = getMatchScore(rightText.low, queryTokens, normalizedQuery);
  if (leftLowScore !== rightLowScore) {
    return rightLowScore - leftLowScore;
  }

  return right.createdAt.localeCompare(left.createdAt);
}

function getMatchScore(text: string, queryTokens: string[], normalizedQuery: string) {
  if (!text) {
    return 0;
  }

  const exactHighMatch = text.includes(normalizedQuery);
  const orderedMatch = matchesAllTokensInOrder(text, queryTokens);

  if (exactHighMatch) {
    return 3;
  }

  if (orderedMatch) {
    return 2;
  }

  return 1;
}

function formatSearchDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return [];
  }

  const locale = undefined;
  const long = new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', day: 'numeric' }).format(date);
  const monthDayYearLong = new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', day: 'numeric' }).format(date);
  const monthDayYearShort = new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
  const monthDay = new Intl.DateTimeFormat(locale, { month: 'long', day: 'numeric' }).format(date);
  const dayMonth = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' }).format(date);
  const numeric = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
  const iso = date.toISOString().slice(0, 10);
  const ordinalDay = getOrdinal(date.getDate());
  const ordinalLong = `${ordinalDay} ${new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(date)}`;

  return [long, monthDayYearLong, monthDayYearShort, monthDay, dayMonth, numeric, iso, ordinalLong];
}

function getOrdinal(day: number) {
  const suffix = day % 10 === 1 && day !== 11 ? 'st'
    : day % 10 === 2 && day !== 12 ? 'nd'
    : day % 10 === 3 && day !== 13 ? 'rd'
    : 'th';
  return `${day}${suffix}`;
}

function sortNewestFirst(searches: SavedSearch[]) {
  return searches.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}
