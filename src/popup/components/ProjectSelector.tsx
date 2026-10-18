import { useState } from 'react';
import type { Project } from '../../domain/project';

type ProjectSelectorProps = {
  activeProject: Project | null;
  disabled?: boolean;
  onCreateProject: (name: string) => Promise<void>;
  onDeleteProject: (projectId: string) => Promise<void>;
  onSelectProject: (projectId: string) => Promise<void>;
  onUpdateProject: (projectId: string, name: string) => Promise<void>;
  projects: Project[];
};

const CREATE_NEW_PROJECT_VALUE = '__create_new_project__';

export function ProjectSelector({
  activeProject,
  disabled = false,
  onCreateProject,
  onDeleteProject,
  onSelectProject,
  onUpdateProject,
  projects,
}: ProjectSelectorProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [isManaging, setIsManaging] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [draftProjectName, setDraftProjectName] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  async function handleProjectChange(value: string) {
    if (value === CREATE_NEW_PROJECT_VALUE) {
      setIsCreating(true);
      return;
    }

    await onSelectProject(value);
  }

  async function handleCreateProject() {
    const trimmedName = newProjectName.trim();

    if (!trimmedName) {
      return;
    }

    setIsSaving(true);
    try {
      await onCreateProject(trimmedName);
      setNewProjectName('');
      setIsCreating(false);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveProjectRename(projectId: string) {
    const trimmedName = draftProjectName.trim();

    if (!trimmedName) {
      return;
    }

    setIsSaving(true);
    try {
      await onUpdateProject(projectId, trimmedName);
      setEditingProjectId(null);
      setDraftProjectName('');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteProject(projectId: string) {
    setIsSaving(true);
    try {
      await onDeleteProject(projectId);
      setDeletingProjectId(null);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="project-selector">
      <label htmlFor="project-select">Project</label>
      <select
        id="project-select"
        disabled={disabled || isSaving}
        value={activeProject?.id ?? ''}
        onChange={(event) => void handleProjectChange(event.target.value)}
      >
        {projects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
        <option value={CREATE_NEW_PROJECT_VALUE}>+ Create New Project</option>
      </select>
      <button className="manage-projects-link" type="button" onClick={() => setIsManaging((current) => !current)}>
        {isManaging ? 'Hide project management' : 'Manage projects'}
      </button>
      {isCreating ? (
        <div className="inline-form">
          <input
            aria-label="New project name"
            placeholder="Project name"
            value={newProjectName}
            onChange={(event) => setNewProjectName(event.target.value)}
          />
          <button disabled={isSaving || !newProjectName.trim()} onClick={() => void handleCreateProject()}>
            Create
          </button>
          <button className="ghost-button" disabled={isSaving} onClick={() => setIsCreating(false)}>
            Cancel
          </button>
        </div>
      ) : null}
      {isManaging ? (
        <div className="manage-projects-panel">
          <div className="manage-projects-header">
            <span>Projects</span>
            <button className="ghost-button small" type="button" onClick={() => setIsManaging(false)}>
              Close
            </button>
          </div>
          <div className="manage-projects-list">
            {projects.map((project) => {
              const isEditing = editingProjectId === project.id;
              const isDeleting = deletingProjectId === project.id;

              return (
                <div className="manage-project-row" key={project.id}>
                  {isEditing ? (
                    <div className="manage-project-edit">
                      <input
                        aria-label="Project name"
                        value={draftProjectName}
                        onChange={(event) => setDraftProjectName(event.target.value)}
                      />
                      <div className="manage-project-actions">
                        <button className="ghost-button small" disabled={isSaving} type="button" onClick={() => void handleSaveProjectRename(project.id)}>
                          Save
                        </button>
                        <button className="ghost-button small" disabled={isSaving} type="button" onClick={() => {
                          setEditingProjectId(null);
                          setDraftProjectName('');
                        }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="manage-project-name">{project.name}</div>
                  )}
                  {!isEditing ? (
                    <div className="manage-project-actions">
                      <button
                        className="ghost-button small"
                        disabled={isSaving}
                        type="button"
                        onClick={() => {
                          setEditingProjectId(project.id);
                          setDraftProjectName(project.name);
                        }}
                      >
                        Edit
                      </button>
                      {!isDeleting ? (
                        <button className="ghost-button small danger" disabled={isSaving} type="button" onClick={() => setDeletingProjectId(project.id)}>
                          Delete
                        </button>
                      ) : (
                        <div className="manage-delete-confirm">
                          <span>Delete this project and its saved searches?</span>
                          <div className="manage-project-actions">
                            <button className="ghost-button small" disabled={isSaving} type="button" onClick={() => setDeletingProjectId(null)}>
                              Cancel
                            </button>
                            <button className="ghost-button small danger" disabled={isSaving} type="button" onClick={() => void handleDeleteProject(project.id)}>
                              Delete
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
