type ParentWindow = Window & {
  apis?: {
    runCli?: (payload: { command: string; args: string; returnResult?: boolean }) => Promise<number>;
  };
  api?: Record<string, (...args: unknown[]) => Promise<unknown>>;
};

function getParentWindow() {
  return parent as ParentWindow;
}

function isAbsolutePath(value: string) {
  return value.startsWith("/") || /^[A-Za-z]:[\\/]/.test(value);
}

function resolveWorkingDirectory(graphPath: string, cwd: string) {
  const normalizedGraph = graphPath.replace(/\\/g, "/").replace(/\/$/, "");
  const normalizedCwd = (cwd || ".").replace(/\\/g, "/").replace(/^\.\//, "");

  if (isAbsolutePath(normalizedCwd)) {
    return normalizedCwd;
  }

  return `${normalizedGraph}/${normalizedCwd}`;
}

async function getWorkingDirectory(cwd: string) {
  const graph = await logseq.App.getCurrentGraph();
  const graphPath =
    graph?.path ||
    graph?.url?.replace(/^file:\/\//, "") ||
    "";

  if (!graphPath) {
    throw new Error("Graph path not found");
  }

  return resolveWorkingDirectory(graphPath, cwd);
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

async function tryRunViaParentApis(workDir: string, command: string) {
  const parentWin = getParentWindow();
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

export async function runCommandButton(button: { label: string; cwd?: string; command: string }) {
  const cwd = button.cwd || ".";
  const workDir = await getWorkingDirectory(cwd);

  logseq.App.showMsg(`Running: ${button.command}`);

  try {
    const ran = await tryRunViaParentApis(workDir, button.command);
    if (ran) {
      logseq.App.showMsg(`Command finished: ${button.label}`, "success");
      return;
    }
  } catch (error) {
    console.error("[TemplateButtons] Command failed", error);
    logseq.App.showMsg(`Command failed: ${button.label}`, "error");
    return;
  }

  logseq.App.showMsg(
    `Shell API unavailable. Add to logseq/config.edn :commands [["${button.label}" "cd ${cwd} && ${button.command}"]]`,
    "warning"
  );
}
