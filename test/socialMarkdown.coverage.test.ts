import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildSocialMarkdown,
  copySocialMarkdownForPage,
} from "../src/socialMarkdown";

const fixture = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "fixtures/sdd-post.md"), "utf8");

describe("socialMarkdown coverage", () => {
  beforeEach(() => {
    logseq.App.getCurrentGraph.mockResolvedValue({ path: "/graph/logsec" });
  });

  it("reads encoded filenames and handles fetch errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).includes(encodeURIComponent("Digitable.Post.Weird"))) {
          return { ok: true, text: async () => fixture };
        }
        throw new Error("network");
      })
    );

    const markdown = await buildSocialMarkdown("Digitable.Post.Weird");
    expect(markdown).toContain("# SDD title");
  });

  it("returns null without graph path", async () => {
    logseq.App.getCurrentGraph.mockResolvedValueOnce(null);
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })));
    await expect(buildSocialMarkdown("Digitable.Post.Test")).resolves.toBeNull();
  });

  it("covers api tree edge cases", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })));

    logseq.Editor.getPageBlocksTree.mockResolvedValue([
      {
        uuid: "thesis",
        content: "### Thesis",
        children: [{ uuid: "t1", content: "Nested title", children: [] }],
      },
      {
        uuid: "post",
        content: "#post",
        children: [
          { uuid: "tags", content: "**Tags**", children: [{ uuid: "t1", content: "#tag", children: [] }] },
          {
            uuid: "content",
            content: "**Content**",
            children: [{ uuid: "c1", content: "Body text", children: [] }],
          },
          { uuid: "links", content: "**Links**", children: [{ uuid: "l1", content: "https://x.dev", children: [] }] },
        ],
      },
    ]);

    logseq.Editor.getBlock.mockImplementation(async (id: string) => {
      if (id === "thesis") {
        return {
          uuid: "thesis",
          content: "### Thesis",
          children: [{ uuid: "t1", content: "Nested title", children: [] }],
        };
      }
      if (id === "post") {
        return {
          uuid: "post",
          content: "#post",
          children: [
            { uuid: "tags", content: "**Tags**", children: [{ uuid: "t1", content: "#tag", children: [] }] },
            {
              uuid: "content",
              content: "**Content**",
              children: [{ uuid: "c1", content: "Body text", children: [] }],
            },
            { uuid: "links", content: "**Links**", children: [{ uuid: "l1", content: "https://x.dev", children: [] }] },
          ],
        };
      }
      return null;
    });

    const markdown = await buildSocialMarkdown("Digitable.Post.Advanced");
    expect(markdown).toContain("# Nested title");
    expect(markdown).toContain("Body text");
    expect(markdown).toContain("https://x.dev");
  });

  it("returns null when api content is empty and warns on copy", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })));
    logseq.Editor.getPageBlocksTree.mockResolvedValue([
      { uuid: "post", content: "#post", children: [{ uuid: "content", content: "**Content**", children: [] }] },
    ]);
    logseq.Editor.getBlock.mockImplementation(async (id: string) => {
      if (id === "post") {
        return {
          uuid: "post",
          content: "#post",
          children: [{ uuid: "content", content: "**Content**", children: [] }],
        };
      }
      if (id === "content") {
        return { uuid: "content", content: "**Content**", children: [{ uuid: "pic", content: "![x](y.png)", children: [] }] };
      }
      return null;
    });

    await expect(buildSocialMarkdown("Empty.Content")).resolves.toBeNull();
    await expect(copySocialMarkdownForPage("Empty.Content")).resolves.toBe(false);
    expect(logseq.App.showMsg).toHaveBeenCalledWith("Нет блока #post / Content на этой странице", "warning");
  });

  it("uses page fallback title for digitable pages", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })));
    logseq.Editor.getPageBlocksTree.mockResolvedValue([
      {
        uuid: "post",
        content: "#post",
        children: [
          { uuid: "content", content: "**Content**", children: [{ uuid: "c1", content: "Only body", children: [] }] },
        ],
      },
    ]);
    logseq.Editor.getBlock.mockImplementation(async (id: string) => {
      if (id === "post") {
        return {
          uuid: "post",
          content: "#post",
          children: [{ uuid: "content", content: "**Content**", children: [{ uuid: "c1", content: "Only body", children: [] }] }],
        };
      }
      if (id === "content") {
        return { uuid: "content", content: "**Content**", children: [{ uuid: "c1", content: "Only body", children: [] }] };
      }
      return null;
    });

    const markdown = await buildSocialMarkdown("Digitable.Post.MyTopic (1)");
    expect(markdown).toContain("# MyTopic");
  });

  it("skips code fence markers in api export", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })));

    logseq.Editor.getPageBlocksTree.mockResolvedValue([
      {
        uuid: "post",
        content: "#post",
        children: [
          {
            uuid: "content",
            content: "**Content**",
            children: [{ uuid: "fence", content: "```", children: [{ uuid: "body", content: "Body text", children: [] }] }],
          },
        ],
      },
    ]);

    logseq.Editor.getBlock.mockImplementation(async (id: string) => {
      if (id === "post") {
        return {
          uuid: "post",
          content: "#post",
          children: [
            {
              uuid: "content",
              content: "**Content**",
              children: [{ uuid: "fence", content: "```", children: [{ uuid: "body", content: "Body text", children: [] }] }],
            },
          ],
        };
      }
      if (id === "content") {
        return {
          uuid: "content",
          content: "**Content**",
          children: [{ uuid: "fence", content: "```", children: [{ uuid: "body", content: "Body text", children: [] }] }],
        };
      }
      return null;
    });

    const markdown = await buildSocialMarkdown("Digitable.Post.Fence");
    expect(markdown).toContain("Body text");
  });

  it("invokes copy callback after manual panel copy", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, text: async () => fixture })));
    Object.defineProperty(window, "parent", {
      configurable: true,
      value: {
        document,
        navigator: { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } },
      },
    });

    await copySocialMarkdownForPage("Digitable.Post.Test");
    const copyButton = document.querySelector(
      '#lstb-copy-fallback-overlay button[data-lstb-copy="true"]'
    ) as HTMLButtonElement;
    copyButton.click();
    await vi.waitFor(() => {
      expect(logseq.App.showMsg).toHaveBeenCalledWith("Markdown для соцсетей скопирован", "success");
    });
  });
});
