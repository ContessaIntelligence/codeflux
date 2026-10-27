import { overrides } from "./overrides"
import { rebrand } from "./rebrand"

export { brandText, rebrand } from "./rebrand"
export { text, type TextKey } from "./text"

/**
 * Applies the CodeFlux brand and copy overrides to one locale's merged dictionary. The English overrides apply to
 * every locale so a translated upstream trademark notice never survives under the new name.
 */
export function brandDictionary<T extends Record<string, string>>(locale: string, dictionary: T): T {
  return rebrand(dictionary, { ...overrides.en, ...overrides[locale] })
}
