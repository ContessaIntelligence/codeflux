/**
 * The product name is rewritten in the dictionaries at load time instead of in each locale file, so the upstream
 * dictionaries stay untouched and merge cleanly. Only the capitalised brand `OpenCode` is replaced: lowercase
 * `opencode` names commands, files and URLs (`opencode.json`, `opencode pair`), and `OPENCODE_*` are environment
 * variables; neither is a brand mention.
 */
const BRAND_PATTERN = /\bOpenCode\b/g

export function brandText(value: string) {
  return value.replace(BRAND_PATTERN, "CodeFlux")
}

export function rebrand<T extends Record<string, string>>(
  dictionary: T,
  overrides: Readonly<Record<string, string>> | undefined,
): T {
  const branded = Object.fromEntries(Object.entries(dictionary).map(([key, value]) => [key, brandText(value)]))

  // SAFETY: same keys as the input, with string values.
  return { ...branded, ...overrides } as T
}
