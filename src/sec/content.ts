/** A structural/error-page guard, not a parser or proof of filing authenticity. */
export function validateFilingHtml(bytes: Uint8Array): void {
  const html = new TextDecoder().decode(bytes);
  const hasDocument = /<html[\s>]/i.test(html) && /<\/html\s*>/i.test(html);
  const isErrorPage = /<title>[^<]*(?:access denied|undeclared automated tool|request rate threshold)/i.test(html);
  if (!hasDocument || isErrorPage) {
    throw new Error('response is not a filing HTML document');
  }
}
