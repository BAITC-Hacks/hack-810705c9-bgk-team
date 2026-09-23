"use client";

import { useEffect, useRef, useState } from "react";
import {
  createBrowserRecognition,
  createSpeechController,
  INITIAL_SPEECH_STATE,
  speechIsBusy,
} from "@/shared/lib/speech-recognition";

export function useSpeechInput(contextKey: string, onFinal: (text: string) => void) {
  const onFinalRef = useRef(onFinal);
  const [state, setState] = useState(INITIAL_SPEECH_STATE);
  const [controller] = useState(() => createSpeechController({
    createRecognition: createBrowserRecognition,
    onState: setState,
    onFinal: (text) => onFinalRef.current(text),
  }));

  useEffect(() => { onFinalRef.current = onFinal; }, [onFinal]);

  useEffect(() => {
    function onVisibilityChange() {
      if (document.hidden && speechIsBusy(controller.getState())) {
        controller.cancel("Диктовка остановлена при переключении вкладки. Уже добавленный текст сохранён.");
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      controller.cancel();
    };
  }, [controller, contextKey]);

  return { ...state, busy: speechIsBusy(state), start: controller.start, stop: controller.stop };
}
