import { expect, test } from "bun:test"
import { normalizeBaseURL, NOUSFLUX_DEFAULT_URL, parseModels } from "../src/settings"

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
