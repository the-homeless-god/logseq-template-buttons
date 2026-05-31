import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildSocialMarkdown,
  copySocialMarkdownForPage,
} from "../src/socialMarkdown";

const fixture = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "fixtures/sdd-post.md"), "utf8");

describe("socialMarkdown", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (String(url).includes("/pages/Digitable.Post.Test.md")) {
        return { ok: true, text: async () => fixture };
      }
      return { ok: false, text: async () => "" };
    }));
  });

  it("builds markdown from raw page file", async () => {
    const markdown = await buildSocialMarkdown("Digitable.Post.Test");
    expect(markdown).toContain("# SDD title");
    expect(markdown).toContain("#нейросети");
    expect(markdown).toContain("Hello social export");
    expect(markdown).not.toContain("cover.png");
  });

  it("falls back to api block tree", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })));
    logseq.Editor.getPageBlocksTree.mockResolvedValue([
      { uuid: "thesis", content: "### Thesis", children: [["uuid", "thesis-body"]] },
      { uuid: "post", content: "#post", children: [["uuid", "tags"], ["uuid", "content"]] },
    ]);
    logseq.Editor.getBlock.mockImplementation(async (id: string) => {
      if (id === "thesis-body") return { uuid: "thesis-body", content: "API title", children: [] };
      if (id === "post") {
        return {
          uuid: "post",
          content: "#post",
          children: [
            { uuid: "tags", content: "**Tags**", children: [{ uuid: "t1", content: "#api", children: [] }] },
            { uuid: "content", content: "**Content**", children: [{ uuid: "c1", content: "API body", children: [] }] },
          ],
        };
      }
      if (id === "tags") return { uuid: "tags", content: "**Tags**", children: [{ uuid: "t1", content: "#api", children: [] }] };
      if (id === "content") return { uuid: "content", content: "**Content**", children: [{ uuid: "c1", content: "API body", children: [] }] };
      if (id === "thesis") return { uuid: "thesis", content: "### Thesis", children: [{ uuid: "thesis-body", content: "API title", children: [] }] };
      return null;
    });

    const markdown = await buildSocialMarkdown("Digitable.Post.Test");
    expect(markdown).toContain("# API title");
    expect(markdown).toContain("API body");
  });

  it("handles missing post and copy panel", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })));
    logseq.Editor.getPageBlocksTree.mockResolvedValue([{ uuid: "a", content: "plain", children: [] }]);
    await expect(buildSocialMarkdown("Empty")).resolves.toBeNull();

    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, text: async () => fixture })));
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    await expect(copySocialMarkdownForPage("Digitable.Post.Test")).resolves.toBe(true);
    expect(document.getElementById("lstb-copy-fallback-overlay")).toBeTruthy();
  });
});
