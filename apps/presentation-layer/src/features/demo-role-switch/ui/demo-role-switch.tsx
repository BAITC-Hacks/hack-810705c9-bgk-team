"use client";

import { useState, useTransition } from "react";

import { Badge } from "@/shared/components/ui/badge";
import { NativeSelect, NativeSelectOption } from "@/shared/components/ui/native-select";
import { DEMO_BUSINESSES, DEMO_TEAMS } from "@/shared/config/demo-actors";
import {
  demoActorId,
  isDemoRole,
  isDemoView,
  type DemoActor,
  type DemoRole,
  type DemoView,
} from "@/shared/lib/demo-actor";

import { switchDemoRole, type SwitchDemoRoleInput } from "../api/switch-demo-role";

const ACTORS: Record<DemoRole, readonly { id: string; name: string }[]> = {
  business: DEMO_BUSINESSES,
  team: DEMO_TEAMS,
};

type Props = { actor: DemoActor; view: DemoView };

/** ADR-008: компактный переключатель роли, участника и вида. Значения — из cookie на сервере. */
export function DemoRoleSwitch({ actor, view }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const actorId = demoActorId(actor);

  function submit(input: SwitchDemoRoleInput) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await switchDemoRole(input);
        if (!result.ok) setError(result.error);
      } catch {
        setError("Не удалось переключить роль");
      }
    });
  }

  return (
    <div
      role="region"
      aria-label="Демо-роль"
      aria-busy={pending}
      className="fixed bottom-3 left-3 z-50 flex max-w-[calc(100vw-1.5rem)] flex-wrap items-center gap-2 rounded-2xl border bg-card/95 p-2 text-xs shadow-lg shadow-black/5 backdrop-blur sm:bottom-4 sm:left-4"
    >
      <Badge variant="outline" title="Cookie можно подделать. Только для локального демо.">
        Демо · без авторизации
      </Badge>
      <NativeSelect
        size="sm"
        aria-label="Роль"
        value={actor.role}
        disabled={pending}
        onChange={(event) => {
          const role = event.target.value;
          if (isDemoRole(role)) submit({ role, actorId: ACTORS[role][0].id });
        }}
      >
        <NativeSelectOption value="business">Бизнес</NativeSelectOption>
        <NativeSelectOption value="team">Команда</NativeSelectOption>
      </NativeSelect>
      <NativeSelect
        size="sm"
        aria-label={actor.role === "business" ? "Бизнес" : "Команда"}
        value={actorId}
        disabled={pending}
        onChange={(event) => submit({ role: actor.role, actorId: event.target.value })}
      >
        {ACTORS[actor.role].map((item) => (
          <NativeSelectOption key={item.id} value={item.id}>
            {item.name}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      {actor.role === "team" && (
        <NativeSelect
          size="sm"
          aria-label="Вид рекомендаций"
          value={view}
          disabled={pending}
          onChange={(event) => {
            const next = event.target.value;
            if (isDemoView(next)) submit({ role: actor.role, actorId, view: next });
          }}
        >
          <NativeSelectOption value="deck">Колода</NativeSelectOption>
          <NativeSelectOption value="grid">Сетка</NativeSelectOption>
        </NativeSelect>
      )}
      {error && (
        <span role="alert" className="text-destructive">
          {error}
        </span>
      )}
    </div>
  );
}
