"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  requestError,
  workspaceApi,
  type WorkspaceSnapshot,
} from "@/entities/workspace/api";
import { OnboardingForm, OnboardingShell } from "@/features/onboarding";

export default function OnboardingPage() {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    workspaceApi
      .load()
      .then((value) => {
        if (active) setSnapshot(value);
      })
      .catch((failure) => {
        if (active) setError(requestError(failure));
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  return (
    <OnboardingShell>
      {snapshot ? (
        <OnboardingForm
          teams={snapshot.teams}
          session={snapshot.session}
          business={snapshot.business}
          onComplete={async () => {
            router.replace("/");
          }}
        />
      ) : (
        <div className="my-16 space-y-4" role={error ? "alert" : "status"}>
          <h1 className="text-2xl font-semibold">
            {error
              ? "Не удалось загрузить профиль"
              : "Готовим ваше пространство…"}
          </h1>
          {error && (
            <>
              <p className="text-sm text-[#746e64]">{error}</p>
              <button
                className="rounded-lg bg-[#29251f] px-5 py-3 text-sm text-white"
                onClick={() => {
                  setError("");
                  setAttempt((value) => value + 1);
                }}
              >
                Попробовать снова
              </button>
            </>
          )}
        </div>
      )}
    </OnboardingShell>
  );
}
