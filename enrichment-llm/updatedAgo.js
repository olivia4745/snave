const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export function formatUpdatedAgo(cachedAt, now = new Date()) {
  const updatedAt = new Date(cachedAt);
  if (Number.isNaN(updatedAt.getTime()) || Number.isNaN(now.getTime())) return null;

  const updatedDay = Date.UTC(updatedAt.getFullYear(), updatedAt.getMonth(), updatedAt.getDate());
  const currentDay = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const daysAgo = Math.floor((currentDay - updatedDay) / MILLISECONDS_PER_DAY);

  if (daysAgo < 0) return null;
  if (daysAgo === 0) return 'Updated today';
  return `Updated ${daysAgo} day${daysAgo === 1 ? '' : 's'} ago`;
}
