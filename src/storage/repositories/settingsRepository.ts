import type { AppSettings } from '../../domain/settings';
import { APP_SETTINGS_ID } from '../../shared/constants';
import { db } from '../database';

export async function getSettings() {
  return db.settings.get(APP_SETTINGS_ID);
}

export async function saveSettings(settings: AppSettings) {
  await db.settings.put(settings);
  return settings;
}

export async function setLastActiveProjectId(projectId: string) {
  return saveSettings({ id: APP_SETTINGS_ID, lastActiveProjectId: projectId });
}
