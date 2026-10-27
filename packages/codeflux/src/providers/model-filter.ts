/** The slice of the provider catalog this filter reads and rewrites. */
type Catalog<Provider extends { models: Record<string, { cost?: { input: number } }> }> = {
  all: Map<string, Provider>
  default: Record<string, string>
  connected: string[]
}

/** The keyless OpenCode catalog: models of the `opencode` provider that cost nothing. */
const FREE_PROVIDER = "opencode"

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
