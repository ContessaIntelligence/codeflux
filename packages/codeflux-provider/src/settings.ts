/** Provider identity and the pure helpers that turn a NousFlux connection form into provider settings. */
export const NOUSFLUX_ID = "nousflux"

export const NOUSFLUX_NAME = "CodeFlux"

export const NOUSFLUX_DEFAULT_URL = "https://www.routok.com"

/** NousFlux speaks the OpenAI chat-completions protocol. */
export const OPENAI_COMPATIBLE_PACKAGE = "@opencode/ai/providers/openai-compatible"

/** The base URL the OpenAI-compatible package expects: the origin the user entered plus `/v1`. */
export function normalizeBaseURL(input: unknown) {
  const raw = typeof input === "string" && input.trim() !== "" ? input.trim() : NOUSFLUX_DEFAULT_URL
  const trimmed = raw.replace(/\/+$/, "")

  return /\/v\d+$/.test(trimmed) ? trimmed : `${trimmed}/v1`
}

/** Model IDs typed by the user, separated by commas, whitespace or new lines. */
export function parseModels(input: unknown) {
  if (typeof input !== "string") return []

  return [...new Set(input.split(/[\s,]+/).filter((id) => id !== ""))]
}

/**
 * Whether a saved connection carries a blank `baseURL`. An earlier build saved the local model that way, and a saved
 * value overrides the provider's own endpoint, so every request failed with "requires an endpoint baseURL".
 */
export function hasBlankBaseURL(metadata: Record<string, unknown> | undefined) {
  return typeof metadata?.baseURL === "string" && metadata.baseURL.trim() === ""
}
