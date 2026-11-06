import { createMemo, onCleanup, onMount } from "solid-js"
import { createStore } from "solid-js/store"
import { Dialog, DialogBody, DialogHeader, DialogTitle } from "@opencode/ui/dialog"
import { useDialog } from "@opencode/ui/context/dialog"
import { BRAND } from "@codeflux/gui/brand"
import { text, type TextKey } from "@codeflux/gui/i18n"
import { MyModelsPanel, type LocalModelAction, type LocalModelStatus } from "@codeflux/gui/providers"
import { LocalRpc } from "@codeflux/provider-codeflux/local"
import { useCommand } from "@/shell/commands/command"
import { formatServerError } from "@/runtime/server/errors"
import { useLanguage } from "@/runtime/i18n/language"
import { usePlatform } from "@/runtime/platform/platform"
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
type CallOptions = { readonly signal?: AbortSignal }

type ModelsRpc = {
  status: (input: Record<string, never>, options?: CallOptions) => Promise<ModelsStatus>
  start: (input: { force?: boolean }, options?: CallOptions) => Promise<{ readonly state: string }>
  stop: (input: { force?: boolean }, options?: CallOptions) => Promise<{ readonly state: string }>
  events: { on: (name: "account", handler: () => void) => () => void }
}

// Reading the status is quick, so a service that stays silent this long is treated as not responding.
const STATUS_TIMEOUT_MS = 8_000

// A forced stop lists the processes and waits for a start to let go, which takes longer than a plain call.
const ACTION_TIMEOUT_MS = 30_000

class TimeoutError extends Error {}

// Runs a call with a time limit. The signal cancels the request itself, so a service that stays silent does not keep a
// connection busy: the browser allows only a few at once, and the rest of the app needs them.
const within = <T,>(call: (options: CallOptions) => Promise<T>, ms: number) => {
  const signal = AbortSignal.timeout(ms)

  return call({ signal }).catch((cause: unknown) => {
    throw signal.aborted ? new TimeoutError("timeout") : cause
  })
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * The My Models page: the state of the CodeFlux local model with Start, Stop, Force stop and Force restart. Opened by
 * the My Models menu, which can also ask it to start or stop right away. Loading the model takes a while, so a start
 * answers at once and the page polls the status until the server answers or the start fails. Every call has a time
 * limit, so a service that does not answer shows as not responding instead of leaving the page waiting.
 */
function MyModelsDialog(props: {
  rpc: ModelsRpc
  action?: "start" | "stop"
  onSignIn: () => void
  onInstall: () => void
  onRestartApp: () => void
}) {
  const language = useLanguage()
  const t = (key: TextKey, params?: Record<string, string>) => text(language.locale(), key, params)

  const [state, setState] = createStore<{
    status?: ModelsStatus
    unavailable: boolean
    busy?: LocalModelAction
    notice?: string
  }>({ unavailable: false })

  let alive = true

  onCleanup(() => {
    alive = false
  })

  const failure = (cause: unknown) =>
    cause instanceof TimeoutError ? t("mymodels.result.timeout") : t("mymodels.result.error", { error: formatServerError(cause, language.t) })

  const refresh = () =>
    within((options) => props.rpc.status({}, options), STATUS_TIMEOUT_MS).then(
      (next) => {
        if (alive) setState({ status: next, unavailable: false })

        return next
      },
      (cause: unknown) => {
        if (alive) setState({ unavailable: true, notice: failure(cause) })

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

  // Start, or with `force` a forced restart: the service ends every local model server first.
  const begin = async (force: boolean) => {
    setState({ busy: force ? "force-restart" : "start", notice: undefined })

    const result = await within((options) => props.rpc.start({ force }, options), ACTION_TIMEOUT_MS).then(
      (value) => ({ state: value.state, error: "", timedOut: false }),
      (cause: unknown) => ({ state: "error", error: failure(cause), timedOut: cause instanceof TimeoutError }),
    )

    if (result.state === "starting") {
      const done = await settle()
      setState(
        "notice",
        done?.running ? t("mymodels.result.started") : t("mymodels.result.failed", { error: done?.failure ?? "" }),
      )
    }

    if (result.state === "already-running") setState("notice", t("mymodels.result.already"))

    // `unlicensed` and `not-installed` need no notice: the page already says so, with the sign-in or the install.
    if (result.state === "busy") setState("notice", t("mymodels.result.busy"))

    if (result.state === "error") setState({ notice: result.error, unavailable: result.timedOut })
    setState("busy", undefined)
    await refresh()
  }

  // Stop, or with `force` a forced stop: the service ends every local model server, even one it did not start.
  const halt = async (force: boolean) => {
    setState({ busy: force ? "force-stop" : "stop", notice: undefined })

    const result = await within((options) => props.rpc.stop({ force }, options), ACTION_TIMEOUT_MS).then(
      (value) => ({ state: value.state, error: "", timedOut: false }),
      (cause: unknown) => ({ state: "error", error: failure(cause), timedOut: cause instanceof TimeoutError }),
    )

    if (result.state === "stopped")
      setState("notice", t(force ? "mymodels.result.forceStopped" : "mymodels.result.stopped"))

    if (result.state === "not-running") setState("notice", t("mymodels.result.notRunning"))

    if (result.state === "error") setState({ notice: result.error, unavailable: result.timedOut })
    setState("busy", undefined)
    await refresh()
  }

  onMount(() => {
    onCleanup(props.rpc.events.on("account", () => void refresh()))
    void refresh().then(() => {
      if (props.action === "start") return begin(false)

      if (props.action === "stop") return halt(false)
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
          status={state.status}
          unavailable={state.unavailable}
          busy={state.busy}
          notice={state.notice}
          onStart={() => void begin(false)}
          onStop={() => void halt(false)}
          onForceStop={() => void halt(true)}
          onForceRestart={() => void begin(true)}
          onSignIn={props.onSignIn}
          onInstall={props.onInstall}
          onRestartApp={props.onRestartApp}
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
  const platform = usePlatform()
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
        onRestartApp={() => void platform.restart()}
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
