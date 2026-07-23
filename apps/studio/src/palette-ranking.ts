/**
 * Subsequence matcher for the command palette. Scores contiguous runs,
 * word boundaries and early matches higher; returns undefined for no match.
 */
export function scoreMatch(query: string, candidate: string): number | undefined {
  const needle = query.trim().toLowerCase();
  if (!needle) return 0;
  const haystack = candidate.toLowerCase();

  const substringIndex = haystack.indexOf(needle);
  if (substringIndex >= 0) {
    const boundaryBonus = substringIndex === 0 || /[\s/·:：-]/.test(haystack[substringIndex - 1]!) ? 20 : 0;
    return 1000 - substringIndex + boundaryBonus;
  }

  let score = 0;
  let run = 0;
  let cursor = 0;
  for (const char of needle) {
    const found = haystack.indexOf(char, cursor);
    if (found < 0) return undefined;
    const atBoundary = found === 0 || /[\s/·:：-]/.test(haystack[found - 1]!);
    run = found === cursor ? run + 1 : 0;
    score += 10 + run * 5 + (atBoundary ? 15 : 0) - found * 0.1;
    cursor = found + 1;
  }
  return score;
}

export interface RankedItem<T> {
  item: T;
  score: number;
}

/**
 * Ranks items by fuzzy score against title + category, boosts recently used
 * entries (earlier in recentIds ranks higher) and keeps a stable order for ties.
 */
export function rankItems<T extends { id: string; title: string; category?: string }>(
  items: readonly T[],
  query: string,
  recentIds: readonly string[] = []
): T[] {
  const recentBoost = new Map(recentIds.map((id, index) => [id, (recentIds.length - index) * 2]));
  const ranked: RankedItem<T>[] = [];
  for (const item of items) {
    const haystacks = [item.title, `${item.category ?? ""} ${item.title}`];
    let best: number | undefined;
    for (const haystack of haystacks) {
      const score = scoreMatch(query, haystack);
      if (score !== undefined && (best === undefined || score > best)) best = score;
    }
    if (best === undefined) continue;
    ranked.push({ item, score: best + (recentBoost.get(item.id) ?? 0) });
  }
  return ranked.sort((left, right) => right.score - left.score).map(({ item }) => item);
}
