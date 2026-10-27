/** Product identity. Everything user-visible that names the product reads from here. */
export const BRAND = {
  name: "CodeFlux",
  company: "NousFlux",
  /** Opened by Help → CodeFlux Support. */
  supportURL: "https://www.nousflux.com",
  /** Where the NousFlux connection form points until the user edits it. */
  nousfluxURL: "https://www.nousflux.com",
  /** Integration and provider ID registered by `@codeflux/provider-nousflux`. */
  nousfluxID: "nousflux",
  nousfluxName: "NousFlux",
} as const
