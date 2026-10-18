import { existsSync, readFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import OpenAI from 'openai';
import { CompanyEnrichmentCache } from './companyEnrichmentCache.js';
import { formatUpdatedAgo } from './updatedAgo.js';

const MODEL = 'gpt-4o-mini';
const FIELDS = ['founded_year', 'venture_backed', 'total_raised', 'latest_funding_amount', 'latest_funding_date', 'funding_type'];
const SOURCE_SUMMARY_FIELD = 'source_summary';

const responseSchema = {
  type: 'object',
  additionalProperties: false,
  required: [...FIELDS, SOURCE_SUMMARY_FIELD],
  properties: {
    founded_year: { type: ['integer', 'null'] },
    venture_backed: { type: ['boolean', 'null'] },
    total_raised: { type: ['string', 'null'] },
    latest_funding_amount: { type: ['string', 'null'] },
    latest_funding_date: { type: ['string', 'null'] },
    funding_type: { type: ['string', 'null'], enum: ['Pre-Seed', 'Seed', 'Series', 'Other Funding', null] },
    source_summary: { type: 'string' },
  },
};

export function loadEnv() {
  const envPath = new URL('../.env', import.meta.url);
  if (!existsSync(envPath)) return;

  for (const rawLine of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const equalsAt = line.indexOf('=');
    if (equalsAt < 1) continue;
    const key = line.slice(0, equalsAt).trim();
    const value = line.slice(equalsAt + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!(key in process.env)) process.env[key] = value;
  }
}

function buildExtractionPrompt(companyName) {
  return `You are researching a company for a recruiting company-intelligence tool.

You MUST use the web search tool to research the company before producing the final JSON. Do not rely only on pretrained knowledge.

Research the company using web search and determine the following five fields:

1. founded_year
2. venture_backed
3. total_raised
4. latest_funding_amount
5. latest_funding_date
6. funding_type

Company:
${companyName}

Research carefully and use reliable sources. Prefer the company's own website, reputable business/financial publications, Crunchbase, PitchBook, company funding announcements, investor websites, and other authoritative sources when available.

When researching the company, actively search these preferred sources first, in this order:

1. The company's official website and newsroom
2. Crunchbase
3. TechCrunch
4. Reuters
5. Bloomberg
6. Forbes
7. Fortune

Owler is not a preferred source. Use it only as a last-resort fallback when the preferred sources and other reputable publications do not establish a field. Treat its classifications and ordering as unverified leads, not as authoritative facts.

For funding information, prioritize the company's own funding announcements and Crunchbase, followed by TechCrunch, Reuters, Bloomberg, Forbes, and Fortune. Use another source only when the required information cannot be established from the preferred sources. If a fallback is necessary, prefer established and reputable business, financial, technology, or venture-capital publications.

Avoid low-quality company databases, scraped company profiles, SEO-generated pages, aggregators, and sources whose underlying information cannot be verified. Do not use Caplight for funding amounts, dates, or cumulative funding. If Owler is used as the last-resort fallback, label it [fallback] in source_summary. When sources disagree, prioritize the preferred sources above rather than simply selecting the largest, newest, or most frequently repeated figure.

Do not perform another company-identity verification step; the upstream tool already handles company verification.

Do not guess.

Return null for any field where reliable evidence cannot be established.

Rules:

* Owler may be used only as a last-resort fallback and must never be labeled [preferred].
* founded_year: Return the year the company was founded. Return only the four-digit year.
* venture_backed: Return true only when there is evidence that the company has received venture capital / institutional venture funding. Return false when reliable evidence indicates it is not venture-backed. Return null when this cannot be established reliably.
* total_raised: Return cumulative funding raised by the company only when a reliable source provides it. Do not confuse it with valuation, revenue, or a single round. Preserve the currency and magnitude as reported.
* Materiality threshold: Ignore any individual funding event below $100,000, or its equivalent in its reported currency (for example, $2.5K or €50K). It is irrelevant for latest_funding_amount, latest_funding_date, funding_type, and total_raised, even if it is the most recent event. Do not let a small grant, award, or other minor transaction replace or alter a material funding result.
* latest_funding_amount and latest_funding_date: First find the most recent event explicitly labeled Pre-Seed, Seed, or Series A/B/C/D/etc., including extensions such as Series B-1 or Series C-2. Read the complete list of funding events on each consulted page. The last explicit Pre-Seed, Seed, or Series event is the marker: ignore every later event for these two fields, regardless of its amount, recency, or label.
* If the first source does not make that explicit round clear, search other preferred or reputable sources and apply the same rule. Do not use an unlabeled Venture Round, Corporate Financing, secondary transaction, debt, grant, acquisition, IPO, or another event merely because it is newer.
* Only if no explicit Pre-Seed, Seed, or Series event can be found after this research may you use the most recent reliable non-series financing event for latest_funding_amount and latest_funding_date. This is a last-resort fallback. In source_summary, label both latest-funding fields "Other Funding" and [fallback].
* Minimum funding threshold: For latest_funding_amount, latest_funding_date, and funding_type only, ignore every event below $100,000 USD or a reliably established equivalent in another currency. This applies to Pre-Seed, Seed, Series, and Other Funding alike. A below-threshold event is invalid and must never be selected; continue searching older events. Do not invent or estimate a missing amount to decide whether it meets the threshold.
* Apply priority and threshold together: select the most recent explicit Pre-Seed, Seed, or Series event that meets the $100,000 threshold. Only if no qualifying Pre-Seed, Seed, or Series event meeting the threshold can be reliably established may you select an Other Funding event that also meets the threshold. If no event meeting the threshold can be reliably established, return null for latest_funding_amount, latest_funding_date, and funding_type.
* Consistency rule: total_raised and the selected latest-funding event must use the same funding universe. If funding_type is "Other Funding", do not return a total_raised figure that excludes that event (for example, private venture funding alone alongside a later government grant). Find a reliable, current cumulative total that includes the Other Funding event. If none can be established, return null for total_raised rather than a conflicting older total. Do not blindly add amounts unless a reliable source explicitly establishes that they are separate components of the cumulative total.
* latest_funding_date: Format the date for the selected event as "Month YYYY", for example "May 2026". Use the funding-event date rather than an announcement date when the source clearly distinguishes them.
* funding_type: There are only four permitted non-null values: "Pre-Seed", "Seed", "Series", and "Other Funding". Return "Pre-Seed" only for a pre-seed round, "Seed" only for a seed round, and "Series" for every Series A/B/C/etc. round (do not return the letter). If the selected event is anything else—Venture Round, corporate financing, secondary transaction, debt, grant, acquisition, IPO, or any other label—return "Other Funding". Never return the source's raw label such as "Venture Round". Return null only when latest_funding_amount and latest_funding_date are both null.
* If the company has subsequently completed an IPO, preserve that information in source_summary so it is clear the latest private funding event is not its current public-company stage.
* Do not confuse a company's valuation with total funding raised.
* Do not confuse revenue with total funding raised.
* Do not treat an individual funding round amount as total funding unless the source explicitly identifies it as cumulative company funding.
* If sources disagree, use the most credible and/or most recent reliable source.
* Do not infer information from the company's size, age, investors, employee count, or reputation.

Return ONLY valid JSON in this exact structure:

{
"founded_year": number | null,
"venture_backed": boolean | null,
"total_raised": string | null,
"latest_funding_amount": string | null,
"latest_funding_date": string | null,
"funding_type": string | null,
"source_summary": "founded_year: [preferred|fallback] Source title — URL; venture_backed: [preferred|fallback] Source title — URL; total_raised: [preferred|fallback] Source title — URL; latest_funding_amount: [preferred|fallback] Source title — URL; latest_funding_date: [preferred|fallback] Source title — URL; funding_type: [preferred|fallback] Source title — URL; public_status: IPO/public status and [preferred|fallback] Source title — URL"
}

source_summary must be exactly one line. Identify one credible source for each field, using its title and URL, and label it [preferred] when it is from the preferred source list or [fallback] otherwise. If a field is null, write "no reliable source found" for that field. Include public_status only when reliable evidence establishes the company has completed an IPO or is public; otherwise write "public_status: not established". Do not include explanations, markdown, citations, or additional fields.`;
}

function parseExtraction(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`OpenAI returned invalid JSON: ${text}`);
  }

  if (!parsed || typeof parsed !== 'object' || [...FIELDS, SOURCE_SUMMARY_FIELD].some((field) => !(field in parsed))) {
    throw new Error('OpenAI JSON did not contain all required fields.');
  }
  if (typeof parsed[SOURCE_SUMMARY_FIELD] !== 'string') {
    throw new Error('OpenAI JSON did not contain a valid source_summary.');
  }
  return {
    result: Object.fromEntries(FIELDS.map((field) => [field, parsed[field] ?? null])),
    sourceSummary: parsed[SOURCE_SUMMARY_FIELD],
  };
}

async function researchCompany(companyName) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is missing. Add it to .env or the environment.');
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const requestStartedAt = performance.now();
  const requestStartedAtIso = new Date().toISOString();
  const response = await client.responses.create({
    model: MODEL,
    input: buildExtractionPrompt(companyName),
    tools: [{ type: 'web_search' }],
    tool_choice: 'required',
    text: {
      format: {
        type: 'json_schema',
        name: 'company_enrichment',
        strict: true,
        schema: responseSchema,
      },
    },
    store: false,
  });
  const researchAndModelMilliseconds = performance.now() - requestStartedAt;
  const { result, sourceSummary } = parseExtraction(response.output_text);

  return { result, sourceSummary, requestStartedAtIso, researchAndModelMilliseconds };
}

/**
 * Runs the shared enrichment workflow for the CLI and HTTP API.
 * The caller owns the cache lifecycle so command-line batches and the server can reuse it.
 */
export async function enrichCompany(companyName, { cache = null, refresh = false, domain = null } = {}) {
  const totalStartedAt = performance.now();
  const lookupStartedAt = performance.now();
  const cached = cache && !refresh ? await cache.get(companyName) : null;
  const lookupMilliseconds = performance.now() - lookupStartedAt;
  const cacheStatus = !cache
    ? 'BYPASSED'
    : refresh
      ? 'REFRESH'
      : cached?.isFresh
        ? 'HIT'
        : cached?.record
          ? 'EXPIRED'
          : 'MISS';

  let result;
  let sourceSummary;
  let requestStartedAtIso = 'cached result';
  let researchAndModelMilliseconds = 0;
  let cacheSaved = false;
  let cachedAt = null;

  if (cached?.isFresh) {
    result = Object.fromEntries(FIELDS.map((field) => [field, cached.record[field]]));
    sourceSummary = cached.record.sources?.source_summary ?? 'Source attribution unavailable in cached record.';
    cachedAt = cached.record.cachedAt;
  } else {
    try {
      const enrichment = await researchCompany(companyName);
      ({ result, sourceSummary, requestStartedAtIso, researchAndModelMilliseconds } = enrichment);
      if (cache) {
        const savedRecord = await cache.set({
          companyName,
          domain,
          result,
          sources: { source_summary: sourceSummary },
        });
        cachedAt = savedRecord.cachedAt;
        cacheSaved = true;
      } else {
        cachedAt = new Date().toISOString();
      }
    } catch (error) {
      if (cached?.record) {
        throw new Error(`GPT enrichment failed; the existing cache record was preserved: ${error.message}`);
      }
      throw error;
    }
  }

  return {
    result: { ...result, updated_ago: formatUpdatedAgo(cachedAt) },
    sourceSummary,
    cacheStatus,
    cacheSaved,
    requestStartedAtIso,
    lookupMilliseconds,
    researchAndModelMilliseconds,
    totalMilliseconds: performance.now() - totalStartedAt,
  };
}

function formatDuration(milliseconds) {
  return `${(milliseconds / 1000).toFixed(2)}s`;
}

function parseCommandLineOptions() {
  const argumentsList = process.argv
    .slice(2)
    .map((value) => value.trim())
    .filter((value) => value && value !== '--');
  const options = { refresh: false, noCache: false, deleteCacheCompany: null, clearCache: false, yes: false, companyNames: [] };

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === '--refresh') options.refresh = true;
    else if (argument === '--no-cache') options.noCache = true;
    else if (argument === '--yes') options.yes = true;
    else if (argument === '--clear-cache') options.clearCache = true;
    else if (argument === '--delete-cache') {
      const companyName = argumentsList[index + 1];
      if (!companyName || companyName.startsWith('--')) {
        throw new Error('--delete-cache requires a company name, for example: --delete-cache "Stripe"');
      }
      options.deleteCacheCompany = companyName;
      index += 1;
    } else options.companyNames.push(argument);
  }

  if (options.deleteCacheCompany && options.clearCache) {
    throw new Error('Use either --delete-cache or --clear-cache, not both.');
  }
  if ((options.deleteCacheCompany || options.clearCache) && (options.companyNames.length || options.refresh || options.noCache)) {
    throw new Error('Cache deletion commands cannot be combined with enrichment options or company names.');
  }
  if (options.yes && !options.clearCache) {
    throw new Error('--yes can only be used with --clear-cache.');
  }
  return options;
}

async function confirmClearCache() {
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = (await terminal.question('Delete every cached company record? Type yes to continue: ')).trim().toLowerCase();
    return answer === 'yes';
  } finally {
    terminal.close();
  }
}

async function companyNamesFromInput(argumentNames) {
  if (argumentNames.length) return argumentNames;

  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  const companyName = (await terminal.question('Enter company name:')).trim();
  terminal.close();
  if (!companyName) throw new Error('A company name is required.');
  return [companyName];
}

async function main() {
  loadEnv();
  const options = parseCommandLineOptions();
  if (options.deleteCacheCompany || options.clearCache) {
    const cache = await CompanyEnrichmentCache.create();
    try {
      if (options.deleteCacheCompany) {
        const deleted = await cache.invalidate(options.deleteCacheCompany);
        console.log(`Cache: ${deleted ? 'DELETED' : 'NOT FOUND'} (${options.deleteCacheCompany})`);
        return;
      }

      if (!options.yes && !(await confirmClearCache())) {
        console.log('Cache: CLEAR CANCELLED');
        return;
      }
      const deleted = await cache.clear();
      console.log(`Cache: CLEARED (${deleted} record${deleted === 1 ? '' : 's'} deleted)`);
      return;
    } finally {
      await cache.close();
    }
  }

  const companyNames = await companyNamesFromInput(options.companyNames);
  const cache = options.noCache ? null : await CompanyEnrichmentCache.create();

  try {
    for (const companyName of companyNames) {
      const enrichment = await enrichCompany(companyName, { cache, refresh: options.refresh });

      const printingStartedAt = performance.now();
      console.log(`\nCompany: ${companyName}`);
      console.log(`Cache: ${enrichment.cacheStatus}`);
      console.log(`Lookup: ${enrichment.lookupMilliseconds.toFixed(0)}ms`);
      if (enrichment.cacheStatus !== 'HIT') console.log(`GPT Research: ${formatDuration(enrichment.researchAndModelMilliseconds)}`);
      if (enrichment.cacheSaved) console.log('Cache: SAVED');
      console.log('Response:');
      console.log(JSON.stringify(enrichment.result, null, 2));
      const printingMilliseconds = performance.now() - printingStartedAt;
      console.log('\nTiming:');
      console.log(`GPT request start: ${enrichment.requestStartedAtIso}`);
      console.log(`GPT web research + processing: ${formatDuration(enrichment.researchAndModelMilliseconds)}`);
      console.log(`Printing: ${formatDuration(printingMilliseconds)}`);
      console.log(`Total: ${formatDuration(enrichment.totalMilliseconds + printingMilliseconds)}`);
      console.log(`Sources: ${enrichment.sourceSummary}`);
    }
  } finally {
    await cache?.close();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`\nError: ${error.message}`);
    process.exitCode = 1;
  });
}
