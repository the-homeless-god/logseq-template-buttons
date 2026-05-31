import { describe, expect, it, vi } from "vitest";
import { copyTextToClipboard, showCopyPanel } from "../src/clipboard";

function mockParentClipboard(writeText: ReturnType<typeof vi.fn>) {
  Object.defineProperty(window, "parent", {
    configurable: true,
    value: {
      document,
      navigator: { clipboard: { writeText } },
    },
  });
}

describe("clipboard", () => {
  it("copies via clipboard api", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    mockParentClipboard(writeText);

    const result = await copyTextToClipboard("hello");
    expect(result.ok).toBe(true);
    expect(writeText).toHaveBeenCalledWith("hello");
  });

  it("shows copy panel when automatic copy fails", async () => {
    mockParentClipboard(vi.fn().mockRejectedValue(new Error("denied")));
    document.execCommand = vi.fn().mockReturnValue(false);

    const copied = vi.fn();
    showCopyPanel("panel text", copied);
    expect(document.getElementById("lstb-copy-fallback-overlay")).toBeTruthy();

    const textarea = document.querySelector(
      "#lstb-copy-fallback-overlay textarea"
    ) as HTMLTextAreaElement;
    expect(textarea.value).toBe("panel text");

    mockParentClipboard(vi.fn().mockResolvedValue(undefined));
    const copyButton = document.querySelector(
      '#lstb-copy-fallback-overlay button[data-lstb-copy="true"]'
    ) as HTMLButtonElement;
    copyButton.click();
    await vi.waitFor(() => {
      expect(copied).toHaveBeenCalled();
    });

    mockParentClipboard(vi.fn().mockRejectedValue(new Error("denied")));
    const result = await copyTextToClipboard("fallback");
    expect(result.ok).toBe(false);
  });

  it("falls back to execCommand and manual panel copy", async () => {
    mockParentClipboard(vi.fn().mockRejectedValue(new Error("denied")));
    document.execCommand = vi.fn().mockReturnValue(true);
    const result = await copyTextToClipboard("exec");
    expect(result.ok).toBe(true);

    showCopyPanel("manual", undefined);
    mockParentClipboard(vi.fn().mockRejectedValue(new Error("denied")));
    document.execCommand = vi.fn().mockReturnValue(false);
    const copyButton = document.querySelector(
      '#lstb-copy-fallback-overlay button[data-lstb-copy="true"]'
    ) as HTMLButtonElement;
    copyButton.click();
    await vi.waitFor(() => {
      expect(logseq.App.showMsg).toHaveBeenCalledWith("Выделите текст и нажмите Cmd+C", "warning");
    });

    const closeButton = document.querySelector(
      '#lstb-copy-fallback-overlay button[data-lstb-close="true"]'
    ) as HTMLButtonElement;
    closeButton.click();
    expect(document.getElementById("lstb-copy-fallback-overlay")).toBeNull();
  });
});
