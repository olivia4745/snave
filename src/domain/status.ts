export const SEARCH_STATUSES = ['successful', 'worth_iterating', 'dead_end'] as const;

export type SearchStatus = (typeof SEARCH_STATUSES)[number];
