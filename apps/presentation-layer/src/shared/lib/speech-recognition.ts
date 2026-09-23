export type SpeechPhase = "idle" | "starting" | "listening" | "stopping" | "unsupported" | "error";

export type SpeechState = {
  phase: SpeechPhase;
  interim: string;
  message: string | null;
};

type RecognitionResult = {
  isFinal: boolean;
  readonly [index: number]: { transcript: string };
};

export type RecognitionResultEvent = {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
};

/** Minimal browser contract, including the prefixed implementation. */
export type BrowserRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: RecognitionResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

export const INITIAL_SPEECH_STATE: SpeechState = { phase: "idle", interim: "", message: null };

export function speechIsBusy(state: SpeechState) {
  return state.phase === "starting" || state.phase === "listening" || state.phase === "stopping";
}

function speechErrorMessage(code: string): string {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Браузер не разрешил голосовой ввод. Проверьте доступ к микрофону в настройках сайта и повторите.";
    case "audio-capture":
      return "Микрофон не найден или занят. Проверьте подключение и доступ к нему.";
    case "no-speech":
      return "Речь не распознана. Включите микрофон ещё раз и попробуйте говорить ближе к нему.";
    case "network":
      return "Сервис распознавания недоступен. Проверьте интернет или введите текст вручную.";
    case "language-not-supported":
      return "Распознавание русского языка недоступно в этом браузере. Введите текст вручную.";
    case "aborted":
      return "Голосовой ввод прерван. Уже добавленный текст сохранён.";
    default:
      return "Не удалось запустить голосовой ввод. Повторите попытку или введите текст вручную.";
  }
}

export function createBrowserRecognition(): BrowserRecognition | null {
  if (typeof window === "undefined") return null;
  const host = window as unknown as {
    SpeechRecognition?: new () => BrowserRecognition;
    webkitSpeechRecognition?: new () => BrowserRecognition;
  };
  const Recognition = host.SpeechRecognition ?? host.webkitSpeechRecognition;
  return Recognition ? new Recognition() : null;
}

export function appendVoiceTranscript(draft: string, transcript: string, limit = 4000): { text: string; remainder: string } {
  const text = transcript.trim();
  if (!text) return { text: draft, remainder: "" };
  const separator = draft && !/\s$/.test(draft) && !/^[.,!?;:)]/.test(text) ? " " : "";
  const next = draft + separator + text;
  return next.length <= limit ? { text: next, remainder: "" } : { text: draft, remainder: text };
}

type Options = {
  createRecognition: () => BrowserRecognition | null;
  onState: (state: SpeechState) => void;
  onFinal: (transcript: string) => void;
  scheduleFinish?: (callback: () => void) => () => void;
};

/** One explicit recording session at a time; late browser callbacks cannot cross sessions. */
export function createSpeechController({ createRecognition, onState, onFinal, scheduleFinish }: Options) {
  let state = INITIAL_SPEECH_STATE;
  let recognition: BrowserRecognition | null = null;
  let generation = 0;
  let cancelFinish: (() => void) | null = null;
  const schedule = scheduleFinish ?? ((callback: () => void) => {
    const timer = setTimeout(callback, 2500);
    return () => clearTimeout(timer);
  });

  function update(next: SpeechState) {
    state = next;
    onState(next);
  }

  function release(abort: boolean) {
    generation += 1;
    cancelFinish?.();
    cancelFinish = null;
    const current = recognition;
    recognition = null;
    if (!current) return;
    current.onstart = null;
    current.onresult = null;
    current.onerror = null;
    current.onend = null;
    if (abort) {
      try { current.abort(); } catch { /* The browser may already have ended the session. */ }
    }
  }

  function fail(message: string) {
    release(true);
    update({ phase: "error", interim: "", message });
  }

  return {
    getState: () => state,
    setOnFinal(listener: (transcript: string) => void) { onFinal = listener; },
    start() {
      if (speechIsBusy(state)) return;
      release(true);
      let current: BrowserRecognition | null;
      try { current = createRecognition(); } catch {
        fail(speechErrorMessage("start-failed"));
        return;
      }
      if (!current) {
        update({ phase: "unsupported", interim: "", message: "Голосовой ввод недоступен в этом браузере. Введите текст вручную или откройте приложение в браузере с поддержкой распознавания речи." });
        return;
      }
      recognition = current;
      const session = ++generation;
      const isCurrent = () => recognition === current && generation === session;
      const finalIndexes = new Set<number>();
      let finalCount = 0;
      current.lang = "ru-RU";
      current.continuous = true;
      current.interimResults = true;
      current.maxAlternatives = 1;
      current.onstart = () => {
        if (isCurrent() && state.phase === "starting") {
          update({ phase: "listening", interim: "", message: "Слушаю… Нажмите стоп, когда закончите." });
        }
      };
      current.onresult = (event) => {
        if (!isCurrent()) return;
        const interim: string[] = [];
        for (let index = 0; index < event.results.length; index += 1) {
          const result = event.results[index];
          const text = result[0]?.transcript?.trim() ?? "";
          if (result.isFinal) {
            if (finalIndexes.has(index)) continue;
            finalIndexes.add(index);
            if (text) {
              finalCount += 1;
              onFinal(text);
            }
          } else if (text) interim.push(text);
        }
        update({ ...state, interim: interim.join(" ") });
      };
      current.onerror = (event) => {
        if (isCurrent()) fail(speechErrorMessage(event.error));
      };
      current.onend = () => {
        if (!isCurrent()) return;
        release(false);
        update({ phase: finalCount ? "idle" : "error", interim: "", message: finalCount ? "Текст добавлен. Проверьте его и отправьте, когда будете готовы." : speechErrorMessage("no-speech") });
      };
      update({ phase: "starting", interim: "", message: "Запускаем микрофон…" });
      try { current.start(); } catch (error) {
        const name = error instanceof Error ? error.name : "";
        fail(speechErrorMessage(name === "NotAllowedError" || name === "SecurityError" ? "not-allowed" : name === "NotFoundError" ? "audio-capture" : "start-failed"));
      }
    },
    stop() {
      if (!recognition || !speechIsBusy(state) || state.phase === "stopping") return;
      const session = generation;
      update({ ...state, phase: "stopping", message: "Завершаем распознавание…" });
      cancelFinish = schedule(() => {
        if (generation === session) fail("Не удалось завершить распознавание. Уже добавленный текст сохранён; проверьте последние слова.");
      });
      try { recognition.stop(); } catch {
        fail("Не удалось завершить голосовой ввод. Уже добавленный текст сохранён.");
      }
    },
    cancel(message: string | null = null) {
      release(true);
      update({ phase: "idle", interim: "", message });
    },
  };
}
