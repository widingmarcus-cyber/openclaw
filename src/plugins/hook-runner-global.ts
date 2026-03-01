/**
 * Global Plugin Hook Runner
 *
 * Singleton hook runner that's initialized when plugins are loaded
 * and can be called from anywhere in the codebase.
 */

import { createSubsystemLogger } from "../logging/subsystem.js";
import { createHookRunner, type HookRunner } from "./hooks.js";
import type { PluginRegistry } from "./registry.js";
import type { PluginHookGatewayContext, PluginHookGatewayStopEvent } from "./types.js";

const log = createSubsystemLogger("plugins");

const HOOK_RUNNER_KEY = Symbol.for("openclaw:hookRunner");

type HookRunnerState = {
  runner: HookRunner | null;
  registry: PluginRegistry | null;
};

const hookRunnerState: HookRunnerState = (() => {
  const g = globalThis as typeof globalThis & { [HOOK_RUNNER_KEY]?: HookRunnerState };
  if (!g[HOOK_RUNNER_KEY]) {
    g[HOOK_RUNNER_KEY] = { runner: null, registry: null };
  }
  return g[HOOK_RUNNER_KEY];
})();

/**
 * Initialize the global hook runner with a plugin registry.
 * Called once when plugins are loaded during gateway startup.
 */
export function initializeGlobalHookRunner(registry: PluginRegistry): void {
  hookRunnerState.registry = registry;
  hookRunnerState.runner = createHookRunner(registry, {
    logger: {
      debug: (msg) => log.debug(msg),
      warn: (msg) => log.warn(msg),
      error: (msg) => log.error(msg),
    },
    catchErrors: true,
  });

  const hookCount = registry.hooks.length;
  if (hookCount > 0) {
    log.info(`hook runner initialized with ${hookCount} registered hooks`);
  }
}

/**
 * Get the global hook runner.
 * Returns null if plugins haven't been loaded yet.
 */
export function getGlobalHookRunner(): HookRunner | null {
  return hookRunnerState.runner;
}

/**
 * Get the global plugin registry.
 * Returns null if plugins haven't been loaded yet.
 */
export function getGlobalPluginRegistry(): PluginRegistry | null {
  return hookRunnerState.registry;
}

/**
 * Check if any hooks are registered for a given hook name.
 */
export function hasGlobalHooks(hookName: Parameters<HookRunner["hasHooks"]>[0]): boolean {
  return hookRunnerState.runner?.hasHooks(hookName) ?? false;
}

export async function runGlobalGatewayStopSafely(params: {
  event: PluginHookGatewayStopEvent;
  ctx: PluginHookGatewayContext;
  onError?: (err: unknown) => void;
}): Promise<void> {
  const hookRunner = getGlobalHookRunner();
  if (!hookRunner?.hasHooks("gateway_stop")) {
    return;
  }
  try {
    await hookRunner.runGatewayStop(params.event, params.ctx);
  } catch (err) {
    if (params.onError) {
      params.onError(err);
      return;
    }
    log.warn(`gateway_stop hook failed: ${String(err)}`);
  }
}

/**
 * Reset the global hook runner (for testing).
 */
export function resetGlobalHookRunner(): void {
  hookRunnerState.runner = null;
  hookRunnerState.registry = null;
}
