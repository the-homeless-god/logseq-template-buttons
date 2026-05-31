import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerPageBar, refreshPageBar } from "../src/pageBar";
import * as socialMarkdown from "../src/socialMarkdown";
import * as templateLogic from "../src/templateLogic";

function mockParentDocument() {
  const parentDoc = document.implementation.createHTMLDocument("parent");
  parentDoc.body.innerHTML = "<div id='host'></div>";
  Object.defineProperty(window, "parent", {
    configurable: true,
    value: {
      document: parentDoc,
      innerWidth: 1200,
      innerHeight: 800,
      navigator: navigator,
    },
  });
  return parentDoc;
}

async function flushPageBar() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("pageBar", () => {
  let parentDoc: Document;

  beforeEach(() => {
    parentDoc = mockParentDocument();
    logseq.settings.pageBarEnabled = true;
    logseq.settings.buttons = JSON.stringify([
      { label: "Child", type: "template", template: "Focus time", scope: "page" },
      { label: "Both", type: "template", template: "Digitable.Blog", scope: "both" },
    ]);
    logseq.Editor.getCurrentPage.mockResolvedValue({
      name: "Parent.Page",
      originalName: "Parent.Page",
    });
    logseq.App.queryElementRect.mockResolvedValue({
      top: 40,
      left: 900,
      right: 940,
      bottom: 74,
      width: 40,
      height: 34,
    });
  });

  it("registers page bar UI and models", async () => {
    registerPageBar();
    await flushPageBar();

    expect(logseq.provideModel).toHaveBeenCalled();
    expect(logseq.provideStyle).toHaveBeenCalled();
    expect(logseq.App.registerUIItem).toHaveBeenCalledWith(
      "pagebar",
      expect.objectContaining({ key: "logseq-template-buttons-pagebar" })
    );

    const routeHandler = logseq.App.onRouteChanged.mock.calls[0][0];
    await routeHandler();
    expect(logseq.App.registerUIItem).toHaveBeenCalledTimes(2);
  });

  it("disables page bar when setting is off", async () => {
    registerPageBar();
    logseq.settings.pageBarEnabled = false;
    refreshPageBar();
    await flushPageBar();
    expect(logseq.App.registerUIItem).not.toHaveBeenCalled();
  });

  it("handles journal pages and overlay actions", async () => {
    registerPageBar();
    await flushPageBar();

    logseq.Editor.getCurrentPage.mockResolvedValueOnce({ name: "journals/2026_05_31", "journal?": true });
    refreshPageBar();
    await flushPageBar();

    const template = logseq.App.registerUIItem.mock.calls.at(-1)?.[1]?.template as string;
    expect(template).toContain("opacity-60");

    const { togglePageBarMenu, copyPageSocialMarkdown } = globalThis.__pluginModels as {
      togglePageBarMenu: () => void;
      copyPageSocialMarkdown: () => Promise<void>;
    };

    await copyPageSocialMarkdown();
    expect(logseq.App.showMsg).toHaveBeenCalledWith("Open a regular page (not a journal)", "warning");

    logseq.Editor.getCurrentPage.mockResolvedValue({
      name: "Parent.Page",
      originalName: "Parent.Page",
    });
    refreshPageBar();
    await flushPageBar();

    togglePageBarMenu();
    expect(parentDoc.getElementById("lstb-pagebar-overlay")).toBeTruthy();

    togglePageBarMenu();
    expect(parentDoc.getElementById("lstb-pagebar-overlay")).toBeNull();

    logseq.Editor.getCurrentPage.mockResolvedValue({
      name: "Parent.Page",
      originalName: "Parent.Page",
    });
    refreshPageBar();
    await flushPageBar();

    logseq.settings.buttons = JSON.stringify([
      { label: "Hidden", type: "template", template: "Focus time", scope: "sidebar" },
    ]);
    togglePageBarMenu();
    expect(logseq.App.showMsg).toHaveBeenCalledWith(
      "No templates for page bar (scope: page or both)",
      "warning"
    );
  });

  it("creates child pages and copies social markdown", async () => {
    registerPageBar();
    await flushPageBar();

    const childSpy = vi.spyOn(templateLogic, "createChildPageFromTemplate").mockResolvedValue(undefined);
    const copySpy = vi.spyOn(socialMarkdown, "copySocialMarkdownForPage").mockResolvedValue(true);

    const { togglePageBarMenu } = globalThis.__pluginModels as { togglePageBarMenu: () => void };
    togglePageBarMenu();

    const item = parentDoc.querySelector('[data-lstb-index="0"]') as HTMLButtonElement;
    item.click();
    await Promise.resolve();
    expect(childSpy).toHaveBeenCalled();

    const { copyPageSocialMarkdown } = globalThis.__pluginModels as {
      copyPageSocialMarkdown: () => Promise<void>;
    };
    await copyPageSocialMarkdown();
    expect(copySpy).toHaveBeenCalledWith("Parent.Page");

    childSpy.mockRestore();
    copySpy.mockRestore();
  });

  it("positions popup without rect and closes via backdrop", async () => {
    registerPageBar();
    await flushPageBar();

    logseq.App.queryElementRect.mockResolvedValueOnce(null);
    const { togglePageBarMenu } = globalThis.__pluginModels as { togglePageBarMenu: () => void };
    togglePageBarMenu();

    const backdrop = parentDoc.querySelector("[data-lstb-close]") as HTMLElement;
    backdrop.click();
    expect(parentDoc.getElementById("lstb-pagebar-overlay")).toBeNull();
  });
});
