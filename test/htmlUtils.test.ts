import { describe, expect, it } from "vitest";
import { escapeHtml } from "../src/htmlUtils";

describe("escapeHtml", () => {
  it("escapes special characters", () => {
    expect(escapeHtml(`Tom & Jerry <script>"x"`)).toBe("Tom &amp; Jerry &lt;script&gt;&quot;x&quot;");
  });
});
