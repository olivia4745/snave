import type { Project } from '../../domain/project';
import { DEFAULT_PROJECT_NAME } from '../../shared/constants';
import { nowIso } from '../../utils/dates';
import { createId } from '../../utils/ids';
import { db } from '../database';

export async function listProjects() {
  return db.projects.orderBy('createdAt').toArray();
}

export async function createProject(name: string): Promise<Project> {
  const timestamp = nowIso();
  const project: Project = {
    id: createId('project'),
    name: name.trim(),
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await db.projects.add(project);
  return project;
}

export async function updateProject(projectId: string, name: string): Promise<Project> {
  const updatedAt = nowIso();
  await db.projects.update(projectId, { name: name.trim(), updatedAt });

  const updatedProject = await db.projects.get(projectId);
  if (!updatedProject) {
    throw new Error('Project not found');
  }

  return updatedProject;
}

export async function deleteProject(projectId: string): Promise<void> {
  await db.searches.where('projectId').equals(projectId).delete();
  await db.projects.delete(projectId);
}

export async function ensureDefaultProject() {
  const existingProject = await db.projects.orderBy('createdAt').first();

  if (existingProject) {
    return existingProject;
  }

  return createProject(DEFAULT_PROJECT_NAME);
}
