"use client";

import { ChatCircleText, X } from "@phosphor-icons/react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { AskChatMessage } from "@/lib/types";

export function SelectionConversationRail({ messages }: { messages: AskChatMessage[] }) {
  const [open, setOpen] = useState(false);

  if (messages.length === 0) return null;

  if (!open) {
    return (
      <button
        type="button"
        aria-label={`Open selection conversation, ${messages.length} messages`}
        onClick={() => setOpen(true)}
        className="selection-conversation-trigger"
      >
        <ChatCircleText aria-hidden="true" className="size-4" weight="bold" />
        <span>Selection</span>
        <span className="selection-conversation-count">{messages.length}</span>
      </button>
    );
  }

  return (
    <aside aria-label="Selection conversation" className="selection-conversation-rail">
      <header className="selection-conversation-header">
        <div>
          <p className="selection-conversation-kicker">Selection conversation</p>
          <p className="selection-conversation-summary">{messages.length} saved messages</p>
        </div>
        <button
          type="button"
          aria-label="Close selection conversation"
          onClick={() => setOpen(false)}
          className="workbench-icon-button workbench-icon-button-sm"
        >
          <X aria-hidden="true" className="size-3.5" weight="bold" />
        </button>
      </header>
      <div className="selection-conversation-list">
        {messages.map((message) => (
          <article
            key={message.id}
            className={`selection-conversation-message selection-conversation-message-${message.role}`}
          >
            <p className="selection-conversation-role">
              {message.role === "assistant" ? "Assistant" : "Reviewer"}
            </p>
            {message.role === "assistant" ? (
              <div className="ask-markdown">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
              </div>
            ) : (
              <p className="text-sm leading-5">{message.content}</p>
            )}
            {message.evidenceUsed.length > 0 ? (
              <div className="selection-conversation-evidence">
                {message.evidenceUsed.map((locator) => (
                  <p key={locator}>{locator}</p>
                ))}
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </aside>
  );
}
