import { useEffect, useState } from 'react';
import type { SavedSearch } from '../../domain/search';
import { searchSavedSearches } from '../../storage/repositories/searchRepository';

type SearchLibraryState = {
  error: string | null;
  isLoading: boolean;
  searches: SavedSearch[];
};

export function useSearchLibrary(query: string, projectId?: string): SearchLibraryState {
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadSearches() {
      setIsLoading(true);
      setError(null);

      try {
        const matchingSearches = await searchSavedSearches(query, projectId);

        if (isMounted) {
          setSearches(matchingSearches);
        }
      } catch {
        if (isMounted) {
          setError('Could not load saved searches.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadSearches();

    return () => {
      isMounted = false;
    };
  }, [projectId, query]);

  return { error, isLoading, searches };
}
