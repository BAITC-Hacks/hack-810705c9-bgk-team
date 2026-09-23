"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowRight,
  Building2,
  GraduationCap,
  ImagePlus,
  Loader2,
  X,
} from "lucide-react";
import type { Team } from "@/entities/workspace";
import {
  workspaceApi,
  requestError,
  type WorkspaceSnapshot,
} from "@/entities/workspace/api";
import {
  BUSINESS_LOGO_ACCEPT,
  MAX_BUSINESS_LOGO_BYTES,
} from "@/entities/workspace/business-logo";
import styles from "./onboarding.module.css";

type Props = {
  teams: Team[];
  session: WorkspaceSnapshot["session"];
  business?: WorkspaceSnapshot["business"];
  onComplete: () => Promise<void>;
};

export function OnboardingForm({
  teams,
  session,
  business,
  onComplete,
}: Props) {
  const [role, setRole] = useState(session.role);
  const [companyName, setCompanyName] = useState(business?.name ?? "");
  const [teamId, setTeamId] = useState(
    session.onboardingCompleted ? (session.teamId ?? "") : "",
  );
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState(business?.logoUrl ?? "");
  const [logoRemoved, setLogoRemoved] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const objectUrl = useRef<string | null>(null);
  const uploadedLogo = useRef<{ file: File; key: string } | null>(null);
  const submitting = useRef(false);
  const selectedTeam = teams.find((team) => team.id === teamId);

  useEffect(
    () => () => {
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    },
    [],
  );

  function selectLogo(file?: File) {
    if (!file) return;
    if (
      !BUSINESS_LOGO_ACCEPT.split(",").includes(file.type) ||
      !file.size ||
      file.size > MAX_BUSINESS_LOGO_BYTES
    ) {
      setError("Выберите PNG, JPG или WebP до 2 МБ.");
      if (fileInput.current) fileInput.current.value = "";
      return;
    }
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = URL.createObjectURL(file);
    setLogoPreview(objectUrl.current);
    setLogoFile(file);
    setLogoRemoved(false);
    uploadedLogo.current = null;
    setError("");
  }

  function removeLogo() {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = null;
    uploadedLogo.current = null;
    setLogoFile(null);
    setLogoPreview("");
    setLogoRemoved(true);
    if (fileInput.current) fileInput.current.value = "";
    setError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    if (role === "business" && !companyName.trim()) {
      setError("Введите название компании.");
      return;
    }
    if (role === "student" && !selectedTeam) {
      setError("Выберите свою команду.");
      return;
    }
    submitting.current = true;
    setPending(true);
    setError("");
    try {
      if (role === "business") {
        let logoKey: string | null | undefined = logoRemoved ? null : undefined;
        if (logoFile) {
          if (uploadedLogo.current?.file !== logoFile) {
            setUploading(true);
            const body = new FormData();
            body.append("file", logoFile);
            const response = await fetch("/api/business-logos", {
              method: "POST",
              body,
            });
            const result = await response.json().catch(() => null);
            if (!response.ok || typeof result?.key !== "string") {
              throw new Error(
                result?.error?.message ||
                  "Не удалось загрузить логотип. Попробуйте ещё раз или продолжите без него.",
              );
            }
            uploadedLogo.current = { file: logoFile, key: result.key };
            setUploading(false);
          }
          logoKey = uploadedLogo.current!.key;
        }
        await workspaceApi.onboard({
          role,
          companyName: companyName.trim(),
          ...(logoKey !== undefined ? { logoKey } : {}),
        });
      } else {
        await workspaceApi.onboard({ role, teamId });
      }
      await onComplete();
    } catch (failure) {
      setError(requestError(failure));
    } finally {
      submitting.current = false;
      setPending(false);
      setUploading(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <h1 className="text-[32px] leading-[1.15] font-semibold tracking-[-0.035em] sm:text-[38px]">
        Давайте знакомиться
      </h1>
      <p className="mt-3 text-sm leading-6 text-[#746e64]">
        {role === "student"
          ? "Выберите команду, чтобы находить задачи и предлагать решения."
          : "Представьте компанию, чтобы размещать задачи для студентов."}
      </p>

      <fieldset disabled={pending} className="mt-8 min-w-0 space-y-6">
        <fieldset>
          <legend className="mb-2.5 text-[13px] font-medium">
            Я здесь как
          </legend>
          <div className={styles.roles}>
            {(
              [
                ["student", "Студент", GraduationCap],
                ["business", "Бизнес", Building2],
              ] as const
            ).map(([value, label, Icon]) => (
              <label key={value} className={styles.role}>
                <input
                  type="radio"
                  name="role"
                  value={value}
                  checked={role === value}
                  onChange={() => {
                    setRole(value);
                    setError("");
                  }}
                />
                <span>
                  <Icon size={17} strokeWidth={1.6} aria-hidden="true" />
                  {label}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {role === "business" ? (
          <>
            <div>
              <label
                htmlFor="onboarding-company"
                className="mb-2.5 block text-[13px] font-medium"
              >
                Название компании
              </label>
              <input
                id="onboarding-company"
                className={styles.field}
                autoComplete="organization"
                placeholder="Например, Пекарня у дома"
                value={companyName}
                onChange={(event) => {
                  setCompanyName(event.target.value);
                  setError("");
                }}
                maxLength={200}
                required
              />
            </div>
            <div>
              <p className="mb-2.5 text-[13px] font-medium">
                Логотип{" "}
                <span className="font-normal text-[#817a70]">
                  · необязательно
                </span>
              </p>
              <div className="flex items-center gap-3.5">
                <label className="relative flex size-14 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-[#ccc6bb] bg-white transition-colors hover:bg-[#f0ede6] focus-within:outline-2 focus-within:outline-offset-3 focus-within:outline-[#7e613b]">
                  {logoPreview ? (
                    // Browser object URLs and our own image endpoint do not need image optimization.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={logoPreview}
                      alt="Логотип компании"
                      className="size-full object-contain p-1"
                    />
                  ) : (
                    <ImagePlus
                      size={21}
                      strokeWidth={1.5}
                      className="text-[#817a70]"
                      aria-hidden="true"
                    />
                  )}
                  <input
                    ref={fileInput}
                    className="absolute inset-0 size-full cursor-pointer opacity-0"
                    type="file"
                    accept={BUSINESS_LOGO_ACCEPT}
                    aria-label="Загрузить логотип компании"
                    onChange={(event) => selectLogo(event.target.files?.[0])}
                  />
                </label>
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    className="rounded text-[13px] font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-3"
                    onClick={() => fileInput.current?.click()}
                  >
                    {logoPreview ? "Заменить логотип" : "Загрузить изображение"}
                  </button>
                  <p className="mt-1 text-xs text-[#817a70]">
                    PNG, JPG или WebP · до 2 МБ
                  </p>
                </div>
                {logoPreview && (
                  <button
                    type="button"
                    className="rounded-md p-2 text-[#817a70] hover:bg-[#eeeae2]"
                    onClick={removeLogo}
                    aria-label="Удалить логотип"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>
          </>
        ) : (
          <div>
            <label
              htmlFor="onboarding-team"
              className="mb-2.5 block text-[13px] font-medium"
            >
              Ваша команда
            </label>
            <select
              id="onboarding-team"
              className={styles.field}
              value={teamId}
              onChange={(event) => {
                setTeamId(event.target.value);
                setError("");
              }}
              required
              disabled={!teams.length}
            >
              <option value="" disabled>
                Выберите команду
              </option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
            <p className="mt-3 text-xs leading-5 text-[#817a70]">
              {!teams.length
                ? "Команд пока нет. Попросите организатора добавить вашу команду."
                : selectedTeam
                  ? `${selectedTeam.name} · ${selectedTeam.skills.join(", ") || selectedTeam.tagline || "Профиль команды можно дополнить позже."}`
                  : "Отклики и результаты будут сохраняться за этой командой."}
            </p>
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm leading-5 text-[#a13b29]">
            {error}
          </p>
        )}
        <button
          type="submit"
          className={styles.submit}
          disabled={pending || (role === "student" && !teams.length)}
        >
          <span>
            {pending
              ? uploading
                ? "Загружаем логотип…"
                : "Сохраняем…"
              : "Продолжить"}
          </span>
          {pending ? (
            <Loader2
              size={17}
              className="animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
          ) : (
            <ArrowRight size={17} aria-hidden="true" />
          )}
        </button>
      </fieldset>
    </form>
  );
}
