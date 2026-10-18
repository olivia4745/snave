import pg from 'pg';

const { Pool } = pg;

export const CACHE_TTL_DAYS = 120;
export const CACHE_TTL_MILLISECONDS = CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;

export function normalizeCompanyName(companyName) {
  return companyName.trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeFundingType(fundingType) {
  if (fundingType === null || fundingType === undefined) return null;
  const normalized = String(fundingType).trim().toLowerCase();
  if (normalized === 'pre-seed' || normalized === 'pre seed') return 'Pre-Seed';
  if (normalized === 'seed') return 'Seed';
  if (normalized.startsWith('series')) return 'Series';
  return 'Other Funding';
}

function timestamp(value) {
  return value instanceof Date ? value.toISOString() : value;
}

function deserializeRecord(row) {
  if (!row) return null;
  let sources = row.sources ?? null;
  if (typeof sources === 'string') {
    try {
      sources = JSON.parse(sources);
    } catch {
      sources = null;
    }
  }

  return {
    id: row.id,
    companyName: row.company_name,
    normalizedName: row.normalized_name,
    domain: row.domain,
    founded_year: row.founded_year,
    venture_backed: row.venture_backed === null ? null : Boolean(row.venture_backed),
    total_raised: row.total_raised,
    latest_funding_amount: row.latest_funding_amount,
    latest_funding_date: row.latest_funding_date,
    funding_type: normalizeFundingType(row.funding_type),
    sources,
    enrichmentMethod: row.enrichment_method,
    cachedAt: timestamp(row.cached_at),
    expiresAt: timestamp(row.expires_at),
  };
}

function databaseSslOptions(databaseUrl) {
  const parsedUrl = new URL(databaseUrl);
  const hostname = parsedUrl.hostname.toLowerCase();
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  return isLocal || parsedUrl.searchParams.get('sslmode') === 'disable'
    ? false
    : { rejectUnauthorized: false };
}

/** PostgreSQL implementation of the company-enrichment cache. */
export class CompanyEnrichmentCache {
  constructor(databaseUrl = process.env.DATABASE_URL) {
    if (!databaseUrl) {
      throw new Error('DATABASE_URL is missing. Add it to .env or the environment.');
    }

    try {
      this.pool = new Pool({
        connectionString: databaseUrl,
        ssl: databaseSslOptions(databaseUrl),
        max: 3,
        connectionTimeoutMillis: 10_000,
      });
    } catch {
      throw new Error('DATABASE_URL is invalid. Check its format in .env.');
    }
    this.closed = false;
  }

  static async create(databaseUrl) {
    const cache = new CompanyEnrichmentCache(databaseUrl);
    try {
      await cache.initialize();
      return cache;
    } catch (error) {
      await cache.close();
      if (error.message.startsWith('DATABASE_URL')) throw error;
      throw new Error(`Unable to connect to the PostgreSQL cache. Check DATABASE_URL and database availability${error.code ? ` (${error.code})` : ''}.`);
    }
  }

  async initialize() {
    await this.pool.query('SELECT 1');
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS company_enrichment_cache (
        id BIGSERIAL PRIMARY KEY,
        company_name TEXT NOT NULL,
        normalized_name TEXT NOT NULL,
        domain TEXT NULL,
        founded_year INTEGER NULL,
        venture_backed BOOLEAN NULL,
        total_raised TEXT NULL,
        latest_funding_amount TEXT NULL,
        latest_funding_date TEXT NULL,
        funding_type TEXT NULL,
        sources JSONB NULL,
        enrichment_method TEXT NOT NULL,
        cached_at TIMESTAMPTZ NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL
      )
    `);
    await this.pool.query('ALTER TABLE company_enrichment_cache ADD COLUMN IF NOT EXISTS funding_type TEXT NULL');
    await this.pool.query('CREATE UNIQUE INDEX IF NOT EXISTS company_enrichment_cache_normalized_name_idx ON company_enrichment_cache (normalized_name)');
    await this.pool.query('CREATE INDEX IF NOT EXISTS company_enrichment_cache_expires_at_idx ON company_enrichment_cache (expires_at)');
  }

  async get(companyName, now = new Date()) {
    const normalizedName = normalizeCompanyName(companyName);
    const { rows } = await this.pool.query(
      'SELECT * FROM company_enrichment_cache WHERE normalized_name = $1',
      [normalizedName],
    );
    const record = deserializeRecord(rows[0]);
    return {
      record,
      isFresh: Boolean(record && new Date(record.expiresAt).getTime() > now.getTime()),
    };
  }

  async set({ companyName, domain = null, result, sources = null, enrichmentMethod = 'openai-gpt-4o-mini-web-search' }, now = new Date()) {
    const normalizedName = normalizeCompanyName(companyName);
    const cachedAt = now.toISOString();
    const expiresAt = new Date(now.getTime() + CACHE_TTL_MILLISECONDS).toISOString();
    const ventureBacked = result.venture_backed === null ? null : Boolean(result.venture_backed);

    await this.pool.query(`
      INSERT INTO company_enrichment_cache (
        company_name, normalized_name, domain, founded_year, venture_backed, total_raised,
        latest_funding_amount, latest_funding_date, funding_type, sources, enrichment_method, cached_at, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12::timestamptz, $13::timestamptz)
      ON CONFLICT(normalized_name) DO UPDATE SET
        company_name = EXCLUDED.company_name,
        domain = EXCLUDED.domain,
        founded_year = EXCLUDED.founded_year,
        venture_backed = EXCLUDED.venture_backed,
        total_raised = EXCLUDED.total_raised,
        latest_funding_amount = EXCLUDED.latest_funding_amount,
        latest_funding_date = EXCLUDED.latest_funding_date,
        funding_type = EXCLUDED.funding_type,
        sources = EXCLUDED.sources,
        enrichment_method = EXCLUDED.enrichment_method,
        cached_at = EXCLUDED.cached_at,
        expires_at = EXCLUDED.expires_at
    `, [
      companyName,
      normalizedName,
      domain,
      result.founded_year,
      ventureBacked,
      result.total_raised,
      result.latest_funding_amount,
      result.latest_funding_date,
      normalizeFundingType(result.funding_type),
      sources === null ? null : JSON.stringify(sources),
      enrichmentMethod,
      cachedAt,
      expiresAt,
    ]);

    return (await this.get(companyName, now)).record;
  }

  async invalidate(companyName) {
    const normalizedName = normalizeCompanyName(companyName);
    const result = await this.pool.query(
      'DELETE FROM company_enrichment_cache WHERE normalized_name = $1',
      [normalizedName],
    );
    return result.rowCount;
  }

  async clear() {
    const result = await this.pool.query('DELETE FROM company_enrichment_cache');
    return result.rowCount;
  }

  async close() {
    if (this.closed) return;
    this.closed = true;
    await this.pool.end();
  }
}
