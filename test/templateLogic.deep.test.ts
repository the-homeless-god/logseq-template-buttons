import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createChildPageFromTemplate,
  createPageFromTemplate,
  initDateFormat,
} from "../src/templateLogic";

describe("templateLogic deep coverage", () => {
  beforeEach(async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await initDateFormat();
    logseq.Editor.getPage.mockResolvedValue(null);
    logseq.Editor.createPage.mockResolvedValue({ uuid: "page", name: "Page" });
  });

  it("covers dynamic tokens, properties, and block resolution branches", async () => {
    logseq.App.getTemplate.mockResolvedValue({ uuid: "tpl" });
    logseq.Editor.getBlock.mockImplementation(async (id: string) => {
      if (id === "tpl") {
        return {
          uuid: "tpl",
          content: "Template",
          children: [
            {
              uuid: "full-child",
              content: "<%yesterday%> <%tomorrow%> <%time%> <%noop%>",
              properties: { custom: "x", template: "strip", id: "1", uuid: "u" },
              children: [{ uuid: "inline-child", content: "Inline", children: [] }],
            },
            ["uuid", "missing"],
          ],
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
    expect(logseq.Editor.insertBatchBlock).toHaveBeenCalled();
  });

  it("walks batch insert fallbacks and native template append", async () => {
    logseq.App.getTemplate.mockResolvedValue({ uuid: "tpl" });
    logseq.Editor.getBlock.mockResolvedValue({
      uuid: "tpl",
      content: "Template",
      children: [{ uuid: "c", content: "Line", children: [] }],
    });

    let treeCalls = 0;
    logseq.Editor.getPageBlocksTree.mockImplementation(async () => {
      treeCalls += 1;
      if (treeCalls === 1) return [];
      if (treeCalls === 2) return [{ uuid: "ph", content: "" }];
      return [
        { uuid: "ph", content: "" },
        { uuid: "keep", content: "old" },
      ];
    });
    logseq.Editor.insertBatchBlock.mockResolvedValue(null);
    logseq.Editor.appendBlockInPage.mockResolvedValue({ uuid: "new-ph" });
    logseq.App.insertTemplate.mockImplementation(async () => {
      logseq.Editor.getPageBlocksTree.mockResolvedValue([
        { uuid: "ph", content: "" },
        { uuid: "keep", content: "old" },
        { uuid: "native", content: "Native" },
      ]);
    });
    logseq.Editor.getPage.mockResolvedValueOnce({ uuid: "exists" });

    const promise = createPageFromTemplate("Focus time", "Existing");
    await vi.runAllTimersAsync();
    await promise;
    expect(logseq.App.showMsg).toHaveBeenCalledWith(expect.stringContaining("Created"), "success");
  });

  it("covers ensureChildPageName and failed native insert without target", async () => {
    logseq.App.getTemplate.mockResolvedValue({ uuid: "tpl" });
    logseq.Editor.getBlock.mockResolvedValue({
      uuid: "tpl",
      content: "Template",
      children: [{ uuid: "c", content: "Line", children: [] }],
    });
    logseq.Editor.getPageBlocksTree.mockResolvedValue([]);
    logseq.Editor.appendBlockInPage.mockResolvedValue(null as never);
    logseq.Editor.insertBatchBlock.mockResolvedValue(null);
    logseq.App.insertTemplate.mockResolvedValue(undefined);

    const promise = createChildPageFromTemplate("", "Focus time", "FlatName");
    await vi.runAllTimersAsync();
    await promise;
    expect(logseq.App.showMsg).not.toHaveBeenCalledWith(expect.stringContaining("Created child"), "success");
  });
});
