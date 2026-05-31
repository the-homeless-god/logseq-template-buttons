import { beforeEach, vi } from "vitest";
import { createLogseqMock, resetLogseqMock } from "./helpers/logseqMock";

declare global {
  // eslint-disable-next-line no-var
  var logseq: ReturnType<typeof createLogseqMock>;
  // eslint-disable-next-line no-var
  var __pluginModels: Record<string, unknown>;
}

globalThis.logseq = createLogseqMock();
globalThis.__pluginModels = {};

beforeEach(() => {
  resetLogseqMock(globalThis.logseq);
  globalThis.__pluginModels = {};
  globalThis.logseq.provideModel = vi.fn((model: Record<string, unknown>) => {
    Object.assign(globalThis.__pluginModels, model);
  });
});
