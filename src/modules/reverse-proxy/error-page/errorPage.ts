/** Keep in step with the limit the management API enforces. */
export const ERROR_PAGE_MAX_BYTES = 64 * 1024;

export const ERROR_PAGE_PLACEHOLDERS = [
  { token: "{{status}}", description: "HTTP status code, e.g. 503" },
  { token: "{{title}}", description: "Short error title" },
  { token: "{{message}}", description: "Explanation shown to the visitor" },
  { token: "{{request_id}}", description: "Request ID, useful for support" },
] as const;

export const ERROR_PAGE_STARTER = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{{title}}</title>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center;
           font-family: system-ui, sans-serif; background: #181a1d; color: #e4e7e9; }
    main { max-width: 32rem; padding: 2rem; text-align: center; }
    h1 { font-size: 4rem; margin: 0; color: #f68330; }
    p { color: #a7b1b9; }
    small { color: #7c8994; }
  </style>
</head>
<body>
  <main>
    <h1>{{status}}</h1>
    <h2>{{title}}</h2>
    <p>{{message}}</p>
    <small>Request ID: {{request_id}}</small>
  </main>
</body>
</html>
`;

export type ErrorPageSample = {
  status: number;
  title: string;
  message: string;
  requestId: string;
};

export const ERROR_PAGE_SAMPLE: ErrorPageSample = {
  status: 503,
  title: "Service Unavailable",
  message: "This service is not available at this time.",
  requestId: "dc0e2mc5gagc73b5r7rg",
};

export function byteLength(html: string): number {
  return new TextEncoder().encode(html).length;
}

/** Returns an error message for the page, or "" when it can be saved. */
export function validateErrorPageHtml(html: string): string {
  if (html.trim() === "") return "Enter the HTML of the page.";
  if (byteLength(html) > ERROR_PAGE_MAX_BYTES) {
    return `The page is larger than ${ERROR_PAGE_MAX_BYTES / 1024} KB.`;
  }
  return "";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Fills the placeholders the way the proxy does: every value is HTML-escaped
 * and unknown placeholders are left as they are.
 */
export function renderErrorPagePreview(
  html: string,
  sample: ErrorPageSample = ERROR_PAGE_SAMPLE,
): string {
  return html
    .split("{{status}}")
    .join(String(sample.status))
    .split("{{title}}")
    .join(escapeHtml(sample.title))
    .split("{{message}}")
    .join(escapeHtml(sample.message))
    .split("{{request_id}}")
    .join(escapeHtml(sample.requestId));
}
