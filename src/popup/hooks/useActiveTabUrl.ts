import { useEffect, useState } from 'react';

type ActiveTabUrlState = {
  error: string | null;
  isLoading: boolean;
  url: string | undefined;
};

export function useActiveTabUrl(): ActiveTabUrlState {
  const [state, setState] = useState<ActiveTabUrlState>({
    error: null,
    isLoading: true,
    url: undefined,
  });

  useEffect(() => {
    let isMounted = true;

    async function loadActiveTabUrl() {
      try {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!isMounted) {
          return;
        }

        setState({ error: null, isLoading: false, url: activeTab?.url });
      } catch {
        if (!isMounted) {
          return;
        }

        setState({
          error: 'Could not read the active tab URL.',
          isLoading: false,
          url: undefined,
        });
      }
    }

    void loadActiveTabUrl();

    return () => {
      isMounted = false;
    };
  }, []);

  return state;
}
