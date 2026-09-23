import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  appendVoiceTranscript,
  createSpeechController,
  speechIsBusy,
  type BrowserRecognition,
  type RecognitionResultEvent,
  type SpeechState,
} from "./speech-recognition";

class FakeRecognition implements BrowserRecognition {
  lang = "";
  continuous = false;
  interimResults = false;
  maxAlternatives = 0;
  onstart: BrowserRecognition["onstart"] = null;
  onresult: BrowserRecognition["onresult"] = null;
  onerror: BrowserRecognition["onerror"] = null;
  onend: BrowserRecognition["onend"] = null;
  starts = 0;
  stops = 0;
  aborts = 0;
  startError: Error | null = null;
  start() { this.starts += 1; if (this.startError) throw this.startError; }
  stop() { this.stops += 1; }
  abort() { this.aborts += 1; }
}

function results(...items: [string, boolean][]): RecognitionResultEvent {
  return { resultIndex: 0, results: items.map(([transcript, isFinal]) => ({ 0: { transcript }, isFinal })) };
}

function harness(factory?: () => BrowserRecognition | null) {
  const recognizers: FakeRecognition[] = [];
  const finalized: string[] = [];
  const states: SpeechState[] = [];
  let finish: (() => void) | null = null;
  const controller = createSpeechController({
    createRecognition: factory ?? (() => { const recognition = new FakeRecognition(); recognizers.push(recognition); return recognition; }),
    onFinal: (text) => finalized.push(text),
    onState: (state) => states.push(state),
    scheduleFinish: (callback) => { finish = callback; return () => { finish = null; }; },
  });
  return { controller, recognizers, finalized, states, finishTimeout: () => finish?.() };
}

describe("browser speech controller", () => {
  it("requires an explicit start, sets Russian, and rejects overlapping starts", () => {
    const { controller, recognizers } = harness();
    assert.equal(recognizers.length, 0);
    controller.start();
    controller.start();
    assert.equal(recognizers.length, 1);
    assert.equal(recognizers[0].starts, 1);
    assert.equal(recognizers[0].lang, "ru-RU");
    assert.equal(recognizers[0].continuous, true);
    assert.equal(recognizers[0].interimResults, true);
    assert.equal(controller.getState().phase, "starting");
    recognizers[0].onstart?.();
    assert.equal(controller.getState().phase, "listening");
    controller.cancel();
  });

  it("keeps interim separate and commits each final result once despite repeated cumulative events", () => {
    const { controller, recognizers, finalized } = harness();
    controller.start();
    const recognition = recognizers[0];
    recognition.onstart?.();
    recognition.onresult?.(results(["Нужно", false]));
    assert.deepEqual(finalized, []);
    assert.equal(controller.getState().interim, "Нужно");
    recognition.onresult?.(results(["Нужно улучшить", true], ["данные", false]));
    recognition.onresult?.(results(["Нужно улучшить", true], ["данные", false]));
    recognition.onresult?.(results(["Нужно улучшить", true], ["данные", true]));
    assert.deepEqual(finalized, ["Нужно улучшить", "данные"]);
    assert.equal(controller.getState().interim, "");
    recognition.onend?.();
    assert.equal(controller.getState().phase, "idle");
    assert.match(controller.getState().message ?? "", /Проверьте его и отправьте/);
    assert.equal(recognizers.length, 1);
  });

  it("waits for queued finals after stop and ignores late callbacks from cancelled sessions", () => {
    const { controller, recognizers, finalized } = harness();
    controller.start();
    const first = recognizers[0];
    first.onstart?.();
    controller.stop();
    controller.stop();
    assert.equal(first.stops, 1);
    assert.equal(controller.getState().phase, "stopping");
    assert.equal(speechIsBusy(controller.getState()), true);
    first.onresult?.(results(["Последняя фраза", true]));
    const staleResult = first.onresult;
    const staleEnd = first.onend;
    controller.cancel();
    assert.equal(first.aborts, 1);
    assert.equal(first.onresult, null);
    controller.start();
    staleResult?.(results(["Не должно попасть в новую задачу", true]));
    staleEnd?.();
    assert.deepEqual(finalized, ["Последняя фраза"]);
    assert.equal(controller.getState().phase, "starting");
    recognizers[1].onresult?.(results(["Новая фраза", true]));
    assert.deepEqual(finalized, ["Последняя фраза", "Новая фраза"]);
    controller.cancel();
  });

  it("unlocks editing after a missing end event and never restarts automatically", () => {
    const { controller, recognizers, finishTimeout } = harness();
    controller.start();
    controller.stop();
    finishTimeout();
    assert.equal(speechIsBusy(controller.getState()), false);
    assert.equal(controller.getState().phase, "error");
    assert.equal(recognizers[0].aborts, 1);
    assert.equal(recognizers.length, 1);
  });

  it("shows an unsupported message without throwing or starting another service", () => {
    const { controller } = harness(() => null);
    controller.start();
    assert.equal(controller.getState().phase, "unsupported");
    assert.match(controller.getState().message ?? "", /недоступен в этом браузере/);
  });

  it("retains error guidance after permission, microphone, speech, network and language failures", () => {
    for (const code of ["not-allowed", "audio-capture", "no-speech", "network", "language-not-supported"]) {
      const { controller, recognizers } = harness();
      controller.start();
      const staleEnd = recognizers[0].onend;
      recognizers[0].onerror?.({ error: code });
      const errorState = controller.getState();
      staleEnd?.();
      assert.equal(errorState.phase, "error");
      assert.ok(errorState.message);
      assert.equal(controller.getState(), errorState);
      assert.equal(recognizers[0].aborts, 1);
      assert.equal(speechIsBusy(errorState), false);
    }
  });

  it("recovers from a synchronous start failure", () => {
    const recognition = new FakeRecognition();
    recognition.startError = Object.assign(new Error("denied"), { name: "NotAllowedError" });
    const { controller } = harness(() => recognition);
    controller.start();
    assert.equal(controller.getState().phase, "error");
    assert.match(controller.getState().message ?? "", /доступ к микрофону/);
    assert.equal(recognition.aborts, 1);
  });
});

describe("voice draft insertion", () => {
  it("preserves the typed draft and supports multiple phrases and trailing newlines", () => {
    assert.deepEqual(appendVoiceTranscript("Мой черновик", " новая фраза "), { text: "Мой черновик новая фраза", remainder: "" });
    assert.deepEqual(appendVoiceTranscript("Мой черновик\n", "Дальше"), { text: "Мой черновик\nДальше", remainder: "" });
    assert.deepEqual(appendVoiceTranscript("Сохранить", ""), { text: "Сохранить", remainder: "" });
  });

  it("keeps a phrase that exceeds the limit separate instead of truncating or losing it", () => {
    const draft = "x".repeat(3995);
    assert.deepEqual(appendVoiceTranscript(draft, "остаток текста"), { text: draft, remainder: "остаток текста" });
    assert.equal(appendVoiceTranscript("x".repeat(3998), "я").text.length, 4000);
  });
});
