import { NODE_META, type ScoreNode } from '@/entities/task/model/nodes';
export type NodeKey = ScoreNode;
export function fallbackQuestion(node: NodeKey): string { return NODE_META[node].question; }
