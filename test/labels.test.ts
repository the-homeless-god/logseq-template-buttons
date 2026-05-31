import { describe, expect, it } from "vitest";
import {
  DEFAULT_UI_LABELS_JSON,
  LOCALE_PRESETS,
  formatLabel,
  getUiLabels,
  label,
} from "../src/labels";

describe("labels", () => {
  it("uses english preset by default", () => {
    logseq.settings.uiLocale = "en";
    logseq.settings.uiLabels = "";
    expect(getUiLabels().pageBarPopupTitle).toBe("Child page");
    expect(label("msgOpenRegularPage")).toBe("Open a regular page (not a journal)");
  });

  it("switches to russian preset", () => {
    logseq.settings.uiLocale = "ru";
    expect(getUiLabels().copyPanelCopyButton).toBe("Скопировать");
  });

  it("merges custom overrides", () => {
    logseq.settings.uiLocale = "en";
    logseq.settings.uiLabels = JSON.stringify({ pageBarPopupTitle: "My child menu" });
    expect(getUiLabels().pageBarPopupTitle).toBe("My child menu");
    expect(getUiLabels().copyPanelTitle).toBe("Social markdown");
  });

  it("ignores invalid override json", () => {
    logseq.settings.uiLocale = "en";
    logseq.settings.uiLabels = "{";
    expect(getUiLabels().pageBarPopupTitle).toBe("Child page");

    logseq.settings.uiLabels = JSON.stringify(["not", "object"]);
    expect(getUiLabels().copyPanelTitle).toBe("Social markdown");
  });
});
