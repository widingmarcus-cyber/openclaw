/**
 * Unified dispatch helpers for overlapping hook events.
 *
 * Three events are dispatched through both the internal hook system
 * (HOOK.md discovery) and the plugin typed hook system. This module
 * co-locates the dual dispatch so each call site only needs one function.
 */

import { getGlobalHookRunner } from "../plugins/hook-runner-global.js";
import { createInternalHookEvent, triggerInternalHook } from "./internal-hooks.js";

/**
 * Emit a message_received event through both hook systems.
 */
export function emitMessageReceived(params: {
  from: string;
  content: string;
  timestamp?: number;
  channelId: string;
  accountId?: string;
  conversationId?: string;
  messageId?: string;
  sessionKey?: string;
  metadata?: Record<string, unknown>;
}): void {
  const hookRunner = getGlobalHookRunner();
  if (hookRunner?.hasHooks("message_received")) {
    void hookRunner
      .runMessageReceived(
        {
          from: params.from,
          content: params.content,
          timestamp: params.timestamp,
          metadata: {
            ...params.metadata,
            ...(params.messageId ? { messageId: params.messageId } : {}),
          },
        },
        {
          channelId: params.channelId,
          accountId: params.accountId,
          conversationId: params.conversationId,
        },
      )
      .catch(() => {});
  }

  if (params.sessionKey) {
    void triggerInternalHook(
      createInternalHookEvent("message", "received", params.sessionKey, {
        from: params.from,
        content: params.content,
        timestamp: params.timestamp,
        channelId: params.channelId,
        accountId: params.accountId,
        conversationId: params.conversationId,
        messageId: params.messageId,
        metadata: params.metadata ?? {},
      }),
    ).catch(() => {});
  }
}

/**
 * Emit a message_sent event through both hook systems.
 */
export function emitMessageSent(params: {
  to: string;
  content: string;
  success: boolean;
  error?: string;
  channelId: string;
  accountId?: string;
  conversationId?: string;
  messageId?: string;
  sessionKey?: string;
}): void {
  const hookRunner = getGlobalHookRunner();
  if (hookRunner?.hasHooks("message_sent")) {
    void hookRunner
      .runMessageSent(
        {
          to: params.to,
          content: params.content,
          success: params.success,
          ...(params.error ? { error: params.error } : {}),
        },
        {
          channelId: params.channelId,
          accountId: params.accountId,
          conversationId: params.conversationId ?? params.to,
        },
      )
      .catch(() => {});
  }

  if (params.sessionKey) {
    void triggerInternalHook(
      createInternalHookEvent("message", "sent", params.sessionKey, {
        to: params.to,
        content: params.content,
        success: params.success,
        ...(params.error ? { error: params.error } : {}),
        channelId: params.channelId,
        accountId: params.accountId,
        conversationId: params.conversationId ?? params.to,
        messageId: params.messageId,
      }),
    ).catch(() => {});
  }
}

/**
 * Emit gateway startup through both hook systems.
 *
 * Fires both hooks synchronously (no setTimeout). Must be called after
 * hook loading completes to avoid the race condition in #30784.
 */
export function emitGatewayStartup(params: {
  port: number;
  cfg?: unknown;
  deps?: unknown;
  workspaceDir?: string;
  internalHooksEnabled?: boolean;
}): void {
  // Plugin hook
  const hookRunner = getGlobalHookRunner();
  if (hookRunner?.hasHooks("gateway_start")) {
    void hookRunner.runGatewayStart({ port: params.port }, { port: params.port }).catch(() => {});
  }

  // Internal hook — no setTimeout, fire immediately after hooks are loaded
  if (params.internalHooksEnabled) {
    void triggerInternalHook(
      createInternalHookEvent("gateway", "startup", "gateway:startup", {
        cfg: params.cfg,
        deps: params.deps,
        workspaceDir: params.workspaceDir,
      }),
    ).catch(() => {});
  }
}
