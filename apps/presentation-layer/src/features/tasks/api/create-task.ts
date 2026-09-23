import type { DemoActor } from '@/shared/api/demo-actor';
import { forbidden } from '@/shared/api/errors';
import type { AnalyzeTextOutput } from '@/shared/api/ports';
import { getAiPort } from '@/shared/api/ports';
import { ruleBasedAnalyze } from '@/shared/api/store/rule-based-analyzer';
import { ALL_NODES } from '@/shared/api/store/nodes';
import { createId, store, toApiTask } from '@/shared/api/store';
import type { InternalField, InternalTask } from '@/shared/api/store/domain';
import { inMemoryTransaction } from '@/shared/db/transaction';
import type { CreateTaskRequest, CreateTaskResponse } from '@/shared/api/contracts/tasks';
import type { NodeId } from '@/shared/api/contracts/common';

/**
 * ADR-004 §4 + ADR-009 §6: черновик анализируется до открытия транзакции
 * (Mastra вне транзакции, ADR-003 §5), а первым шагом клиенту возвращается
 * checkpoint черновика — поля пишутся как `suggested`, баллы за них не
 * начисляются, пока бизнес не подтвердит сводку (`POST /grill/checkpoint`).
 *
 * INTEGRATION(ADR-004/005): реальный use-case перекладывает запись в
 * `task`/`task_field` Drizzle-транзакцией и создаёт `grill_session` по своей
 * схеме. Здесь — минимальная демонстрация контракта на in-memory store.
 */
export async function createTask(
  actor: DemoActor,
  request: CreateTaskRequest,
): Promise<CreateTaskResponse> {
  if (actor.role !== 'business' || !actor.businessId) {
    throw forbidden('Создавать задачу может только роль «бизнес».');
  }

  let fallbackUsed = false;
  let analysis: AnalyzeTextOutput;
  const aiPort = getAiPort();
  if (!aiPort) {
    fallbackUsed = true;
    analysis = {
      nodes: [],
      fields: ruleBasedAnalyze(request.draftText, ALL_NODES).map((f) => ({
        ...f,
        specificity: 1,
      })),
      roles: [],
      skills: [],
    };
  } else {
    try {
      analysis = await aiPort.analyzeText({
        text: request.draftText,
        targetNodes: ALL_NODES,
        dictionary: { roles: [], skills: [] },
      });
    } catch {
      fallbackUsed = true;
      analysis = {
        nodes: [],
        fields: ruleBasedAnalyze(request.draftText, ALL_NODES).map((f) => ({
          ...f,
          specificity: 1,
        })),
        roles: [],
        skills: [],
      };
    }
  }

  return inMemoryTransaction(async () => {
    const id = createId('task');
    const title =
      request.draftText.split(/[\n.!?]/, 1)[0]?.trim().slice(0, 80) || 'Новая задача';

    const fields = new Map<NodeId, InternalField>();
    for (const extracted of analysis.fields) {
      // AI-6/ADR-003 §4: BFF повторно проверяет цитату по сохранённому тексту.
      if (!request.draftText.includes(extracted.sourceQuote)) continue;
      fields.set(extracted.node, {
        node: extracted.node,
        value: extracted.value,
        state: 'suggested',
        notApplicable: false,
        source: 'draft',
        sourceQuote: extracted.sourceQuote,
      });
    }

    const task: InternalTask = {
      id,
      businessId: actor.businessId!,
      title,
      topic: request.topic,
      draftText: request.draftText,
      status: 'draft',
      format: request.format,
      paymentTerms: request.paymentTerms,
      neededRoles: [],
      neededSkills: [],
      tagsState: 'empty',
      fields,
      criteria: [1, 2, 3].map((position) => ({
        id: createId('criterion'),
        position: position as 1 | 2 | 3,
        metric: '',
        threshold: '',
        thresholdHasNumber: false,
        howToCheck: '',
        state: 'empty',
      })),
      criteriaVersion: 1,
      createdAt: new Date().toISOString(),
    };

    store.tasks.set(id, task);
    store.sessions.set(id, {
      taskId: id,
      status: 'active',
      currentNode: null,
      currentBlock: 'context',
      pushbacks: {},
      questionsAsked: 0,
      version: 0,
      dataNoneBranch: false,
    });
    store.turns.set(id, []);

    return {
      task: toApiTask(task),
      draftSummary: {
        block: 'draft' as const,
        quotes: [...fields.values()]
          .filter((field) => field.sourceQuote)
          .map((field) => ({ node: field.node, quote: field.sourceQuote! })),
      },
      fallbackUsed,
    };
  });
}
