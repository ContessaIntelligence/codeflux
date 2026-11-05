import { createUniqueId, onCleanup, onMount, Show } from "solid-js"
import { createStore } from "solid-js/store"
import { Button } from "@opencode/ui/button"
import { Loader } from "@opencode/ui/loader"
import { text, type TextKey } from "../i18n/text"
import "./nousflux-form.css"

type Stage = "checking" | "confirm" | "downloading" | "starting" | "connecting" | "error"

export type LocalProgress = {
  stage: "checking" | "downloading" | "starting" | "ready" | "error"
  step: number
  total: number
  received?: number
  size?: number
  speed?: number
  port?: number
  baseURL?: string
  failure?: string
}

/** The renderer-side shape of the `codeflux.local` RPC client; the app builds it with `sdk.api.rpc(LocalRpc)`. */
export type LocalRpcClient = {
  probe: (input: Record<string, never>) => Promise<{ runtime: boolean; model: boolean; sizeBytes: number }>
  setup: (input: Record<string, never>) => Promise<{ state: "started" | "joined" | "unlicensed" }>
  cancel: (input: Record<string, never>) => Promise<{ cancelled: boolean }>
  events: {
    on: (name: "progress", handler: (event: { data: LocalProgress }) => void) => () => void
  }
}

export type LocalSubmit = { key: string; baseURL: string; models: string }

const describe = (cause: unknown) => {
  if (cause instanceof Error) return cause.message
  if (cause && typeof cause === "object" && "message" in cause) {
    const data = (cause as { data?: { message?: string } }).data?.message

    return [String((cause as { message: unknown }).message), data].filter(Boolean).join(": ")
  }

  return String(cause)
}

const megabytes = (bytes: number) => (bytes / 1_048_576).toFixed(bytes >= 1_073_741_824 ? 0 : 1)
const gigabytes = (bytes: number) => (bytes / 1_073_741_824).toFixed(1)

/**
 * The Local model page. It probes what is on disk, asks before downloading Qwen3-4B, then runs the server-side setup
 * (download with resume, start the bundled llama-server) and connects with the returned endpoint. Progress events
 * drive a download bar. `onSubmit` rejects to show a failure.
 */
export function LocalModelForm(props: {
  locale: string
  rpc: LocalRpcClient
  model: string
  busy?: boolean
  onCancel: () => void
  onSubmit: (input: LocalSubmit) => Promise<void>
}) {
  const [form, setForm] = createStore<{
    stage: Stage
    step?: number
    total?: number
    received: number
    size: number
    speed: number
    expected: number
    failure?: string
    running: boolean
  }>({ stage: "checking", received: 0, size: 0, speed: 0, expected: 0, running: false })
  const errorID = createUniqueId()
  const t = (key: TextKey, params?: Record<string, string>) => text(props.locale, key, params)
  const busy = () => form.running || !!props.busy

  const start = async () => {
    setForm({ stage: "starting", running: true, failure: undefined, received: 0, size: 0, speed: 0 })
    try {
      const result = await props.rpc.setup({})
      if (result.state === "unlicensed") {
        setForm({ stage: "error", running: false, failure: t("local.error.unlicensed") })
      }
    } catch (cause) {
      setForm({ stage: "error", running: false, failure: t("local.error.failed", { error: describe(cause) }) })
    }
  }

  const check = async () => {
    if (busy()) return
    setForm({ stage: "checking", running: true, failure: undefined })
    try {
      const probe = await props.rpc.probe({})
      if (!probe.runtime) {
        setForm({ stage: "error", running: false, failure: t("local.error.runtime") })
        return
      }
      setForm({ expected: probe.sizeBytes })
      // Nothing to download: start the server straight away. Otherwise ask first.
      if (probe.model) return await start()
      setForm({ stage: "confirm", running: false })
    } catch (cause) {
      setForm({ stage: "error", running: false, failure: t("local.error.failed", { error: describe(cause) }) })
    }
  }

  const cancelDownload = async () => {
    await props.rpc.cancel({}).catch(() => undefined)
  }

  onMount(() => {
    const off = props.rpc.events.on("progress", (event) => {
      const data = event.data
      if (data.stage === "ready") {
        setForm({ stage: "connecting", step: data.step, total: data.total })
        void props
          .onSubmit({ key: "local", baseURL: data.baseURL ?? "", models: props.model })
          .catch((error) => setForm({ stage: "error", running: false, failure: describe(error) }))
        return
      }
      if (data.stage === "error") {
        const cancelled = data.failure === "cancelled"
        setForm({
          stage: cancelled ? "confirm" : "error",
          running: false,
          failure: cancelled ? undefined : (data.failure ?? t("local.error.failed", { error: "" })),
        })
        return
      }
      setForm({
        stage: data.stage,
        step: data.step,
        total: data.total,
        ...(data.received === undefined ? {} : { received: data.received, size: data.size ?? 0, speed: data.speed ?? 0 }),
      })
    })
    onCleanup(off)
    void check()
  })

  const stageKey = () => {
    if (form.stage === "connecting") return "local.stage.connecting" as const
    if (form.stage === "checking" || form.stage === "downloading" || form.stage === "starting")
      return `local.stage.${form.stage}` as const

    return undefined
  }

  const total = () => (form.size > 0 ? form.size : form.expected)
  const percent = () => (total() > 0 ? Math.min(100, Math.round((form.received / total()) * 100)) : 0)

  return (
    <div data-component="local-model-form" class="cf-nousflux">
      {/* Only this area scrolls, so the status below it always stays on screen. */}
      <div class="cf-nousflux-scroll">
        <p class="cf-nousflux-description">
          {form.stage === "confirm"
            ? t("local.confirm.body", { size: gigabytes(form.expected) })
            : t("local.description")}
        </p>
        <Show when={stageKey()}>
          <div class="cf-local-progress">
            <div class="cf-local-step">
              {t("local.step", { step: String(form.step ?? 1), total: String(form.total ?? 4) })}
              <span> · </span>
              {t(stageKey()!)}
            </div>
            <Show when={form.stage === "downloading"}>
              <progress class="cf-local-bar" max={100} value={percent()} />
              <div class="cf-local-output">
                {t("local.download.progress", {
                  received: megabytes(form.received),
                  size: megabytes(total()),
                  percent: String(percent()),
                  speed: (form.speed / 1_048_576).toFixed(1),
                })}
              </div>
            </Show>
          </div>
        </Show>
      </div>
      <div class="cf-nousflux-footer">
        <Show when={form.stage === "error" && form.failure}>
          {(error) => (
            <div id={errorID} role="alert" class="cf-nousflux-error">
              {error()}
            </div>
          )}
        </Show>
        <Show
          when={form.stage === "confirm"}
          fallback={
            <Show
              when={stageKey()}
              keyed
              fallback={
                <Button type="button" variant="neutral" data-action="local-retry" onClick={() => void check()}>
                  {t("local.retry")}
                </Button>
              }
            >
              {(key) => (
                <>
                  <Show when={form.stage === "downloading"}>
                    <Button
                      type="button"
                      variant="neutral"
                      data-action="local-cancel-download"
                      onClick={() => void cancelDownload()}
                    >
                      {t("local.confirm.cancel")}
                    </Button>
                  </Show>
                  <Button type="button" variant="contrast" disabled data-action="local-status">
                    <Loader class="size-4" />
                    {t(key)}
                  </Button>
                </>
              )}
            </Show>
          }
        >
          <Button type="button" variant="neutral" data-action="local-cancel" onClick={() => props.onCancel()}>
            {t("local.confirm.cancel")}
          </Button>
          <Button type="button" variant="contrast" data-action="local-download" onClick={() => void start()}>
            {t("local.confirm.download")}
          </Button>
        </Show>
      </div>
    </div>
  )
}
