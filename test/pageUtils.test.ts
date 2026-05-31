import { describe, expect, it } from "vitest";
import { isRegularPage } from "../src/pageUtils";

describe("isRegularPage", () => {
  it("accepts regular pages", () => {
    expect(isRegularPage({ name: "Post", originalName: "Post" } as never)).toBe(true);
  });

  it("rejects journals, templates, and empty names", () => {
    expect(isRegularPage({ name: "j", "journal?": true } as never)).toBe(false);
    expect(isRegularPage({ name: "Template: X" } as never)).toBe(false);
    expect(isRegularPage({ name: "" } as never)).toBe(false);
  });
});
