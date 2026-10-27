import { expect, test } from "bun:test"
import { fetchModels, modelsEndpoint, parseModelList } from "../src/providers/models"

test.each([
  { input: "https://www.nousflux.com", expected: "https://www.nousflux.com/v1/models" },
  { input: " https://www.nousflux.com/// ", expected: "https://www.nousflux.com/v1/models" },
  { input: "https://api.example.com/v1/", expected: "https://api.example.com/v1/models" },
  { input: "https://api.example.com/api/v2", expected: "https://api.example.com/api/v2/models" },
])("models endpoint for $input", ({ input, expected }) => {
  expect(modelsEndpoint(input)).toBe(expected)
})

test.each<{ name: string; body: unknown; expected: string[] }>([
  { name: "OpenAI list", body: { data: [{ id: "b" }, { id: "a" }, { id: "a" }] }, expected: ["a", "b"] },
  { name: "bare array", body: [{ id: "x" }], expected: ["x"] },
  { name: "entries without an id", body: { data: [{ id: "" }, { name: "n" }, null, { id: 3 }] }, expected: [] },
  { name: "not a list", body: { error: "nope" }, expected: [] },
])("parses $name", ({ body, expected }) => {
  expect(parseModelList(body)).toEqual(expected)
})

test("sends the key and returns the models", async () => {
  const calls: { url: string; auth: string | null }[] = []
  const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), auth: new Headers(init?.headers).get("authorization") })

    return Response.json({ data: [{ id: "m2" }, { id: "m1" }] })
  }) as typeof fetch

  expect(await fetchModels(fetcher, "https://s.example", "sk-test")).toEqual(["m1", "m2"])
  expect(calls).toEqual([{ url: "https://s.example/v1/models", auth: "Bearer sk-test" }])
})

test("a rejected key reads as the HTTP status", async () => {
  const fetcher = (async () => new Response("no", { status: 401, statusText: "Unauthorized" })) as unknown as typeof fetch

  await expect(fetchModels(fetcher, "https://s.example", "bad")).rejects.toThrow("401 Unauthorized")
})
