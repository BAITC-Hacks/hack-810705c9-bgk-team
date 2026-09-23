"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import styles from "./onboarding.module.css";

export function OnboardingVideo() {
  const video = useRef<HTMLVideoElement>(null);
  const manuallyPaused = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    const element = video.current;
    if (!element) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const desktop = window.matchMedia("(min-width: 761px)");
    const syncPlayback = () => {
      if (!desktop.matches) {
        element.pause();
        return;
      }
      element.poster = "/ai-sana-onboarding-poster.webp";
      if (motion.matches) {
        element.pause();
        return;
      }
      if (!element.getAttribute("src"))
        element.src = "/ai_sana_onboarding_video.mp4";
      if (!element.ended && !manuallyPaused.current)
        void element.play().catch(() => {});
    };
    syncPlayback();
    motion.addEventListener("change", syncPlayback);
    desktop.addEventListener("change", syncPlayback);
    return () => {
      motion.removeEventListener("change", syncPlayback);
      desktop.removeEventListener("change", syncPlayback);
    };
  }, []);

  return (
    <div className={styles.media}>
      <video
        ref={video}
        className={styles.video}
        aria-hidden="true"
        muted
        playsInline
        preload="none"
        disablePictureInPicture
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setFinished(true);
        }}
        onError={() => setFinished(true)}
      />
      {!finished && (
        <button
          type="button"
          className={styles.videoControl}
          onClick={() => {
            if (!video.current) return;
            manuallyPaused.current = playing;
            if (playing) video.current.pause();
            else {
              if (!video.current.getAttribute("src"))
                video.current.src = "/ai_sana_onboarding_video.mp4";
              void video.current.play().catch(() => {});
            }
          }}
          aria-label={playing ? "Приостановить видео" : "Включить видео"}
        >
          {playing ? (
            <Pause size={14} aria-hidden="true" />
          ) : (
            <Play size={14} aria-hidden="true" />
          )}
        </button>
      )}
    </div>
  );
}
