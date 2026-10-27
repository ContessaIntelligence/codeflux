import { CodeFluxLogo } from "./codeflux-logo"
import "./wordmark.css"

/** The CodeFlux mark followed by the product name. `size` is the type size in pixels; the mark scales with it. */
export function CodeFluxWordmark(props: { size?: number; class?: string }) {
  return (
    <span
      data-component="codeflux-wordmark"
      class={`cf-wordmark ${props.class ?? ""}`}
      style={{ "font-size": `${props.size ?? 40}px` }}
    >
      <CodeFluxLogo class="cf-wordmark-logo" />
      <span class="cf-wordmark-text">CodeFlux</span>
    </span>
  )
}
