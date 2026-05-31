import { getSidebarButtons, TemplateButton } from "./settings";
import { runCommandButton } from "./commandRunner";
import { createPageFromTemplate } from "./templateLogic";

const UI_KEY = "lstb-sidebar-section";

/** New Logseq (0.11+): nav-contents-container; legacy: sidebar-contents-container */
const SIDEBAR_PATHS = [
  "#left-sidebar .nav-contents-container",
  "#left-sidebar .sidebar-contents-container",
];

let renderTimer: ReturnType<typeof setTimeout> | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function sidebarTargetExists() {
  for (const path of SIDEBAR_PATHS) {
    const rect = await logseq.App.queryElementRect(path);
    if (rect) {
      return path;
    }
  }
  return null;
}

function renderButtonItems(buttons: TemplateButton[]) {
  if (!buttons.length) {
    return `<li class="favorite-item font-medium opacity-60">No buttons configured</li>`;
  }

  return buttons
    .map((button, index) => {
      const isCommand = button.type === "command";
      const iconClass = isCommand ? "ti-terminal-2 lstb-icon-command" : "ti-file-description";
      const linkClass = isCommand ? "lstb-link lstb-link-command" : "lstb-link";
      const title = isCommand
        ? `Run: ${escapeHtml(button.command || "")}`
        : `Create page from ${escapeHtml(button.template || "")}`;

      return `
        <li class="favorite-item font-medium lstb-item">
          <a
            class="${linkClass}"
            href="#"
            title="${title}"
            data-on-click="handleSidebarButton"
            data-prevent-default="true"
            data-button-index="${index}"
          >
            <span class="page-icon ui__icon ti ${iconClass} lstb-icon"></span>
            <span class="page-title">${escapeHtml(button.label)}</span>
            ${isCommand ? '<span class="lstb-command-badge" title="Shell command">▶</span>' : ""}
          </a>
        </li>
      `;
    })
    .join("");
}

function buildSidebarTemplate() {
  const title = (logseq.settings?.sectionTitle || "Templates").toUpperCase();
  const buttons = getSidebarButtons();

  return `
    <div class="nav-content-item lstb-root template-buttons is-expand has-children">
      <div class="nav-content-item-inner">
        <div class="header items-center">
          <div class="a flex items-center text-sm font-medium rounded-md wrap-th">
            <span class="ui__icon ti ti-layout-2 lstb-header-icon"></span>
            <strong class="flex-1 ml-2">${escapeHtml(title)}</strong>
          </div>
        </div>
        <div class="bd">
          <ul class="favorites text-sm lstb-list">
            ${renderButtonItems(buttons)}
          </ul>
        </div>
      </div>
    </div>
  `;
}

/** Legacy Logseq sidebar markup (pre-0.11) */
function buildLegacySidebarTemplate() {
  const title = (logseq.settings?.sectionTitle || "Templates").toUpperCase();
  const buttons = getSidebarButtons();

  return `
    <div class="sidebar-content-group lstb-root is-expand has-children">
      <div class="sidebar-content-group-inner">
        <div class="hd items-center non-collapsable">
          <span class="a wrap-th">
            <span class="ui__icon ti ti-layout-2 lstb-header-icon"></span>
            <strong class="flex-1">${escapeHtml(title)}</strong>
          </span>
        </div>
        <div class="bd">
          <ul class="favorites text-sm lstb-list">
            ${renderButtonItems(buttons)}
          </ul>
        </div>
      </div>
    </div>
  `;
}

function isLegacySidebarPath(path: string) {
  return path.includes("sidebar-contents-container");
}

export async function renderSidebar() {
  const path = await sidebarTargetExists();
  if (!path) {
    return false;
  }

  const template = isLegacySidebarPath(path)
    ? buildLegacySidebarTemplate()
    : buildSidebarTemplate();

  logseq.provideUI({
    key: UI_KEY,
    path,
    replace: false,
    template,
  });

  return true;
}

export function scheduleSidebarRender() {
  if (renderTimer) {
    clearTimeout(renderTimer);
  }

  renderTimer = setTimeout(() => {
    renderTimer = null;
    void renderSidebar();
  }, 150);
}

export function registerSidebarModel() {
  logseq.provideModel({
    async handleSidebarButton(event: { dataset?: { buttonIndex?: string } }) {
      const index = Number(event?.dataset?.buttonIndex);
      if (Number.isNaN(index)) {
        return;
      }

      const button = getSidebarButtons()[index];
      if (!button) {
        return;
      }

      if (button.type === "command") {
        await runCommandButton({
          label: button.label,
          cwd: button.cwd,
          command: button.command || "",
        });
        return;
      }

      const defaultPageName = logseq.settings?.defaultPageName || "{template}.{date}";
      const pageNamePattern = button.pageName || defaultPageName;
      await createPageFromTemplate(button.template || "", pageNamePattern);
    },
  });
}

export function registerToolbarFallback() {
  logseq.App.registerUIItem("toolbar", {
    key: "logseq-template-buttons-toolbar",
    template: `<a data-on-click="openTemplateButtonsPanel" class="button" title="Template Buttons"><i class="ti ti-layout-sidebar-left"></i></a>`,
  });

  logseq.provideModel({
    openTemplateButtonsPanel() {
      logseq.App.showMsg("Template Buttons: check the left sidebar above Favorites", "warning");
      logseq.App.setLeftSidebarVisible(true);
      scheduleSidebarRender();
    },
  });
}

function startSidebarPolling() {
  if (pollTimer) {
    return;
  }

  pollTimer = window.setInterval(() => {
    void renderSidebar();
  }, 2000);
}

export async function mountSidebarWhenReady(attempt = 0) {
  const mounted = await renderSidebar();
  if (mounted) {
    startSidebarPolling();
    return;
  }

  if (attempt < 80) {
    window.setTimeout(() => mountSidebarWhenReady(attempt + 1), 250);
  }
}

export const sidebarStyles = `
  #left-sidebar .nav-contents-container,
  #left-sidebar .sidebar-contents-container {
    display: flex;
    flex-direction: column;
  }

  [data-injected-ui="${UI_KEY}"],
  #logseq-template-buttons--${UI_KEY} {
    order: -1;
  }

  .lstb-root {
    margin-bottom: 0;
  }

  .lstb-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .lstb-link {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 4px 8px;
    border-radius: 6px;
    color: inherit;
    text-decoration: none;
    cursor: pointer;
  }

  .lstb-link:hover {
    background: var(--ls-quaternary-background-color, rgba(127, 127, 127, 0.15));
  }

  .lstb-link-command .lstb-icon-command {
    color: var(--ls-link-text-color, #6b9fff);
  }

  .lstb-command-badge {
    margin-left: auto;
    opacity: 0.55;
    font-size: 10px;
    line-height: 1;
  }

  .lstb-header-icon,
  .lstb-icon {
    opacity: 0.75;
    flex-shrink: 0;
  }

  .lstb-header-icon {
    margin-right: 4px;
    font-size: 14px;
  }

  .lstb-icon {
    font-size: 16px;
  }
`;
