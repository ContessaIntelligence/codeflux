/**
 * Copy that replaces upstream text outright instead of just swapping the name. Keyed by the app's locale codes; a
 * locale without an entry keeps the rebranded text. The English entries apply to every locale.
 */
export const overrides: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  en: {
    "desktop.menu.codefluxSupport": "CodeFlux Support",
  },
  zh: {
    "desktop.menu.codefluxSupport": "CodeFlux 支持",
  },
  zht: {
    "desktop.menu.codefluxSupport": "CodeFlux 支援",
  },
}
