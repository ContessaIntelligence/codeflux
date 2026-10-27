import { expect, test } from "bun:test"
import { brandDictionary, brandText } from "../src/i18n"

test.each([
  { value: "OpenCode connected", expected: "CodeFlux connected" },
  { value: "Open OpenCode, then OpenCode Go", expected: "Open CodeFlux, then CodeFlux Go" },
  // Commands, files, URLs and environment variables are not brand mentions.
  { value: "Run opencode pair", expected: "Run opencode pair" },
  { value: "Manage in opencode.json", expected: "Manage in opencode.json" },
  { value: "Use $OPENCODE_WORKTREE_BASE", expected: "Use $OPENCODE_WORKTREE_BASE" },
  { value: "https://opencode.ai/docs", expected: "https://opencode.ai/docs" },
  { value: "MyOpenCodeThing", expected: "MyOpenCodeThing" },
])("brand text $value", ({ value, expected }) => {
  expect(brandText(value)).toBe(expected)
})

test("overrides replace rebranded text, and English overrides cover every locale", () => {
  const dictionary: Record<string, string> = {
    "settings.about.trademark": "OpenCode ist eine eingetragene Marke.",
    "settings.about.description": "OpenCode, der Open-Source-Coding-Agent",
    "other.key": "OpenCode",
  }

  expect(brandDictionary("de", dictionary)).toEqual({
    "settings.about.trademark": "CodeFlux is based on OpenCode, which is released under the MIT License.",
    "settings.about.description": "CodeFlux, an AI coding agent by NousFlux",
    // An override also supplies a key the locale's dictionary lacks.
    "settings.about.website": "www.nousflux.com",
    "other.key": "CodeFlux",
  })
})

test("a locale's own override wins over the English one", () => {
  expect(brandDictionary("zh", { "settings.about.description": "x" })["settings.about.description"]).toBe(
    "CodeFlux，NousFlux 出品的 AI 编程助手",
  )
})
