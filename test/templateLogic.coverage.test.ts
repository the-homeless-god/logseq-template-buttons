import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createChildPageFromTemplate,
  createPageFromTemplate,
  initDateFormat,
  resolvePageNamePattern,
} from "../src/templateLogic";

function mockTemplateWithTokens() {
  logseq.App.getTemplate.mockResolvedValue({ uuid: "tpl" });
  logseq.Editor.getBlock.mockImplementation(async (id: string) => {
    if (id === "tpl") {
      return {
        uuid: "tpl",
        content: "Template",
        children: [
          {
            uuid: "dyn",
            content: "<%tomorrow%> <%time%> <%unknown%>",
            properties: { custom: "keep" },
            children: [{ uuid: "nested", content: "Child", children: [] }],
          },
        ],
      };
    }
    return null;
  });
}

describe("templateLogic coverage", () => {
  beforeEach(async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await initDateFormat();
    logseq.Editor.getPage.mockResolvedValue(null);
    logseq.Editor.createPage.mockResolvedValue({ uuid: "page", name: "Page" });
  });

  it("covers ensureChildPageName branches via child creation", async () => {
    let inserted = false;
    logseq.Editor.insertBatchBlock.mockImplementation(async () => {
      inserted = true;
      return null;
    });
    logseq.Editor.getPageBlocksTree.mockImplementation(async () =>
      inserted
        ? [{ uuid: "ph", content: "" }, { uuid: "b1", content: "x" }]
        : [{ uuid: "ph", content: "" }]
    );
    logseq.App.getTemplate.mockResolvedValue({ uuid: "tpl" });
    logseq.Editor.getBlock.mockResolvedValue({
      uuid: "tpl",
      content: "Template",
      children: [{ uuid: "c", content: "Line", children: [] }],
    });

    await createChildPageFromTemplate("Parent", "Focus time", "Sub/{template}", { addBacklink: true });
    expect(logseq.Editor.appendBlockInPage).toHaveBeenCalled();
  });

  it("covers unique page names and existing page deletion", async () => {
    let checks = 0;
    logseq.Editor.getPage.mockImplementation(async () => {
      checks += 1;
      return checks <= 100 ? { uuid: `p-${checks}` } : null;
    });

    let inserted = false;
    logseq.Editor.insertBatchBlock.mockImplementation(async () => {
      inserted = true;
      return null;
    });
    logseq.Editor.getPageBlocksTree.mockImplementation(async () =>
      inserted
        ? [{ uuid: "ph", content: "" }, { uuid: "b1", content: "x" }]
        : [{ uuid: "ph", content: "" }]
    );
    logseq.App.getTemplate.mockResolvedValue({ uuid: "tpl" });
    logseq.Editor.getBlock.mockResolvedValue({
      uuid: "tpl",
      content: "Template",
      children: [{ uuid: "c", content: "Line", children: [] }],
    });

    await createPageFromTemplate("Focus time", "Collision");
    expect(checks).toBeGreaterThan(1);
  });

  it("covers insert fallback paths and native template api", async () => {
    logseq.App.getTemplate.mockResolvedValue({ uuid: "tpl" });
    logseq.Editor.getBlock.mockResolvedValue({
      uuid: "tpl",
      content: "Template",
      children: [{ uuid: "c", content: "Line", children: [] }],
    });

    let phase = 0;
    logseq.Editor.getPageBlocksTree.mockImplementation(async () => {
      phase += 1;
      if (phase === 1) return [{ uuid: "ph", content: "" }];
      if (phase <= 8) return [{ uuid: "ph", content: "" }, { uuid: "keep", content: "old" }];
      return [{ uuid: "ph", content: "" }, { uuid: "native", content: "Native" }];
    });
    logseq.Editor.insertBatchBlock.mockResolvedValue(null);
    logseq.Editor.getPage.mockResolvedValueOnce({ uuid: "exists" });
    logseq.App.insertTemplate.mockImplementation(async () => undefined);

    const promise = createPageFromTemplate("Focus time", "Fallback");
    await vi.runAllTimersAsync();
    await promise;
    expect(logseq.App.insertTemplate).toHaveBeenCalled();
  });

  it("covers dynamic tokens and unresolved block refs", async () => {
    mockTemplateWithTokens();
    logseq.Editor.getBlock.mockImplementation(async (id: string) => {
      if (id === "tpl") {
        return {
          uuid: "tpl",
          content: "Template",
          children: [["uuid", "missing-ref"]],
        };
      }
      return null;
    });

    let inserted = false;
    logseq.Editor.insertBatchBlock.mockImplementation(async () => {
      inserted = true;
      return null;
    });
    logseq.Editor.getPageBlocksTree.mockImplementation(async () =>
      inserted
        ? [{ uuid: "ph", content: "" }, { uuid: "b1", content: "x" }]
        : [{ uuid: "ph", content: "" }]
    );

    await createPageFromTemplate("Focus time", "{template}");
    expect(resolvePageNamePattern("{parent}", "T", { parentPageName: "A/B/C" })).toBe("A/B/C");
  });

  it("returns early when child insert fails", async () => {
    logseq.App.getTemplate.mockResolvedValue({ uuid: "tpl" });
    logseq.Editor.getBlock.mockResolvedValue({
      uuid: "tpl",
      content: "Template",
      children: [{ uuid: "c", content: "Line", children: [] }],
    });
    logseq.Editor.getPageBlocksTree.mockResolvedValue([
      { uuid: "ph", content: "" },
      { uuid: "keep", content: "old" },
    ]);
    logseq.Editor.insertBatchBlock.mockResolvedValue(null);
    logseq.App.insertTemplate.mockResolvedValue(undefined);

    const promise = createChildPageFromTemplate("Parent", "Focus time", "{template}");
    await vi.runAllTimersAsync();
    await promise;
    expect(logseq.App.showMsg).not.toHaveBeenCalledWith(expect.stringContaining("Created child"), "success");
  });
});
