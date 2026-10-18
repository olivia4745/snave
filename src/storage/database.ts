import Dexie, { type EntityTable } from 'dexie';
import type { Project } from '../domain/project';
import type { SavedSearch } from '../domain/search';
import type { AppSettings } from '../domain/settings';

export class SalesNavMemoryDatabase extends Dexie {
  projects!: EntityTable<Project, 'id'>;
  searches!: EntityTable<SavedSearch, 'id'>;
  settings!: EntityTable<AppSettings, 'id'>;

  constructor() {
    super('sales-nav-search-memory');

    this.version(1).stores({
      projects: 'id, name, createdAt, updatedAt',
      searches: 'id, projectId, normalizedUrl, searchType, status, similarityFingerprint, createdAt, updatedAt',
      settings: 'id, lastActiveProjectId',
    });
  }
}

export const db = new SalesNavMemoryDatabase();
