/** The slice of the provider catalog this filter reads and rewrites. */
type Catalog<Provider extends { models: Record<string, { cost?: { input: number } }> }> = {
  all: Map<string, Provider>
  default: Record<string, string>
  connected: string[]
}

/** The keyless OpenCode catalog: models of the `opencode` provider that cost nothing. */
const FREE_PROVIDER = "opencode"

/** The raw Ollama provider: local models surface as CodeFlux-4B instead. */
const RAW_LOCAL_PROVIDER = "ollama"

/**
 * Drops the free OpenCode models from a provider catalog. CodeFlux does not offer them, so no picker, setting or
 * default model should see them. A paid model of the same provider (a Zen key) stays, and a provider left without
 * models disappears.
 */
export function withoutFreeCatalog<Provider extends { models: Record<string, { cost?: { input: number } }> }>(
  catalog: Catalog<Provider>,
): Catalog<Provider> {
  const provider = catalog.all.get(FREE_PROVIDER)

  if (!provider) return catalog
  const paid = Object.fromEntries(
    Object.entries(provider.models).filter(([, model]) => model.cost !== undefined && model.cost.input > 0),
  )
  const all = new Map(catalog.all)

  if (Object.keys(paid).length > 0) all.set(FREE_PROVIDER, { ...provider, models: paid })
  else all.delete(FREE_PROVIDER)

  return {
    all,
    default: Object.fromEntries(
      Object.entries(catalog.default).filter(([id, model]) => id !== FREE_PROVIDER || model in paid),
    ),
    connected: catalog.connected.filter((id) => all.has(id)),
  }
}

/**
 * Drops the raw Ollama provider from a catalog. CodeFlux presents the local Ollama endpoint as its own CodeFlux-4B
 * provider, so the unbranded duplicate never reaches a picker, setting or default model.
 */
export function withoutRawOllama<Provider extends { models: Record<string, { cost?: { input: number } }> }>(
  catalog: Catalog<Provider>,
): Catalog<Provider> {
  if (!catalog.all.has(RAW_LOCAL_PROVIDER)) return catalog
  const all = new Map(catalog.all)
  all.delete(RAW_LOCAL_PROVIDER)

  return {
    all,
    default: Object.fromEntries(Object.entries(catalog.default).filter(([id]) => id !== RAW_LOCAL_PROVIDER)),
    connected: catalog.connected.filter((id) => all.has(id)),
  }
}
