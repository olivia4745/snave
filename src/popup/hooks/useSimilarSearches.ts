import { useEffect, useState } from 'react';
import { listSearchesByProject } from '../../storage/repositories/searchRepository';
import type { ParsedSalesNavigatorUrl } from '../../services/salesNavigatorUrlParser';
import { findSimilarSearches, type SimilarSearchResult } from '../../services/searchSimilarityService';

type SimilarSearchesState = {
  error: string | null;
  isLoading: boolean;
  similarSearches: SimilarSearchResult[];
};

export function useSimilarSearches(parsedUrl: ParsedSalesNavigatorUrl, projectId?: string): SimilarSearchesState {
  const [similarSearches, setSimilarSearches] = useState<SimilarSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadSimilarSearches() {
      if (!projectId || !parsedUrl.isSalesNavigatorSearchPage) {
        setSimilarSearches([]);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const savedSearches = await listSearchesByProject(projectId);
        const results = findSimilarSearches(parsedUrl, savedSearches);

        if (isMounted) {
          setSimilarSearches(results);
        }
      } catch {
        if (isMounted) {
          setError('Could not check for similar searches.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadSimilarSearches();

    return () => {
      isMounted = false;
    };
  }, [parsedUrl, projectId]);

  return { error, isLoading, similarSearches };
}
