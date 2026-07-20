/** Not cryptographic — a light obfuscation for a single-user shared gate. */
export function expectedToken(password: string): string {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    hash = (hash * 31 + password.charCodeAt(i)) >>> 0;
  }
  return `v1-${hash.toString(36)}`;
}
