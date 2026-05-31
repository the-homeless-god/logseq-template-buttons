import { vi } from "vitest";

export function createLogseqMock() {
  return {
    App: {
      showMsg: vi.fn(),
      getUserConfigs: vi.fn(async () => ({ preferredDateFormat: "dd.MM.yyyy" })),
      getCurrentGraph: vi.fn(async () => ({ path: "/graph/logsec", url: "file:///graph/logsec" })),
      existTemplate: vi.fn(async () => true),
      getTemplate: vi.fn(),
      insertTemplate: vi.fn(async () => undefined),
      pushState: vi.fn(),
      invokeExternalCommand: vi.fn(async () => undefined),
      openExternalLink: vi.fn(async () => undefined),
      registerCommand: vi.fn(),
      registerUIItem: vi.fn(),
      queryElementRect: vi.fn(async () => null),
      onRouteChanged: vi.fn(() => ({ off: vi.fn() })),
      onGraphAfterIndexed: vi.fn(() => ({ off: vi.fn() })),
      onThemeModeChanged: vi.fn(() => ({ off: vi.fn() })),
      onSidebarVisibleChanged: vi.fn(() => ({ off: vi.fn() })),
      onCurrentGraphChanged: vi.fn(() => ({ off: vi.fn() })),
    },
    Editor: {
      getCurrentPage: vi.fn(async () => ({ name: "Digitable.Post.Test", originalName: "Digitable.Post.Test" })),
      getPage: vi.fn(async () => null),
      getPageBlocksTree: vi.fn(async () => []),
      getBlock: vi.fn(async () => null),
      createPage: vi.fn(async () => ({ uuid: "page-uuid", name: "Test" })),
      deletePage: vi.fn(async () => undefined),
      insertBatchBlock: vi.fn(async () => null),
      removeBlock: vi.fn(async () => undefined),
      appendBlockInPage: vi.fn(async () => ({ uuid: "block-uuid" })),
    },
    Git: {
      execCommand: vi.fn(async () => ({ stdout: "ok", stderr: "", exitCode: 0 })),
    },
    settings: {
      sectionTitle: "Templates",
      defaultPageName: "{template}.{date}",
      childPageName: "{parent}/{template}.{date}",
      addBacklinkOnParent: true,
      pageBarEnabled: true,
      preferTerminalScripts: true,
      nodePath: "",
      buttons: "",
    },
    provideModel: vi.fn(),
    provideStyle: vi.fn(),
    provideUI: vi.fn(),
    useSettingsSchema: vi.fn(),
    onSettingsChanged: vi.fn(),
    ready: vi.fn((callback: () => void) => {
      void callback();
      return Promise.resolve();
    }),
  };
}

export function resetLogseqMock(logseq: ReturnType<typeof createLogseqMock>) {
  Object.values(logseq.App).forEach((fn) => {
    if (typeof fn === "function" && "mockClear" in fn) {
      (fn as { mockClear: () => void }).mockClear();
    }
  });
  Object.values(logseq.Editor).forEach((fn) => {
    if (typeof fn === "function" && "mockClear" in fn) {
      (fn as { mockClear: () => void }).mockClear();
    }
  });
  logseq.Git.execCommand.mockClear();
  logseq.settings.nodePath = "";
  logseq.settings.preferTerminalScripts = true;
  logseq.settings.pageBarEnabled = true;
  logseq.settings.buttons = "";
}
