import { createStep } from '@mastra/core/workflows';

import {
  FinalOutput,
  ToTranslate,
  TranslatorQuestion,
  TranslatorResume,
  TranslatorSuspend,
  Translations,
  WithLanguages,
} from '../../schemas/pipeline';

/**
 * Вопрос переводчика: «на какие языки перевести финальную версию?» —
 * формулируется translator-агентом на языке диалога, шаг suspend'ится;
 * resume с пустым списком языков → повторный suspend с тем же вопросом.
 */
export const translatorAskStep = createStep({
  id: 'translator-ask',
  inputSchema: ToTranslate,
  outputSchema: WithLanguages,
  resumeSchema: TranslatorResume,
  suspendSchema: TranslatorSuspend,
  execute: async ({ inputData, resumeData, suspendData, suspend, mastra }) => {
    const languages = resumeData?.targetLanguages?.map(l => l.trim()).filter(Boolean) ?? [];
    if (languages.length > 0) {
      return { ...inputData, targetLanguages: languages };
    }

    let question = suspendData?.question;
    if (!question) {
      const agent = mastra.getAgent('translatorAgent');
      const res = await agent.generate(
        `Dialogue language: ${inputData.language}. Ask the user which languages ` +
          `the final version of the task should be translated into. Output only the question.`,
        {
          memory: { thread: inputData.threadId, resource: inputData.resource },
          structuredOutput: { schema: TranslatorQuestion },
        },
      );
      question = res.object.question;
    }
    return await suspend({ question, language: inputData.language });
  },
});

/** Перевод финального пакета на все запрошенные языки одним вызовом. */
export const translateStep = createStep({
  id: 'translate',
  inputSchema: WithLanguages,
  outputSchema: FinalOutput,
  execute: async ({ inputData, mastra }) => {
    const agent = mastra.getAgent('translatorAgent');
    const res = await agent.generate(
      `Translate the final task package into these languages: ${inputData.targetLanguages.join(', ')}.\n` +
        `Dialogue language of the package: ${inputData.language}.\n` +
        `Preserve structure exactly (SMART fields, As a/I want/so that, ` +
        `When/I want to/so I can, every Given/When/Then scenario with its cut). ` +
        `Output only translation content per language.\n\n` +
        `PACKAGE:\n${JSON.stringify(inputData.package, null, 2)}`,
      {
        memory: { thread: inputData.threadId, resource: inputData.resource },
        structuredOutput: { schema: Translations },
      },
    );
    return { package: inputData.package, translations: res.object.translations };
  },
});
