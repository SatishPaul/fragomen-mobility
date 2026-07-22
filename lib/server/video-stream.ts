export function forwardedRange(range: string | null): string | null {
  if (!range) return null;
  return /^bytes=\d*-\d*(?:,\s*\d*-\d*)*$/.test(range) ? range : null;
}

export function contentDisposition(filename: string): string {
  const safeFilename = filename.replace(/["\\\r\n]/g, "-");
  return `attachment; filename="${safeFilename}"`;
}