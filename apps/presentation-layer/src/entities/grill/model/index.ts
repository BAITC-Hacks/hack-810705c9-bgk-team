export const GRILL_BLOCKS = [
  'context',
  'result',
  'criteria',
  'data',
  'constraints',
  'users',
  'link',
] as const;

export type GrillBlock = (typeof GRILL_BLOCKS)[number] | 'draft';
export type GrillNode =
  | 'context.current' | 'context.size' | 'context.change'
  | 'result.artifact' | 'result.acceptance'
  | 'criteria.items'
  | 'data.what' | 'data.volume' | 'data.sample'
  | 'constraints.deadline' | 'constraints.stack' | 'constraints.other'
  | 'users.role' | 'users.scale'
  | 'link.contact' | 'link.cadence' | 'link.response';
export type GrillQuestionNode = GrillNode | 'data.collection' | 'result.profile';
export type FieldState = 'suggested' | 'confirmed';
export type Specificity = 'specific' | 'vague';

export type GrillField = {
  value: unknown;
  state: FieldState;
  notApplicable?: boolean;
  sourceQuote?: string;
};

export type GrillSessionState = {
  status: 'active' | 'finished';
  currentNode: GrillQuestionNode | null;
  currentBlock: GrillBlock | null;
  pushbacks: Partial<Record<GrillQuestionNode, 0 | 1>>;
  questionsAsked: number;
  version: number;
  askedNodes: GrillQuestionNode[];
  skippedNodes: GrillNode[];
};

export type GrillClassification = {
  specificity: Specificity;
  coveredNodes: GrillNode[];
  fields: Partial<Record<GrillNode, GrillField>>;
  notApplicable?: { node: GrillNode; note: string }[];
  dataUnavailable?: boolean;
  resultType?: 'bot' | 'model' | 'mockup' | 'report' | 'other';
};

export type NextStep =
  | { kind: 'question'; node: GrillQuestionNode; isPushback: boolean }
  | { kind: 'checkpoint'; block: GrillBlock }
  | { kind: 'done' };

export const GRILL_NODES: ReadonlyArray<{ node: GrillNode; block: Exclude<GrillBlock, 'draft'> }> = [
  { node: 'context.current', block: 'context' },
  { node: 'context.size', block: 'context' },
  { node: 'context.change', block: 'context' },
  { node: 'result.artifact', block: 'result' },
  { node: 'result.acceptance', block: 'result' },
  { node: 'criteria.items', block: 'criteria' },
  { node: 'data.what', block: 'data' },
  { node: 'data.volume', block: 'data' },
  { node: 'data.sample', block: 'data' },
  { node: 'constraints.deadline', block: 'constraints' },
  { node: 'constraints.stack', block: 'constraints' },
  { node: 'constraints.other', block: 'constraints' },
  { node: 'users.role', block: 'users' },
  { node: 'users.scale', block: 'users' },
  { node: 'link.contact', block: 'link' },
  { node: 'link.cadence', block: 'link' },
  { node: 'link.response', block: 'link' },
];

const hasField = (fields: Partial<Record<GrillNode, GrillField>>, node: GrillNode) => {
  const field = fields[node];
  return Boolean(field && (field.state === 'suggested' || field.state === 'confirmed'));
};

function profileTypeOf(value: unknown): GrillClassification['resultType'] | undefined {
  const candidate = typeof value === 'string'
    ? value.toLocaleLowerCase('ru')
    : value && typeof value === 'object' && 'type' in value && typeof value.type === 'string'
      ? value.type.toLocaleLowerCase('ru')
      : '';
  if (candidate.includes('бот')) return 'bot';
  if (candidate.includes('модел')) return 'model';
  if (candidate.includes('макет')) return 'mockup';
  if (candidate.includes('отчёт') || candidate.includes('отчет')) return 'report';
  return undefined;
}

/** Selects the next deterministic step. It has no I/O and does not mutate input. */
export function nextStep(
  session: GrillSessionState,
  fields: Partial<Record<GrillNode, GrillField>>,
  classification?: GrillClassification,
): NextStep {
  if (session.status === 'finished') return { kind: 'done' };

  const knownFields = { ...fields, ...(classification?.fields ?? {}) };
  const skipped = new Set(session.skippedNodes);
  if (classification?.dataUnavailable) {
    skipped.add('data.volume');
    skipped.add('data.sample');
  }
  const covered = new Set(classification?.coveredNodes ?? []);
  const pushbacks = { ...session.pushbacks };

  // A vague answer earns one clarification. The second vague answer is accepted as suggested.
  const vagueNode = session.currentNode && classification?.specificity === 'vague'
    ? session.currentNode
    : undefined;
  if (vagueNode && (pushbacks[vagueNode] ?? 0) === 0) {
    return { kind: 'question', node: vagueNode, isPushback: true };
  }

  // Supplemental turns are asked once and attached to their parent field, rather than
  // becoming independently scored card fields.
  if (classification?.dataUnavailable && !session.askedNodes.includes('data.collection')) {
    return { kind: 'question', node: 'data.collection', isPushback: false };
  }
  const resultType = classification?.resultType ?? profileTypeOf(knownFields['result.artifact']?.value);
  if (resultType && !session.askedNodes.includes('result.profile')) {
    return { kind: 'question', node: 'result.profile', isPushback: false };
  }

  const available = GRILL_NODES.filter(({ node }) =>
    !skipped.has(node) && !hasField(knownFields, node),
  );
  const firstBlock = GRILL_BLOCKS.find((block) =>
    available.some((entry) => entry.block === block),
  );

  if (session.currentBlock && session.currentBlock !== 'draft') {
    const currentBlockStillOpen = GRILL_NODES.some(({ node, block }) =>
      block === session.currentBlock && !skipped.has(node) && !hasField(knownFields, node),
    );
    if (!currentBlockStillOpen && firstBlock !== session.currentBlock) {
      return { kind: 'checkpoint', block: session.currentBlock };
    }
  }

  if (firstBlock) {
    const candidates = available.filter((entry) => entry.block === firstBlock);
    const unasked = candidates.find(({ node }) => !session.askedNodes.includes(node));
    // An unanswered node stays open even after the minimum; users may correct a
    // non-substantive answer, and can always leave via the finish action.
    const selected = unasked ?? candidates[0];
    if (selected) return { kind: 'question', node: selected.node, isPushback: false };
    return { kind: 'done' };
  }

  if (session.questionsAsked < 3) {
    const fallback = GRILL_NODES.find(({ node }) =>
      !skipped.has(node) && !covered.has(node) && !session.askedNodes.includes(node),
    );
    if (fallback) return { kind: 'question', node: fallback.node, isPushback: false };
  }
  return { kind: 'done' };
}

export function applyClassification(
  fields: Partial<Record<GrillNode, GrillField>>,
  classification: GrillClassification,
): Partial<Record<GrillNode, GrillField>> {
  const next = { ...fields };
  for (const node of classification.coveredNodes) {
    const field = classification.fields[node];
    // Fields without an attributable quote are not persisted.
    if (field && typeof field.sourceQuote === 'string' && field.sourceQuote.trim()) {
      next[node] = { ...field, state: 'suggested' };
    }
  }
  for (const item of classification.notApplicable ?? []) {
    if (item.note.trim()) {
      next[item.node] = {
        value: item.note,
        state: 'suggested',
        notApplicable: true,
        sourceQuote: item.note,
      };
    }
  }
  return next;
}

export function editField(field: GrillField, value: unknown): GrillField {
  return { ...field, value, state: 'suggested' };
}
