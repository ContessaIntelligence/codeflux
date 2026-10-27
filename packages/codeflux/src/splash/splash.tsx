import { onMount } from "solid-js"
import screen from "../../assets/derived/screen-720.webp"
import { removeSplash } from "./remove"
import "./splash.css"

/**
 * The in-app loading screen. It looks exactly like the static splash in the page, which it replaces on mount, so the
 * handoff between the two is not visible.
 */
export function CodeFluxSplash() {
  onMount(removeSplash)

  return (
    <div data-component="codeflux-splash" class="cf-splash" role="presentation">
      <img src={screen} alt="" draggable={false} />
      <div class="cf-splash-bar" />
    </div>
  )
}
