import { describe, expect, it, vi } from "vitest";
import { copyTextToClipboard } from "../src/clipboard";

describe("clipboard coverage", () => {
  it("uses iframe document when parent is inaccessible", async () => {
    Object.defineProperty(window, "parent", {
      configurable: true,
      get() {
        throw new Error("cross origin");
      },
    });

    document.execCommand = vi.fn().mockReturnValue(true);
    const result = await copyTextToClipboard("fallback-doc");
    expect(result.ok).toBe(true);
  });

  it("handles execCommand failures in textarea copy", async () => {
    Object.defineProperty(window, "parent", {
      configurable: true,
      value: {
        document,
        navigator: { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } },
      },
    });

    document.execCommand = vi.fn().mockImplementation(() => {
      throw new Error("copy blocked");
    });

    const result = await copyTextToClipboard("fail");
    expect(result.ok).toBe(false);
  });

  it("uses document fallback when parent clipboard is unavailable", async () => {
    Object.defineProperty(window, "parent", {
      configurable: true,
      value: {
        document,
        navigator: {},
      },
    });

    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    document.execCommand = vi.fn()
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);

    const result = await copyTextToClipboard("second-doc");
    expect(result.ok).toBe(true);
  });
});
