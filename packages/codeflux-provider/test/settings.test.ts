import { expect, test } from "bun:test"
import { Schema } from "effect"
import { hasBlankBaseURL, localStatus, normalizeBaseURL, NOUSFLUX_DEFAULT_URL, parseModels } from "../src/settings"

test.each([
  { input: undefined, expected: `${NOUSFLUX_DEFAULT_URL}/v1` },
  { input: "   ", expected: `${NOUSFLUX_DEFAULT_URL}/v1` },
  { input: "https://api.example.com", expected: "https://api.example.com/v1" },
  { input: "https://api.example.com///", expected: "https://api.example.com/v1" },
  // A URL that already names its API version keeps it.
  { input: "https://api.example.com/v1/", expected: "https://api.example.com/v1" },
  { input: "https://api.example.com/api/v2", expected: "https://api.example.com/api/v2" },
])("base URL $input becomes $expected", ({ input, expected }) => {
  expect(normalizeBaseURL(input)).toBe(expected)
})

test.each<{ input: unknown; expected: string[] }>([
  { input: undefined, expected: [] },
  { input: "", expected: [] },
  { input: "a, b\nc  d", expected: ["a", "b", "c", "d"] },
  { input: "a,a,,b", expected: ["a", "b"] },
])("models $input parse to $expected", ({ input, expected }) => {
  expect(parseModels(input)).toEqual(expected)
})

test.each<{ metadata: Record<string, unknown> | undefined; expected: boolean }>([
  // What the earlier build saved, and the whitespace variant.
  { metadata: { baseURL: "", models: "qwen3-4b" }, expected: true },
  { metadata: { baseURL: "  ", models: "qwen3-4b" }, expected: true },
  // A real endpoint, a connection that never set one, and no metadata at all are left alone.
  { metadata: { baseURL: "http://127.0.0.1:18080/v1", models: "qwen3-4b" }, expected: false },
  { metadata: { models: "qwen3-4b" }, expected: false },
  { metadata: undefined, expected: false },
])("blank base URL in $metadata is $expected", ({ metadata, expected }) => {
  expect(hasBlankBaseURL(metadata)).toBe(expected)
})

test.each([
  { name: "stopped", server: { running: false as const }, extra: {}, expected: { running: false, starting: false } },
  {
    name: "running",
    server: { running: true as const, port: 18080 },
    extra: {},
    expected: { running: true, starting: false, port: 18080 },
  },
  {
    name: "loading the model",
    server: { running: false as const },
    extra: { starting: true },
    expected: { running: false, starting: true },
  },
  {
    name: "after a failed start",
    server: { running: false as const },
    extra: { failure: "llama-server exited with code 1" },
    expected: { running: false, starting: false, failure: "llama-server exited with code 1" },
  },
])("the local status while $name is a JSON value", ({ server, extra, expected }) => {
  const status = localStatus({ runtime: true, model: true, licensed: true, starting: false, server, ...extra })

  expect(status).toMatchObject(expected)
  // JSON has no undefined: an optional field is absent, never a key holding undefined.
  expect(Object.keys(status).includes("port")).toBe(server.running)
  expect(Object.keys(status).includes("failure")).toBe("failure" in extra)
  expect(Schema.is(Schema.Json)(status)).toBe(true)
})
