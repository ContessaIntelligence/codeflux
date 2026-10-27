import { createUniqueId, onMount, Show } from "solid-js"
import { createStore } from "solid-js/store"
import { Button } from "@opencode/ui/button"
import { Loader } from "@opencode/ui/loader"
import { TextInput } from "@opencode/ui/text-input"
import { BRAND } from "../brand"
import { text, type TextKey } from "../i18n/text"
import screen from "../../assets/derived/screen-720.webp"
import "./nousflux-form.css"

export type NousFluxSubmit = { key: string; baseURL: string; models: string }

/**
 * The NousFlux connection page. It owns layout and validation only; the caller turns the submitted values into the
 * connection request and rejects with an `Error` to show a failure.
 */
export function NousFluxForm(props: {
  locale: string
  /** True while the caller is still finishing the connection, after `onSubmit` resolved. */
  busy?: boolean
  onSubmit: (input: NousFluxSubmit) => Promise<void>
}) {
  const [form, setForm] = createStore<{
    baseURL: string
    key: string
    models: string
    error?: TextKey
    failure?: string
    submitting: boolean
  }>({
    baseURL: BRAND.nousfluxURL,
    key: "",
    models: "",
    submitting: false,
  })
  const errorID = createUniqueId()
  const t = (key: TextKey, params?: Record<string, string>) => text(props.locale, key, params)
  const busy = () => form.submitting || !!props.busy
  let key: HTMLInputElement | undefined

  onMount(() => key?.focus({ preventScroll: true }))

  const invalid = () => {
    const url = URL.parse(form.baseURL.trim())

    if (!url || (url.protocol !== "http:" && url.protocol !== "https:")) return "nousflux.error.url" as const

    if (!form.key.trim()) return "nousflux.error.key" as const

    if (!/[^\s,]/.test(form.models)) return "nousflux.error.models" as const
  }

  const submit = async (event: SubmitEvent) => {
    event.preventDefault()

    if (busy()) return
    const error = invalid()
    setForm({ error, failure: undefined })

    if (error) return
    setForm("submitting", true)
    await props
      .onSubmit({ key: form.key.trim(), baseURL: form.baseURL.trim(), models: form.models.trim() })
      .catch((cause: unknown) =>
        setForm("failure", t("nousflux.error.failed", { error: cause instanceof Error ? cause.message : String(cause) })),
      )
    setForm("submitting", false)
  }

  const message = () => (form.error ? t(form.error) : form.failure)

  return (
    <form data-component="nousflux-form" class="cf-nousflux" onSubmit={submit}>
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
          onInput={(event) => setForm({ baseURL: event.currentTarget.value, error: undefined })}
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
          onInput={(event) => setForm({ key: event.currentTarget.value, error: undefined })}
        />
      </label>
      <label class="cf-nousflux-field">
        {t("nousflux.models.label")}
        <TextInput
          class="!w-full"
          name="models"
          data-input="nousflux-models"
          placeholder={t("nousflux.models.placeholder")}
          value={form.models}
          invalid={form.error === "nousflux.error.models"}
          autocomplete="off"
          spellcheck={false}
          onInput={(event) => setForm({ models: event.currentTarget.value, error: undefined })}
        />
      </label>
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
    </form>
  )
}
