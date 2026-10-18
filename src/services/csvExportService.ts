import type { Project } from '../domain/project';
import type { SavedSearch } from '../domain/search';

const CSV_HEADERS = [
  'Project',
  'Summary',
  'Status',
  'Search Type',
  'Text Note',
  'Original URL',
  'Normalized URL',
  'Filters',
  'Created At',
  'Updated At',
];

export function buildSearchesCsv(searches: SavedSearch[], projects: Project[]) {
  const projectNamesById = new Map(projects.map((project) => [project.id, project.name]));
  const rows = searches.map((search) => [
    projectNamesById.get(search.projectId) ?? 'Unknown Project',
    search.summary,
    search.status,
    search.searchType,
    search.textNote ?? '',
    search.originalUrl,
    search.normalizedUrl,
    formatFilters(search),
    search.createdAt,
    search.updatedAt,
  ]);

  return [CSV_HEADERS, ...rows].map((row) => row.map(escapeCsvCell).join(',')).join('\n');
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function createCsvFilename(projectName: string | undefined) {
  const safeProjectName = (projectName ?? 'search-library')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const date = new Date().toISOString().slice(0, 10);

  return `${safeProjectName || 'search-library'}-${date}.csv`;
}

function formatFilters(search: SavedSearch) {
  return search.parsedFilters
    .map((filter) => `${filter.label}: ${filter.values.join(' | ')}`)
    .join('; ');
}

function escapeCsvCell(value: string) {
  const escapedValue = value.replace(/"/g, '""');
  return `"${escapedValue}"`;
}
