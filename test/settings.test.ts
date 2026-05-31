import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_BUTTONS,
  getButtons,
  getPageButtons,
  getSidebarButtons,
  normalizeButton,
  normalizeScope,
  parseButtons,
} from "../src/settings";

describe("settings", () => {
  it("normalizes scopes and button types", () => {
    expect(normalizeScope("sidebar")).toBe("sidebar");
    expect(normalizeScope("invalid")).toBe("both");

    expect(
      normalizeButton({
        label: "T",
        type: "template",
        template: "Focus time",
        scope: "page",
      })
    ).toEqual({
      label: "T",
      type: "template",
      template: "Focus time",
      scope: "page",
    });

    expect(normalizeButton({
      label: "Run",
      type: "command",
      command: "npm run build",
    })?.type).toBe("command");

    expect(normalizeButton({
      label: "Git",
      type: "git",
      command: "push",
      gitArgs: ["push", "origin"],
    })?.gitArgs).toEqual(["push", "origin"]);

    expect(normalizeButton({
      label: "Term",
      type: "terminal",
      script: "scripts/run.command",
    })?.script).toBe("scripts/run.command");
  });

  it("rejects invalid buttons", () => {
    expect(normalizeButton(null as never)).toBeNull();
    expect(normalizeButton({ label: "  " })).toBeNull();
    expect(normalizeButton({ label: "X", type: "terminal", script: " " })).toBeNull();
    expect(normalizeButton({ label: "X", type: "command", command: "" })).toBeNull();
    expect(normalizeButton({ label: "X", type: "template", template: "" })).toBeNull();
    expect(normalizeButton({ label: "Cmd", command: "npm run x" })).toMatchObject({ type: "command" });
  });

  it("parses buttons json with fallbacks", () => {
    expect(parseButtons("")).toEqual(DEFAULT_BUTTONS);
    expect(parseButtons("[]")).toEqual(DEFAULT_BUTTONS);

    const parsed = parseButtons(
      JSON.stringify([
        { label: "Blog", type: "template", template: "Digitable.Blog", scope: "sidebar" },
        { label: "Push", type: "git", command: "status", scope: "sidebar" },
      ])
    );
    expect(parsed).toHaveLength(2);
    logseq.settings.buttons = JSON.stringify([
      { label: "Blog", type: "template", template: "Digitable.Blog", scope: "sidebar" },
      { label: "PageOnly", type: "template", template: "Focus time", scope: "page" },
    ]);
    expect(getSidebarButtons()).toEqual([expect.objectContaining({ label: "Blog" })]);
    expect(getPageButtons()).toEqual([expect.objectContaining({ label: "PageOnly" })]);
    expect(getButtons()).toHaveLength(2);

    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(parseButtons(JSON.stringify({ not: "array" }))).toEqual(DEFAULT_BUTTONS);
    expect(parseButtons("{")).toEqual(DEFAULT_BUTTONS);
    expect(logseq.App.showMsg).toHaveBeenCalled();
  });
});
