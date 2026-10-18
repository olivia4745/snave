import { useCallback, useEffect, useState } from 'react';
import type { Project } from '../../domain/project';
import { createProject, deleteProject as deleteProjectEntry, ensureDefaultProject, listProjects, updateProject as updateProjectEntry } from '../../storage/repositories/projectRepository';
import { getSettings, setLastActiveProjectId } from '../../storage/repositories/settingsRepository';

type ProjectState = {
  activeProject: Project | null;
  createAndSelectProject: (name: string) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  error: string | null;
  isLoading: boolean;
  projects: Project[];
  selectProject: (projectId: string) => Promise<void>;
  updateProject: (projectId: string, name: string) => Promise<void>;
};

export function useProjects(): ProjectState {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshProjects = useCallback(async (preferredProjectId?: string) => {
    const defaultProject = await ensureDefaultProject();
    const settings = await getSettings();
    const allProjects = await listProjects();
    const activeProjectId = preferredProjectId ?? settings?.lastActiveProjectId ?? defaultProject.id;
    const nextActiveProject = allProjects.find((project) => project.id === activeProjectId) ?? defaultProject;

    await setLastActiveProjectId(nextActiveProject.id);
    setProjects(allProjects);
    setActiveProject(nextActiveProject);
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadProjects() {
      try {
        await refreshProjects();
      } catch {
        if (isMounted) {
          setError('Could not load projects.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadProjects();

    return () => {
      isMounted = false;
    };
  }, [refreshProjects]);

  const selectProject = useCallback(
    async (projectId: string) => {
      await setLastActiveProjectId(projectId);
      await refreshProjects(projectId);
    },
    [refreshProjects],
  );

  const createAndSelectProject = useCallback(
    async (name: string) => {
      const project = await createProject(name);
      await refreshProjects(project.id);
    },
    [refreshProjects],
  );

  const updateProject = useCallback(
    async (projectId: string, name: string) => {
      await updateProjectEntry(projectId, name);
      await refreshProjects(projectId);
    },
    [refreshProjects],
  );

  const deleteProject = useCallback(
    async (projectId: string) => {
      await deleteProjectEntry(projectId);
      const remainingProjects = await listProjects();
      const fallbackProjectId = projectId === activeProject?.id ? remainingProjects[0]?.id : activeProject?.id;
      await refreshProjects(fallbackProjectId ?? undefined);
    },
    [activeProject?.id, refreshProjects],
  );

  return { activeProject, createAndSelectProject, deleteProject, error, isLoading, projects, selectProject, updateProject };
}
