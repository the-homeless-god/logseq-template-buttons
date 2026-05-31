type ParentWindow = Window & {
  apis?: {
    runCli?: (payload: { command: string; args: string; returnResult?: boolean }) => Promise<number>;
  };
  api?: Record<string, (...args: unknown[]) => Promise<unknown>>;
};

import {
  buildNodeScriptCommand,
  getConfiguredNodePath,
  getGraphPath,
  npmCommandToNodeScript,
  openTerminalScript,
  resolveTerminalScriptForCommand,
} from "./scriptLauncher";

const LOGSEQ_SHELL_ALLOWLIST = new Set(["git", "pandoc", "ag", "grep", "alda"]);

function getParentWindow() {
  return parent as ParentWindow;
}

function isAbsolutePath(value: string) {
  return value.startsWith("/") || /^[A-Za-z]:[\\/]/.test(value);
}

function normalizePath(value: string) {
  return value.replace(/\\/g, "/").replace(/\/$/, "");
}

function resolveWorkingDirectory(graphPath: string, cwd: string) {
  const normalizedGraph = normalizePath(graphPath);
  const normalizedCwd = (cwd || ".").replace(/\\/g, "/").replace(/^\.\//, "");

  if (isAbsolutePath(normalizedCwd)) {
    return normalizedCwd;
  }

  return `${normalizedGraph}/${normalizedCwd}`;
}

async function getWorkingDirectory(cwd: string) {
  const graphPath = await getGraphPath();

  if (!graphPath) {
    throw new Error("Graph path not found");
  }

  return resolveWorkingDirectory(graphPath, cwd);
}

function getCommandBinary(command: string) {
  return command.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
}

function relativePathFromGraph(graphPath: string, workDir: string) {
  const graph = normalizePath(graphPath);
  const work = normalizePath(workDir);

  if (work === graph) {
    return null;
  }

  if (work.startsWith(`${graph}/`)) {
    return work.slice(graph.length + 1);
  }

  return null;
}

function isShellWrapper(binary: string) {
  return ["bash", "sh", "zsh", "cmd", "cmd.exe", "/bin/bash", "powershell", "pwsh"].includes(binary);
}

function preferTerminalLaunch() {
  return logseq.settings?.preferTerminalScripts !== false;
}

/**
 * Logseq Run command (Cmd+Shift+1) only allows binaries from an allowlist.
 * GUI Logseq often has no npm in PATH — use absolute node path when configured.
 */
export function buildRunDialogCommand(workDir: string, graphPath: string, command: string) {
  const nodeScript = npmCommandToNodeScript(graphPath, command);
  if (nodeScript) {
    return nodeScript;
  }

  const trimmed = command.trim();
  const binary = getCommandBinary(trimmed);
  const nodePath = getConfiguredNodePath();

  if (nodePath && (binary === "node" || binary === "npm")) {
    const rest = trimmed.split(/\s+/).slice(1).join(" ");
    return rest ? `${nodePath} ${rest}` : nodePath;
  }

  if (isShellWrapper(binary)) {
    return trimmed;
  }

  const relPath = relativePathFromGraph(graphPath, workDir);
  if (!relPath) {
    return trimmed;
  }

  const npmRunMatch = trimmed.match(/^npm\s+run\s+(\S+)(.*)$/i);
  if (npmRunMatch) {
    const script = npmRunMatch[1];
    const rest = npmRunMatch[2] || "";
    return `npm --prefix ${relPath} run ${script}${rest}`.trim();
  }

  const npmMatch = trimmed.match(/^npm\s+(.+)$/i);
  if (npmMatch && !trimmed.includes("--prefix")) {
    return `npm --prefix ${relPath} ${npmMatch[1]}`.trim();
  }

  const nodeMatch = trimmed.match(/^node\s+(\S+)(.*)$/i);
  if (nodeMatch) {
    const script = nodeMatch[1];
    if (!isAbsolutePath(script)) {
      const runner = nodePath || "node";
      return `${runner} ${workDir}/${script}${nodeMatch[2] || ""}`.trim();
    }
  }

  return trimmed;
}

function allowlistConfigHint(binary: string, graphPath: string, command: string) {
  const nodeLine = npmCommandToNodeScript(graphPath, command);
  if (nodeLine) {
    const nodeBin = getCommandBinary(nodeLine);
    return `Добавьте в logseq/config.edn :shell/command-allowlist ["${nodeBin}"], или укажите nodePath в настройках плагина. Команда: ${nodeLine}`;
  }
  return `:shell/command-allowlist ["${binary}" ...] in logseq/config.edn`;
}

function needsAllowlistEntry(command: string) {
  const binary = getCommandBinary(command);
  if (!binary || LOGSEQ_SHELL_ALLOWLIST.has(binary)) {
    return null;
  }
  if (isAbsolutePath(binary)) {
    return binary;
  }
  return binary;
}

function buildShellInvocation(workDir: string, command: string) {
  const isWindows = navigator.platform.toLowerCase().includes("win");

  if (isWindows) {
    return {
      command: "cmd.exe",
      args: `/c "cd /d ${workDir} && ${command}"`,
    };
  }

  const escapedDir = workDir.replace(/'/g, `'\\''`);
  return {
    command: "/bin/bash",
    args: `-lc 'cd "${escapedDir}" && ${command}'`,
  };
}

async function tryRunViaParentApis(workDir: string, command: string, graphPath: string) {
  const parentWin = getParentWindow();
  const nodeScript = npmCommandToNodeScript(graphPath, command);
  const nodePath = getConfiguredNodePath();

  if (nodeScript && nodePath) {
    const parts = nodeScript.split(/\s+/);
    const binary = parts[0];
    const args = parts.slice(1).join(" ");
    const payload = { command: binary, args, returnResult: true };

    if (typeof parentWin.apis?.runCli === "function") {
      await parentWin.apis.runCli(payload);
      return true;
    }
  }

  const { command: shell, args } = buildShellInvocation(workDir, command);
  const payload = { command: shell, args, returnResult: true };

  if (typeof parentWin.apis?.runCli === "function") {
    await parentWin.apis.runCli(payload);
    return true;
  }

  const apiCandidates = ["runCli", "run_cli", "runShellCommand", "run_shell_command"];
  for (const method of apiCandidates) {
    const fn = parentWin.api?.[method];
    if (typeof fn === "function") {
      await fn(payload);
      return true;
    }
  }

  return false;
}

function parseGitArgs(command: string, gitArgs?: string[]) {
  if (gitArgs?.length) {
    return gitArgs;
  }

  const parts = command.trim().split(/\s+/).filter(Boolean);
  if (parts[0]?.toLowerCase() === "git") {
    return parts.slice(1);
  }

  return parts;
}

export async function runGitButton(button: { label: string; command: string; gitArgs?: string[] }) {
  const args = parseGitArgs(button.command, button.gitArgs);
  if (!args.length) {
    logseq.App.showMsg(`Git: empty command for "${button.label}"`, "warning");
    return;
  }

  logseq.App.showMsg(`Git: ${args.join(" ")}`);

  try {
    const result = await logseq.Git.execCommand(args);
    const output = (result.stdout || result.stderr || "").trim();
    const preview = output ? output.slice(0, 600) : "Done";
    const status = result.exitCode === 0 ? "success" : "error";
    logseq.App.showMsg(preview, status, { timeout: output.length > 200 ? 15000 : 8000 });
  } catch (error) {
    console.error("[TemplateButtons] Git command failed", error);
    logseq.App.showMsg(`Git failed: ${button.label}`, "error");
  }
}

import { copyTextToClipboard } from "./clipboard";

async function openRunCommandDialog() {
  await logseq.App.invokeExternalCommand("logseq.command/run");
}

async function runViaRunCommandDialog(
  workDir: string,
  graphPath: string,
  command: string,
  label: string
) {
  const shellLine = buildRunDialogCommand(workDir, graphPath, command);
  const binary = needsAllowlistEntry(shellLine);
  const copied = (await copyTextToClipboard(shellLine)).ok;

  await openRunCommandDialog();

  let hint = `${label}: Cmd+Shift+1 — вставьте (Cmd+V) и Enter`;
  if (binary) {
    hint += `\n${allowlistConfigHint(binary, graphPath, command)}`;
  }
  hint +=
    "\nЕсли npm не находится — используйте type: terminal или укажите nodePath в настройках плагина.";

  logseq.App.showMsg(hint, "warning", { timeout: 18000 });

  if (!copied) {
    logseq.App.showMsg(shellLine, "warning", { timeout: 12000 });
  }
}

export async function runCommandButton(button: { label: string; cwd?: string; command: string }) {
  const cwd = button.cwd || ".";
  const graphPath = await getGraphPath();
  const workDir = await getWorkingDirectory(cwd);

  if (preferTerminalLaunch()) {
    const script = resolveTerminalScriptForCommand(button.command);
    if (script) {
      const opened = await openTerminalScript(script, button.label);
      if (opened) {
        return;
      }
    }
  }

  const runDialogCommand = buildRunDialogCommand(workDir, graphPath, button.command);
  logseq.App.showMsg(`Running: ${runDialogCommand}`);

  try {
    const ran = await tryRunViaParentApis(workDir, button.command, graphPath);
    if (ran) {
      logseq.App.showMsg(`Command finished: ${button.label}`, "success");
      return;
    }
  } catch (error) {
    console.error("[TemplateButtons] Command failed", error);
    logseq.App.showMsg(`Command failed: ${button.label}`, "error");
    return;
  }

  try {
    await runViaRunCommandDialog(workDir, graphPath, button.command, button.label);
  } catch (error) {
    console.error("[TemplateButtons] Run dialog fallback failed", error);
    logseq.App.showMsg(`Cmd+Shift+1:\n${runDialogCommand}`, "error", { timeout: 12000 });
  }
}

export { buildNodeScriptCommand, openTerminalScript, resolveTerminalScriptForCommand };
