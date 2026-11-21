import { describe, expect, it } from "vitest";
import {
  byteLength,
  ERROR_PAGE_MAX_BYTES,
  ERROR_PAGE_SAMPLE,
  ERROR_PAGE_STARTER,
  renderErrorPagePreview,
  validateErrorPageHtml,
} from "@/modules/reverse-proxy/error-page/errorPage";

describe("validateErrorPageHtml", () => {
  it("accepts a normal page", () => {
    expect(validateErrorPageHtml("<h1>{{status}}</h1>")).toBe("");
  });

  it("rejects an empty or blank page", () => {
    expect(validateErrorPageHtml("")).toMatch(/enter the html/i);
    expect(validateErrorPageHtml("  \n\t")).toMatch(/enter the html/i);
  });

  it("accepts a page exactly at the limit", () => {
    expect(validateErrorPageHtml("a".repeat(ERROR_PAGE_MAX_BYTES))).toBe("");
  });

  it("rejects a page over the limit", () => {
    expect(validateErrorPageHtml("a".repeat(ERROR_PAGE_MAX_BYTES + 1))).toMatch(
      /larger than 64 KB/,
    );
  });

  it("counts bytes, not characters, as the API does", () => {
    // "é" is 2 bytes in UTF-8, so half the limit in characters is already full.
    const html = "é".repeat(ERROR_PAGE_MAX_BYTES / 2 + 1);
    expect(html.length).toBeLessThan(ERROR_PAGE_MAX_BYTES);
    expect(validateErrorPageHtml(html)).toMatch(/larger than/);
  });
});

describe("byteLength", () => {
  it("measures UTF-8 bytes", () => {
    expect(byteLength("abc")).toBe(3);
    expect(byteLength("é")).toBe(2);
    expect(byteLength("日本")).toBe(6);
  });
});

describe("renderErrorPagePreview", () => {
  it("fills every placeholder", () => {
    const out = renderErrorPagePreview(
      "{{status}}|{{title}}|{{message}}|{{request_id}}",
    );
    expect(out).toBe(
      `503|Service Unavailable|${ERROR_PAGE_SAMPLE.message}|${ERROR_PAGE_SAMPLE.requestId}`,
    );
  });

  it("replaces repeated placeholders", () => {
    expect(renderErrorPagePreview("{{status}} {{status}}")).toBe("503 503");
  });

  it("escapes substituted values like the proxy does", () => {
    const out = renderErrorPagePreview("<p>{{message}}</p>", {
      ...ERROR_PAGE_SAMPLE,
      message: `<script>alert("x")</script> & 'y'`,
    });
    expect(out).not.toContain("<script>");
    expect(out).toContain("&lt;script&gt;");
    expect(out).toContain("&amp;");
    expect(out).toContain("&#39;y&#39;");
  });

  it("leaves unknown placeholders alone", () => {
    expect(renderErrorPagePreview("{{unknown}} {{ title }}")).toBe(
      "{{unknown}} {{ title }}",
    );
  });
});

describe("ERROR_PAGE_STARTER", () => {
  it("is a valid page that uses every placeholder", () => {
    expect(validateErrorPageHtml(ERROR_PAGE_STARTER)).toBe("");
    for (const token of [
      "{{status}}",
      "{{title}}",
      "{{message}}",
      "{{request_id}}",
    ]) {
      expect(ERROR_PAGE_STARTER).toContain(token);
    }
  });

  it("does not need scripts, which the proxy blocks", () => {
    expect(ERROR_PAGE_STARTER.toLowerCase()).not.toContain("<script");
  });
});
