import { describe, expect, it, vi } from "vitest";
import { buildRunDialogCommand, runCommandButton, runGitButton } from "../src/commandRunner";
import * as scriptLauncher from "../src/scriptLauncher";

describe("commandRunner coverage", () => {
  it("covers run dialog branches and path helpers", () => {
    logseq.settings.nodePath = "";

    expect(buildRunDialogCommand("/abs/work", "/graph", "npm run build")).toBe("npm run build");
    expect(buildRunDialogCommand("/graph/pkg", "/graph", "npm install")).toBe("npm --prefix pkg install");

    logseq.settings.nodePath = "/opt/homebrew/bin/node";
    expect(buildRunDialogCommand("/graph", "/graph", "npm run build")).toBe("/opt/homebrew/bin/node run build");
    expect(buildRunDialogCommand("/graph/pkg", "/graph", "node scripts/run.mjs --flag")).toContain(
      "scripts/run.mjs"
    );
    expect(buildRunDialogCommand("/graph", "/graph", "node /abs/script.mjs")).toContain("/abs/script.mjs");

    Object.defineProperty(navigator, "platform", { configurable: true, value: "Win32" });
    expect(buildRunDialogCommand("/graph/sub", "/graph", "echo hi")).toBe("echo hi");
    Object.defineProperty(navigator, "platform", { configurable: true, value: "MacIntel" });
  });

  it("runs git with output and non-zero exit", async () => {
    logseq.Git.execCommand.mockResolvedValueOnce({
      stdout: "x".repeat(700),
      stderr: "",
      exitCode: 0,
    });
    await runGitButton({ label: "Long", command: "git log" });

    logseq.Git.execCommand.mockResolvedValueOnce({
      stdout: "failed",
      stderr: "",
      exitCode: 1,
    });
    await runGitButton({ label: "Fail", command: "push" });
  });

  it("handles graph path errors and parent api fallbacks", async () => {
    logseq.App.getCurrentGraph.mockResolvedValue(null);
    logseq.settings.preferTerminalScripts = false;
    vi.spyOn(scriptLauncher, "resolveTerminalScriptForCommand").mockReturnValue(null);
    await expect(
      runCommandButton({ label: "X", cwd: ".", command: "echo hi" })
    ).rejects.toThrow("Graph path not found");

    logseq.App.getCurrentGraph.mockResolvedValue({ path: "/graph/logsec" });
    Object.defineProperty(window, "parent", {
      configurable: true,
      value: {
        apis: {
          runCli: vi.fn().mockRejectedValue(new Error("cli fail")),
        },
      },
    });
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await runCommandButton({ label: "Fail", cwd: "/graph/logsec", command: "echo hi" });
    errSpy.mockRestore();

    logseq.settings.nodePath = "/opt/homebrew/bin/node";
    Object.defineProperty(window, "parent", {
      configurable: true,
      value: {
        apis: {
          runCli: vi.fn().mockResolvedValue(0),
        },
      },
    });
    await runCommandButton({ label: "Publish", cwd: ".", command: "npm run publish:blog:push" });

    Object.defineProperty(window, "parent", {
      configurable: true,
      value: {
        api: {
          run_cli: vi.fn().mockResolvedValue(0),
        },
      },
    });
    await runCommandButton({ label: "Legacy", cwd: ".", command: "echo ok" });
    Object.defineProperty(window, "parent", { configurable: true, value: window });
  });

  it("opens run dialog when parent apis are unavailable", async () => {
    vi.spyOn(scriptLauncher, "resolveTerminalScriptForCommand").mockReturnValue(null);
    logseq.settings.preferTerminalScripts = false;
    logseq.settings.nodePath = "";

    Object.defineProperty(window, "parent", {
      configurable: true,
      value: {
        document,
        navigator: { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } },
      },
    });

    await runCommandButton({ label: "Echo", cwd: "sub", command: "npm run build" });
    expect(logseq.App.invokeExternalCommand).toHaveBeenCalledWith("logseq.command/run");

    Object.defineProperty(window, "parent", {
      configurable: true,
      value: {
        document,
        navigator: { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } },
      },
    });
    document.execCommand = vi.fn().mockReturnValue(false);
    await runCommandButton({ label: "Need allowlist", cwd: ".", command: "cargo build" });

    logseq.App.invokeExternalCommand.mockRejectedValueOnce(new Error("dialog fail"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await runCommandButton({ label: "Broken", cwd: ".", command: "echo broken" });
    errSpy.mockRestore();
    Object.defineProperty(window, "parent", { configurable: true, value: window });
  });

  it("covers allowlist hints and absolute binaries", () => {
    logseq.settings.nodePath = "";
    expect(buildRunDialogCommand("/graph/apps", "/graph", "node scripts/x.mjs")).toContain("scripts/x.mjs");

    logseq.settings.nodePath = "/opt/homebrew/bin/node";
    expect(buildRunDialogCommand("/graph/apps", "/graph", "node scripts/x.mjs")).toContain(
      "/opt/homebrew/bin/node"
    );
  });

  it("uses Windows shell invocation via parent apis", async () => {
    vi.spyOn(scriptLauncher, "resolveTerminalScriptForCommand").mockReturnValue(null);
    logseq.settings.preferTerminalScripts = false;
    logseq.settings.nodePath = "";
    Object.defineProperty(navigator, "platform", { configurable: true, value: "Win32" });

    const runCli = vi.fn().mockResolvedValue(0);
    Object.defineProperty(window, "parent", {
      configurable: true,
      value: { apis: { runCli } },
    });

    await runCommandButton({ label: "Echo", cwd: ".", command: "echo hi" });
    expect(runCli).toHaveBeenCalledWith(
      expect.objectContaining({
        command: "cmd.exe",
        args: expect.stringContaining("echo hi"),
      })
    );

    Object.defineProperty(navigator, "platform", { configurable: true, value: "MacIntel" });
    Object.defineProperty(window, "parent", { configurable: true, value: window });
  });

  it("shows allowlist hint for blocked binaries in run dialog", async () => {
    vi.spyOn(scriptLauncher, "resolveTerminalScriptForCommand").mockReturnValue(null);
    logseq.settings.preferTerminalScripts = false;
    logseq.settings.nodePath = "/opt/homebrew/bin/node";

    Object.defineProperty(window, "parent", {
      configurable: true,
      value: {
        document,
        navigator: { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } },
      },
    });

    await runCommandButton({ label: "Publish", cwd: ".", command: "npm run publish:blog:push" });
    expect(logseq.App.showMsg).toHaveBeenCalledWith(expect.stringContaining("nodePath"), "warning", expect.anything());
    Object.defineProperty(window, "parent", { configurable: true, value: window });
  });
});
