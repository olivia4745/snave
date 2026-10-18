export function buildExtractionPrompt(companyName, searchResults) {
  return `You are extracting structured company information from Google search results.

Company: ${companyName}

Using ONLY the information contained in the retrieved results below, extract these four fields:

founded_year — the year the company was founded.
venture_backed — whether the company has received venture capital / VC funding.
funding_stage — the company's latest funding round/stage.
total_raised — the total amount of funding the company has raised.

For funding_stage, ONLY classify the stage if the evidence explicitly identifies a conventional venture funding stage such as:

Pre-Seed
Seed
Series A
Series B
Series C
Series D
Series E
Series F
and so on.

Do NOT classify any of the following as a funding stage:

Grant
Corporate Round
Tender Offer
Secondary
Debt Financing
Post-IPO
Initial Public Offering
Crowdfunding
or other non-standard financing events.

If the latest financing event is one of those excluded categories, look for the most recent conventional venture funding stage instead. If no conventional stage can be reliably determined, return null.

Do not guess. If reliable information cannot be found in the retrieved results, return null.

Return ONLY valid JSON in exactly this format:

{
"founded_year": null,
"venture_backed": null,
"funding_stage": null,
"total_raised": null
}

Retrieved results:
${JSON.stringify(searchResults, null, 2)}`;
}

export function parseExtraction(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Gemini returned invalid JSON: ${text}`);
  }

  const fields = ['founded_year', 'venture_backed', 'funding_stage', 'total_raised'];
  if (!parsed || typeof parsed !== 'object' || fields.some((field) => !(field in parsed))) {
    throw new Error('Gemini JSON did not contain all four required fields.');
  }
  return Object.fromEntries(fields.map((field) => [field, parsed[field] ?? null]));
}

/** Sends exactly one Gemini request for the supplied search results. */
export async function extractCompanyInfo(
  companyName,
  apiKey,
  model = 'gemini-3.5-flash-lite',
  preparedPrompt = buildExtractionPrompt(companyName, []),
  recordTiming = () => {},
) {
  if (!apiKey) throw new Error('GEMINI_API_KEY is missing. Add it to .env.');

  const initializationStartedAt = performance.now();
  const endpoint = 'https://generativelanguage.googleapis.com/v1beta/interactions';
  const request = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      model,
      input: preparedPrompt,
      response_format: { type: 'text', mime_type: 'application/json' },
      generation_config: { thinking_level: 'minimal' },
      store: false,
    }),
  };
  recordTiming('Gemini client initialization', performance.now() - initializationStartedAt);

  const requestStartedAt = performance.now();
  const response = await fetch(endpoint, {
    ...request,
  });
  recordTiming('Gemini API request', performance.now() - requestStartedAt);

  if (!response.ok) {
    throw new Error(`Gemini Interactions API failed (${response.status}): ${await response.text()}`);
  }

  const parsingStartedAt = performance.now();
  const payload = await response.json();
  const text = payload.steps
    ?.filter((step) => step.type === 'model_output')
    .flatMap((step) => step.content ?? [])
    .filter((content) => content.type === 'text')
    .map((content) => content.text ?? '')
    .join('');
  if (!text) throw new Error('Gemini returned no extractable text.');
  const result = parseExtraction(text);
  recordTiming('Gemini response parsing', performance.now() - parsingStartedAt);
  return result;
}
