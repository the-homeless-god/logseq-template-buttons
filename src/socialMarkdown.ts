import type { BlockEntity } from "@logseq/libs/dist/LSPlugin";
import { showCopyPanel } from "./clipboard";
import { getGraphPath } from "./scriptLauncher";
import { parsePostFromRaw } from "./postExtract";

function stripImages(text: string) {
  return text
    .split("\n")
    .filter((line) => !/!\[[^\]]*]\([^)]+\)/.test(line.trim()))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanInlineMarkdown(text: string) {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/^\s*[-*]\s+/gm, "")
    .trim();
}

function firstNonEmptyLine(text: string) {
  return (
    text
      .split("\n")
      .map((line) => cleanInlineMarkdown(line.trim()))
      .find(Boolean) ?? ""
  );
}

function pageFallbackTitle(pageName: string) {
  const short = pageName.split("/").pop() ?? pageName;
  return short
    .replace(/^Digitable\.(?:Post|Blog)\.?/, "")
    .replace(/\[\[|\]\]/g, "")
    .replace(/\(\d+\)$/, "")
    .trim();
}

function pageFilenameCandidates(pageName: string) {
  return [`${pageName}.md`, `${encodeURIComponent(pageName)}.md`];
}

async function readPageRawMarkdown(pageName: string) {
  const graphPath = await getGraphPath();
  if (!graphPath) {
    return null;
  }

  const base = graphPath.replace(/\\/g, "/").replace(/\/$/, "");
  const filenames = pageFilenameCandidates(pageName);

  for (const filename of filenames) {
    const urls = [
      `file://${base}/pages/${filename}`,
      `file:///${base.replace(/^\//, "")}/pages/${filename}`,
    ];

    for (const url of urls) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          return await response.text();
        }
      } catch {
        // try next
      }
    }
  }

  return null;
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

async function collectBlockText(block: BlockEntity): Promise<string> {
  const parts: string[] = [];

  async function walk(entity: BlockEntity) {
    const content = entity.content ?? "";
    if (content.trim() && content.trim() !== "```") {
      parts.push(content);
    }

    for (const child of entity.children ?? []) {
      const resolved = await resolveBlockChild(child as BlockEntity | ["uuid", string]);
      if (resolved) {
        await walk(resolved);
      }
    }
  }

  for (const child of block.children ?? []) {
    const resolved = await resolveBlockChild(child as BlockEntity | ["uuid", string]);
    if (resolved) {
      await walk(resolved);
    }
  }

  return parts.join("\n").trim();
}

async function findPostBlock(pageName: string) {
  const tree = await logseq.Editor.getPageBlocksTree(pageName);
  if (!tree?.length) {
    return null;
  }

  for (const block of tree) {
    const full =
      block.children?.length && !isBlockEntity(block.children[0])
        ? await logseq.Editor.getBlock(block.uuid, { includeChildren: true })
        : block;

    if (!full) {
      continue;
    }

    if (full.content.trim() === "#post" || full.content.trim().startsWith("#post ")) {
      return full;
    }

    async function search(entity: BlockEntity): Promise<BlockEntity | null> {
      if (entity.content.trim() === "#post" || entity.content.trim().startsWith("#post ")) {
        return entity;
      }

      for (const child of entity.children ?? []) {
        const resolved = await resolveBlockChild(child as BlockEntity | ["uuid", string]);
        if (resolved) {
          const found = await search(resolved);
          if (found) {
            return found;
          }
        }
      }

      return null;
    }

    const nested = await search(full);
    if (nested) {
      return nested;
    }
  }

  return null;
}

async function findLabeledChild(postBlock: BlockEntity, label: string) {
  for (const child of postBlock.children ?? []) {
    const entity = await resolveBlockChild(child as BlockEntity | ["uuid", string]);
    if (!entity) {
      continue;
    }

    if (entity.content.trim().replace(/\*\*/g, "") === label) {
      return entity;
    }
  }

  return null;
}

async function buildSocialMarkdownFromApi(pageName: string): Promise<string | null> {
  const tree = await logseq.Editor.getPageBlocksTree(pageName);
  if (!tree?.length) {
    return null;
  }

  let thesis = "";
  for (const block of tree) {
    const content = block.content.trim();
    if (content === "### Thesis" || content.endsWith("### Thesis")) {
      const full = await logseq.Editor.getBlock(block.uuid, { includeChildren: true });
      if (full) {
        thesis = await collectBlockText(full);
      }
      break;
    }
  }

  const postBlock = await findPostBlock(pageName);
  if (!postBlock) {
    return null;
  }

  const tagsBlock = await findLabeledChild(postBlock, "Tags");
  const contentBlock = await findLabeledChild(postBlock, "Content");
  const linksBlock = await findLabeledChild(postBlock, "Links");

  const tagsText = tagsBlock ? await collectBlockText(tagsBlock) : "";
  const contentRaw = contentBlock ? await collectBlockText(contentBlock) : "";
  const linksRaw = linksBlock ? await collectBlockText(linksBlock) : "";

  const content = stripImages(contentRaw);
  if (!content) {
    return null;
  }

  const title = firstNonEmptyLine(thesis) || pageFallbackTitle(pageName);
  const tags = [...tagsText.matchAll(/#([\w\u0400-\u04ff-]+)/gu)].map((match) => match[1]);
  const links = stripImages(linksRaw);

  const parts: string[] = [`# ${title}`, ""];

  if (tags.length) {
    parts.push(tags.map((tag) => `#${tag}`).join(" "));
    parts.push("");
  }

  parts.push(content);

  if (links) {
    parts.push("", links);
  }

  return parts.join("\n").trim();
}

function buildSocialMarkdownFromParsed(
  pageName: string,
  parsed: NonNullable<ReturnType<typeof parsePostFromRaw>>
) {
  const title = firstNonEmptyLine(parsed.thesis) || pageFallbackTitle(pageName);
  const content = stripImages(parsed.content);
  const links = stripImages(parsed.links);

  const parts: string[] = [`# ${title}`, ""];

  if (parsed.tags.length) {
    parts.push(parsed.tags.map((tag) => `#${tag}`).join(" "));
    parts.push("");
  }

  parts.push(content);

  if (links) {
    parts.push("", links);
  }

  return parts.join("\n").trim();
}

export async function buildSocialMarkdown(pageName: string): Promise<string | null> {
  const raw = await readPageRawMarkdown(pageName);
  if (raw) {
    const parsed = parsePostFromRaw(raw);
    if (parsed) {
      return buildSocialMarkdownFromParsed(pageName, parsed);
    }
  }

  return buildSocialMarkdownFromApi(pageName);
}

export async function copySocialMarkdownForPage(pageName: string) {
  const markdown = await buildSocialMarkdown(pageName);
  if (!markdown) {
    logseq.App.showMsg("Нет блока #post / Content на этой странице", "warning");
    return false;
  }

  showCopyPanel(markdown, () => {
    logseq.App.showMsg("Markdown для соцсетей скопирован", "success");
  });

  return true;
}
