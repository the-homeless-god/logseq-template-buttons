import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildRunDialogCommand, runCommandButton } from "../src/commandRunner";
import { showCopyPanel, copyTextToClipboard } from "../src/clipboard";
import { registerPageBar, refreshPageBar } from "../src/pageBar";
import { buildSocialMarkdown } from "../src/socialMarkdown";
import { initDateFormat } from "../src/templateLogic";
import * as scriptLauncher from "../src/scriptLauncher";

function mockParentDoc() {
  const parentDoc = document.implementation.createHTMLDocument("parent");
  Object.defineProperty(window, "parent", {
    configurable: true,
    value: { document: parentDoc, innerWidth: 800, innerHeight: 600, navigator },
  });
  return parentDoc;
}

describe("remaining line coverage", () => {
  beforeEach(async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockParentDoc();
    await initDateFormat();
  });

  it("covers clipboard host document catch", () => {
    showCopyPanel("text");
    expect(window.parent.document.getElementById("lstb-copy-fallback-overlay")).toBeTruthy();
  });

  it("covers absolute binary allowlist detection", async () => {
    vi.spyOn(scriptLauncher, "resolveTerminalScriptForCommand").mockReturnValue(null);
    logseq.settings.preferTerminalScripts = false;
    Object.defineProperty(window, "parent", {
      configurable: true,
      value: {
        document,
        navigator: { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } },
      },
    });
    expect(buildRunDialogCommand("/graph", "/graph", "/usr/local/bin/cargo build")).toContain("cargo");
    await runCommandButton({ label: "Cargo", cwd: ".", command: "/usr/local/bin/cargo build" });
  });

  it("covers pageBar overlay noop clicks and missing template guard", async () => {
    logseq.settings.buttons = JSON.stringify([
      { label: "Child", type: "template", template: "Focus time", scope: "page" },
    ]);
    logseq.Editor.getCurrentPage.mockResolvedValue({
      name: "Parent.Page",
      originalName: "Parent.Page",
    });
    registerPageBar();
    await Promise.resolve();
    await Promise.resolve();

    const { togglePageBarMenu } = globalThis.__pluginModels as { togglePageBarMenu: () => void };
    togglePageBarMenu();
    await Promise.resolve();

    const parentDoc = window.parent.document;
    parentDoc.getElementById("lstb-pagebar-overlay")?.dispatchEvent(
      new MouseEvent("click", { bubbles: true })
    );

    logseq.Editor.getCurrentPage.mockResolvedValue(null);
    refreshPageBar();
    await Promise.resolve();
    parentDoc.querySelector('[data-lstb-index="0"]')?.dispatchEvent(
      new MouseEvent("click", { bubbles: true })
    );
  });

  it("covers socialMarkdown nested post search and uuid refs", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })));
    logseq.Editor.getPageBlocksTree.mockResolvedValue([
      {
        uuid: "root",
        content: "wrapper",
        children: [{ uuid: "nested-post", content: "#post", children: [["uuid", "content-ref"]] }],
      },
    ]);
    logseq.Editor.getBlock.mockImplementation(async (id: string) => {
      if (id === "root") {
        return {
          uuid: "root",
          content: "wrapper",
          children: [{ uuid: "nested-post", content: "#post", children: [["uuid", "content-ref"]] }],
        };
      }
      if (id === "nested-post") {
        return {
          uuid: "nested-post",
          content: "#post",
          children: [["uuid", "content-ref"]],
        };
      }
      if (id === "content-ref") {
        return {
          uuid: "content-ref",
          content: "**Content**",
          children: [{ uuid: "body", content: "Nested body", children: [] }],
        };
      }
      return null;
    });

    const markdown = await buildSocialMarkdown("Nested.Post");
    expect(markdown).toContain("Nested body");
  });
});
