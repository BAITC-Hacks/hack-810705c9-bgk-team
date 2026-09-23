"use client";

import { useEffect, useState } from "react";
import {
  createBrowserRecognition,
  createSpeechController,
  INITIAL_SPEECH_STATE,
  speechIsBusy,
} from "@/shared/lib/speech-recognition";

export function useSpeechInput(contextKey: string, onFinal: (text: string) => void) {
  const [state, setState] = useState(INITIAL_SPEECH_STATE);
  const [controller] = useState(() => createSpeechController({
    createRecognition: createBrowserRecognition,
    onState: setState,
    onFinal,
  }));

  useEffect(() => { controller.setOnFinal(onFinal); }, [controller, onFinal]);

  useEffect(() => {
    function onVisibilityChange() {
      if (document.hidden && speechIsBusy(controller.getState())) {
        controller.cancel("Диктовка остановлена при переключении вкладки. Уже добавленный текст сохранён.");
      }
    }
    function onFocusIn(event: FocusEvent) {
      if (event.target instanceof Element && event.target.closest('[role="dialog"], [role="alertdialog"]') && speechIsBusy(controller.getState())) {
        controller.cancel("Диктовка остановлена при открытии окна. Уже добавленный текст сохранён.");
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      document.removeEventListener("focusin", onFocusIn);
      controller.cancel();
    };
  }, [controller, contextKey]);

  return { ...state, busy: speechIsBusy(state), start: controller.start, stop: controller.stop };
}
