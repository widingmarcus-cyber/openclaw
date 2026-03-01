import { describe, expect, it } from "vitest";
import {
  normalizeUsage,
  hasNonzeroUsage,
  derivePromptTokens,
  deriveSessionTotalTokens,
} from "./usage.js";

describe("normalizeUsage", () => {
  it("normalizes cache fields from provider response", () => {
    const usage = normalizeUsage({
      input: 1000,
      output: 500,
      cacheRead: 2000,
      cacheWrite: 300,
    });
    expect(usage).toEqual({
      input: 1000,
      output: 500,
      cacheRead: 2000,
      cacheWrite: 300,
      total: undefined,
    });
  });

  it("normalizes cache fields from alternate naming", () => {
    const usage = normalizeUsage({
      input_tokens: 1000,
      output_tokens: 500,
      cache_read_input_tokens: 2000,
      cache_creation_input_tokens: 300,
    });
    expect(usage).toEqual({
      input: 1000,
      output: 500,
      cacheRead: 2000,
      cacheWrite: 300,
      total: undefined,
    });
  });

  it("handles cache_read and cache_write naming variants", () => {
    const usage = normalizeUsage({
      input: 1000,
      cache_read: 1500,
      cache_write: 200,
    });
    expect(usage).toEqual({
      input: 1000,
      output: undefined,
      cacheRead: 1500,
      cacheWrite: 200,
      total: undefined,
    });
  });

  it("handles Moonshot/Kimi cached_tokens field", () => {
    // Moonshot v1 returns cached_tokens instead of cache_read_input_tokens
    const usage = normalizeUsage({
      prompt_tokens: 30,
      completion_tokens: 9,
      total_tokens: 39,
      cached_tokens: 19,
    });
    expect(usage).toEqual({
      input: 11, // 30 - 19: prompt_tokens includes cached_tokens
      output: 9,
      cacheRead: 19,
      cacheWrite: undefined,
      total: 39,
    });
  });

  it("handles Kimi K2 prompt_tokens_details.cached_tokens field", () => {
    // Kimi K2 uses automatic prefix caching and returns cached_tokens in prompt_tokens_details
    const usage = normalizeUsage({
      prompt_tokens: 1113,
      completion_tokens: 5,
      total_tokens: 1118,
      prompt_tokens_details: { cached_tokens: 1024 },
    });
    expect(usage).toEqual({
      input: 89, // 1113 - 1024: prompt_tokens includes cached_tokens
      output: 5,
      cacheRead: 1024,
      cacheWrite: undefined,
      total: 1118,
    });
  });

  it("returns undefined when no valid fields are provided", () => {
    const usage = normalizeUsage(null);
    expect(usage).toBeUndefined();
  });

  it("handles undefined input", () => {
    const usage = normalizeUsage(undefined);
    expect(usage).toBeUndefined();
  });
});

describe("hasNonzeroUsage", () => {
  it("returns true when cache read is nonzero", () => {
    const usage = { cacheRead: 100 };
    expect(hasNonzeroUsage(usage)).toBe(true);
  });

  it("returns true when cache write is nonzero", () => {
    const usage = { cacheWrite: 50 };
    expect(hasNonzeroUsage(usage)).toBe(true);
  });

  it("returns true when both cache fields are nonzero", () => {
    const usage = { cacheRead: 100, cacheWrite: 50 };
    expect(hasNonzeroUsage(usage)).toBe(true);
  });

  it("returns false when cache fields are zero", () => {
    const usage = { cacheRead: 0, cacheWrite: 0 };
    expect(hasNonzeroUsage(usage)).toBe(false);
  });

  it("returns false for undefined usage", () => {
    expect(hasNonzeroUsage(undefined)).toBe(false);
  });
});

describe("derivePromptTokens", () => {
  it("includes cache tokens in prompt total", () => {
    const usage = {
      input: 1000,
      cacheRead: 500,
      cacheWrite: 200,
    };
    const promptTokens = derivePromptTokens(usage);
    expect(promptTokens).toBe(1700); // 1000 + 500 + 200
  });

  it("handles missing cache fields", () => {
    const usage = {
      input: 1000,
    };
    const promptTokens = derivePromptTokens(usage);
    expect(promptTokens).toBe(1000);
  });

  it("returns undefined for empty usage", () => {
    const promptTokens = derivePromptTokens({});
    expect(promptTokens).toBeUndefined();
  });
});

describe("deriveSessionTotalTokens", () => {
  it("includes cache tokens in total calculation", () => {
    const totalTokens = deriveSessionTotalTokens({
      usage: {
        input: 1000,
        cacheRead: 500,
        cacheWrite: 200,
      },
      contextTokens: 4000,
    });
    expect(totalTokens).toBe(1700); // 1000 + 500 + 200
  });

  it("prefers promptTokens override over derived total", () => {
    const totalTokens = deriveSessionTotalTokens({
      usage: {
        input: 1000,
        cacheRead: 500,
        cacheWrite: 200,
      },
      contextTokens: 4000,
      promptTokens: 2500, // Override
    });
    expect(totalTokens).toBe(2500);
  });
});

describe("normalizeUsage — OpenAI cache double-count fix", () => {
  it("subtracts cached_tokens from prompt_tokens to avoid double-counting", () => {
    const result = normalizeUsage({
      prompt_tokens: 1000,
      completion_tokens: 200,
      prompt_tokens_details: { cached_tokens: 800 },
    });
    expect(result).toEqual({
      input: 200, // 1000 - 800 (non-cached portion)
      output: 200,
      cacheRead: 800,
      cacheWrite: undefined,
      total: undefined,
    });
  });

  it("subtracts cached_tokens (top-level) from prompt_tokens", () => {
    const result = normalizeUsage({
      prompt_tokens: 500,
      completion_tokens: 100,
      cached_tokens: 300,
    });
    expect(result).toEqual({
      input: 200,
      output: 100,
      cacheRead: 300,
      cacheWrite: undefined,
      total: undefined,
    });
  });

  it("does NOT subtract when Anthropic-style input_tokens is present", () => {
    // Anthropic reports input_tokens as non-cached, so no subtraction needed.
    const result = normalizeUsage({
      input_tokens: 200,
      output_tokens: 100,
      cache_read_input_tokens: 800,
    });
    expect(result).toEqual({
      input: 200,
      output: 100,
      cacheRead: 800,
      cacheWrite: undefined,
      total: undefined,
    });
  });

  it("clamps to zero when cached_tokens exceeds prompt_tokens", () => {
    const result = normalizeUsage({
      prompt_tokens: 100,
      completion_tokens: 50,
      prompt_tokens_details: { cached_tokens: 150 },
    });
    expect(result).toEqual({
      input: 0,
      output: 50,
      cacheRead: 150,
      cacheWrite: undefined,
      total: undefined,
    });
  });

  it("no adjustment when cacheRead is zero", () => {
    const result = normalizeUsage({
      prompt_tokens: 500,
      completion_tokens: 100,
      prompt_tokens_details: { cached_tokens: 0 },
    });
    expect(result).toEqual({
      input: 500,
      output: 100,
      cacheRead: 0,
      cacheWrite: undefined,
      total: undefined,
    });
  });
});
