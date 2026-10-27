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

test("a dictionary is rebranded and gains the CodeFlux support label", () => {
  const dictionary: Record<string, string> = { "other.key": "OpenCode", "desktop.menu.app": "OpenCode" }

  expect(brandDictionary("de", dictionary)).toEqual({
    "other.key": "CodeFlux",
    "desktop.menu.app": "CodeFlux",
    "desktop.menu.codefluxSupport": "CodeFlux Support",
  })
})

test("a locale's own override wins over the English one", () => {
  const empty: Record<string, string> = {}

  expect(brandDictionary("zh", empty)["desktop.menu.codefluxSupport"]).toBe("CodeFlux 支持")
  expect(brandDictionary("zht", empty)["desktop.menu.codefluxSupport"]).toBe("CodeFlux 支援")
})
