"use client";

import type { ReactNode } from "react";
import { AiSanaLogo } from "@/shared/components/ai-sana-logo";
import { OnboardingVideo } from "./onboarding-video";
import { OnboardingForm } from "./onboarding-form";
import type { WorkspaceSnapshot } from "@/entities/workspace/api";
import styles from "./onboarding.module.css";

export function OnboardingShell({ children }: { children: ReactNode }) {
  return (
    <main className={styles.page}>
      <OnboardingVideo />
      <div className={styles.panel}>
        <AiSanaLogo className="h-auto w-28 shrink-0 text-[#29251f]" />
        {children}
        <p className="text-xs text-[#8b8377]">
          Бизнес-задачи и студенческие команды
        </p>
      </div>
    </main>
  );
}

export function OnboardingScreen({
  snapshot,
  onComplete,
}: {
  snapshot: WorkspaceSnapshot;
  onComplete: () => Promise<void>;
}) {
  return (
    <OnboardingShell>
      <OnboardingForm
        teams={snapshot.teams}
        session={snapshot.session}
        business={snapshot.business}
        onComplete={onComplete}
      />
    </OnboardingShell>
  );
}
