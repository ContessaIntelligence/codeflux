import { expect, test } from "bun:test"
import { withoutFreeCatalog } from "../src/providers/model-filter"

const model = (input?: number) => ({ cost: input === undefined ? undefined : { input } })

const catalog = (opencode: Record<string, ReturnType<typeof model>>) => ({
  all: new Map([
    ["opencode", { id: "opencode", models: opencode }],
    ["openai", { id: "openai", models: { gpt: model(1) } }],
  ]),
  default: { opencode: Object.keys(opencode)[0] ?? "", openai: "gpt" },
  connected: ["opencode", "openai"],
})

test("a provider with only free models disappears from the catalog", () => {
  const result = withoutFreeCatalog(catalog({ free: model(0), unpriced: model() }))

  expect([...result.all.keys()]).toEqual(["openai"])
  expect(result.connected).toEqual(["openai"])
  expect(result.default).toEqual({ openai: "gpt" })
})

test("paid models of the provider stay, the free ones go", () => {
  const result = withoutFreeCatalog(catalog({ free: model(0), paid: model(2) }))

  expect(Object.keys(result.all.get("opencode")?.models ?? {})).toEqual(["paid"])
  expect(result.connected).toEqual(["opencode", "openai"])
  // The default pointed at the free model, so it is dropped rather than left dangling.
  expect(result.default).toEqual({ openai: "gpt" })
})

test("a catalog without the provider is returned as is", () => {
  const input = { all: new Map([["openai", { id: "openai", models: { gpt: model(1) } }]]), default: {}, connected: ["openai"] }

  expect(withoutFreeCatalog(input)).toBe(input)
})
