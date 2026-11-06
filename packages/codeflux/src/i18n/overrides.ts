/**
 * Copy that replaces upstream text outright instead of just swapping the name. Keyed by the app's locale codes; a
 * locale without an entry keeps the rebranded text. The English entries apply to every locale.
 */
export const overrides: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  en: {
    "desktop.menu.codefluxSupport": "CodeFlux Support",
    // The first-launch default project is a fixed folder name, so every locale creates the same directory.
    "desktop.onboarding.defaultProject": "myproject",
  },
  zh: {
    "desktop.menu.codefluxSupport": "CodeFlux 支持",
    "desktop.menu.myModels": "我的模型",
    "desktop.menu.myModels.signIn": "登录",
    "desktop.menu.myModels.start": "启动本地模型",
    "desktop.menu.myModels.stop": "停止本地模型",
     "desktop.onboarding.defaultProject": "我的项目",
  },
  zht: {
    "desktop.menu.codefluxSupport": "CodeFlux 支援",
    "desktop.menu.myModels": "我的模型",
    "desktop.menu.myModels.signIn": "登入",
    "desktop.menu.myModels.start": "啟動本機模型",
    "desktop.menu.myModels.stop": "停止本機模型",
    "desktop.onboarding.defaultProject": "我的項目",
  },
}
