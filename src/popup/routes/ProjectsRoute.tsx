import { useState } from 'react';
import { ProjectSelector } from '../components/ProjectSelector';
import { SearchLibraryList } from '../components/SearchLibraryList';
import { useProjects } from '../hooks/useProjects';
import { useSearchLibrary } from '../hooks/useSearchLibrary';
import { buildSearchesCsv, createCsvFilename, downloadCsv } from '../../services/csvExportService';

export function ProjectsRoute() {
  const [query, setQuery] = useState('');
  const {
    activeProject,
    createAndSelectProject,
    deleteProject,
    error: projectError,
    isLoading: isLoadingProjects,
    projects,
    selectProject,
    updateProject,
  } = useProjects();
  const { error: libraryError, isLoading: isLoadingLibrary, searches } = useSearchLibrary(query, activeProject?.id);

  function handleExportCsv() {
    const csv = buildSearchesCsv(searches, projects);
    const filename = createCsvFilename(activeProject?.name);
    downloadCsv(filename, csv);
  }

  if (isLoadingProjects) {
    return (
      <section className="card">
        <h2>Search Library</h2>
        <p className="muted">Loading projects…</p>
      </section>
    );
  }

  if (projectError) {
    return (
      <section className="card status-card warning">
        <h2>Search Library</h2>
        <p>{projectError}</p>
      </section>
    );
  }

  return (
    <div className="route-stack">
      <ProjectSelector
        activeProject={activeProject}
        onCreateProject={createAndSelectProject}
        onDeleteProject={deleteProject}
        onSelectProject={selectProject}
        onUpdateProject={updateProject}
        projects={projects}
      />
      <section className="card">
        <div className="section-header">
          <div>
            <h2>Search Library</h2>
            <p className="muted small-text">Exports the current project and search filter.</p>
          </div>
          <button className="secondary-button" disabled={searches.length === 0 || isLoadingLibrary} onClick={handleExportCsv}>
            Export CSV
          </button>
        </div>
        <label className="search-field" htmlFor="library-search">
          Search saved searches
          <input
            id="library-search"
            placeholder="Search title, notes, status, filters, URLs…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        {isLoadingLibrary ? <p className="muted">Loading saved searches…</p> : null}
        {libraryError ? <p className="error-message">{libraryError}</p> : null}
        {!isLoadingLibrary && !libraryError ? <SearchLibraryList projects={projects} searches={searches} /> : null}
      </section>
    </div>
  );
}
