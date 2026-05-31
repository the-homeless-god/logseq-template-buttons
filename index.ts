import "@logseq/libs";

import { getButtons } from "./src/settings";
import { settings } from "./src/settings";
import { runCommandButton } from "./src/commandRunner";
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
  getButtons()
    .filter((button) => button.type === "command" && button.command)
    .forEach((button, index) => {
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
