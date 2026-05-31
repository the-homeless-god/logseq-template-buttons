import { describe, expect, it, vi } from "vitest";
import { buildRunDialogCommand, runCommandButton, runGitButton } from "../src/commandRunner";
import * as scriptLauncher from "../src/scriptLauncher";

describe("commandRunner", () => {
  it("builds run dialog commands for npm/node paths", () => {
    logseq.settings.nodePath = "/opt/homebrew/bin/node";

    expect(buildRunDialogCommand("/graph", "/graph", "npm run publish:blog:push")).toContain(
      "publish-digitable-blog.mjs"
    );

    logseq.settings.nodePath = "";
    expect(buildRunDialogCommand("/graph/sub", "/graph", "npm run build")).toBe("npm --prefix sub run build");
    expect(buildRunDialogCommand("/graph", "/graph", "node scripts/a.mjs")).toContain("scripts/a.mjs");
    expect(buildRunDialogCommand("/graph", "/graph", "bash -lc 'echo'")).toBe("bash -lc 'echo'");
    expect(buildRunDialogCommand("/graph", "/graph", "npm install")).toBe("npm install");
  });

  it("runs git commands", async () => {
    await runGitButton({ label: "Status", command: "git status" });
    expect(logseq.Git.execCommand).toHaveBeenCalledWith(["status"]);

    await runGitButton({ label: "Empty", command: "   " });
    expect(logseq.App.showMsg).toHaveBeenCalledWith('Git: empty command for "Empty"', "warning");

    logseq.Git.execCommand.mockRejectedValueOnce(new Error("git fail"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await runGitButton({ label: "Push", command: "push", gitArgs: ["push"] });
    errSpy.mockRestore();
  });

  it("prefers terminal scripts and falls back to run dialog", async () => {
    const openSpy = vi.spyOn(scriptLauncher, "openTerminalScript").mockResolvedValue(true);
    await runCommandButton({ label: "Publish", cwd: ".", command: "npm run publish:blog:push" });
    expect(openSpy).toHaveBeenCalled();

    openSpy.mockResolvedValue(false);
    Object.defineProperty(window, "parent", {
      configurable: true,
      value: { apis: { runCli: vi.fn().mockResolvedValue(0) } },
    });
    await runCommandButton({ label: "Publish", cwd: ".", command: "npm run publish:blog:push" });
    expect(logseq.App.showMsg).toHaveBeenCalledWith("Command finished: Publish", "success");

    Object.defineProperty(window, "parent", { configurable: true, value: window });
    logseq.settings.preferTerminalScripts = false;
    await runCommandButton({ label: "Echo", cwd: ".", command: "echo hi" });
    expect(logseq.App.invokeExternalCommand).toHaveBeenCalledWith("logseq.command/run");

    logseq.settings.preferTerminalScripts = true;
    openSpy.mockRejectedValueOnce(new Error("boom"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await runCommandButton({ label: "Echo", cwd: ".", command: "echo hi" });
    errSpy.mockRestore();
    openSpy.mockRestore();
  });
});
