import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Regression test: Verify that the pi-ai Anthropic provider does NOT call
 * sanitizeSurrogates() on thinking blocks that have a thinkingSignature.
 *
 * The Anthropic API requires signed thinking blocks to be returned verbatim;
 * modifying the text invalidates the cryptographic signature and causes:
 *   "thinking blocks cannot be modified" (400 error)
 *
 * Bug: #17019 (31 upvotes), #24612
 * Fix: patches/@mariozechner__pi-ai@0.52.12.patch
 */
describe("pi-ai Anthropic thinking signature patch (#17019, #24612)", () => {
  it("does not sanitize thinking text when thinkingSignature is present", () => {
    // Read the compiled Anthropic provider to verify the patch is applied
    const anthropicPath = path.resolve(
      "node_modules/@mariozechner/pi-ai/dist/providers/anthropic.js",
    );
    const source = fs.readFileSync(anthropicPath, "utf-8");

    // Find the thinking block construction where signature is present.
    // The patched code should use `block.thinking` directly (not wrapped in sanitizeSurrogates).
    // The unpatched code has: thinking: sanitizeSurrogates(block.thinking), signature: block.thinkingSignature
    const signedThinkingPattern =
      /thinking:\s*sanitizeSurrogates\(block\.thinking\),\s*\n\s*signature:\s*block\.thinkingSignature/;
    const hasUnsafePattern = signedThinkingPattern.test(source);

    expect(
      hasUnsafePattern,
      [
        "pi-ai Anthropic provider still calls sanitizeSurrogates() on signed thinking blocks.",
        "This causes 400 errors when the Anthropic API validates thinking block signatures.",
        "Apply the patch: patches/@mariozechner__pi-ai@0.52.12.patch",
      ].join("\n"),
    ).toBe(false);
  });

  it("still sanitizes thinking text when no signature is present", () => {
    const anthropicPath = path.resolve(
      "node_modules/@mariozechner/pi-ai/dist/providers/anthropic.js",
    );
    const source = fs.readFileSync(anthropicPath, "utf-8");

    // The unsigned thinking path (converted to text block) should still sanitize
    const unsignedPattern = /type:\s*"text",\s*\n\s*text:\s*sanitizeSurrogates\(block\.thinking\)/;
    expect(unsignedPattern.test(source)).toBe(true);
  });

  it("patch file exists", () => {
    const patchPath = path.resolve("patches/@mariozechner__pi-ai@0.52.12.patch");
    expect(fs.existsSync(patchPath)).toBe(true);
  });
});
