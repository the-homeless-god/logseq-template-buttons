import "@logseq/libs";

import { getButtons } from "./src/settings";
import { settings } from "./src/settings";
import { runCommandButton, runGitButton } from "./src/commandRunner";
import { runTerminalButton } from "./src/scriptLauncher";
import { initDateFormat } from "./src/templateLogic";
import { registerPageBar, refreshPageBar } from "./src/pageBar";
import {
  mountSidebarWhenReady,
  registerSidebarModel,
  registerToolbarFallback,
  scheduleSidebarRender,
  sidebarStyles,
} from "./src/sidebar";

logseq.useSettingsSchema(settings);

function registerCommandPaletteEntries() {
  getButtons().forEach((button, index) => {
    if (button.type === "terminal" && button.script) {
      const key = `lstb-term-${index}-${button.label.replace(/\s+/g, "-").toLowerCase()}`;
      logseq.App.registerCommand(
        `lstb_${key}`,
        {
          key,
          label: `[Template Buttons] ${button.label}`,
          palette: true,
        },
        async () => {
          await runTerminalButton({
            label: button.label,
            script: button.script || "",
          });
        }
      );
      return;
    }

    if (button.type === "git") {
      const key = `lstb-git-${index}-${button.label.replace(/\s+/g, "-").toLowerCase()}`;
      logseq.App.registerCommand(
        `lstb_${key}`,
        {
          key,
          label: `[Template Buttons] Git: ${button.label}`,
          palette: true,
        },
        async () => {
          await runGitButton({
            label: button.label,
            command: button.command || "status",
            gitArgs: button.gitArgs,
          });
        }
      );
      return;
    }

    if (button.type === "command" && button.command) {
      const key = `lstb-cmd-${index}-${button.label.replace(/\s+/g, "-").toLowerCase()}`;
      logseq.App.registerCommand(
        `lstb_${key}`,
        {
          key,
          label: `[Template Buttons] ${button.label}`,
          palette: true,
        },
        async () => {
          await runCommandButton({
            label: button.label,
            cwd: button.cwd,
            command: button.command || "",
          });
        }
      );
    }
  });
}

const main = async () => {
  await initDateFormat();

  registerSidebarModel();
  registerToolbarFallback();
  registerPageBar();
  logseq.provideStyle(sidebarStyles);
  registerCommandPaletteEntries();

  logseq.onSettingsChanged(() => {
    scheduleSidebarRender();
    refreshPageBar();
  });

  logseq.App.onCurrentGraphChanged(async () => {
    await initDateFormat();
    scheduleSidebarRender();
  });

  logseq.App.onGraphAfterIndexed(() => scheduleSidebarRender());
  logseq.App.onRouteChanged(() => scheduleSidebarRender());
  logseq.App.onThemeModeChanged(() => scheduleSidebarRender());
  logseq.App.onSidebarVisibleChanged(() => scheduleSidebarRender());

  await mountSidebarWhenReady();
};

logseq.ready(main).catch(console.error);
