export type UiLabels = {
  pageBarPopupTitle: string;
  pageBarCopyTooltip: string;
  pageBarCopyTooltipDisabled: string;
  pageBarChildTooltip: string;
  pageBarChildTooltipDisabled: string;
  pageBarChildTooltipNoTemplates: string;
  msgOpenRegularPage: string;
  msgNoPageBarTemplates: string;
  copyPanelTitle: string;
  copyPanelHint: string;
  copyPanelCloseButton: string;
  copyPanelCopyButton: string;
  msgCopyManual: string;
  msgSocialCopied: string;
  msgNoPostBlock: string;
  msgTerminalOpened: string;
  msgTerminalOpenFailed: string;
  msgGraphPathNotFound: string;
  msgAllowlistHint: string;
  msgRunDialogHint: string;
  msgRunDialogNpmHint: string;
  sidebarEmptyButtons: string;
  sidebarToolbarHint: string;
  msgInvalidButtonsJson: string;
  templateNotFound: string;
  templateEmpty: string;
  failedCreatePage: string;
  failedInsertTemplate: string;
  createdPage: string;
  createdChildPage: string;
  gitEmptyCommand: string;
  gitFailed: string;
  commandRunning: string;
  commandFinished: string;
  commandFailed: string;
  cmdShiftFallback: string;
};

export type UiLocale = "en" | "ru";

export const UI_LABEL_KEYS = Object.keys({
  pageBarPopupTitle: "",
  pageBarCopyTooltip: "",
  pageBarCopyTooltipDisabled: "",
  pageBarChildTooltip: "",
  pageBarChildTooltipDisabled: "",
  pageBarChildTooltipNoTemplates: "",
  msgOpenRegularPage: "",
  msgNoPageBarTemplates: "",
  copyPanelTitle: "",
  copyPanelHint: "",
  copyPanelCloseButton: "",
  copyPanelCopyButton: "",
  msgCopyManual: "",
  msgSocialCopied: "",
  msgNoPostBlock: "",
  msgTerminalOpened: "",
  msgTerminalOpenFailed: "",
  msgGraphPathNotFound: "",
  msgAllowlistHint: "",
  msgRunDialogHint: "",
  msgRunDialogNpmHint: "",
  sidebarEmptyButtons: "",
  sidebarToolbarHint: "",
  msgInvalidButtonsJson: "",
  templateNotFound: "",
  templateEmpty: "",
  failedCreatePage: "",
  failedInsertTemplate: "",
  createdPage: "",
  createdChildPage: "",
  gitEmptyCommand: "",
  gitFailed: "",
  commandRunning: "",
  commandFinished: "",
  commandFailed: "",
  cmdShiftFallback: "",
}) as (keyof UiLabels)[];

const EN_LABELS: UiLabels = {
  pageBarPopupTitle: "Child page",
  pageBarCopyTooltip: "Copy social markdown (no images)",
  pageBarCopyTooltipDisabled: "Open a post page first",
  pageBarChildTooltip: "Create child page from template",
  pageBarChildTooltipDisabled: "Open a page to create a child",
  pageBarChildTooltipNoTemplates: "No templates (scope: page or both)",
  msgOpenRegularPage: "Open a regular page (not a journal)",
  msgNoPageBarTemplates: "No templates for page bar (scope: page or both)",
  copyPanelTitle: "Social markdown",
  copyPanelHint: "Click Copy or select text and press Cmd+C.",
  copyPanelCloseButton: "Close",
  copyPanelCopyButton: "Copy",
  msgCopyManual: "Select the text and press Cmd+C",
  msgSocialCopied: "Social markdown copied",
  msgNoPostBlock: "No #post / Content block on this page",
  msgTerminalOpened: "{label}: opened in Terminal ({path})",
  msgTerminalOpenFailed: "Could not open {path}",
  msgGraphPathNotFound: "Graph path not found",
  msgAllowlistHint:
    'Add to logseq/config.edn :shell/command-allowlist ["{binary}"], or set nodePath in plugin settings. Command: {command}',
  msgRunDialogHint: "{label}: Cmd+Shift+1 — paste (Cmd+V) and Enter",
  msgRunDialogNpmHint:
    "If npm is missing, use type: terminal or set nodePath in plugin settings.",
  sidebarEmptyButtons: "No buttons configured",
  sidebarToolbarHint: "Template Buttons: check the left sidebar above Favorites",
  msgInvalidButtonsJson: "Template Buttons: invalid buttons JSON in settings",
  templateNotFound: 'Template "{name}" not found',
  templateEmpty: 'Template "{name}" has no content blocks',
  failedCreatePage: 'Failed to create page "{name}"',
  failedInsertTemplate: 'Failed to insert template into "{name}"',
  createdPage: "Created [[{name}]]",
  createdChildPage: "Created child [[{name}]]",
  gitEmptyCommand: 'Git: empty command for "{label}"',
  gitFailed: "Git failed: {label}",
  commandRunning: "Running: {command}",
  commandFinished: "Command finished: {label}",
  commandFailed: "Command failed: {label}",
  cmdShiftFallback: "Cmd+Shift+1:\n{command}",
};

const RU_LABELS: UiLabels = {
  pageBarPopupTitle: "Дочерняя страница",
  pageBarCopyTooltip: "Копировать markdown для соцсетей (без фото)",
  pageBarCopyTooltipDisabled: "Откройте страницу поста",
  pageBarChildTooltip: "Создать дочернюю страницу из шаблона",
  pageBarChildTooltipDisabled: "Откройте страницу, чтобы создать дочернюю",
  pageBarChildTooltipNoTemplates: "Нет шаблонов (scope: page или both)",
  msgOpenRegularPage: "Откройте обычную страницу (не journal)",
  msgNoPageBarTemplates: "Нет шаблонов для page bar (scope: page или both)",
  copyPanelTitle: "Markdown для соцсетей",
  copyPanelHint: "Нажмите «Скопировать» или выделите текст и Cmd+C.",
  copyPanelCloseButton: "Закрыть",
  copyPanelCopyButton: "Скопировать",
  msgCopyManual: "Выделите текст и нажмите Cmd+C",
  msgSocialCopied: "Markdown для соцсетей скопирован",
  msgNoPostBlock: "Нет блока #post / Content на этой странице",
  msgTerminalOpened: "{label}: открыт Terminal ({path})",
  msgTerminalOpenFailed: "Не удалось открыть {path}",
  msgGraphPathNotFound: "Graph path not found",
  msgAllowlistHint:
    'Добавьте в logseq/config.edn :shell/command-allowlist ["{binary}"], или укажите nodePath в настройках плагина. Команда: {command}',
  msgRunDialogHint: "{label}: Cmd+Shift+1 — вставьте (Cmd+V) и Enter",
  msgRunDialogNpmHint:
    "Если npm не находится — используйте type: terminal или укажите nodePath в настройках плагина.",
  sidebarEmptyButtons: "Кнопки не настроены",
  sidebarToolbarHint: "Template Buttons: секция слева над Favorites",
  msgInvalidButtonsJson: "Template Buttons: неверный JSON кнопок в настройках",
  templateNotFound: 'Шаблон "{name}" не найден',
  templateEmpty: 'У шаблона "{name}" нет блоков контента',
  failedCreatePage: 'Не удалось создать страницу "{name}"',
  failedInsertTemplate: 'Не удалось вставить шаблон в "{name}"',
  createdPage: "Создана [[{name}]]",
  createdChildPage: "Создана дочерняя [[{name}]]",
  gitEmptyCommand: 'Git: пустая команда для "{label}"',
  gitFailed: "Git ошибка: {label}",
  commandRunning: "Запуск: {command}",
  commandFinished: "Команда завершена: {label}",
  commandFailed: "Команда не выполнена: {label}",
  cmdShiftFallback: "Cmd+Shift+1:\n{command}",
};

export const LOCALE_PRESETS: Record<UiLocale, UiLabels> = {
  en: EN_LABELS,
  ru: RU_LABELS,
};

export const DEFAULT_UI_LABELS_JSON = JSON.stringify(EN_LABELS, null, 2);

function normalizeLocale(value: unknown): UiLocale {
  return value === "ru" ? "ru" : "en";
}

function parseLabelOverrides(raw: unknown): Partial<UiLabels> {
  if (typeof raw !== "string" || !raw.trim()) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    const overrides: Partial<UiLabels> = {};
    for (const key of UI_LABEL_KEYS) {
      const value = (parsed as Record<string, unknown>)[key];
      if (typeof value === "string" && value.trim()) {
        overrides[key] = value.trim();
      }
    }
    return overrides;
  } catch {
    return {};
  }
}

export function getUiLabels(): UiLabels {
  const locale = normalizeLocale(logseq.settings?.uiLocale);
  const base = LOCALE_PRESETS[locale];
  const overrides = parseLabelOverrides(logseq.settings?.uiLabels);
  return { ...base, ...overrides };
}

export function formatLabel(template: string, vars: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => vars[key] ?? match);
}

export function label(key: keyof UiLabels, vars: Record<string, string> = {}) {
  return formatLabel(getUiLabels()[key], vars);
}
