import { createUniqueId, For, onMount, Show } from "solid-js"
import { createStore } from "solid-js/store"
import { Button } from "@opencode/ui/button"
import { Checkbox } from "@opencode/ui/checkbox"
import { Loader } from "@opencode/ui/loader"
import { TextInput } from "@opencode/ui/text-input"
import { BRAND } from "../brand"
import { text, type TextKey } from "../i18n/text"
import screen from "../../assets/derived/screen-720.webp"
import { fetchModels } from "./models"
import "./nousflux-form.css"

export type NousFluxSubmit = { key: string; baseURL: string; models: string }

/**
 * The NousFlux connection page. It owns layout and validation only; the caller turns the submitted values into the
 * connection request and rejects with an `Error` to show a failure. The model list is read from the server with the
 * entered key, and the user picks which of those models to add.
 */
export function NousFluxForm(props: {
  locale: string
  /** Reaches the NousFlux server; the desktop app passes its own fetch. */
  fetch?: typeof fetch
  /** True while the caller is still finishing the connection, after `onSubmit` resolved. */
  busy?: boolean
  onSubmit: (input: NousFluxSubmit) => Promise<void>
}) {
  const [form, setForm] = createStore<{
    baseURL: string
    key: string
    available: string[]
    selected: string[]
    loading: boolean
    loaded: boolean
    modelsError?: string
    error?: TextKey
    failure?: string
    submitting: boolean
  }>({
    baseURL: BRAND.nousfluxURL,
    key: "",
    available: [],
    selected: [],
    loading: false,
    loaded: false,
    submitting: false,
  })
  const errorID = createUniqueId()
  const t = (key: TextKey, params?: Record<string, string>) => text(props.locale, key, params)
  const busy = () => form.submitting || !!props.busy
  let key: HTMLInputElement | undefined

  onMount(() => key?.focus({ preventScroll: true }))

  const urlInvalid = () => {
    const url = URL.parse(form.baseURL.trim())

    return !url || (url.protocol !== "http:" && url.protocol !== "https:")
  }

  const invalid = () => {
    if (urlInvalid()) return "nousflux.error.url" as const

    if (!form.key.trim()) return "nousflux.error.key" as const

    if (form.selected.length === 0) return "nousflux.error.models" as const
  }

  // A different URL or key describes a different account, so the models read earlier no longer apply.
  const forget = () => setForm({ available: [], selected: [], loaded: false, modelsError: undefined })

  const load = async () => {
    if (form.loading || busy()) return
    const error = urlInvalid() ? ("nousflux.error.url" as const) : !form.key.trim() ? ("nousflux.error.key" as const) : undefined
    setForm({ error, failure: undefined, modelsError: undefined })

    if (error) return
    setForm("loading", true)
    const models = await fetchModels(props.fetch ?? fetch, form.baseURL, form.key.trim()).catch((cause: unknown) => {
      setForm("modelsError", t("nousflux.models.failed", { error: cause instanceof Error ? cause.message : String(cause) }))
    })
    setForm("loading", false)

    if (!models) return
    // Keep what the user had already ticked if the same models come back.
    setForm({ available: models, selected: form.selected.filter((id) => models.includes(id)), loaded: true })
  }

  const toggle = (id: string, checked: boolean) =>
    setForm("selected", (selected) => (checked ? [...selected, id] : selected.filter((item) => item !== id)))

  const submit = async (event: SubmitEvent) => {
    event.preventDefault()

    if (busy()) return
    const error = invalid()
    setForm({ error, failure: undefined })

    if (error) return
    setForm("submitting", true)
    await props
      .onSubmit({ key: form.key.trim(), baseURL: form.baseURL.trim(), models: form.selected.join(",") })
      .catch((cause: unknown) =>
        setForm("failure", t("nousflux.error.failed", { error: cause instanceof Error ? cause.message : String(cause) })),
      )
    setForm("submitting", false)
  }

  const message = () => (form.error ? t(form.error) : form.failure)

  return (
    <form data-component="nousflux-form" class="cf-nousflux" onSubmit={submit}>
      {/* Only this area scrolls, so the Continue button below it always stays on screen. */}
      <div class="cf-nousflux-scroll">
      <img class="cf-nousflux-image" src={screen} alt={t("nousflux.image.alt")} draggable={false} />
      <label class="cf-nousflux-field">
        {t("nousflux.url.label")}
        <TextInput
          class="!w-full"
          name="baseURL"
          data-input="nousflux-url"
          value={form.baseURL}
          autocomplete="off"
          spellcheck={false}
          onInput={(event) => {
            setForm({ baseURL: event.currentTarget.value, error: undefined })
            forget()
          }}
        />
      </label>
      <p class="cf-nousflux-description">{t("nousflux.description")}</p>
      <label class="cf-nousflux-field">
        {t("nousflux.key.label")}
        <TextInput
          ref={key}
          class="!w-full"
          type="password"
          name="apiKey"
          data-input="nousflux-api-key"
          placeholder={t("nousflux.key.placeholder")}
          value={form.key}
          invalid={form.error === "nousflux.error.key"}
          aria-describedby={message() ? errorID : undefined}
          autocomplete="off"
          spellcheck={false}
          onInput={(event) => {
            setForm({ key: event.currentTarget.value, error: undefined })
            forget()
          }}
        />
      </label>

      <div class="cf-nousflux-field" data-slot="nousflux-models">
        <div class="cf-nousflux-models-head">
          <span>{t("nousflux.models.label")}</span>
          <Button type="button" variant="neutral" disabled={form.loading || busy()} onClick={() => void load()}>
            {form.loading ? <Loader class="size-4" /> : t(form.loaded ? "nousflux.models.reload" : "nousflux.models.load")}
          </Button>
        </div>
        <Show
          when={form.loaded}
          fallback={
            <p class="cf-nousflux-hint">
              {form.loading ? t("nousflux.models.loading") : (form.modelsError ?? t("nousflux.models.hint"))}
            </p>
          }
        >
          <Show when={form.available.length > 0} fallback={<p class="cf-nousflux-hint">{t("nousflux.models.empty")}</p>}>
            <div class="cf-nousflux-models-tools">
              <span>{t("nousflux.models.selected", { count: String(form.selected.length) })}</span>
              <button type="button" class="cf-nousflux-link" onClick={() => setForm("selected", [...form.available])}>
                {t("nousflux.models.all")}
              </button>
              <button type="button" class="cf-nousflux-link" onClick={() => setForm("selected", [])}>
                {t("nousflux.models.none")}
              </button>
            </div>
            <div class="cf-nousflux-models" role="group" aria-label={t("nousflux.models.label")}>
              <For each={form.available}>
                {(id) => (
                  <Checkbox checked={form.selected.includes(id)} onChange={(checked: boolean) => toggle(id, checked)}>
                    <span class="cf-nousflux-model">{id}</span>
                  </Checkbox>
                )}
              </For>
            </div>
          </Show>
        </Show>
      </div>
      </div>

      <div class="cf-nousflux-footer">
        <Show when={message()}>
          {(error) => (
            <div id={errorID} role="alert" class="cf-nousflux-error">
              {error()}
            </div>
          )}
        </Show>
        <Button type="submit" variant="contrast" disabled={busy()} data-action="nousflux-connect-submit">
          {busy() ? <Loader class="size-4" /> : t("nousflux.submit")}
        </Button>
      </div>
    </form>
  )
}
