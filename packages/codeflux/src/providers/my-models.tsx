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

/** The action that is running: Start, Stop, or one of the forced ones. */
export type LocalModelAction = "start" | "stop" | "force-stop" | "force-restart"

/**
 * The My Models page: the state of the CodeFlux local model with Start and Stop buttons. The Force stop and Force
 * restart actions are hidden from the UI; their props and handlers stay so they can come back. Starting needs an
 * account with an active plan, so a signed-out customer gets the sign-in prompt, and a model that is not installed
 * yet points to the CodeFlux Local page that downloads it. Everything it shows arrives through props; the app owns
 * the RPC calls.
 */
export function MyModelsPanel(props: {
  locale: string
  /** Undefined until the first status arrives. */
  status?: LocalModelStatus
  /** The status could not be read: the service did not answer, or it is too old to know the question. */
  unavailable?: boolean
  /** The action that is running. */
  busy?: LocalModelAction
  /** The outcome of the last action, already worded. */
  notice?: string
  onStart: () => void
  onStop: () => void
  onForceStop: () => void
  onForceRestart: () => void
  onSignIn: () => void
  onInstall: () => void
  /** Restarts the whole app, the last resort when the service does not answer at all. */
  onRestartApp?: () => void
}) {
  const t = (key: TextKey, params?: Record<string, string>) => text(props.locale, key, params)

  const state = () => {
    if (props.busy === "start" || props.busy === "force-restart") return "starting" as const
    if (props.busy === "stop" || props.busy === "force-stop") return "stopping" as const
    if (props.unavailable) return "unavailable" as const

    const status = props.status

    if (!status) return "loading" as const
    if (!status.runtime || !status.model) return "notInstalled" as const

    return status.running ? ("running" as const) : ("stopped" as const)
  }

  const licensed = () => props.status?.licensed ?? false
  const idle = () => props.busy === undefined
  // When the state is unknown the buttons stay usable: the call itself finds out, and a forced one does not need it.
  const unknown = () => state() === "unavailable" || state() === "loading"

  return (
    <section data-component="codeflux-my-models" data-state={state()} class="cf-models">
      <div class="cf-models-head">
        <span class="cf-models-name">{t("mymodels.model")}</span>
        <span class="cf-models-badge" data-state={state()}>
          {t(`mymodels.state.${state()}`)}
        </span>
      </div>
      <p class="cf-models-text">{t("local.description")}</p>
      <Show when={props.status?.port && !props.unavailable}>
        <div class="cf-models-row">
          <span class="cf-models-label">
            {t("mymodels.port")}
            {t("account.colon")}
          </span>
          <span class="cf-models-value">{props.status?.port}</span>
        </div>
      </Show>
      <Show when={props.status && !licensed() && !props.unavailable}>
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
      <Show when={state() === "unavailable"}>
        <div class="cf-models-hint" role="status">
          <span>{t("mymodels.hint.unavailable")}</span>
          <Show when={props.onRestartApp}>
            {(restart) => (
              <button type="button" class="cf-models-link" data-action="my-models-restart-app" onClick={() => restart()()}>
                {t("mymodels.restartApp")}
              </button>
            )}
          </Show>
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
              disabled={!idle() || (!unknown() && (!licensed() || state() !== "stopped"))}
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
          disabled={!idle() || (!unknown() && state() !== "running")}
          onClick={() => props.onStop()}
        >
          {t("mymodels.stop")}
        </button>
      </div>
      {/* The Force stop and Force restart buttons are hidden from the UI for now. */}
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
