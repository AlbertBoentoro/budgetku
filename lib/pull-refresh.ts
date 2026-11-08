// A deliberate downward swipe at the top of the document triggers an
// in-app data refresh. Keep this math independent of browser globals so it
// can be regression-tested without a DOM or a live finance account.
export const PULL_REFRESH_THRESHOLD = 64;
export const PULL_REFRESH_MAX_DISTANCE = 112;

export function getPullRefreshDistance(
  startX: number,
  startY: number,
  currentX: number,
  currentY: number,
  scrollTop: number,
): number {
  const deltaY = currentY - startY;
  const deltaX = currentX - startX;
  if (!Number.isFinite(deltaY) || !Number.isFinite(deltaX)) return 0;
  if (scrollTop > 1 || deltaY <= 0 || Math.abs(deltaX) > Math.abs(deltaY)) {
    return 0;
  }
  // Damp the visual distance so a normal short tap/scroll does not refresh.
  return Math.min(PULL_REFRESH_MAX_DISTANCE, Math.round(deltaY * 0.65));
}

export function isPullRefreshReady(distance: number): boolean {
  return distance >= PULL_REFRESH_THRESHOLD;
}
