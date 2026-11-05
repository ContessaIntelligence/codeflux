import { For, onMount } from "solid-js"
import { ProviderIcon } from "@opencode/ui/provider-icon"
import { BRAND } from "../brand"
import { text } from "../i18n/text"
import { CodeFluxLogo } from "../logo/codeflux-logo"
import "./picker.css"

const tiles = [
  { id: "openai", name: "OpenAI" },
  { id: "anthropic", name: "Anthropic" },
  { id: "google", name: "Google" },
] as const

/**
 * The provider list: the CodeFlux local-model banner (the default, with the CodeFlux logo) above OpenAI, Anthropic
 * and Google tiles; the CodeFlux cloud provider tile is hidden for now. The picker replaces the searchable catalog,
 * so a click only reports the integration ID and the caller starts the connection.
 */
export function CodeFluxProviderPicker(props: { locale: string; onSelect: (id: string) => void; onPrepare?: () => void }) {
  let local: HTMLButtonElement | undefined

  onMount(() => local?.focus({ preventScroll: true }))

  const choose = (id: string) => {
    props.onPrepare?.()
    props.onSelect(id)
  }

  return (
    <div data-component="codeflux-provider-picker" class="cf-picker">
      <button
        ref={local}
        type="button"
        data-provider-id={BRAND.localID}
        class="cf-picker-banner"
        onClick={() => choose(BRAND.localID)}
      >
        <CodeFluxLogo class="cf-picker-banner-logo" />
        <span class="cf-picker-banner-text">
          <span class="cf-picker-banner-name">{text(props.locale, "picker.local.name")}</span>
          <span class="cf-picker-banner-tagline">{text(props.locale, "picker.local.tagline")}</span>
        </span>
      </button>
      {/* The CodeFlux cloud provider tile stays hidden for now. */}
      <div class="cf-picker-row">
        <For each={tiles}>
          {(tile) => (
            <button type="button" data-provider-id={tile.id} class="cf-picker-tile" onClick={() => choose(tile.id)}>
              <ProviderIcon id={tile.id} width={20} height={20} />
              <span>{tile.name}</span>
            </button>
          )}
        </For>
      </div>
    </div>
  )
}
