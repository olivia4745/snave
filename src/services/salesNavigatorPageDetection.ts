export type SalesNavigatorPageType = 'lead-search' | 'account-search' | 'unsupported';

export type SalesNavigatorPageDetection = {
  isSalesNavigatorSearchPage: boolean;
  pageType: SalesNavigatorPageType;
};

const SALES_NAVIGATOR_HOSTNAME = 'www.linkedin.com';
const LEAD_SEARCH_PATH_PREFIX = '/sales/search/people';
const ACCOUNT_SEARCH_PATH_PREFIX = '/sales/search/company';

export function detectSalesNavigatorPage(url: string | undefined): SalesNavigatorPageDetection {
  if (!url) {
    return unsupportedPage();
  }

  try {
    const parsedUrl = new URL(url);

    if (parsedUrl.hostname !== SALES_NAVIGATOR_HOSTNAME) {
      return unsupportedPage();
    }

    if (parsedUrl.pathname.startsWith(LEAD_SEARCH_PATH_PREFIX)) {
      return { isSalesNavigatorSearchPage: true, pageType: 'lead-search' };
    }

    if (parsedUrl.pathname.startsWith(ACCOUNT_SEARCH_PATH_PREFIX)) {
      return { isSalesNavigatorSearchPage: true, pageType: 'account-search' };
    }

    return unsupportedPage();
  } catch {
    return unsupportedPage();
  }
}

function unsupportedPage(): SalesNavigatorPageDetection {
  return { isSalesNavigatorSearchPage: false, pageType: 'unsupported' };
}
