import { useEffect, useState } from 'react';
import type { Project } from '../../domain/project';
import type { SavedSearch } from '../../domain/search';
import type { SearchStatus } from '../../domain/status';
import { deleteSearch, updateSearch } from '../../storage/repositories/searchRepository';

type SearchLibraryListProps = {
  projects: Project[];
  searches: SavedSearch[];
};

const statusLabels: Record<SearchStatus, string> = {
  dead_end: 'Dead End',
  successful: 'Successful',
  worth_iterating: 'Worth Iterating',
};

const statusOptions: SearchStatus[] = ['successful', 'worth_iterating', 'dead_end'];

export function SearchLibraryList({ projects, searches }: SearchLibraryListProps) {
  const [visibleSearches, setVisibleSearches] = useState<SavedSearch[]>(searches);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftNote, setDraftNote] = useState('');
  const [draftStatus, setDraftStatus] = useState<SearchStatus>('successful');
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  useEffect(() => {
    setVisibleSearches(searches);
  }, [searches]);

  async function handleSaveEdit(search: SavedSearch) {
    const updatedSearch: SavedSearch = {
      ...search,
      summary: draftTitle.trim() || search.summary,
      textNote: draftNote.trim() || undefined,
      status: draftStatus,
      updatedAt: new Date().toISOString(),
    };

    await updateSearch(updatedSearch);
    setVisibleSearches((current) => current.map((item) => (item.id === search.id ? updatedSearch : item)));
    setEditingId(null);
    setDraftTitle('');
    setDraftNote('');
    setDraftStatus('successful');
  }

  async function handleDelete(search: SavedSearch) {
    await deleteSearch(search.id);
    setVisibleSearches((current) => current.filter((item) => item.id !== search.id));
    setConfirmingId(null);
  }

  if (visibleSearches.length === 0) {
    return <p className="muted">No saved searches found yet.</p>;
  }

  return (
    <div className="search-list" aria-label="Saved searches">
      {visibleSearches.map((search) => {
        const isEditing = editingId === search.id;
        const isConfirming = confirmingId === search.id;

        return (
          <article className="search-list-item" key={search.id}>
            <div className="search-list-item-header">
              <h3>
                {search.summary}
                <a className="search-link" href={search.originalUrl} target="_blank" rel="noreferrer noopener">link to search</a>
              </h3>
              <span className={`status-pill ${search.status}`}>{statusLabels[search.status]}</span>
            </div>
            <dl className="compact-metadata">
              <div>
                <dt>Project</dt>
                <dd>{projects.find((project) => project.id === search.projectId)?.name ?? 'Unknown Project'}</dd>
              </div>
              <div>
                <dt>Type</dt>
                <dd>{search.searchType}</dd>
              </div>
              <div>
                <dt>Saved</dt>
                <dd>{formatDate(search.createdAt)}</dd>
              </div>
            </dl>
            {search.textNote ? <p className="note-preview">{search.textNote}</p> : null}

            <div className="search-actions">
              {!isEditing ? (
                <button
                  className="ghost-button small"
                  type="button"
                  onClick={() => {
                    setEditingId(search.id);
                    setDraftTitle(search.summary);
                    setDraftNote(search.textNote ?? '');
                  }}
                >
                  Edit
                </button>
              ) : null}
              {!isConfirming ? (
                <button className="ghost-button small danger" type="button" onClick={() => setConfirmingId(search.id)}>
                  Delete
                </button>
              ) : (
                <div className="confirm-delete">
                  <span>Delete this search?</span>
                  <button className="ghost-button small" type="button" onClick={() => setConfirmingId(null)}>
                    Cancel
                  </button>
                  <button className="ghost-button small danger" type="button" onClick={() => void handleDelete(search)}>
                    Confirm
                  </button>
                </div>
              )}
            </div>

            {isEditing ? (
              <div className="edit-form">
                <label className="notes-field compact">
                  Title
                  <input value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} />
                </label>
                <label className="notes-field compact">
                  Notes
                  <textarea rows={3} value={draftNote} onChange={(event) => setDraftNote(event.target.value)} />
                </label>
                <fieldset className="status-options compact-status-options">
                  <legend>Status</legend>
                  {statusOptions.map((status) => (
                    <button
                      key={status}
                      className={`status-button ${status} ${draftStatus === status ? 'active' : ''}`}
                      type="button"
                      onClick={() => setDraftStatus(status)}
                    >
                      {statusLabels[status]}
                    </button>
                  ))}
                </fieldset>
                <div className="edit-actions">
                  <button className="primary-button small" type="button" onClick={() => void handleSaveEdit(search)}>
                    Save
                  </button>
                  <button className="ghost-button small" type="button" onClick={() => {
                    setEditingId(null);
                    setDraftTitle('');
                    setDraftNote('');
                    setDraftStatus('successful');
                  }}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
}
