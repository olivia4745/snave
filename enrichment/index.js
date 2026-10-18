import { createInterface } from 'node:readline/promises';
import { existsSync, readFileSync } from 'node:fs';
import { searchCompany } from './serperSearch.js';
import { buildExtractionPrompt, extractCompanyInfo } from './geminiExtraction.js';

const applicationStartedAt = performance.now();

function createTimingLog() {
  const timings = [];
  return {
    record(name, milliseconds) {
      timings.push({ name, milliseconds });
    },
    entries() {
      return timings;
    },
  };
}

function loadEnv() {
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

function display(value) {
  return value === null || value === undefined || value === '' ? 'null' : String(value);
}

function formatDuration(milliseconds) {
  return `${(milliseconds / 1000).toFixed(3)}s`;
}

function totalFor(timings, names) {
  return timings
    .filter((timing) => names.includes(timing.name))
    .reduce((total, timing) => total + timing.milliseconds, 0);
}

async function main() {
  const timings = createTimingLog();
  timings.record('Application startup / initialization', performance.now() - applicationStartedAt);

  const environmentStartedAt = performance.now();
  loadEnv();
  timings.record('Environment variable loading', performance.now() - environmentStartedAt);

  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  const inputStartedAt = performance.now();
  const companyName = (await terminal.question('Enter company name:')).trim();
  timings.record('Reading company input', performance.now() - inputStartedAt);
  terminal.close();
  if (!companyName) throw new Error('A company name is required.');

  const searchResults = await searchCompany(companyName, process.env.SERPER_API_KEY, timings.record);
  console.log(`\nSerper search results:\n${JSON.stringify(searchResults, null, 2)}`);

  const preparationStartedAt = performance.now();
  const preparedPrompt = buildExtractionPrompt(companyName, searchResults);
  timings.record('Building Gemini input', performance.now() - preparationStartedAt);

  const result = await extractCompanyInfo(
    companyName,
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_MODEL,
    preparedPrompt,
    timings.record,
  );

  const outputStartedAt = performance.now();
  const output = [
    `\nCompany: ${companyName}`,
    `Founded year: ${display(result.founded_year)}`,
    `Venture-backed: ${display(result.venture_backed)}`,
    `Funding stage: ${display(result.funding_stage)}`,
    `Total raised: ${display(result.total_raised)}`,
  ].join('\n');
  timings.record('Final output formatting', performance.now() - outputStartedAt);
  timings.record('Retries / waits', 0);
  const totalDuration = performance.now() - applicationStartedAt;

  console.log(output);
  const timingEntries = timings.entries();
  console.log(`Search: ${formatDuration(totalFor(timingEntries, ['SerperAPI request', 'Processing SerperAPI response']))}`);
  console.log(`Preparation: ${formatDuration(totalFor(timingEntries, ['Building Gemini input']))}`);
  console.log(`Gemini processing: ${formatDuration(totalFor(timingEntries, ['Gemini client initialization', 'Gemini API request', 'Gemini response parsing']))}`);
  console.log(`Total processing: ${formatDuration(totalDuration)}`);
}

main().catch((error) => {
  console.error(`\nError: ${error.message}`);
  process.exitCode = 1;
});
