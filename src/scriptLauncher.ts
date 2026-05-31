const NPM_SCRIPT_LAUNCHERS: Record<string, string> = {
  "publish:blog": "scripts/logseq-publish-blog.command",
  "publish:blog:push": "scripts/logseq-publish-blog-push.command",
  "publish:video": "scripts/logseq-publish-video.command",
  "publish:video:push": "scripts/logseq-publish-video-push.command",
  "publish:all": "scripts/logseq-publish-all.command",
  "publish:all:push": "scripts/logseq-publish-all-push.command",
};

function normalizePath(value: string) {
  return value.replace(/\\/g, "/").replace(/\/$/, "");
}

export async function getGraphPath() {
  const graph = await logseq.App.getCurrentGraph();
  return graph?.path || graph?.url?.replace(/^file:\/\//, "") || "";
}

function graphFileUrl(graphPath: string, relativePath: string) {
  const full = `${normalizePath(graphPath)}/${relativePath.replace(/^\.\//, "")}`;
  return `file://${encodeURI(full.replace(/\\/g, "/"))}`;
}

export function resolveTerminalScriptForCommand(command: string) {
  const trimmed = command.trim();
  const npmRun = trimmed.match(/^npm\s+run\s+(\S+)/i);
  if (npmRun) {
    return NPM_SCRIPT_LAUNCHERS[npmRun[1]] ?? null;
  }

  if (trimmed.startsWith("scripts/") && (trimmed.endsWith(".command") || trimmed.endsWith(".bat"))) {
    return trimmed;
  }

  return null;
}

export function getConfiguredNodePath() {
  const fromSettings = logseq.settings?.nodePath;
  if (typeof fromSettings === "string" && fromSettings.trim()) {
    return fromSettings.trim();
  }
  return "";
}

export function buildNodeScriptCommand(graphPath: string, scriptRelative: string, args = "") {
  const nodePath = getConfiguredNodePath() || "node";
  const scriptPath = `${normalizePath(graphPath)}/${scriptRelative.replace(/^\.\//, "")}`;
  const extra = args.trim();
  return extra ? `${nodePath} ${scriptPath} ${extra}` : `${nodePath} ${scriptPath}`;
}

export function npmCommandToNodeScript(graphPath: string, command: string) {
  const match = command.trim().match(/^npm\s+run\s+(\S+)(.*)$/i);
  if (!match) {
    return null;
  }

  const scriptName = match[1];
  const argTail = match[2]?.trim() ?? "";

  const scriptMap: Record<string, { script: string; defaultArgs: string }> = {
    "publish:blog": { script: "scripts/publish-digitable-blog.mjs", defaultArgs: "" },
    "publish:blog:push": { script: "scripts/publish-digitable-blog.mjs", defaultArgs: "--push" },
    "publish:video": { script: "scripts/publish-digitable-video.mjs", defaultArgs: "" },
    "publish:video:push": { script: "scripts/publish-digitable-video.mjs", defaultArgs: "--push" },
  };

  const mapped = scriptMap[scriptName];
  if (!mapped) {
    return null;
  }

  const args = [mapped.defaultArgs, argTail].filter(Boolean).join(" ").trim();
  return buildNodeScriptCommand(graphPath, mapped.script, args);
}

export async function openTerminalScript(relativePath: string, label: string) {
  const graphPath = await getGraphPath();
  if (!graphPath) {
    logseq.App.showMsg("Graph path not found", "error");
    return false;
  }

  const url = graphFileUrl(graphPath, relativePath);

  try {
    await logseq.App.openExternalLink(url);
    logseq.App.showMsg(`${label}: открыт Terminal (${relativePath})`, "success", { timeout: 8000 });
    return true;
  } catch (error) {
    console.error("[TemplateButtons] openExternalLink failed", error);
    logseq.App.showMsg(`Не удалось открыть ${relativePath}`, "error");
    return false;
  }
}

export async function runTerminalButton(button: { label: string; script: string }) {
  return openTerminalScript(button.script, button.label);
}
