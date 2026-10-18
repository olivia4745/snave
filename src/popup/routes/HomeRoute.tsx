import { useMemo } from 'react';
import { ProjectSelector } from '../components/ProjectSelector';
import { SaveSearchForm } from '../components/SaveSearchForm';
import { SimilarSearchesPanel } from '../components/SimilarSearchesPanel';
import { useActiveTabUrl } from '../hooks/useActiveTabUrl';
import { useProjects } from '../hooks/useProjects';
import { useSimilarSearches } from '../hooks/useSimilarSearches';
import { detectSalesNavigatorPage } from '../../services/salesNavigatorPageDetection';
import { parseSalesNavigatorUrl } from '../../services/salesNavigatorUrlParser';
import { generateSearchSummary } from '../../services/searchSummaryService';

const pageTypeLabels = {
  'account-search': 'Account search page detected',
  'lead-search': 'Lead search page detected',
  unsupported: 'Unsupported page',
};

export function HomeRoute() {
  const { error, isLoading, url } = useActiveTabUrl();
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
  const detection = useMemo(() => detectSalesNavigatorPage(url), [url]);
  const parsedUrl = useMemo(() => parseSalesNavigatorUrl(url), [url]);
  const summary = useMemo(() => generateSearchSummary(parsedUrl), [parsedUrl]);
  const { error: similarityError, isLoading: isLoadingSimilarSearches, similarSearches } = useSimilarSearches(
    parsedUrl,
    activeProject?.id,
  );
  const hasExactDuplicate = similarSearches.some((result) => result.level === 'exact');

  if (isLoading || isLoadingProjects) {
    return (
      <section className="card">
        <h2>Current Page</h2>
        <p className="muted">Checking the active tab…</p>
      </section>
    );
  }

  if (error || projectError) {
    return (
      <section className="card status-card warning">
        <h2>Current Page</h2>
        <p>{error ?? projectError}</p>
      </section>
    );
  }

  return (
    <div className="route-stack">
      <ProjectSelector
        activeProject={activeProject}
        disabled={false}
        onCreateProject={createAndSelectProject}
        onDeleteProject={deleteProject}
        onSelectProject={selectProject}
        onUpdateProject={updateProject}
        projects={projects}
      />
      <section className={`card status-card no-accent ${detection.isSalesNavigatorSearchPage ? 'success' : 'neutral'}`}>
        <h2>Current Page</h2>
        <p className="status-label">{pageTypeLabels[detection.pageType]}</p>
        <p className="muted">
          {detection.isSalesNavigatorSearchPage
            ? 'Readable summary generated from the current URL.'
            : 'Open a LinkedIn Sales Navigator lead or account search page to continue.'}
        </p>
        {parsedUrl.isSalesNavigatorSearchPage ? (
          <>
            <article className="summary-card" aria-label="Search summary">
              <p className="summary-title">{summary.title}</p>
              <ul className="summary-list">
                {summary.filterSummaries.map((summaryLine) => {
                  const [label, body] = summaryLine.split('\n');
                  return (
                    <li key={summaryLine}>
                      <strong>{label}</strong>
                      {body ? `: ${body}` : ''}
                    </li>
                  );
                })}
              </ul>
            </article>
          </>
        ) : null}
      </section>
      {parsedUrl.isSalesNavigatorSearchPage ? (
        <>
          <SimilarSearchesPanel
            error={similarityError}
            isLoading={isLoadingSimilarSearches}
            similarSearches={similarSearches}
          />
          <SaveSearchForm
            activeProjectId={activeProject?.id}
            hasExactDuplicate={hasExactDuplicate}
            parsedUrl={parsedUrl}
            summary={summary}
          />
        </>
      ) : null}
    </div>
  );
}
