import { Show } from "solid-js"
import { text, type TextKey } from "../i18n/text"
import "./my-models.css"

/** What the My Models page knows about the CodeFlux local model (CodeFlux-4B). */
export type LocalModelStatus = {
  readonly runtime: boolean
  readonly model: boolean
  readonly running: boolean
  readonly port?: number
  /** The account allows the local model: signed in, with an active plan. */
  readonly licensed: boolean
}

/**
 * The My Models page: the state of the CodeFlux local model with Start and Stop buttons. Starting needs an account with
 * an active plan, so a signed-out customer gets the sign-in prompt, and a model that is not installed yet points to the
 * CodeFlux Local page that downloads it. Everything it shows arrives through props; the app owns the RPC calls.
 */
export function MyModelsPanel(props: {
  locale: string
  /** Undefined until the first status arrives. */
  status?: LocalModelStatus
  /** The action that is running. */
  busy?: "start" | "stop"
  /** The outcome of the last action, already worded. */
  notice?: string
  onStart: () => void
  onStop: () => void
  onSignIn: () => void
  onInstall: () => void
}) {
  const t = (key: TextKey, params?: Record<string, string>) => text(props.locale, key, params)

  const state = () => {
    if (props.busy === "start") return "starting" as const
    if (props.busy === "stop") return "stopping" as const
    const status = props.status

    if (!status) return "loading" as const
    if (!status.runtime || !status.model) return "notInstalled" as const

    return status.running ? ("running" as const) : ("stopped" as const)
  }

  const licensed = () => props.status?.licensed ?? false
  const idle = () => props.busy === undefined

  return (
    <section data-component="codeflux-my-models" data-state={state()} class="cf-models">
      <div class="cf-models-head">
        <span class="cf-models-name">{t("mymodels.model")}</span>
        <span class="cf-models-badge" data-state={state()}>
          {t(`mymodels.state.${state()}`)}
        </span>
      </div>
      <p class="cf-models-text">{t("local.description")}</p>
      <Show when={props.status?.port}>
        {(port) => (
          <div class="cf-models-row">
            <span class="cf-models-label">
              {t("mymodels.port")}
              {t("account.colon")}
            </span>
            <span class="cf-models-value">{port()}</span>
          </div>
        )}
      </Show>
      <Show when={props.status && !licensed()}>
        <div class="cf-models-hint" role="status">
          <span>{t("error.local.signin")}</span>
          <button type="button" class="cf-models-link" data-action="my-models-sign-in" onClick={() => props.onSignIn()}>
            {t("account.signin.button")}
          </button>
        </div>
      </Show>
      <Show when={licensed() && state() === "notInstalled"}>
        <div class="cf-models-hint" role="status">
          <span>{t("mymodels.hint.notInstalled")}</span>
        </div>
      </Show>
      <div class="cf-models-actions">
        <Show
          when={licensed() && state() === "notInstalled"}
          fallback={
            <button
              type="button"
              class="cf-models-action"
              data-variant="primary"
              data-action="my-models-start"
              disabled={!licensed() || !idle() || state() !== "stopped"}
              onClick={() => props.onStart()}
            >
              {t("mymodels.start")}
            </button>
          }
        >
          <button
            type="button"
            class="cf-models-action"
            data-variant="primary"
            data-action="my-models-install"
            onClick={() => props.onInstall()}
          >
            {t("mymodels.install")}
          </button>
        </Show>
        <button
          type="button"
          class="cf-models-action"
          data-action="my-models-stop"
          disabled={!idle() || state() !== "running"}
          onClick={() => props.onStop()}
        >
          {t("mymodels.stop")}
        </button>
      </div>
      <Show when={props.notice}>
        {(notice) => (
          <div role="status" class="cf-models-notice">
            {notice()}
          </div>
        )}
      </Show>
    </section>
  )
}
