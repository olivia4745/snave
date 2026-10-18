import type { ParsedQueryParameter, ParsedSalesNavigatorUrl } from './salesNavigatorUrlParser';

export type SearchSummary = {
  title: string;
  description: string;
  filterSummaries: string[];
};

const PARAMETER_LABELS: Record<string, string> = {
  companyHeadcount: 'Company headcount',
  companyHqGeo: 'Company HQ',
  companyIncluded: 'Companies',
  companyIndustry: 'Company industry',
  companySize: 'Company size',
  currentCompany: 'Current company',
  function: 'Function',
  geoIncluded: 'Geography',
  industry: 'Industry',
  keywords: 'Keywords',
  profileLanguage: 'Profile language',
  query: 'Search filters',
  school: 'School',
  seniority: 'Seniority',
  title: 'Title',
};

const MAX_FILTER_SUMMARIES = 5;
const MAX_VALUE_LENGTH = 80;

const TYPE_LABELS: Record<string, string> = {
  REGION: 'Location',
  CURRENT_TITLE: 'Current job title',
  PAST_TITLE: 'Past job title',
  CURRENT_COMPANY: 'Current company',
  PAST_COMPANY: 'Past company',
  YEARS_AT_CURRENT_COMPANY: 'Years in current company',
  YEARS_OF_EXPERIENCE: 'Years of experience',
  SCHOOL: 'School',
};

const SUMMARY_ORDER = [
  'Current company',
  'Current job title',
  'Past job title',
  'Past company',
  'Location',
  'Years in current company',
  'Years of experience',
  'School',
  'Industry',
  'Company industry',
  'Company size',
  'Company headcount',
  'Company HQ',
  'Keywords',
  'Profile language',
];

export function generateSearchSummary(parsedUrl: ParsedSalesNavigatorUrl): SearchSummary {
  if (!parsedUrl.isSalesNavigatorSearchPage) {
    return {
      title: 'Unsupported page',
      description: 'Open a LinkedIn Sales Navigator search page to generate a summary.',
      filterSummaries: [],
    };
  }

  const searchTypeLabel = parsedUrl.searchType === 'account' ? 'Account search' : 'Lead search';
  const filterSummaries = buildGroupedFilterSummaries(parsedUrl.queryParameters);

  if (filterSummaries.length === 0) {
    return {
      title: searchTypeLabel,
      description: 'No filters detected in the URL.',
      filterSummaries: [],
    };
  }

  const visibleFilters = filterSummaries.slice(0, MAX_FILTER_SUMMARIES);
  const hiddenFilterCount = filterSummaries.length - visibleFilters.length;
  const description = hiddenFilterCount > 0
    ? `${visibleFilters.join('\n')}\n+${hiddenFilterCount} more`
    : visibleFilters.join('\n');

  return {
    title: searchTypeLabel,
    description,
    filterSummaries,
  };
}
function buildGroupedFilterSummaries(parameters: ParsedQueryParameter[]) {
  const groups = new Map<string, string[]>();

  for (const parameter of parameters) {
    for (const rawValue of parameter.values) {
      const decoded = safeDecode(rawValue).trim();
      if (!decoded) continue;

      // If this decoded value contains a filters:List blob, parse it robustly
      if (decoded.includes('filters:List') || looksLikeLinkedInFilterBlob(decoded)) {
        const filterBlocks = parseLinkedInFilterBlocks(decoded);

        for (const { type, textValues } of filterBlocks) {
          const label = TYPE_LABELS[type] ?? toTitleCase(type.toLowerCase());
          if (!groups.has(label)) groups.set(label, []);
          groups.set(label, [...groups.get(label)!, ...textValues]);
        }

        continue;
      }

      // Non-blob values — attribute to the parameter key
      const label = PARAMETER_LABELS[parameter.key] ?? toTitleCase(parameter.key);
      const valueText = formatParameterValue(decoded);
      if (!valueText) continue;
      if (!groups.has(label)) groups.set(label, []);
      groups.set(label, [...groups.get(label)!, valueText]);
    }
  }

  // Build summary lines per category
  const summaries: Array<{ label: string; text: string }> = [];
  for (const [label, values] of groups.entries()) {
    const unique = Array.from(new Set(values)).filter(Boolean);
    if (unique.length === 0) continue;

    const display = unique.length > 2
      ? `${unique.slice(0, 2).join(', ')}, +${unique.length - 2}`
      : unique.join(', ');

    summaries.push({ label, text: display });
  }

  summaries.sort((a, b) => {
    const aIndex = SUMMARY_ORDER.indexOf(a.label);
    const bIndex = SUMMARY_ORDER.indexOf(b.label);

    if (aIndex !== -1 && bIndex !== -1) {
      return aIndex - bIndex;
    }
    if (aIndex !== -1) {
      return -1;
    }
    if (bIndex !== -1) {
      return 1;
    }
    return a.label.localeCompare(b.label);
  });

  return summaries.map(({ label, text }) => `${label}:\n${text}`);
}

function formatParameterValue(value: string) {
  const decodedValue = safeDecode(value).trim();

  if (!decodedValue) {
    return '';
  }

  const extractedNames = extractLinkedInFilterNames(decodedValue);

  if (extractedNames.length > 0) {
    return extractedNames.join(', ');
  }

  if (looksLikeLinkedInFilterBlob(decodedValue)) {
    return 'LinkedIn filter values detected';
  }

  return truncate(decodedValue, MAX_VALUE_LENGTH);
}

function extractLinkedInFilterNames(value: string) {
  const names = Array.from(value.matchAll(/text:([^,)]+)/g)).map((match) => match[1]?.trim()).filter(Boolean);
  return Array.from(new Set(names));
}

function parseLinkedInFilterBlocks(value: string) {
  const blocks: Array<{ type: string; textValues: string[] }> = [];
  const regex = /type:([A-Z_]+),values:List\(\(/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(value)) !== null) {
    const type = match[1];
    let index = match.index + match[0].length;
    let depth = 2;
    let end = index;

    while (end < value.length && depth > 0) {
      if (value[end] === '(') {
        depth += 1;
      } else if (value[end] === ')') {
        depth -= 1;
      }
      end += 1;
    }

    const blockText = value.slice(index, Math.max(index, end - 2));
    const textValues = Array.from(blockText.matchAll(/text:([^,)]+)/g))
      .map((m) => safeDecode(m[1]).trim())
      .filter(Boolean);

    if (textValues.length > 0) {
      blocks.push({ type, textValues });
    }

    regex.lastIndex = end;
  }

  return blocks;
}

function looksLikeLinkedInFilterBlob(value: string) {
  return value.includes('List(') || value.includes('urn:li:') || value.includes('includedValues');
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '));
  } catch {
    return value;
  }
}

function toTitleCase(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1)}…`;
}
