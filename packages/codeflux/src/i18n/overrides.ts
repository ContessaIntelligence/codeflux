/**
 * Copy that replaces upstream text outright instead of just swapping the name. Keyed by the app's locale codes; a
 * locale without an entry keeps the rebranded text.
 */
export const overrides: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  en: {
    "settings.about.website": "www.nousflux.com",
    "settings.about.description": "CodeFlux, an AI coding agent by NousFlux",
    "settings.about.trademark": "CodeFlux is based on OpenCode, which is released under the MIT License.",
  },
  zh: {
    "desktop.menu.codefluxSupport": "CodeFlux 支持",
    "settings.about.website": "www.nousflux.com",
    "settings.about.description": "CodeFlux，NousFlux 出品的 AI 编程助手",
    "settings.about.trademark": "CodeFlux 基于 OpenCode 开发，OpenCode 以 MIT 许可证发布。",
  },
  zht: {
    "desktop.menu.codefluxSupport": "CodeFlux 支援",
    "settings.about.website": "www.nousflux.com",
    "settings.about.description": "CodeFlux，NousFlux 出品的 AI 程式設計助手",
    "settings.about.trademark": "CodeFlux 基於 OpenCode 開發，OpenCode 以 MIT 授權條款發布。",
  },
}
