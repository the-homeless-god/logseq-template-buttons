import { SettingSchemaDesc } from "@logseq/libs/dist/LSPlugin.user";

export type ButtonScope = "sidebar" | "page" | "both";

export type TemplateButton = {
  label: string;
  type: "template" | "command";
  template?: string;
  pageName?: string;
  scope?: ButtonScope;
  cwd?: string;
  command?: string;
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
    key: "buttons",
    type: "string",
    default: DEFAULT_BUTTONS_JSON,
    title: "Buttons",
    description:
      "JSON array. Template: `{ \"label\", \"type\": \"template\", \"template\", \"pageName\"?, \"scope\"? }`. Command: `{ \"label\", \"type\": \"command\", \"cwd\", \"command\", \"scope\"? }`. `scope`: `sidebar`, `page`, or `both` (default). Command buttons show a ▶ badge.",
    inputAs: "textarea",
  },
];

function normalizeButton(item: Record<string, unknown>): TemplateButton | null {
  if (!item || typeof item.label !== "string") {
    return null;
  }

  const label = item.label.trim();
  if (!label) {
    return null;
  }

  const explicitType = item.type === "command" ? "command" : item.type === "template" ? "template" : null;

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

function normalizeScope(value: unknown): ButtonScope {
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
    logseq.App.showMsg("Template Buttons: invalid buttons JSON in settings", "warning");
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
