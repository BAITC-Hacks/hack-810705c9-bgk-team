"use client";

import {
  ActionBarPrimitive,
  MessagePrimitive,
  useAuiState,
  type TextMessagePartComponent,
} from "@assistant-ui/react";
import { Copy, CopyCheck, FileText } from "@gravity-ui/icons";
import { MessageResponse } from "@/shared/components/ai-elements/message";
import { Shimmer } from "@/shared/components/ai-elements/shimmer";

export function UserMessage() {
  const hasText = useAuiState((state) => state.message.content.some((part) => part.type === "text" && part.text.trim().length > 0));
  return (
    <MessagePrimitive.Root className="workspace-enter flex flex-col items-end gap-2">
      <MessagePrimitive.Attachments>
        {({ attachment }) => (
          <span className="inline-flex max-w-64 items-center gap-2 rounded-xl border bg-card px-3 py-2 text-xs font-semibold">
            <FileText className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="truncate">{attachment.name}</span>
          </span>
        )}
      </MessagePrimitive.Attachments>
      {hasText && (
        <div className="max-w-[85%] rounded-2xl bg-secondary px-5 py-4 text-[15px] leading-[1.7] whitespace-pre-wrap">
          <MessagePrimitive.Parts />
        </div>
      )}
    </MessagePrimitive.Root>
  );
}

export function AssistantMessage() {
  return (
    <MessagePrimitive.Root className="workspace-enter flex items-start gap-3">
      <AssistantAvatar />
      <div className="min-w-0 flex-1">
        <p className="mb-1.5 text-[15px] font-bold">AI-Sana</p>
        <div className="text-[15px] leading-[1.7]">
          <MessagePrimitive.Parts components={{ Text: MarkdownText, Empty: Thinking }} />
        </div>
        <ActionBarPrimitive.Root
          hideWhenRunning
          autohide="not-last"
          className="mt-2 flex gap-1"
        >
          <ActionBarPrimitive.Copy
            aria-label="Скопировать ответ"
            title="Скопировать ответ"
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-workspace-selected hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
          >
            <Copy className="size-3.5 in-data-copied:hidden" />
            <CopyCheck className="hidden size-3.5 in-data-copied:block" />
          </ActionBarPrimitive.Copy>
        </ActionBarPrimitive.Root>
      </div>
    </MessagePrimitive.Root>
  );
}

export function AssistantAvatar() {
  return (
    <span
      aria-hidden="true"
      className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-foreground text-[11px] font-bold text-background"
    >
      AI
    </span>
  );
}

const MarkdownText: TextMessagePartComponent = ({ text, status }) => (
  <MessageResponse isAnimating={status.type === "running"}>{text}</MessageResponse>
);

function Thinking() {
  return (
    <div
      role="status"
      className="inline-flex items-center gap-3 rounded-2xl bg-muted px-4 py-3"
    >
      <span className="flex items-center gap-1" aria-hidden="true">
        <span className="chat-typing-dot size-1.5 rounded-full bg-foreground" />
        <span className="chat-typing-dot size-1.5 rounded-full bg-foreground" />
        <span className="chat-typing-dot size-1.5 rounded-full bg-foreground" />
      </span>
      <Shimmer as="span" className="text-sm font-medium">
        AI-Sana готовит ответ…
      </Shimmer>
    </div>
  );
}
