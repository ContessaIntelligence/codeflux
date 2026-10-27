/** Copy for the components in this package, keyed like the app dictionaries. Locales without an entry read English. */
const en = {
  "picker.nousflux.tagline": "Connect your NousFlux account",
  "nousflux.title": "NousFlux",
  "nousflux.image.alt": "NousFlux",
  "nousflux.url.label": "NousFlux URL",
  "nousflux.description": "Enter your NousFlux API key to connect your account",
  "nousflux.key.label": "NousFlux API key",
  "nousflux.key.placeholder": "API key",
  "nousflux.models.label": "Models",
  "nousflux.models.placeholder": "Model IDs, separated by commas",
  "nousflux.submit": "Continue",
  "nousflux.error.url": "Enter a valid http or https URL",
  "nousflux.error.key": "API key is required",
  "nousflux.error.models": "Add at least one model",
  "nousflux.error.failed": "Could not connect: {{error}}",
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
  "nousflux.models.label": "模型",
  "nousflux.models.placeholder": "模型 ID，多个用逗号分隔",
  "nousflux.submit": "继续",
  "nousflux.error.url": "请输入有效的 http 或 https 网址",
  "nousflux.error.key": "请输入 API 密钥",
  "nousflux.error.models": "请至少添加一个模型",
  "nousflux.error.failed": "连接失败：{{error}}",
}

const zht: Record<TextKey, string> = {
  "picker.nousflux.tagline": "連接你的 NousFlux 帳戶",
  "nousflux.title": "NousFlux",
  "nousflux.image.alt": "NousFlux",
  "nousflux.url.label": "NousFlux URL",
  "nousflux.description": "輸入你的 NousFlux API 金鑰以連接帳戶",
  "nousflux.key.label": "NousFlux API 金鑰",
  "nousflux.key.placeholder": "API 金鑰",
  "nousflux.models.label": "模型",
  "nousflux.models.placeholder": "模型 ID，多個以逗號分隔",
  "nousflux.submit": "繼續",
  "nousflux.error.url": "請輸入有效的 http 或 https 網址",
  "nousflux.error.key": "請輸入 API 金鑰",
  "nousflux.error.models": "請至少新增一個模型",
  "nousflux.error.failed": "連線失敗：{{error}}",
}

const dictionaries: Record<string, Record<TextKey, string>> = { en, zh, zht }

export function text(locale: string, key: TextKey, params?: Record<string, string>) {
  const template = (dictionaries[locale] ?? en)[key]

  return template.replace(/{{\s*(\w+)\s*}}/g, (_, name: string) => params?.[name] ?? "")
}
