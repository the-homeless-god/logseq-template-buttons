import { describe, expect, it, vi } from "vitest";
import {
  buildNodeScriptCommand,
  getConfiguredNodePath,
  getGraphPath,
  npmCommandToNodeScript,
  openTerminalScript,
  resolveTerminalScriptForCommand,
  runTerminalButton,
} from "../src/scriptLauncher";

describe("scriptLauncher", () => {
  it("resolves npm scripts and node commands", () => {
    expect(resolveTerminalScriptForCommand("npm run publish:blog:push")).toBe(
      "scripts/logseq-publish-blog-push.command"
    );
    expect(resolveTerminalScriptForCommand("scripts/custom.command")).toBe("scripts/custom.command");
    expect(resolveTerminalScriptForCommand("scripts/custom.bat")).toBe("scripts/custom.bat");
    expect(resolveTerminalScriptForCommand("echo hi")).toBeNull();

    logseq.settings.nodePath = "/opt/homebrew/bin/node";
    expect(getConfiguredNodePath()).toBe("/opt/homebrew/bin/node");

    const nodeCmd = npmCommandToNodeScript("/graph", "npm run publish:blog:push");
    expect(nodeCmd).toContain("/graph/scripts/publish-digitable-blog.mjs --push");
    expect(buildNodeScriptCommand("/graph", "scripts/a.mjs", "--dry-run")).toContain("--dry-run");
    expect(npmCommandToNodeScript("/graph", "npm run unknown")).toBeNull();
  });

  it("reads graph path and opens terminal scripts", async () => {
    await expect(getGraphPath()).resolves.toBe("/graph/logsec");

    logseq.App.getCurrentGraph.mockResolvedValueOnce(null);
    await expect(openTerminalScript("scripts/x.command", "X")).resolves.toBe(false);

    logseq.App.getCurrentGraph.mockResolvedValue({ path: "/graph/logsec" });
    await expect(openTerminalScript("scripts/x.command", "X")).resolves.toBe(true);
    await expect(runTerminalButton({ label: "X", script: "scripts/x.command" })).resolves.toBe(true);

    logseq.App.openExternalLink.mockRejectedValueOnce(new Error("fail"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(openTerminalScript("scripts/x.command", "X")).resolves.toBe(false);
    errSpy.mockRestore();
  });
});
