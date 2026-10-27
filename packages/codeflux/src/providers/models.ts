/** The models endpoint of an OpenAI-compatible server: the entered origin plus `/v1` unless it already names a version. */
export function modelsEndpoint(baseURL: string) {
  const trimmed = baseURL.trim().replace(/\/+$/, "")

  return `${/\/v\d+$/.test(trimmed) ? trimmed : `${trimmed}/v1`}/models`
}

/** Reads the model IDs from a `/v1/models` response: `{ data: [{ id }] }`, or a bare array of the same objects. */
export function parseModelList(body: unknown) {
  const list = Array.isArray(body) ? body : isRecord(body) && Array.isArray(body.data) ? body.data : []

  return [
    ...new Set(
      list.flatMap((item): string[] => (isRecord(item) && typeof item.id === "string" && item.id !== "" ? [item.id] : [])),
    ),
  ].toSorted((a, b) => a.localeCompare(b))
}

/**
 * Asks the server which models the key may use. Rejects with an `Error` whose message the form shows as is, so a wrong
 * key (401) and an unreachable server read differently.
 */
export async function fetchModels(fetcher: typeof fetch, baseURL: string, key: string) {
  const response = await fetcher(modelsEndpoint(baseURL), {
    headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
  })

  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`.trim())

  return parseModelList(await response.json())
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}
