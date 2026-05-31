import { beforeEach, describe, expect, it } from "vitest";
import { refreshPageBar, registerPageBar } from "../src/pageBar";

function mockParentDocument() {
  const parentDoc = document.implementation.createHTMLDocument("parent");
  parentDoc.body.innerHTML = "<div id='host'></div>";
  Object.defineProperty(window, "parent", {
    configurable: true,
    value: {
      document: parentDoc,
      innerWidth: 400,
      innerHeight: 300,
      navigator,
    },
  });
  return parentDoc;
}

describe("pageBar coverage", () => {
  let parentDoc: Document;

  beforeEach(() => {
    parentDoc = mockParentDocument();
    logseq.settings.pageBarEnabled = true;
    logseq.settings.buttons = JSON.stringify([
      { label: "Child", type: "template", template: "Focus time", scope: "page" },
    ]);
    logseq.Editor.getCurrentPage.mockResolvedValue({
      name: "Parent.Page",
      originalName: "Parent.Page",
    });
  });

  async function flush() {
    await Promise.resolve();
    await Promise.resolve();
  }

  it("handles invalid current page and popup positioning", async () => {
    registerPageBar();
    logseq.Editor.getCurrentPage.mockResolvedValueOnce({});
    refreshPageBar();
    await flush();

    logseq.Editor.getCurrentPage.mockResolvedValue({
      name: "Parent.Page",
      originalName: "Parent.Page",
    });
    refreshPageBar();
    await flush();

    logseq.App.queryElementRect.mockResolvedValueOnce({
      top: 250,
      left: 350,
      right: 390,
      bottom: 284,
      width: 40,
      height: 34,
    });

    const { togglePageBarMenu } = globalThis.__pluginModels as { togglePageBarMenu: () => void };
    togglePageBarMenu();
    await flush();
    expect(parentDoc.getElementById("lstb-pagebar-overlay-styles")).toBeTruthy();

    togglePageBarMenu();
    togglePageBarMenu();
    await flush();
    expect(parentDoc.querySelectorAll("#lstb-pagebar-overlay-styles")).toHaveLength(1);

    parentDoc.querySelector(".lstb-pagebar-backdrop")?.dispatchEvent(
      new MouseEvent("click", { bubbles: true })
    );
    parentDoc.querySelector(".lstb-pagebar-popup")?.dispatchEvent(
      new MouseEvent("click", { bubbles: true })
    );
  });

  it("handles overlay guard paths and invalid template buttons", async () => {
    registerPageBar();
    await flush();

    const { togglePageBarMenu } = globalThis.__pluginModels as { togglePageBarMenu: () => void };

    logseq.Editor.getCurrentPage.mockResolvedValueOnce(null);
    refreshPageBar();
    await flush();
    togglePageBarMenu();
    expect(logseq.App.showMsg).toHaveBeenCalledWith("Откройте обычную страницу (не journal)", "warning");

    logseq.Editor.getCurrentPage.mockResolvedValue({
      name: "Parent.Page",
      originalName: "Parent.Page",
    });
    refreshPageBar();
    await flush();

    logseq.App.queryElementRect.mockResolvedValueOnce({
      top: 10,
      left: 5,
      right: 45,
      bottom: 44,
      width: 40,
      height: 34,
    });
    togglePageBarMenu();
    await flush();

    logseq.settings.buttons = JSON.stringify([
      { label: "Broken", type: "template", template: "Missing", scope: "page" },
    ]);
    refreshPageBar();
    await flush();
    togglePageBarMenu();
    await flush();
    parentDoc.querySelector('[data-lstb-index="0"]')?.dispatchEvent(
      new MouseEvent("click", { bubbles: true })
    );
  });
});
