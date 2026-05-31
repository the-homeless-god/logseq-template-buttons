/** Shared with scripts/publish-digitable-blog.mjs — extract #post fields from page markdown. */

type ParsedBlock = { depth: number; text: string };

export function parseBlocks(content: string): ParsedBlock[] {
  const blocks: ParsedBlock[] = [];

  for (const line of content.split("\n")) {
    const bullet = line.match(/^(\t*)- (.*)$/);
    if (bullet) {
      blocks.push({ depth: bullet[1].length, text: bullet[2].trimEnd() });
      continue;
    }

    const header = line.match(/^(\t*)(#{1,3} .+|#post|\*\*[^*]+\*\*)\s*$/);
    if (header) {
      blocks.push({ depth: header[1].length, text: header[2].trimEnd() });
    }
  }

  return blocks;
}

function findBlockIndex(blocks: ParsedBlock[], matcher: (text: string) => boolean) {
  return blocks.findIndex((block) => matcher(block.text));
}

function collectSubtree(blocks: ParsedBlock[], startIndex: number) {
  const start = blocks[startIndex];
  const lines: string[] = [];

  for (let index = startIndex + 1; index < blocks.length; index += 1) {
    if (blocks[index].depth <= start.depth) {
      break;
    }
    lines.push(blocks[index].text);
  }

  return lines.join("\n").trim();
}

export function extractSectionFromRaw(raw: string, label: string) {
  const pattern = new RegExp(
    `(?:^|\\n)(?:\\t*- )?\\*\\*${label}\\*\\*\\s*\\n([\\s\\S]*?)(?=\\n(?:\\t*- )?\\*\\*[^*]+\\*\\*|\\n(?:\\t*- )?#{1,3} |\\n(?:\\t*- )?#post|\\n(?:\\t*- )?\\[\\[|$)`
  );
  const match = raw.match(pattern);
  return match?.[1]?.trim() ?? "";
}

export function extractContentFromRaw(raw: string) {
  const section = extractSectionFromRaw(raw, "Content");
  if (!section) {
    return "";
  }

  const normalized = section
    .split("\n")
    .map((line) => line.replace(/^\t*- /, ""))
    .join("\n")
    .trim();

  const fenced = normalized.match(/^```[^\n]*\n([\s\S]*?)\n\s*```\s*$/m);
  if (fenced) {
    return fenced[1]
      .split("\n")
      .map((line) => line.replace(/^\t+/, "").replace(/^ {2,4}/, ""))
      .join("\n")
      .trim();
  }

  return normalized;
}

export function extractTags(text: string) {
  return [...text.matchAll(/#([\w\u0400-\u04ff-]+)/gu)].map((match) => match[1]);
}

export function parsePostFromRaw(raw: string) {
  const blocks = parseBlocks(raw);
  const postIndex = findBlockIndex(blocks, (text) => text === "#post" || text.startsWith("#post "));
  if (postIndex === -1) {
    return null;
  }

  const thesisIndex = findBlockIndex(
    blocks,
    (text) => text === "### Thesis" || text.endsWith("### Thesis")
  );
  const thesis = thesisIndex === -1 ? "" : collectSubtree(blocks, thesisIndex);

  const tagsText = extractSectionFromRaw(raw, "Tags");
  const content = extractContentFromRaw(raw);
  const links = extractSectionFromRaw(raw, "Links").replace(/^\t*-?\s*$/gm, "").trim();

  if (!content) {
    return null;
  }

  return { thesis, tags: extractTags(tagsText), content, links };
}
