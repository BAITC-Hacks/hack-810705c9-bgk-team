import { score } from '@/entities/task';
import { db } from '@/shared/db';
import { loadScoreCard } from './load-score-card';
export async function openBlocksOf(ids: string[]): Promise<Map<string, string[]>> {
  return new Map(await Promise.all(ids.map(async id => {
    const card = await loadScoreCard(db, id);
    return [id, card ? [...new Set(score(card).missing.map(item => item.node.split('.')[0]))] : []] as const;
  })));
}
