import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { CompanyEnrichmentCache } from './companyEnrichmentCache.js';
import { enrichCompany, loadEnv } from './index.js';

const MAX_REQUEST_BODY_BYTES = 16 * 1024;
let cache = null;
let cachePromise = null;

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

function keysMatch(actual, expected) {
  if (typeof actual !== 'string' || !expected) return false;
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

function validDomain(domain) {
  return /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(domain);
}

function normalizeDomainInput(input) {
  const value = input.trim().toLowerCase();
  const urlInput = /^[a-z][a-z\d+.-]*:\/\//i.test(value) ? value : `https://${value}`;
  let parsedUrl;

  try {
    parsedUrl = new URL(urlInput);
  } catch {
    return null;
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) return null;
  const domain = parsedUrl.hostname.replace(/^www\./, '');
  return validDomain(domain) ? domain : null;
}

async function readJsonBody(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (Buffer.byteLength(body) > MAX_REQUEST_BODY_BYTES) {
      const error = new Error('Request body is too large.');
      error.statusCode = 413;
      throw error;
    }
  }

  try {
    return JSON.parse(body);
  } catch {
    const error = new Error('Request body must be valid JSON.');
    error.statusCode = 400;
    throw error;
  }
}

async function getCache() {
  if (cache) return cache;
  if (!cachePromise) {
    cachePromise = CompanyEnrichmentCache.create()
      .then((createdCache) => {
        cache = createdCache;
        return cache;
      })
      .catch((error) => {
        cachePromise = null;
        throw error;
      });
  }
  return cachePromise;
}

function isServiceConfigurationError(error) {
  return error.message.startsWith('DATABASE_URL')
    || error.message.startsWith('Unable to connect to the PostgreSQL cache')
    || error.message.startsWith('OPENAI_API_KEY is missing');
}

async function handleEnrich(request, response) {
  const expectedApiKey = process.env.ENRICHMENT_API_KEY;
  if (!expectedApiKey) {
    sendJson(response, 503, { error: 'service_unavailable' });
    return;
  }
  if (!keysMatch(request.headers['x-api-key'], expectedApiKey)) {
    sendJson(response, 401, { error: 'unauthorized' });
    return;
  }

  try {
    const payload = await readJsonBody(request);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload) || typeof payload.domain !== 'string') {
      sendJson(response, 400, { error: 'invalid_request', message: 'Provide a domain string.' });
      return;
    }

    const domain = normalizeDomainInput(payload.domain);
    if (!domain) {
      sendJson(response, 400, { error: 'invalid_request', message: 'Provide a valid HTTP website URL or domain, for example "https://stripe.com/about".' });
      return;
    }

    const enrichment = await enrichCompany(domain, { cache: await getCache(), domain });
    sendJson(response, 200, {
      ...enrichment.result,
      cache_status: enrichment.cacheStatus,
      source_summary: enrichment.sourceSummary,
      timing: {
        lookup_ms: Math.round(enrichment.lookupMilliseconds),
        gpt_research_ms: Math.round(enrichment.researchAndModelMilliseconds),
        total_ms: Math.round(enrichment.totalMilliseconds),
      },
    });
  } catch (error) {
    if (error.statusCode) {
      sendJson(response, error.statusCode, { error: 'invalid_request', message: error.message });
      return;
    }
    if (isServiceConfigurationError(error)) {
      sendJson(response, 503, { error: 'service_unavailable' });
      return;
    }
    console.error('Enrichment request failed.');
    sendJson(response, 502, { error: 'enrichment_failed' });
  }
}

loadEnv();
const PORT = Number.parseInt(process.env.PORT ?? '3000', 10) || 3000;

const server = createServer(async (request, response) => {
  if (request.method === 'GET' && request.url === '/health') {
    sendJson(response, 200, { status: 'ok' });
    return;
  }
  if (request.method === 'POST' && request.url === '/enrich') {
    await handleEnrich(request, response);
    return;
  }
  sendJson(response, 404, { error: 'not_found' });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Enrichment API listening on port ${PORT}`);
});

async function shutdown() {
  server.close();
  await cache?.close();
}

process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
