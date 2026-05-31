import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createChildPageFromTemplate,
  createPageFromTemplate,
  initDateFormat,
  resolvePageNamePattern,
} from "../src/templateLogic";

function mockTemplateTree(extra?: { children?: unknown[] }) {
  logseq.App.getTemplate.mockResolvedValue({ uuid: "tpl" });
  logseq.Editor.getBlock.mockImplementation(async (id: string | { uuid: string }) => {
    const key = typeof id === "string" ? id : id.uuid;
    if (key === "tpl") {
      return {
        uuid: "tpl",
        content: "Template",
        children: extra?.children ?? [
          { uuid: "child", content: "Line <%today%>", properties: { template: "X" }, children: [] },
          { uuid: "child-2", content: "Second <%yesterday%>", children: [] },
        ],
      };
    }
    if (key === "child-ref") {
      return { uuid: "child-ref", content: "From uuid ref", children: [] };
    }
    if (key === "nested-child") {
      return {
        uuid: "nested-child",
        content: "Nested",
        children: [["uuid", "child-ref"]],
      };
    }
    return null;
  });
}

function mockSuccessfulInsert() {
  let inserted = false;
  logseq.Editor.insertBatchBlock.mockImplementation(async () => {
    inserted = true;
    return null;
  });
  logseq.Editor.getPageBlocksTree.mockImplementation(async () => {
    if (!inserted) {
      return [{ uuid: "ph", content: "" }];
    }
    return [
      { uuid: "ph", content: "" },
      { uuid: "b1", content: "Line" },
      { uuid: "b2", content: "Second" },
    ];
  });
}

function mockFailedInsert() {
  logseq.Editor.getPageBlocksTree.mockResolvedValue([
    { uuid: "ph", content: "" },
    { uuid: "keep", content: "existing" },
  ]);
  logseq.Editor.insertBatchBlock.mockResolvedValue(null);
  logseq.App.insertTemplate.mockResolvedValue(undefined);
}

describe("templateLogic", () => {
  beforeEach(async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await initDateFormat();
    logseq.Editor.getPage.mockResolvedValue(null);
    logseq.Editor.createPage.mockResolvedValue({ uuid: "new-page", name: "New" });
    mockTemplateTree();
    mockSuccessfulInsert();
  });

  it("resolves page name patterns and dynamic tokens", () => {
    expect(resolvePageNamePattern("{template}-{parent-short}", "T", { parentPageName: "A/B" })).toBe("T-B");
    expect(resolvePageNamePattern("{datetime}", "T")).toMatch(/\d/);
  });

  it("creates pages from templates", async () => {
    const promise = createPageFromTemplate("Focus time", "{template}");
    await vi.runAllTimersAsync();
    await promise;

    expect(logseq.App.pushState).toHaveBeenCalledWith("page", { name: expect.any(String) });
    expect(logseq.App.showMsg).toHaveBeenCalledWith(expect.stringContaining("Created"), "success");
  });

  it("handles missing templates and failed inserts", async () => {
    logseq.App.existTemplate.mockResolvedValueOnce(false);
    await createPageFromTemplate("Missing", "{template}");
    expect(logseq.App.showMsg).toHaveBeenCalledWith('Template "Missing" not found', "warning");

    logseq.App.existTemplate.mockResolvedValue(true);
    logseq.App.getTemplate.mockResolvedValueOnce(null);
    await createPageFromTemplate("Empty", "{template}");
    expect(logseq.App.showMsg).toHaveBeenCalledWith('Template "Empty" has no content blocks', "warning");

    mockTemplateTree({ children: [] });
    await createPageFromTemplate("Empty", "{template}");
    expect(logseq.App.showMsg).toHaveBeenCalledWith('Template "Empty" has no content blocks', "warning");

    mockTemplateTree();
    logseq.Editor.createPage.mockResolvedValueOnce(null);
    await createPageFromTemplate("Focus time", "{template}");
    expect(logseq.App.showMsg).toHaveBeenCalledWith('Failed to create page "Focus time"', "error");

    logseq.Editor.createPage.mockResolvedValue({ uuid: "new-page", name: "New" });
    mockFailedInsert();

    const failPromise = createPageFromTemplate("Focus time", "{template}");
    await vi.runAllTimersAsync();
    await failPromise;
    expect(logseq.Editor.deletePage).toHaveBeenCalled();
    expect(logseq.App.showMsg).toHaveBeenCalledWith(expect.stringContaining("Failed to insert"), "error");
  });

  it("creates child pages with optional backlink", async () => {
    logseq.Editor.getPage.mockResolvedValue(null);
    mockSuccessfulInsert();

    await createChildPageFromTemplate("Parent", "Focus time", "{template}", { addBacklink: false });
    expect(logseq.Editor.appendBlockInPage).not.toHaveBeenCalled();

    mockSuccessfulInsert();
    await createChildPageFromTemplate("Parent", "Focus time", "{parent}/{template}");
    expect(logseq.Editor.appendBlockInPage).toHaveBeenCalledWith("Parent", expect.stringContaining("[["));

    logseq.App.existTemplate.mockResolvedValueOnce(false);
    await createChildPageFromTemplate("Parent", "X", "{template}");
    expect(logseq.App.showMsg).toHaveBeenCalledWith('Template "X" not found', "warning");
  });

  it("covers uuid refs, nested children, and native insert fallback", async () => {
    mockTemplateTree({
      children: [["uuid", "nested-child"]],
    });
    mockFailedInsert();
    logseq.App.insertTemplate.mockImplementation(async () => {
      logseq.Editor.getPageBlocksTree.mockResolvedValue([
        { uuid: "ph", content: "" },
        { uuid: "keep", content: "existing" },
        { uuid: "native", content: "Native" },
      ]);
    });

    const promise = createPageFromTemplate("Focus time", "Unique");
    await vi.runAllTimersAsync();
    await promise;
    expect(logseq.App.insertTemplate).toHaveBeenCalled();
  });
});
