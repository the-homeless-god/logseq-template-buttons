import { beforeEach, describe, expect, it, vi } from "vitest";
import * as settings from "../src/settings";
import { pageBarTestHooks } from "../src/pageBar";
import {
  buildNodeScriptCommand,
  getConfiguredNodePath,
  npmCommandToNodeScript,
  resolveTerminalScriptForCommand,
} from "../src/scriptLauncher";
import { buildRunDialogCommand, runCommandButton } from "../src/commandRunner";
import { copyTextToClipboard } from "../src/clipboard";
import { buildSocialMarkdown } from "../src/socialMarkdown";
import { mountSidebarWhenReady } from "../src/sidebar";
import {
  createChildPageFromTemplate,
  createPageFromTemplate,
  initDateFormat,
} from "../src/templateLogic";
import * as scriptLauncher from "../src/scriptLauncher";

function mockParentDoc() {
  Object.defineProperty(window, "parent", {
    configurable: true,
    value: new Proxy(
      { innerWidth: 800, innerHeight: 600 },
      {
        get(_target, prop) {
          if (prop === "document") {
            throw new Error("cross origin document");
          }
          if (prop === "navigator") {
            return undefined;
          }
          return undefined;
        },
      }
    ),
  });
}

function mockTemplateBlock(children: unknown[]) {
  logseq.App.getTemplate.mockResolvedValue({ uuid: "tpl" });
  logseq.Editor.getBlock.mockImplementation(async (id: string) => {
    if (id === "tpl") {
      return { uuid: "tpl", content: "Template", children };
    }
    if (id === "uuid-child") {
      return { uuid: "uuid-child", content: "From ref", children: [] };
    }
    return null;
  });
}

function mockBlockCountGate(successAfterBatchInserts: number) {
  let batchInserts = 0;
  logseq.Editor.insertBatchBlock.mockImplementation(async () => {
    batchInserts += 1;
    return null;
  });
  logseq.Editor.getPageBlocksTree.mockImplementation(async () => {
    const count = batchInserts >= successAfterBatchInserts ? 4 : 2;
    return Array.from({ length: count }, (_, index) => ({
      uuid: index === 0 ? "ph" : `b${index}`,
      content: index === 0 ? "" : "block",
    }));
  });
  return () => batchInserts;
}

describe("full coverage gaps", () => {
  beforeEach(async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await initDateFormat();
    logseq.Editor.getPage.mockReset();
    logseq.Editor.getPageBlocksTree.mockReset();
    logseq.Editor.insertBatchBlock.mockReset();
    logseq.Editor.getBlock.mockReset();
    logseq.Editor.createPage.mockResolvedValue({ uuid: "page", name: "Page" });
    logseq.Editor.getPage.mockResolvedValue(null);
  });

  it("covers clipboard parent.document catch fallback", async () => {
    mockParentDoc();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
    document.execCommand = vi.fn().mockReturnValue(true);
    const result = await copyTextToClipboard("via-iframe-doc");
    expect(result.ok).toBe(true);
  });

  it("covers allowlist null branch for git commands", async () => {
    vi.spyOn(scriptLauncher, "resolveTerminalScriptForCommand").mockReturnValue(null);
    logseq.settings.preferTerminalScripts = false;
    Object.defineProperty(window, "parent", {
      configurable: true,
      value: {
        document,
        navigator: { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } },
      },
    });
    await runCommandButton({ label: "Git", cwd: ".", command: "git status" });
    expect(buildRunDialogCommand("/graph", "/graph", "git status")).toBe("git status");
  });

  it("covers pageBar handlePageBarIndex guards", async () => {
    vi.spyOn(settings, "getPageButtons").mockReturnValue([
      { label: "Broken", type: "template", scope: "page" },
    ]);

    pageBarTestHooks.setCurrentPageName(null);
    await pageBarTestHooks.handlePageBarIndex(0);
    expect(logseq.App.showMsg).toHaveBeenCalledWith("Откройте обычную страницу (не journal)", "warning");

    pageBarTestHooks.setCurrentPageName("Parent");
    await pageBarTestHooks.handlePageBarIndex(0);
    expect(logseq.Editor.appendBlockInPage).not.toHaveBeenCalled();
  });

  it("covers scriptLauncher branch fallbacks", () => {
    logseq.settings.nodePath = "";
    expect(resolveTerminalScriptForCommand("npm run unknown:script")).toBeNull();
    expect(getConfiguredNodePath()).toBe("");
    expect(npmCommandToNodeScript("/graph", "npm run publish:blog")).toContain("publish-digitable-blog.mjs");
    expect(buildNodeScriptCommand("/graph", "scripts/a.mjs")).toBe("node /graph/scripts/a.mjs");
  });

  it("covers socialMarkdown resolveBlockChild edge cases", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })));
    logseq.Editor.getPageBlocksTree.mockResolvedValue([]);
    await expect(buildSocialMarkdown("Empty.Tree")).resolves.toBeNull();

    let treeCalls = 0;
    logseq.Editor.getPageBlocksTree.mockImplementation(async () => {
      treeCalls += 1;
      return treeCalls === 1 ? [{ uuid: "plain", content: "no post", children: [] }] : [];
    });
    await expect(buildSocialMarkdown("Missing.Post.Block")).resolves.toBeNull();

    logseq.Editor.getPageBlocksTree.mockResolvedValue([
      {
        uuid: "root",
        content: "wrapper",
        children: [["uuid", "missing-block"]],
      },
    ]);
    logseq.Editor.getBlock.mockImplementation(async (id: string) => {
      if (id === "root") return null;
      return null;
    });
    await expect(buildSocialMarkdown("Missing.Block")).resolves.toBeNull();

    logseq.Editor.getPageBlocksTree.mockResolvedValue([
      {
        uuid: "post",
        content: "#post",
        children: [
          ["invalid", "child"],
          { uuid: "tags", content: "**Tags**", children: [["uuid", "missing-tag"]] },
          { uuid: "content", content: "**Content**", children: [{ uuid: "c1", content: "Body", children: [] }] },
        ],
      },
    ]);
    logseq.Editor.getBlock.mockImplementation(async (id: string) => {
      if (id === "post") {
        return {
          uuid: "post",
          content: "#post",
          children: [
            ["invalid", "child"],
            { uuid: "tags", content: "**Tags**", children: [["uuid", "missing-tag"]] },
            { uuid: "content", content: "**Content**", children: [{ uuid: "c1", content: "Body", children: [] }] },
          ],
        };
      }
      if (id === "missing-tag") return null;
      return null;
    });

    const markdown = await buildSocialMarkdown("Partial.Post");
    expect(markdown).toContain("Body");
  });

  it("covers templateLogic block resolution branches", async () => {
    mockTemplateBlock([
      { uuid: "with-ref", content: "Ref parent", children: [["uuid", "uuid-child"]] },
      "not-a-block" as never,
    ]);

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
    expect(logseq.Editor.getBlock).toHaveBeenCalledWith("with-ref", { includeChildren: true });
  });

  it("covers insert sibling-false success path", async () => {
    mockTemplateBlock([{ uuid: "c1", content: "One", children: [] }, { uuid: "c2", content: "Two", children: [] }]);
    mockBlockCountGate(2);

    const promise = createPageFromTemplate("Focus time", "SiblingFalse");
    await vi.runAllTimersAsync();
    await promise;
    expect(logseq.App.showMsg).toHaveBeenCalledWith(expect.stringContaining("Created"), "success");
  });

  it("covers insert one-by-one success path", async () => {
    mockTemplateBlock([{ uuid: "c1", content: "One", children: [] }, { uuid: "c2", content: "Two", children: [] }]);
    mockBlockCountGate(3);

    const promise = createPageFromTemplate("Focus time", "OneByOne");
    await vi.runAllTimersAsync();
    await promise;
    expect(logseq.App.showMsg).toHaveBeenCalledWith(expect.stringContaining("Created"), "success");
  });

  it("covers insert by page uuid success path", async () => {
    mockTemplateBlock([{ uuid: "c1", content: "One", children: [] }, { uuid: "c2", content: "Two", children: [] }]);
    logseq.Editor.getPage.mockResolvedValue({ uuid: "page-uuid", name: "ByUuid" });

    let batchInserts = 0;
    logseq.Editor.insertBatchBlock.mockImplementation(async () => {
      batchInserts += 1;
      return null;
    });
    logseq.Editor.getPageBlocksTree.mockImplementation(async () => {
      const count = batchInserts >= 6 ? 4 : 2;
      return Array.from({ length: count }, (_, index) => ({
        uuid: index === 0 ? "ph" : `b${index}`,
        content: index === 0 ? "" : "block",
      }));
    });

    const promise = createPageFromTemplate("Focus time", "ByUuid");
    await vi.runAllTimersAsync();
    await promise;
    expect(batchInserts).toBeGreaterThanOrEqual(6);
  });

  it("covers insert by page name success path", async () => {
    mockTemplateBlock([{ uuid: "c1", content: "One", children: [] }]);
    logseq.Editor.getPage.mockResolvedValue({ uuid: "page-uuid", name: "ByName" });

    let batchInserts = 0;
    logseq.Editor.insertBatchBlock.mockImplementation(async () => {
      batchInserts += 1;
      return null;
    });
    logseq.Editor.getPageBlocksTree.mockImplementation(async () => {
      const count = batchInserts >= 4 ? 3 : 2;
      return Array.from({ length: count }, (_, index) => ({
        uuid: index === 0 ? "ph" : `b${index}`,
        content: index === 0 ? "" : "block",
      }));
    });

    const promise = createPageFromTemplate("Focus time", "ByName");
    await vi.runAllTimersAsync();
    await promise;
    expect(batchInserts).toBeGreaterThanOrEqual(4);
  });

  it("covers alternate fallback placeholder insert path", async () => {
    mockTemplateBlock([{ uuid: "c1", content: "One", children: [] }]);
    logseq.Editor.getPage.mockResolvedValue({ uuid: "page-uuid", name: "FallbackPh" });

    let batchInserts = 0;
    logseq.Editor.insertBatchBlock.mockImplementation(async () => {
      batchInserts += 1;
      return null;
    });
    logseq.Editor.getPageBlocksTree.mockImplementation(async () => {
      if (batchInserts >= 6) {
        return [
          { uuid: "alt-ph", content: "" },
          { uuid: "keep", content: "old" },
          { uuid: "b1", content: "block" },
        ];
      }
      if (batchInserts >= 5) {
        return [
          { uuid: "alt-ph", content: "" },
          { uuid: "keep", content: "old" },
        ];
      }
      return [
        { uuid: "ph", content: "" },
        { uuid: "keep", content: "old" },
      ];
    });

    const promise = createPageFromTemplate("Focus time", "FallbackPh");
    await vi.runAllTimersAsync();
    await promise;
    expect(batchInserts).toBeGreaterThanOrEqual(6);
  });

  it("covers fallback placeholder path and deletePage for existing page", async () => {
    mockTemplateBlock([{ uuid: "c1", content: "One", children: [] }]);

    const takenCalls: string[] = [];
    logseq.Editor.getPage.mockImplementation(async (name: string) => {
      if (name === "Taken") {
        takenCalls.push(name);
        return takenCalls.length === 1 ? null : { uuid: "exists" };
      }
      return { uuid: "page-uuid", name };
    });

    let batchInserts = 0;
    logseq.Editor.insertBatchBlock.mockImplementation(async () => {
      batchInserts += 1;
      return null;
    });

    let treeCalls = 0;
    logseq.Editor.getPageBlocksTree.mockImplementation(async () => {
      treeCalls += 1;
      if (treeCalls === 1) return [{ uuid: "ph", content: "" }];
      if (batchInserts < 6) {
        return [
          { uuid: "ph", content: "" },
          { uuid: "alt-ph", content: "" },
        ];
      }
      return [
        { uuid: "ph", content: "" },
        { uuid: "alt-ph", content: "" },
        { uuid: "b1", content: "block" },
      ];
    });

    const promise = createPageFromTemplate("Focus time", "Taken");
    await vi.runAllTimersAsync();
    await promise;
    expect(logseq.Editor.deletePage).toHaveBeenCalledWith("Taken");
  });

  it("covers ensureChildPageName parent prefix branches", async () => {
    mockTemplateBlock([{ uuid: "c1", content: "Line", children: [] }]);
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

    await createChildPageFromTemplate("", "Focus time", "FlatName", { addBacklink: false });
    await vi.runAllTimersAsync();

    inserted = false;
    await createChildPageFromTemplate("Parent", "Focus time", "Parent/Deep/Child", { addBacklink: false });
    await vi.runAllTimersAsync();
  });

  it("covers sidebar mount giving up after max attempts", async () => {
    vi.useRealTimers();
    logseq.App.queryElementRect.mockResolvedValue(null);
    const promise = mountSidebarWhenReady(79);
    await new Promise((resolve) => setTimeout(resolve, 300));
    await promise;
    expect(logseq.provideUI).not.toHaveBeenCalled();
  });
});
