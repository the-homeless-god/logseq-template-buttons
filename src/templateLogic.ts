import type { BlockEntity, IBatchBlock } from "@logseq/libs/dist/LSPlugin";
import { getDateForPage } from "logseq-dateutils";

let dateFormat = "dd.MM.yyyy";

const TEMPLATE_PROPERTY_KEYS = ["template", "template-including-parent"];

export async function initDateFormat() {
  dateFormat = (await logseq.App.getUserConfigs()).preferredDateFormat;
}

function formatTime(date: Date) {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function resolvePageNamePattern(
  pattern: string,
  templateName: string,
  context?: { parentPageName?: string }
) {
  const now = new Date();
  const date = getDateForPage(now, dateFormat);
  const time = formatTime(now);
  const parentPageName = context?.parentPageName ?? "";
  const parentShort = parentPageName.split("/").pop() ?? parentPageName;

  return pattern
    .replaceAll("{parent}", parentPageName)
    .replaceAll("{parent-short}", parentShort)
    .replaceAll("{template}", templateName)
    .replaceAll("{date}", date)
    .replaceAll("{time}", time)
    .replaceAll("{datetime}", `${date} ${time}`)
    .trim();
}

function stripTemplateProperties(properties?: Record<string, unknown>) {
  if (!properties) {
    return undefined;
  }

  const next: Record<string, unknown> = { ...properties };
  for (const key of TEMPLATE_PROPERTY_KEYS) {
    delete next[key];
  }

  return Object.keys(next).length ? next : undefined;
}

function resolveDynamicContent(content: string) {
  const now = new Date();
  const today = getDateForPage(now, dateFormat);

  return content.replace(/<%([^%].*?)%>/g, (match, raw: string) => {
    const token = raw.trim().toLowerCase();
    if (token === "today") {
      return `[[${today}]]`;
    }
    if (token === "yesterday") {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return `[[${getDateForPage(yesterday, dateFormat)}]]`;
    }
    if (token === "tomorrow") {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return `[[${getDateForPage(tomorrow, dateFormat)}]]`;
    }
    if (token === "time") {
      return formatTime(now);
    }
    return match;
  });
}

function isBlockEntity(value: unknown): value is BlockEntity {
  return typeof value === "object" && value !== null && "uuid" in value && "content" in value;
}

async function resolveBlockChild(child: BlockEntity | ["uuid", string]): Promise<BlockEntity | null> {
  if (isBlockEntity(child)) {
    if (child.children?.length && !isBlockEntity(child.children[0])) {
      return logseq.Editor.getBlock(child.uuid, { includeChildren: true });
    }
    return child;
  }

  if (Array.isArray(child) && child[0] === "uuid") {
    return logseq.Editor.getBlock(child[1], { includeChildren: true });
  }

  return null;
}

async function blockToBatch(block: BlockEntity): Promise<IBatchBlock> {
  const childEntities: BlockEntity[] = [];

  for (const child of block.children ?? []) {
    const entity = await resolveBlockChild(child as BlockEntity | ["uuid", string]);
    if (entity) {
      childEntities.push(entity);
    }
  }

  const properties = stripTemplateProperties(block.properties as Record<string, unknown> | undefined);
  const batch: IBatchBlock = {
    content: resolveDynamicContent(block.content),
  };

  if (properties) {
    batch.properties = properties;
  }

  if (childEntities.length) {
    batch.children = await Promise.all(childEntities.map(blockToBatch));
  }

  return batch;
}

async function collectTemplateBatchBlocks(templateName: string): Promise<IBatchBlock[]> {
  const templateBlock = await logseq.App.getTemplate(templateName);
  if (!templateBlock?.uuid) {
    return [];
  }

  const templateTree = await logseq.Editor.getBlock(templateBlock.uuid, { includeChildren: true });
  if (!templateTree?.children?.length) {
    return [];
  }

  const childEntities: BlockEntity[] = [];
  for (const child of templateTree.children) {
    const entity = await resolveBlockChild(child as BlockEntity | ["uuid", string]);
    if (entity) {
      childEntities.push(entity);
    }
  }

  return Promise.all(childEntities.map(blockToBatch));
}

async function pageExists(pageName: string) {
  const page = await logseq.Editor.getPage(pageName);
  return Boolean(page);
}

async function uniquePageName(baseName: string) {
  if (!(await pageExists(baseName))) {
    return baseName;
  }

  for (let index = 1; index < 100; index += 1) {
    const candidate = `${baseName} (${index})`;
    if (!(await pageExists(candidate))) {
      return candidate;
    }
  }

  return `${baseName} ${Date.now()}`;
}

function ensureChildPageName(parentPageName: string, pageName: string) {
  if (!parentPageName) {
    return pageName;
  }

  if (pageName === parentPageName || pageName.startsWith(`${parentPageName}/`)) {
    return pageName;
  }

  if (pageName.includes("/")) {
    return pageName;
  }

  return `${parentPageName}/${pageName}`;
}

async function insertTemplateIntoPage(pageName: string, templateName: string) {
  const batchBlocks = await collectTemplateBatchBlocks(templateName);
  if (!batchBlocks.length) {
    logseq.App.showMsg(`Template "${templateName}" has no content blocks`, "warning");
    return false;
  }

  const page = await logseq.Editor.createPage(pageName, {}, { createFirstBlock: false, redirect: false });
  if (!page?.uuid) {
    logseq.App.showMsg(`Failed to create page "${pageName}"`, "error");
    return false;
  }

  const inserted = await logseq.Editor.insertBatchBlock(page.uuid, batchBlocks, { sibling: false });
  if (!inserted?.length) {
    logseq.App.showMsg(`Failed to insert template into "${pageName}"`, "error");
    await logseq.Editor.deletePage(pageName);
    return false;
  }

  return true;
}

async function addBacklinkOnParent(parentPageName: string, childPageName: string) {
  const linkTarget = childPageName.startsWith(`${parentPageName}/`)
    ? childPageName.slice(parentPageName.length + 1)
    : childPageName;

  await logseq.Editor.appendBlockInPage(parentPageName, `[[${linkTarget}]]`);
}

export async function createPageFromTemplate(templateName: string, pageNamePattern: string) {
  const exists = await logseq.App.existTemplate(templateName);
  if (!exists) {
    logseq.App.showMsg(`Template "${templateName}" not found`, "warning");
    return;
  }

  const pageName = await uniquePageName(resolvePageNamePattern(pageNamePattern, templateName));
  const created = await insertTemplateIntoPage(pageName, templateName);
  if (!created) {
    return;
  }

  logseq.App.pushState("page", { name: pageName });
  logseq.App.showMsg(`Created [[${pageName}]]`, "success");
}

export async function createChildPageFromTemplate(
  parentPageName: string,
  templateName: string,
  pageNamePattern: string,
  options?: { addBacklink?: boolean }
) {
  const exists = await logseq.App.existTemplate(templateName);
  if (!exists) {
    logseq.App.showMsg(`Template "${templateName}" not found`, "warning");
    return;
  }

  const resolvedName = resolvePageNamePattern(pageNamePattern, templateName, { parentPageName });
  const childPageName = await uniquePageName(ensureChildPageName(parentPageName, resolvedName));
  const created = await insertTemplateIntoPage(childPageName, templateName);
  if (!created) {
    return;
  }

  if (options?.addBacklink !== false) {
    await addBacklinkOnParent(parentPageName, childPageName);
  }

  logseq.App.pushState("page", { name: childPageName });
  logseq.App.showMsg(`Created child [[${childPageName}]]`, "success");
}
