import type { SimilarSearchResult } from '../../services/searchSimilarityService';
import type { SearchStatus } from '../../domain/status';

type SimilarSearchesPanelProps = {
  error: string | null;
  isLoading: boolean;
  similarSearches: SimilarSearchResult[];
};

const levelLabels = {
  exact: 'Exact match',
  high: 'High similarity',
  medium: 'Medium similarity',
  low: 'Low similarity',
};

const statusLabels: Record<SearchStatus, string> = {
  dead_end: 'Dead End',
  successful: 'Successful',
  worth_iterating: 'Worth Iterating',
};

export function SimilarSearchesPanel({ error, isLoading, similarSearches }: SimilarSearchesPanelProps) {
  const exactMatch = similarSearches.find((result) => result.level === 'exact');
  const otherMatches = similarSearches.filter((result) => result.level !== 'exact');
  const visibleOtherMatches = otherMatches.slice(0, 1);
  const hiddenOtherCount = otherMatches.length - visibleOtherMatches.length;

  return (
    <section className="card">
      <h2>Similar Searches</h2>
      {isLoading ? <p className="muted">Checking existing searches…</p> : null}
      {error ? <p className="error-message">{error}</p> : null}
      {!isLoading && !error && similarSearches.length === 0 ? <p className="muted">No similar searches found.</p> : null}
      {!isLoading && !error && (exactMatch || otherMatches.length > 0) ? (
        <div className="similar-list">
          {exactMatch ? (
            <article className="similar-item exact" key={exactMatch.search.id}>
              <div className="similar-item-header">
                <strong>{levelLabels[exactMatch.level]}</strong>
                <span>{Math.round(exactMatch.score * 100)}%</span>
              </div>
              <h3>{exactMatch.search.summary}</h3>
              {exactMatch.search.textNote ? <p className="similar-note">{exactMatch.search.textNote}</p> : null}
              <div className="similar-item-meta">
                <span>{statusLabels[exactMatch.search.status]}</span>
                <span>Saved {formatDate(exactMatch.search.createdAt)}</span>
                <a href={exactMatch.search.originalUrl} target="_blank" rel="noreferrer noopener">Link to search</a>
              </div>
            </article>
          ) : null}
          {visibleOtherMatches.map((result) => (
            <article className={`similar-item ${result.level}`} key={result.search.id}>
              <div className="similar-item-header">
                <strong>{levelLabels[result.level]}</strong>
                <span>{Math.round(result.score * 100)}%</span>
              </div>
              <h3>{result.search.summary}</h3>
              {result.search.textNote ? <p className="similar-note">{result.search.textNote}</p> : null}
              <div className="similar-item-meta">
                <span>{statusLabels[result.search.status]}</span>
                <span>Saved {formatDate(result.search.createdAt)}</span>
                <a href={result.search.originalUrl} target="_blank" rel="noreferrer noopener">Link to search</a>
              </div>
            </article>
          ))}
          {hiddenOtherCount > 0 ? (
            <div className="similar-hidden-count">+{hiddenOtherCount} more similar searches</div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
}
