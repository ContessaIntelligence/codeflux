/** Copy for the components in this package, keyed like the app dictionaries. Locales without an entry read English. */
const en = {
  "picker.nousflux.tagline": "Connect your NousFlux account",
  "nousflux.title": "NousFlux",
  "nousflux.image.alt": "NousFlux",
  "nousflux.url.label": "NousFlux URL",
  "nousflux.description": "Enter your NousFlux API key to connect your account",
  "nousflux.key.label": "NousFlux API key",
  "nousflux.key.placeholder": "API key",
  "nousflux.submit": "Continue",
  "nousflux.error.url": "Enter a valid http or https URL",
  "nousflux.error.key": "API key is required",
  "nousflux.error.models": "Select at least one model",
  "nousflux.error.failed": "Could not connect: {{error}}",
  "nousflux.models.label": "Models",
  "nousflux.models.hint": "Enter your API key, then load the models this account can use.",
  "nousflux.models.load": "Load models",
  "nousflux.models.reload": "Reload",
  "nousflux.models.loading": "Loading models…",
  "nousflux.models.empty": "No models were returned for this account.",
  "nousflux.models.failed": "Could not load models: {{error}}",
  "nousflux.models.selected": "{{count}} selected",
  "nousflux.models.all": "Select all",
  "nousflux.models.none": "Clear",
  "about.company": "CodeFlux is developed by NousFlux",
  "about.copyright": "Copyright © 2026 Hongkong CONTESSA INTELLIGENCE TECH LIMITED. All rights reserved.",
  "about.website": "www.nousflux.com",
  "about.openSource.title": "Open source",
  "about.openSource.body":
    "CodeFlux is based on OpenCode, an open source project released under the MIT License. Copyright (c) 2025 opencode. OpenCode is a trademark of its owner and is not affiliated with CodeFlux.",
  "about.openSource.link": "OpenCode on GitHub",
}

export type TextKey = keyof typeof en

const zh: Record<TextKey, string> = {
  "picker.nousflux.tagline": "连接你的 NousFlux 账户",
  "nousflux.title": "NousFlux",
  "nousflux.image.alt": "NousFlux",
  "nousflux.url.label": "NousFlux URL",
  "nousflux.description": "输入你的 NousFlux API 密钥以连接账户",
  "nousflux.key.label": "NousFlux API 密钥",
  "nousflux.key.placeholder": "API 密钥",
  "nousflux.submit": "继续",
  "nousflux.error.url": "请输入有效的 http 或 https 网址",
  "nousflux.error.key": "请输入 API 密钥",
  "nousflux.error.models": "请至少选择一个模型",
  "nousflux.error.failed": "连接失败：{{error}}",
  "nousflux.models.label": "模型",
  "nousflux.models.hint": "输入 API 密钥后，加载此账户可用的模型。",
  "nousflux.models.load": "加载模型",
  "nousflux.models.reload": "重新加载",
  "nousflux.models.loading": "正在加载模型…",
  "nousflux.models.empty": "此账户没有返回任何模型。",
  "nousflux.models.failed": "无法加载模型：{{error}}",
  "nousflux.models.selected": "已选 {{count}} 个",
  "nousflux.models.all": "全选",
  "nousflux.models.none": "清空",
  "about.company": "CodeFlux 由 NousFlux 开发",
  "about.copyright": "版权所有 © 2026 Hongkong CONTESSA INTELLIGENCE TECH LIMITED。保留所有权利。",
  "about.website": "www.nousflux.com",
  "about.openSource.title": "开源信息",
  "about.openSource.body":
    "CodeFlux 基于开源项目 OpenCode 开发，OpenCode 以 MIT 许可证发布。Copyright (c) 2025 opencode。OpenCode 是其所有者的商标，与 CodeFlux 无关联。",
  "about.openSource.link": "OpenCode 的 GitHub 主页",
}

const zht: Record<TextKey, string> = {
  "picker.nousflux.tagline": "連接你的 NousFlux 帳戶",
  "nousflux.title": "NousFlux",
  "nousflux.image.alt": "NousFlux",
  "nousflux.url.label": "NousFlux URL",
  "nousflux.description": "輸入你的 NousFlux API 金鑰以連接帳戶",
  "nousflux.key.label": "NousFlux API 金鑰",
  "nousflux.key.placeholder": "API 金鑰",
  "nousflux.submit": "繼續",
  "nousflux.error.url": "請輸入有效的 http 或 https 網址",
  "nousflux.error.key": "請輸入 API 金鑰",
  "nousflux.error.models": "請至少選擇一個模型",
  "nousflux.error.failed": "連線失敗：{{error}}",
  "nousflux.models.label": "模型",
  "nousflux.models.hint": "輸入 API 金鑰後，載入此帳戶可用的模型。",
  "nousflux.models.load": "載入模型",
  "nousflux.models.reload": "重新載入",
  "nousflux.models.loading": "正在載入模型…",
  "nousflux.models.empty": "此帳戶沒有回傳任何模型。",
  "nousflux.models.failed": "無法載入模型：{{error}}",
  "nousflux.models.selected": "已選 {{count}} 個",
  "nousflux.models.all": "全選",
  "nousflux.models.none": "清除",
  "about.company": "CodeFlux 由 NousFlux 開發",
  "about.copyright": "版權所有 © 2026 Hongkong CONTESSA INTELLIGENCE TECH LIMITED。保留所有權利。",
  "about.website": "www.nousflux.com",
  "about.openSource.title": "開源資訊",
  "about.openSource.body":
    "CodeFlux 基於開源專案 OpenCode 開發，OpenCode 以 MIT 授權條款發布。Copyright (c) 2025 opencode。OpenCode 是其所有者的商標，與 CodeFlux 無關聯。",
  "about.openSource.link": "OpenCode 的 GitHub 首頁",
}

const dictionaries: Record<string, Record<TextKey, string>> = { en, zh, zht }

export function text(locale: string, key: TextKey, params?: Record<string, string>) {
  const template = (dictionaries[locale] ?? en)[key]

  return template.replace(/{{\s*(\w+)\s*}}/g, (_, name: string) => params?.[name] ?? "")
}
