const TAVILY_SEARCH_URL = 'https://api.tavily.com/search';

export function buildCompanyQuery(companyName) {
  return `"${companyName}" ("total funding" OR "total raised") ("venture-backed" OR "VC-backed" OR "venture capital") founded (Series OR seed)`;
}

/** Fetches up to 10 Tavily results, including Tavily's extracted page content. */
export async function searchCompany(companyName, apiKey, recordTiming = () => {}) {
  if (!apiKey) throw new Error('TAVILY_API_KEY is missing. Add it to .env.');

  const requestStartedAt = performance.now();
  const response = await fetch(TAVILY_SEARCH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query: buildCompanyQuery(companyName),
      max_results: 10,
      include_raw_content: 'markdown',
    }),
  });
  recordTiming('Tavily search', performance.now() - requestStartedAt);

  if (!response.ok) {
    throw new Error(`Tavily search failed (${response.status}): ${await response.text()}`);
  }

  const processingStartedAt = performance.now();
  const payload = await response.json();
  const results = (payload.results ?? []).slice(0, 10).map((result) => ({
    title: result.title ?? '',
    url: result.url ?? '',
    content: result.content ?? '',
    raw_content: result.raw_content ?? result.rawContent ?? '',
  }));
  recordTiming('Processing Tavily response', performance.now() - processingStartedAt);
  return results;
}
