function validDomain(domain) {
  return /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(domain);
}

export function normalizeDomainInput(input) {
  if (typeof input !== 'string') return null;
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
