/** Product identity. Everything user-visible that names the product reads from here. */
export const BRAND = {
  name: "CodeFlux",
  company: "Routok",
  /** Opened by Help → CodeFlux Support. */
  supportURL: "https://www.routok.com",
  /** Where the CodeFlux connection form points until the user edits it. */
  nousfluxURL: "https://www.routok.com",
  /** Integration and provider ID registered by `@codeflux/provider-nousflux`. */
  nousfluxID: "nousflux",
  nousfluxName: "CodeFlux",
} as const
