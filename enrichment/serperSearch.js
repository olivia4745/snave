const SERPER_SEARCH_URL = 'https://google.serper.dev/search';

export function buildCompanyQuery(companyName) {
  return `"${companyName}" ("total funding" OR "total raised") ("venture-backed" OR "VC-backed" OR "venture capital") founded (Series OR seed)`;
}

/** Fetches only title, URL, and snippet for up to the first 10 organic results. */
export async function searchCompany(companyName, apiKey, recordTiming = () => {}) {
  if (!apiKey) throw new Error('SERPER_API_KEY is missing. Add it to .env.');

  const requestStartedAt = performance.now();
  const response = await fetch(SERPER_SEARCH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-KEY': apiKey },
    body: JSON.stringify({ q: buildCompanyQuery(companyName), num: 10 }),
  });
  recordTiming('SerperAPI request', performance.now() - requestStartedAt);

  if (!response.ok) {
    throw new Error(`SerperAPI search failed (${response.status}): ${await response.text()}`);
  }

  const processingStartedAt = performance.now();
  const payload = await response.json();
  const results = (payload.organic ?? []).slice(0, 10).map((result) => ({
    title: result.title ?? '',
    url: result.link ?? '',
    snippet: result.snippet ?? '',
  }));
  recordTiming('Processing SerperAPI response', performance.now() - processingStartedAt);
  return results;
}
