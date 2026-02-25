import { describe, expect, it } from "vitest";
import { loadAndMaybeMigrateDoctorConfig } from "./doctor-config-flow.js";
import { runDoctorConfigWithInput } from "./doctor-config-flow.test-utils.js";

describe("doctor: invalid enum value repair (#26836)", () => {
  it("resets compaction.mode to default when set to an invalid value", async () => {
    const result = await runDoctorConfigWithInput({
      config: {
        agents: {
          defaults: {
            compaction: {
              mode: "aggressive",
            },
          },
        },
      },
      repair: true,
      run: loadAndMaybeMigrateDoctorConfig,
    });

    const cfg = result.cfg as {
      agents?: { defaults?: { compaction?: { mode?: string } } };
    };
    // The invalid "aggressive" value should be removed (reset to undefined = schema default).
    expect(cfg.agents?.defaults?.compaction?.mode).toBeUndefined();
  });

  it("preserves valid compaction.mode values", async () => {
    const result = await runDoctorConfigWithInput({
      config: {
        agents: {
          defaults: {
            compaction: {
              mode: "safeguard",
            },
          },
        },
      },
      repair: true,
      run: loadAndMaybeMigrateDoctorConfig,
    });

    const cfg = result.cfg as {
      agents?: { defaults?: { compaction?: { mode?: string } } };
    };
    expect(cfg.agents?.defaults?.compaction?.mode).toBe("safeguard");
  });

  it("resets multiple invalid enum values in one pass", async () => {
    const result = await runDoctorConfigWithInput({
      config: {
        agents: {
          defaults: {
            compaction: {
              mode: "turbo",
            },
            blockStreamingDefault: "always",
          },
        },
      },
      repair: true,
      run: loadAndMaybeMigrateDoctorConfig,
    });

    const cfg = result.cfg as {
      agents?: {
        defaults?: {
          compaction?: { mode?: string };
          blockStreamingDefault?: string;
        };
      };
    };
    expect(cfg.agents?.defaults?.compaction?.mode).toBeUndefined();
    expect(cfg.agents?.defaults?.blockStreamingDefault).toBeUndefined();
  });

  it("reports warnings when not in repair mode", async () => {
    const result = await runDoctorConfigWithInput({
      config: {
        agents: {
          defaults: {
            compaction: {
              mode: "aggressive",
            },
          },
        },
      },
      repair: false,
      run: loadAndMaybeMigrateDoctorConfig,
    });

    // Config should NOT be repaired without --fix.
    const cfg = result.cfg as {
      agents?: { defaults?: { compaction?: { mode?: string } } };
    };
    expect(cfg.agents?.defaults?.compaction?.mode).toBe("aggressive");
  });
});
