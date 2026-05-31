import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  extractContentFromRaw,
  extractSectionFromRaw,
  extractTags,
  parseBlocks,
  parsePostFromRaw,
} from "../src/postExtract";

const fixture = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "fixtures/sdd-post.md"), "utf8");

describe("postExtract", () => {
  it("parses blocks and post sections from fixture", () => {
    const blocks = parseBlocks(fixture);
    expect(blocks.some((block) => block.text === "#post")).toBe(true);

    const post = parsePostFromRaw(fixture);
    expect(post?.thesis).toContain("SDD title");
    expect(post?.tags).toEqual(expect.arrayContaining(["sdd", "ai", "нейросети"]));
    expect(post?.content).toContain("Hello social export");
    expect(post?.links).toContain("https://example.com");
  });

  it("returns null when #post block is absent", () => {
    expect(parsePostFromRaw("### Thesis\n- line\n")).toBeNull();
  });

  it("returns null when post content is missing", () => {
    expect(parsePostFromRaw("- #post\n\t- **Content**")).toBeNull();
  });

  it("extracts tags and empty sections", () => {
    expect(extractTags("#one #two")).toEqual(["one", "two"]);
    expect(extractSectionFromRaw(fixture, "Missing")).toBe("");
    expect(extractContentFromRaw("- **Content**\n\t- plain text")).toBe("plain text");
  });
});
