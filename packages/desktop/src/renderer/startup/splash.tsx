import { CodeFluxSplash } from "@codeflux/gui/splash"
import type { Platform } from "@opencode/app/desktop"
import { onMount } from "solid-js"

// CodeFlux draws one loading screen for every launch, so there is no first-launch drawing to wait for.
export function LoadingSplash(props: {
  deep: boolean
  firstLaunch: boolean
  platform: Platform
  preview: boolean
  onDrawEnd: () => void
}) {
  onMount(() => {
    if (props.firstLaunch) props.onDrawEnd()
  })

  return <CodeFluxSplash />
}
