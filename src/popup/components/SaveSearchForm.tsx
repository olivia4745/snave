import { useState } from 'react';
import type { SearchStatus } from '../../domain/status';
import type { ParsedSalesNavigatorUrl } from '../../services/salesNavigatorUrlParser';
import type { SearchSummary } from '../../services/searchSummaryService';
import { saveSearch } from '../../services/saveSearchService';

const statusOptions: Array<{ label: string; value: SearchStatus }> = [
  { label: 'Successful', value: 'successful' },
  { label: 'Worth Iterating', value: 'worth_iterating' },
  { label: 'Dead End', value: 'dead_end' },
];

type SaveSearchFormProps = {
  activeProjectId: string | undefined;
  hasExactDuplicate?: boolean;
  parsedUrl: ParsedSalesNavigatorUrl;
  summary: SearchSummary;
};

export function SaveSearchForm({ activeProjectId, hasExactDuplicate = false, parsedUrl, summary }: SaveSearchFormProps) {
  const [status, setStatus] = useState<SearchStatus>('worth_iterating');
  const [title, setTitle] = useState('');
  const [textNote, setTextNote] = useState('');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const canSave = Boolean(
    activeProjectId && parsedUrl.isSalesNavigatorSearchPage && saveState !== 'saving' && !hasExactDuplicate && title.trim(),
  );

  async function handleSave() {
    if (!activeProjectId || !parsedUrl.isSalesNavigatorSearchPage || hasExactDuplicate) {
      return;
    }

    setSaveState('saving');

    try {
      await saveSearch({ parsedUrl, projectId: activeProjectId, status, summary, title, textNote });
      setSaveState('saved');
      setTextNote('');
    } catch {
      setSaveState('error');
    }
  }

  return (
    <section className="card">
      <h2>Save Search</h2>
      <div className="status-options" role="group" aria-label="Status">
        {statusOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`status-button ${option.value} ${status === option.value ? 'active' : ''}`}
            disabled={hasExactDuplicate}
            onClick={() => setStatus(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <label className="notes-field" htmlFor="search-title">
        Title (required)
        <input
          id="search-title"
          disabled={hasExactDuplicate}
          placeholder="Give this search a short title…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>
      <label className="notes-field" htmlFor="search-note">
        Text note
        <textarea
          id="search-note"
          disabled={hasExactDuplicate}
          placeholder="Optional note about this search…"
          rows={4}
          value={textNote}
          onChange={(event) => setTextNote(event.target.value)}
        />
      </label>
      <button className="primary-button" disabled={!canSave} onClick={() => void handleSave()}>
        {saveState === 'saving' ? 'Saving…' : 'Save Search'}
      </button>
      {saveState === 'saved' ? <p className="success-message">Search saved locally.</p> : null}
      {saveState === 'error' ? <p className="error-message">Could not save this search.</p> : null}
    </section>
  );
}
