import logo from "../../assets/derived/logo-128.png"

/** The CodeFlux mark as an image; size it with `class`. */
export function CodeFluxLogo(props: { class?: string }) {
  return <img data-component="codeflux-logo" src={logo} alt="" aria-hidden="true" draggable={false} class={props.class} />
}
