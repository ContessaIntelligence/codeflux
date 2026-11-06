import { createMemo, createSignal, onCleanup, onMount } from "solid-js"
import { Dialog, DialogBody, DialogHeader, DialogTitle } from "@opencode/ui/dialog"
import { useDialog } from "@opencode/ui/context/dialog"
import { BRAND } from "@codeflux/gui/brand"
import { text, type TextKey } from "@codeflux/gui/i18n"
import { MyModelsPanel, type LocalModelStatus } from "@codeflux/gui/providers"
import { LocalRpc } from "@codeflux/provider-codeflux/local"
import { useCommand } from "@/shell/commands/command"
import { useLanguage } from "@/runtime/i18n/language"
import { ServerProvider } from "@/runtime/server/current"
import { ServerConnection, useServers } from "@/runtime/server/registry"
import { useGlobal } from "@/runtime/server/runtime"

/** The command ids the "My Models" menu runs. */
export const codefluxCommands = {
  signIn: "codeflux.signin",
  start: "codeflux.local.start",
  stop: "codeflux.local.stop",
} as const

type ModelsStatus = LocalModelStatus & { readonly starting: boolean; readonly failure?: string }

/** The part of the `codeflux.local` RPC client the My Models page calls. */
type ModelsRpc = {
  status: (input: Record<string, never>) => Promise<ModelsStatus>
  start: (input: Record<string, never>) => Promise<{ readonly state: string }>
  stop: (input: Record<string, never>) => Promise<{ readonly state: string }>
  events: { on: (name: "account", handler: () => void) => () => void }
}

const describe = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause))

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * The My Models page: the state of the CodeFlux local model with Start and Stop. Opened by the My Models menu, which
 * can also ask it to start or stop right away. Loading the model takes a while, so a start answers at once and the page
 * polls the status until the server answers or the start fails.
 */
function MyModelsDialog(props: {
  rpc: ModelsRpc
  action?: "start" | "stop"
  onSignIn: () => void
  onInstall: () => void
}) {
  const language = useLanguage()
  const t = (key: TextKey, params?: Record<string, string>) => text(language.locale(), key, params)
  const [status, setStatus] = createSignal<ModelsStatus>()
  const [busy, setBusy] = createSignal<"start" | "stop">()
  const [notice, setNotice] = createSignal<string>()
  let alive = true

  onCleanup(() => {
    alive = false
  })

  const refresh = () =>
    props.rpc.status({}).then(
      (next) => {
        if (alive) setStatus(next)

        return next
      },
      (cause: unknown) => {
        if (alive) setNotice(t("mymodels.result.error", { error: describe(cause) }))

        return undefined
      },
    )

  // Five minutes at most: a cold disk loads the model slowly, but a start that never answers must not poll forever.
  const settle = async () => {
    for (let attempt = 0; attempt < 300 && alive; attempt++) {
      const next = await refresh()

      if (next && !next.starting) return next
      await pause(1000)
    }
  }

  const start = async () => {
    setBusy("start")
    setNotice(undefined)
    const result = await props.rpc.start({}).then(
      (value) => ({ state: value.state, error: "" }),
      (cause: unknown) => ({ state: "error", error: describe(cause) }),
    )

    if (result.state === "starting") {
      const done = await settle()
      setNotice(
        done?.running ? t("mymodels.result.started") : t("mymodels.result.failed", { error: done?.failure ?? "" }),
      )
    }
    if (result.state === "already-running") setNotice(t("mymodels.result.already"))
    // `unlicensed` and `not-installed` need no notice: the page already says so, with the sign-in or the install.
    if (result.state === "busy") setNotice(t("mymodels.result.busy"))
    if (result.state === "error") setNotice(t("mymodels.result.error", { error: result.error }))
    setBusy(undefined)
    await refresh()
  }

  const stop = async () => {
    setBusy("stop")
    setNotice(undefined)
    const result = await props.rpc.stop({}).then(
      (value) => ({ state: value.state, error: "" }),
      (cause: unknown) => ({ state: "error", error: describe(cause) }),
    )

    if (result.state === "stopped") setNotice(t("mymodels.result.stopped"))
    if (result.state === "not-running") setNotice(t("mymodels.result.notRunning"))
    if (result.state === "error") setNotice(t("mymodels.result.error", { error: result.error }))
    setBusy(undefined)
    await refresh()
  }

  onMount(() => {
    onCleanup(props.rpc.events.on("account", () => void refresh()))
    void refresh().then(() => {
      if (props.action === "start") return start()
      if (props.action === "stop") return stop()
    })
  })

  return (
    <Dialog
      fit
      containerClass="!h-auto max-h-[calc(100vh_-_16px)] !w-[min(calc(100vw_-_16px),480px)]"
      class="[font-family:var(--v2-font-family-sans)] [&_[data-slot=dialog-header]]:!px-5 [&_[data-slot=dialog-header-title]]:!text-[15px] [&_[data-slot=dialog-header-title]]:!tracking-[-0.13px]"
    >
      <DialogHeader closeLabel={language.t("common.close")}>
        <DialogTitle>{t("mymodels.title")}</DialogTitle>
      </DialogHeader>
      <DialogBody class="max-h-[calc(100vh_-_68px)] min-h-0 flex-none gap-0 overflow-y-auto px-2 pb-2">
        <MyModelsPanel
          locale={language.locale()}
          status={status()}
          busy={busy()}
          notice={notice()}
          onStart={() => void start()}
          onStop={() => void stop()}
          onSignIn={props.onSignIn}
          onInstall={props.onInstall}
        />
      </DialogBody>
    </Dialog>
  )
}

/**
 * The commands behind the "My Models" menu: sign in, start the local model, stop the local model. They are registered
 * for the whole app, so the menu works on every screen. The local model runs on this computer, so they act on the
 * server of this computer; with only a remote server there is nothing to start or stop and they are not registered.
 */
export function CodeFluxCommands() {
  const command = useCommand()
  const dialog = useDialog()
  const language = useLanguage()
  const global = useGlobal()
  const servers = useServers()
  const connection = createMemo(() => servers.list.find((item) => ServerConnection.local(item)))
  const t = (key: TextKey) => text(language.locale(), key)

  // The provider list is the CodeFlux Provider page: it holds the account card with sign in, and "CodeFlux Local".
  // `localModel` goes straight to the local model form that installs the model.
  const openProviders = async (localModel?: boolean) => {
    const conn = connection()

    if (!conn) return
    const { DialogConnectProvider, useProviderConnectController } = await import("./connect/dialog")
    // Outside a route there is no server or directory in scope, so the dialog brings its own server.
    void dialog.show(() => {
      const controller = useProviderConnectController()
      if (localModel) controller.select(BRAND.localID)

      return (
        <ServerProvider conn={conn}>
          <DialogConnectProvider controller={controller} defaultLocation />
        </ServerProvider>
      )
    })
  }

  const openModels = (action?: "start" | "stop") => {
    const conn = connection()

    if (!conn) return
    const rpc = global.ensureServerCtx(conn).sdk.api.rpc(LocalRpc)
    void dialog.show(() => (
      <MyModelsDialog
        rpc={rpc}
        action={action}
        onSignIn={() => void openProviders()}
        onInstall={() => void openProviders(true)}
      />
    ))
  }

  command.register("codeflux", () => {
    if (!connection()) return []
    const category = t("mymodels.title")

    return [
      { id: codefluxCommands.signIn, title: t("account.signin.button"), category, onSelect: () => void openProviders() },
      { id: codefluxCommands.start, title: t("mymodels.start"), category, onSelect: () => openModels("start") },
      { id: codefluxCommands.stop, title: t("mymodels.stop"), category, onSelect: () => openModels("stop") },
    ]
  })

  return null
}
