import { createSignal, onCleanup, onMount } from "solid-js"
import type { CodeFluxAccount } from "@codeflux/gui/providers"
import { ACCOUNT_RENEW_URL, LocalRpc } from "@codeflux/provider-codeflux/local"
import { usePlatform } from "@/runtime/platform/platform"
import { useServerSDK } from "@/runtime/server/client"

const signedOut: CodeFluxAccount = { signedIn: false, pending: false, licensed: false, expired: false }

const describe = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause))

/**
 * The CodeFlux account behind the provider picker: the saved state, live updates, and the sign-in, sign-out and renew
 * actions. It starts signed out, so the sign-in prompt is on screen while the saved state loads and when the account
 * service cannot be reached; in that case the error is shown on the card instead of leaving the page without a way in.
 */
export function useCodeFluxAccount() {
  const sdk = useServerSDK()
  const platform = usePlatform()
  const rpc = sdk.api.rpc(LocalRpc)
  const [account, setAccount] = createSignal<CodeFluxAccount>(signedOut)
  const fail = (cause: unknown) => setAccount((current) => ({ ...current, pending: false, failure: describe(cause) }))

  onMount(() => {
    void rpc.account({}).then(setAccount, fail)
    const off = rpc.events.on("account", (event) => {
      setAccount(event.data)
    })
    onCleanup(off)
  })

  return {
    account,
    signIn: () => rpc.signIn({}).then((result) => platform.openExternal(result.url), fail),
    signOut: () => rpc.signOut({}).then(() => undefined, fail),
    openSite: () => platform.openExternal(ACCOUNT_RENEW_URL),
  }
}
