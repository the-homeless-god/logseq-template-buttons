import { SettingSchemaDesc } from "@logseq/libs/dist/LSPlugin.user";
import { label } from "./labels";

export type ButtonScope = "sidebar" | "page" | "both";

export type TemplateButton = {
  label: string;
  type: "template" | "command" | "git" | "terminal";
  template?: string;
  pageName?: string;
  scope?: ButtonScope;
  cwd?: string;
  command?: string;
  script?: string;
  gitArgs?: string[];
};

export const DEFAULT_BUTTONS: TemplateButton[] = [
  {
    label: "Digitable Blog",
    type: "template",
    template: "Digitable.Blog",
    pageName: "{template}.{date}",
  },
  { label: "Focus time", type: "template", template: "Focus time" },
  { label: "Online meeting", type: "template", template: "Online meeting" },
  { label: "Kontur Contract", type: "template", template: "Kontur.Contract" },
  { label: "Zettelkasten", type: "template", template: "Zettelkasten" },
];

export const DEFAULT_BUTTONS_JSON = JSON.stringify(DEFAULT_BUTTONS, null, 2);

export const settings: SettingSchemaDesc[] = [
  {
    key: "uiLocale",
    type: "enum",
    enumChoices: ["en", "ru"],
    enumPicker: "select",
    default: "en",
    title: "UI language",
    description: "Preset for plugin messages, page bar, and copy panel. Override any string in UI labels JSON.",
  },
  {
    key: "uiLabels",
    type: "string",
    default: "",
    title: "UI labels (JSON overrides)",
    description:
      "Optional JSON object to override UI strings. Keys: pageBarPopupTitle, copyPanelTitle, msgOpenRegularPage, templateNotFound, etc. Placeholders: {name}, {label}, {command}, {path}, {binary}. Empty = use locale preset only.",
    inputAs: "textarea",
  },
  {
    key: "sectionTitle",
    type: "string",
    default: "Templates",
    title: "Section title",
    description: "Title shown in the left sidebar section.",
  },
  {
    key: "defaultPageName",
    type: "string",
    default: "{template}.{date}",
    title: "Default page name pattern",
    description:
      "Used when a button has no `pageName`. Tokens: `{template}`, `{date}`, `{time}`, `{datetime}`.",
  },
  {
    key: "childPageName",
    type: "string",
    default: "{parent}/{template}.{date}",
    title: "Child page name pattern",
    description:
      "Used from the page bar when creating a child page. Tokens: `{parent}`, `{parent-short}`, `{template}`, `{date}`, `{time}`, `{datetime}`.",
  },
  {
    key: "addBacklinkOnParent",
    type: "boolean",
    default: true,
    title: "Add backlink on parent page",
    description: "When creating a child page from the page bar, append a link to it on the current page.",
  },
  {
    key: "pageBarEnabled",
    type: "boolean",
    default: true,
    title: "Show page bar menu",
    description: "Show a dropdown on the current page to create child pages from templates.",
  },
  {
    key: "preferTerminalScripts",
    type: "boolean",
    default: true,
    title: "Open npm scripts in Terminal (macOS)",
    description:
      "For type `command` with `npm run ...`, open a `.command` launcher in Terminal instead of Logseq shell. Avoids «npm does not exist» in GUI Logseq.",
  },
  {
    key: "nodePath",
    type: "string",
    default: "",
    title: "Node binary path (optional)",
    description:
      "Full path to node for Cmd+Shift+1 fallback, e.g. /opt/homebrew/bin/node or ~/.nvm/versions/node/v22/bin/node. Leave empty to use `node` from PATH.",
  },
  {
    key: "buttons",
    type: "string",
    default: DEFAULT_BUTTONS_JSON,
    title: "Buttons",
    description:
      "JSON array. Template: `{ \"label\", \"type\": \"template\", \"template\", ... }`. Terminal (recommended for npm): `{ \"label\", \"type\": \"terminal\", \"script\": \"scripts/logseq-publish-blog-push.command\" }`. Command: `{ \"type\": \"command\", \"command\": \"npm run publish:blog:push\" }` — auto-opens Terminal if launcher exists. Git: `{ \"type\": \"git\", \"command\": \"push\" }`.",
    inputAs: "textarea",
  },
];

export function normalizeButton(item: Record<string, unknown>): TemplateButton | null {
  if (!item || typeof item.label !== "string") {
    return null;
  }

  const label = item.label.trim();
  if (!label) {
    return null;
  }

  const explicitType =
    item.type === "git"
      ? "git"
      : item.type === "terminal"
        ? "terminal"
        : item.type === "command"
          ? "command"
          : item.type === "template"
            ? "template"
            : null;

  if (explicitType === "terminal") {
    const script = typeof item.script === "string" ? item.script.trim() : "";
    if (!script) {
      return null;
    }

    return {
      label,
      type: "terminal",
      script,
      scope: normalizeScope(item.scope ?? "sidebar"),
    };
  }

  if (explicitType === "git") {
    const command = typeof item.command === "string" ? item.command.trim() : "status";
    const gitArgs = Array.isArray(item.gitArgs)
      ? item.gitArgs.filter((arg): arg is string => typeof arg === "string" && arg.trim().length > 0)
      : undefined;

    return {
      label,
      type: "git",
      command,
      gitArgs,
      scope: normalizeScope(item.scope ?? "sidebar"),
    };
  }

  if (explicitType === "command" || (typeof item.command === "string" && !item.template)) {
    const command = typeof item.command === "string" ? item.command.trim() : "";
    if (!command) {
      return null;
    }

    return {
      label,
      type: "command",
      cwd: typeof item.cwd === "string" ? item.cwd.trim() : ".",
      command,
      scope: normalizeScope(item.scope ?? "sidebar"),
    };
  }

  const template = typeof item.template === "string" ? item.template.trim() : "";
  if (!template) {
    return null;
  }

  const scope = normalizeScope(item.scope);

  return {
    label,
    type: "template",
    template,
    pageName: typeof item.pageName === "string" ? item.pageName.trim() : undefined,
    scope,
  };
}

export function normalizeScope(value: unknown): ButtonScope {
  if (value === "sidebar" || value === "page" || value === "both") {
    return value;
  }
  return "both";
}

export function parseButtons(raw: unknown): TemplateButton[] {
  if (typeof raw !== "string" || !raw.trim()) {
    return DEFAULT_BUTTONS;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error("buttons must be an array");
    }

    const buttons = parsed
      .map((item) => normalizeButton(item))
      .filter((item): item is TemplateButton => Boolean(item));

    return buttons.length ? buttons : DEFAULT_BUTTONS;
  } catch (error) {
    console.error("[TemplateButtons] Invalid buttons JSON", error);
    logseq.App.showMsg(label("msgInvalidButtonsJson"), "warning");
    return DEFAULT_BUTTONS;
  }
}

export function getButtons(): TemplateButton[] {
  return parseButtons(logseq.settings?.buttons);
}

export function getSidebarButtons(): TemplateButton[] {
  return getButtons().filter((button) => button.scope !== "page");
}

export function getPageButtons(): TemplateButton[] {
  return getButtons().filter((button) => button.type === "template" && button.scope !== "sidebar");
}
