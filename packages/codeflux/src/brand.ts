/** Product identity. Everything user-visible that names the product reads from here. */
export const BRAND = {
  name: "CodeFlux",
  company: "Routok",
  /** Opened by Help → CodeFlux Support. */
  supportURL: "https://www.routok.com",
  /** Where the CodeFlux connection form points until the user edits it. */
  nousfluxURL: "https://www.routok.com",
  /** Integration and provider ID registered by `@codeflux/provider-codeflux`. */
  nousfluxID: "nousflux",
  nousfluxName: "CodeFlux",
  /** Integration and provider ID of the local model (qwen3:4b through Ollama). */
  localID: "codeflux-4b",
} as const
