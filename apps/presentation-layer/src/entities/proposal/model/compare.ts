import type { CriteriaAnswers } from "@/shared/db/schema";

// FR-7.1, FR-7.2: список откликов по fit без скрытия и матрица «критерии × команды».
// Сортирует код, не AI (ADR-007, п.7).

export const PARTIAL_MATCH_THRESHOLD = 0.5;

export type CompareCriterion = { id: string; metric: string; threshold: string };

export type ProposalLike = {
  id: string;
  teamId: string;
  fit: number;
  createdAt: Date | string;
  criteriaAnswers: CriteriaAnswers;
};

export type ComparedProposal<P extends ProposalLike> = P & {
  partialMatch: boolean;
  versionMismatch: boolean;
};

export type CompareMatrix = {
  criteria: CompareCriterion[];
  rows: {
    criterionId: string;
    cells: { proposalId: string; answer: string | null; versionMismatch: boolean }[];
  }[];
};

export type CompareResult<P extends ProposalLike> = {
  items: ComparedProposal<P>[];
  matrix: CompareMatrix;
};

function createdAtMs(value: Date | string): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

export function compareProposals<P extends ProposalLike>(
  criteria: CompareCriterion[],
  currentCriteriaVersion: number,
  proposals: P[],
): CompareResult<P> {
  const sorted = [...proposals].sort((a, b) => {
    if (b.fit !== a.fit) return b.fit - a.fit;
    return createdAtMs(a.createdAt) - createdAtMs(b.createdAt);
  });

  const items: ComparedProposal<P>[] = sorted.map((proposal) => ({
    ...proposal,
    partialMatch: proposal.fit < PARTIAL_MATCH_THRESHOLD,
    versionMismatch: proposal.criteriaAnswers.criteriaVersion !== currentCriteriaVersion,
  }));

  const rows = criteria.map((criterion) => ({
    criterionId: criterion.id,
    cells: items.map((proposal) => ({
      proposalId: proposal.id,
      answer: proposal.criteriaAnswers.answers[criterion.id] ?? null,
      versionMismatch: proposal.versionMismatch,
    })),
  }));

  return { items, matrix: { criteria, rows } };
}
