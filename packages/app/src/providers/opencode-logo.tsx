import { CodeFluxLogo } from "@codeflux/gui/logo"

// Kept under its upstream name so the callers do not change; it draws the CodeFlux mark.
export function OpenCodeLogo(props: { class?: string }) {
  return <CodeFluxLogo class={props.class} />
}
