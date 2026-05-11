// crypto.randomUUID is available everywhere we support (Safari 15.4+, modern
// Edge/Chrome/Firefox, Node 16.7+). No fallback needed.
export function newId(): string {
  return crypto.randomUUID();
}
