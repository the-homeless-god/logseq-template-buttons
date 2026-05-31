import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  mountSidebarWhenReady,
  registerSidebarModel,
  registerToolbarFallback,
  scheduleSidebarRender,
  renderSidebar,
} from "../src/sidebar";
import * as commandRunner from "../src/commandRunner";
import * as scriptLauncher from "../src/scriptLauncher";
import * as templateLogic from "../src/templateLogic";

describe("sidebar", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    logseq.settings.buttons = JSON.stringify([
      { label: "Blog", type: "template", template: "Digitable.Blog", scope: "sidebar" },
      { label: "Push", type: "git", command: "push", scope: "sidebar" },
      { label: "Publish", type: "terminal", script: "scripts/x.command", scope: "sidebar" },
      { label: "Build", type: "command", command: "npm run build", scope: "sidebar" },
    ]);
    logseq.App.queryElementRect.mockImplementation(async (path: string) =>
      path.includes("sidebar-contents-container")
        ? { top: 0, left: 0, right: 100, bottom: 100, width: 100, height: 100 }
        : null
    );
  });

  it("renders legacy sidebar markup", async () => {
    const mounted = await renderSidebar();
    expect(mounted).toBe(true);
    expect(logseq.provideUI).toHaveBeenCalledWith(
      expect.objectContaining({
        template: expect.stringContaining("sidebar-content-group"),
      })
    );
  });

  it("renders modern sidebar when nav container exists", async () => {
    logseq.App.queryElementRect.mockImplementation(async (path: string) =>
      path.includes("nav-contents-container")
        ? { top: 0, left: 0, right: 100, bottom: 100, width: 100, height: 100 }
        : null
    );

    await renderSidebar();
    expect(logseq.provideUI).toHaveBeenCalledWith(
      expect.objectContaining({
        template: expect.stringContaining("nav-content-item"),
      })
    );
  });

  it("shows empty state when no sidebar buttons configured", async () => {
    logseq.settings.buttons = JSON.stringify([
      { label: "PageOnly", type: "template", template: "Focus time", scope: "page" },
    ]);
    await renderSidebar();
    const template = logseq.provideUI.mock.calls.at(-1)?.[0]?.template as string;
    expect(template).toContain("No buttons configured");
  });

  it("schedules sidebar render and clears pending timer", async () => {
    scheduleSidebarRender();
    scheduleSidebarRender();
    await vi.advanceTimersByTimeAsync(150);
    expect(logseq.provideUI).toHaveBeenCalled();
  });

  it("handles sidebar button clicks", async () => {
    registerSidebarModel();
    const { handleSidebarButton } = globalThis.__pluginModels as {
      handleSidebarButton: (event: { dataset?: { buttonIndex?: string } }) => Promise<void>;
    };

    const templateSpy = vi.spyOn(templateLogic, "createPageFromTemplate").mockResolvedValue(undefined);
    const gitSpy = vi.spyOn(commandRunner, "runGitButton").mockResolvedValue(undefined);
    const termSpy = vi.spyOn(scriptLauncher, "runTerminalButton").mockResolvedValue(true);
    const cmdSpy = vi.spyOn(commandRunner, "runCommandButton").mockResolvedValue(undefined);

    await handleSidebarButton({ dataset: { buttonIndex: "0" } });
    expect(templateSpy).toHaveBeenCalled();

    await handleSidebarButton({ dataset: { buttonIndex: "1" } });
    expect(gitSpy).toHaveBeenCalled();

    await handleSidebarButton({ dataset: { buttonIndex: "2" } });
    expect(termSpy).toHaveBeenCalled();

    await handleSidebarButton({ dataset: { buttonIndex: "3" } });
    expect(cmdSpy).toHaveBeenCalled();

    await handleSidebarButton({ dataset: { buttonIndex: "NaN" } });
    await handleSidebarButton({ dataset: { buttonIndex: "99" } });
  });

  it("registers toolbar fallback and mounts with polling", async () => {
    logseq.App.setLeftSidebarVisible = vi.fn();
    registerToolbarFallback();

    const { openTemplateButtonsPanel } = globalThis.__pluginModels as {
      openTemplateButtonsPanel: () => void;
    };
    openTemplateButtonsPanel();
    expect(logseq.App.setLeftSidebarVisible).toHaveBeenCalledWith(true);

    logseq.App.queryElementRect.mockImplementation(async (path: string) =>
      path.includes("nav-contents-container")
        ? { top: 0, left: 0, right: 100, bottom: 100, width: 100, height: 100 }
        : null
    );

    await mountSidebarWhenReady();
    await vi.advanceTimersByTimeAsync(2000);
    expect(logseq.provideUI).toHaveBeenCalled();
  });

  it("retries mount until sidebar appears", async () => {
    logseq.App.queryElementRect.mockResolvedValue(null);
    const promise = mountSidebarWhenReady();
    await vi.advanceTimersByTimeAsync(250 * 3);
    logseq.App.queryElementRect.mockImplementation(async (path: string) =>
      path.includes("nav-contents-container")
        ? { top: 0, left: 0, right: 100, bottom: 100, width: 100, height: 100 }
        : null
    );
    await vi.advanceTimersByTimeAsync(250);
    await promise;
    expect(logseq.provideUI).toHaveBeenCalled();
  });
});
