"use client";

import { useId, useState, type FormEvent } from "react";
import { ChevronDown } from "@gravity-ui/icons";
import type { Team } from "@/entities/workspace";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Textarea } from "@/shared/components/ui/textarea";
import { cn } from "@/shared/lib/utils";

export type TeamPickerProps = {
  teams: Team[];
  activeTeamId: string;
  onTeamChange: (id: string) => void;
  onTeamSave: (team: Team) => void;
  points: number;
};

type TeamDraft = {
  name: string;
  tagline: string;
  members: string;
  skills: string;
  interests: string;
};

const EMPTY_DRAFT: TeamDraft = {
  name: "",
  tagline: "",
  members: "4",
  skills: "",
  interests: "",
};

function draftFromTeam(team: Team): TeamDraft {
  return {
    name: team.name,
    tagline: team.tagline,
    members: String(team.members),
    skills: team.skills.join(", "),
    interests: team.interests.join(", "),
  };
}

function parseList(value: string) {
  return [
    ...new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

function teamInitials(name: string) {
  const words = name.split(/\s+/).filter(Boolean);
  return (
    words.length > 1
      ? words
          .slice(0, 2)
          .map((word) => Array.from(word)[0])
          .join("")
      : Array.from(name).slice(0, 2).join("")
  ).toLocaleUpperCase("ru");
}

function memberCount(count: number) {
  return `${count} ${count >= 2 && count <= 4 ? "участника" : "участников"}`;
}

export function TeamPicker({
  teams,
  activeTeamId,
  onTeamChange,
  onTeamSave,
  points,
}: TeamPickerProps) {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(activeTeamId);
  const [mode, setMode] = useState<"browse" | "create" | "edit">("browse");
  const [draft, setDraft] = useState<TeamDraft>(EMPTY_DRAFT);
  const [error, setError] = useState("");
  const id = useId();
  const activeTeam = teams.find((team) => team.id === activeTeamId);
  const selectedTeam =
    teams.find((team) => team.id === selectedId) ?? activeTeam;
  const isActive = selectedTeam?.id === activeTeamId;

  function changeOpen(next: boolean) {
    if (next) {
      setSelectedId(activeTeamId);
      setMode("browse");
      setError("");
    }
    setOpen(next);
  }

  function startForm(nextMode: "create" | "edit") {
    setDraft(
      nextMode === "edit" && activeTeam
        ? draftFromTeam(activeTeam)
        : EMPTY_DRAFT,
    );
    setMode(nextMode);
    setError("");
  }

  function updateDraft(field: keyof TeamDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    setError("");
  }

  function saveTeam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = draft.name.trim();
    const members = Number(draft.members);
    const skills = parseList(draft.skills);
    const interests = parseList(draft.interests);

    if (name.length < 2 || name.length > 60) {
      setError("Название должно содержать от 2 до 60 символов.");
      return;
    }
    if (![3, 4, 5].includes(members)) {
      setError("Выберите от 3 до 5 участников.");
      return;
    }
    if (
      [skills, interests].some(
        (items) => items.length > 10 || items.some((item) => item.length > 50),
      )
    ) {
      setError(
        "Укажите до 10 навыков и интересов, каждый — не длиннее 50 символов.",
      );
      return;
    }

    const team: Team = {
      id: mode === "edit" && activeTeam ? activeTeam.id : crypto.randomUUID(),
      name,
      initials: teamInitials(name),
      tagline: draft.tagline.trim(),
      members,
      skills,
      interests,
      color: "#eeeeee",
    };
    onTeamSave(team);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <div className="flex min-w-0 items-center gap-3">
        <DialogTrigger asChild>
          <Button
            variant="outline"
            className="h-10 min-w-0 gap-3 px-3"
            aria-label={`Моя команда: ${activeTeam?.name ?? "Выбрать команду"}`}
          >
            <span className="hidden text-muted-foreground sm:inline">
              Моя команда
            </span>
            <span className="max-w-44 truncate">
              {activeTeam?.name ?? "Выбрать команду"}
            </span>
            <ChevronDown
              className="size-3.5 text-muted-foreground"
              aria-hidden="true"
            />
          </Button>
        </DialogTrigger>
        <span
          className="whitespace-nowrap text-xs text-muted-foreground"
          title="Баллы за подтверждённые бизнесом этапы"
        >
          {points} баллов
        </span>
      </div>

      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-5 overflow-y-auto p-6 sm:max-w-2xl">
        <DialogHeader className="gap-2 pr-6">
          <DialogTitle className="text-xl font-medium">
            {mode === "create"
              ? "Новая команда"
              : mode === "edit"
                ? "Профиль команды"
                : "Моя команда"}
          </DialogTitle>
          <DialogDescription>
            {mode === "browse"
              ? "Выбор команды для демо. Отклики и баллы сохраняются за каждой командой."
              : "Этот профиль будет виден бизнесу вместе с вашими откликами."}
          </DialogDescription>
        </DialogHeader>

        {mode === "browse" ? (
          <>
            <div className="grid min-h-64 gap-6 sm:grid-cols-[190px_minmax(0,1fr)]">
              <div
                className="max-h-64 space-y-1 overflow-y-auto sm:max-h-80"
                role="group"
                aria-label="Команды"
              >
                {teams.map((team) => (
                  <button
                    type="button"
                    key={team.id}
                    aria-pressed={team.id === selectedTeam?.id}
                    className={cn(
                      "w-full rounded-lg px-3 py-2.5 text-left outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
                      team.id === selectedTeam?.id && "bg-muted",
                    )}
                    onClick={() => setSelectedId(team.id)}
                  >
                    <span className="block truncate text-sm font-medium">
                      {team.name}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {memberCount(team.members)}
                      {team.id === activeTeamId ? " · текущая" : ""}
                    </span>
                  </button>
                ))}
              </div>

              {selectedTeam ? (
                <div className="flex min-w-0 flex-col border-t pt-5 sm:border-t-0 sm:border-l sm:pt-1 sm:pl-6">
                  <h3 className="break-words text-lg font-medium">
                    {selectedTeam.name}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {memberCount(selectedTeam.members)}
                    {isActive ? " · Ваша текущая команда" : ""}
                  </p>
                  <p className="mt-4 break-words text-sm leading-6 text-muted-foreground">
                    {selectedTeam.tagline ||
                      "Команда ещё не добавила описание."}
                  </p>
                  <dl className="mt-5 space-y-4 text-sm">
                    <div>
                      <dt className="font-medium">Навыки и технологии</dt>
                      <dd className="mt-1 break-words leading-6 text-muted-foreground">
                        {selectedTeam.skills.join(", ") || "Не указаны"}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-medium">Интересы</dt>
                      <dd className="mt-1 break-words leading-6 text-muted-foreground">
                        {selectedTeam.interests.join(", ") || "Не указаны"}
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-auto pt-6">
                    {isActive ? (
                      <Button
                        variant="outline"
                        className="h-9"
                        onClick={() => startForm("edit")}
                      >
                        Изменить профиль
                      </Button>
                    ) : (
                      <Button
                        className="h-9"
                        onClick={() => {
                          onTeamChange(selectedTeam.id);
                          setOpen(false);
                        }}
                      >
                        Выбрать команду
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <p className="py-4 text-sm text-muted-foreground">
                  Создайте команду, чтобы отправлять отклики.
                </p>
              )}
            </div>
            <div className="flex items-center justify-between border-t pt-4">
              <Button
                variant="ghost"
                className="-ml-2"
                onClick={() => startForm("create")}
              >
                Создать команду
              </Button>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Готово
              </Button>
            </div>
          </>
        ) : (
          <form onSubmit={saveTeam} className="space-y-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_160px]">
              <div className="space-y-1.5">
                <label htmlFor={`${id}-name`} className="text-sm font-medium">
                  Название команды{" "}
                  <span className="text-muted-foreground">*</span>
                </label>
                <Input
                  id={`${id}-name`}
                  value={draft.name}
                  onChange={(event) => updateDraft("name", event.target.value)}
                  maxLength={60}
                  placeholder="Например, Новая волна"
                  className="h-10"
                  autoFocus
                  required
                  aria-describedby={error ? `${id}-error` : undefined}
                />
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor={`${id}-members`}
                  className="text-sm font-medium"
                >
                  Участников
                </label>
                <Select
                  value={draft.members}
                  onValueChange={(value) => updateDraft("members", value)}
                >
                  <SelectTrigger id={`${id}-members`} className="h-10 w-full">
                    <SelectValue placeholder="Выберите" />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    {[3, 4, 5].map((count) => (
                      <SelectItem key={count} value={String(count)}>
                        {count}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label htmlFor={`${id}-tagline`} className="text-sm font-medium">
                О команде
              </label>
              <Textarea
                id={`${id}-tagline`}
                value={draft.tagline}
                onChange={(event) => updateDraft("tagline", event.target.value)}
                maxLength={300}
                placeholder="Что умеете и над чем хотите работать"
                className="min-h-20 resize-y"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor={`${id}-skills`} className="text-sm font-medium">
                Навыки и технологии
              </label>
              <Input
                id={`${id}-skills`}
                value={draft.skills}
                onChange={(event) => updateDraft("skills", event.target.value)}
                maxLength={500}
                placeholder="React, Python, UX-дизайн"
                className="h-10"
                aria-describedby={`${id}-list-hint`}
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor={`${id}-interests`}
                className="text-sm font-medium"
              >
                Интересы
              </label>
              <Input
                id={`${id}-interests`}
                value={draft.interests}
                onChange={(event) =>
                  updateDraft("interests", event.target.value)
                }
                maxLength={500}
                placeholder="Образование, ритейл, экология"
                className="h-10"
                aria-describedby={`${id}-list-hint`}
              />
              <p
                id={`${id}-list-hint`}
                className="text-xs text-muted-foreground"
              >
                Перечислите навыки и интересы через запятую.
              </p>
            </div>
            {error && (
              <p
                id={`${id}-error`}
                className="text-sm text-destructive"
                role="alert"
              >
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2 border-t pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setMode("browse");
                  setError("");
                }}
              >
                Отмена
              </Button>
              <Button type="submit">
                {mode === "create"
                  ? "Создать и выбрать"
                  : "Сохранить изменения"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
