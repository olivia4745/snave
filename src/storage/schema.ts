import type { Project } from '../domain/project';
import type { SavedSearch } from '../domain/search';
import type { AppSettings } from '../domain/settings';

export type DatabaseSchema = {
  projects: Project;
  searches: SavedSearch;
  settings: AppSettings;
};
