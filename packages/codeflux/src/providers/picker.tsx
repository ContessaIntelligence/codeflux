import { For, Show, onMount } from "solid-js"
import type { TextKey } from "../i18n/text"
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

/** The customer account as the picker shows it. `licensed` is the only thing that unlocks the local model. */
export type CodeFluxAccount = {
  signedIn: boolean
  pending: boolean
  licensed: boolean
  expired: boolean
  user?: { id: number; email: string; displayName: string }
  tierName?: string
  expiresAt?: number
  failure?: string
}

const signedOut: CodeFluxAccount = { signedIn: false, pending: false, licensed: false, expired: false }

/**
 * The provider list: the account panel and the CodeFlux local-model banner (the default, with the CodeFlux logo) above
 * OpenAI, Anthropic and Google tiles; the CodeFlux cloud provider tile is hidden for now. The picker replaces the
 * searchable catalog, so a click only reports the integration ID and the caller starts the connection. The local banner
 * is disabled until the account is licensed.
 */
export function CodeFluxProviderPicker(props: {
  locale: string
  onSelect: (id: string) => void
  onPrepare?: () => void
  account?: CodeFluxAccount
  onSignIn?: () => void
  onSignOut?: () => void
  onOpenSite?: () => void
}) {
  let local: HTMLButtonElement | undefined

  // Until the account state arrives (or when it cannot be read) the customer is treated as signed out, so the sign-in
  // prompt is always on screen.
  const account = () => props.account ?? signedOut

  onMount(() => local?.focus({ preventScroll: true }))

  const choose = (id: string) => {
    props.onPrepare?.()
    props.onSelect(id)
  }

  const tagline = () => {
    const account = props.account
    if (account?.licensed) return text(props.locale, "picker.local.tagline")
    if (!account?.signedIn) return text(props.locale, "picker.local.locked.signin")
    if (account.expired) return text(props.locale, "picker.local.locked.expired")

    return text(props.locale, "picker.local.locked.plan")
  }

  return (
    <div data-component="codeflux-provider-picker" class="cf-picker">
      <AccountPanel
        locale={props.locale}
        account={account()}
        onSignIn={props.onSignIn}
        onSignOut={props.onSignOut}
        onOpenSite={props.onOpenSite}
      />
      <button
        ref={local}
        type="button"
        data-provider-id={BRAND.localID}
        data-locked={props.account?.licensed ? undefined : ""}
        class="cf-picker-banner"
        disabled={!props.account?.licensed}
        onClick={() => choose(BRAND.localID)}
      >
        <CodeFluxLogo class="cf-picker-banner-logo" />
        <span class="cf-picker-banner-text">
          <span class="cf-picker-banner-name">
            {text(props.locale, "picker.local.name")}
            <Show when={!props.account?.licensed}>
              <span class="cf-picker-lock">{text(props.locale, "picker.local.locked")}</span>
            </Show>
          </span>
          <span class="cf-picker-banner-tagline">{tagline()}</span>
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

/** The account card above the banner: sign-in when signed out, and customer details with renew and sign-out when in. */
function AccountPanel(props: {
  locale: string
  account: CodeFluxAccount
  onSignIn?: () => void
  onSignOut?: () => void
  onOpenSite?: () => void
}) {
  const t = (key: TextKey) => text(props.locale, key)
  const status = () => (props.account.licensed ? "active" : props.account.expired ? "expired" : "none")
  const expiry = () =>
    props.account.expiresAt ? new Date(props.account.expiresAt * 1000).toLocaleDateString(props.locale) : "—"

  return (
    <section data-component="codeflux-account" data-status={status()} class="cf-account">
      <Show
        when={props.account.signedIn}
        fallback={
          <>
            <span class="cf-account-title">{t("account.title")}</span>
            <p class="cf-account-text">{props.account.pending ? t("account.signin.pending") : t("account.signin.prompt")}</p>
            <div class="cf-account-actions">
              {/* Not disabled while pending: a closed browser tab must not leave the customer without a way to retry. */}
              <button
                type="button"
                class="cf-account-action"
                data-action="codeflux-sign-in"
                onClick={() => props.onSignIn?.()}
              >
                {t("account.signin.button")}
              </button>
              <button type="button" class="cf-account-link" data-action="codeflux-register" onClick={() => props.onOpenSite?.()}>
                {t("account.register")}
              </button>
            </div>
          </>
        }
      >
        <div class="cf-account-head">
          <span class="cf-account-title">{t("account.title")}</span>
          <span class="cf-account-badge" data-status={status()}>
            {t(status() === "active" ? "account.status.valid" : status() === "expired" ? "account.status.expired" : "account.status.none")}
          </span>
        </div>
        <dl class="cf-account-grid">
          <div>
            <dt>{t("account.id")}</dt>
            <dd>{props.account.user?.id}</dd>
          </div>
          <div>
            <dt>{t("account.name")}</dt>
            <dd>{props.account.user?.displayName}</dd>
          </div>
          <div class="cf-account-wide">
            <dt>{t("account.email")}</dt>
            <dd data-slot="account-email">{props.account.user?.email}</dd>
          </div>
          <div>
            <dt>{t("account.tier")}</dt>
            <dd>{props.account.tierName ?? "—"}</dd>
          </div>
          <div>
            <dt>{t("account.expires")}</dt>
            <dd>{expiry()}</dd>
          </div>
        </dl>
        <div class="cf-account-actions">
          <button
            type="button"
            class="cf-account-action"
            data-variant={status() === "active" ? "ghost" : "primary"}
            data-action="codeflux-renew"
            onClick={() => props.onOpenSite?.()}
          >
            {t("account.renew")}
          </button>
          <button type="button" class="cf-account-link" data-action="codeflux-sign-out" onClick={() => props.onSignOut?.()}>
            {t("account.signout")}
          </button>
        </div>
      </Show>
      <Show when={props.account.failure}>
        {(failure) => (
          <div role="alert" class="cf-account-error">
            {failure()}
          </div>
        )}
      </Show>
    </section>
  )
}

