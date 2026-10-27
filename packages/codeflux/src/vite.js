import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

const read = (path) => readFileSync(fileURLToPath(new URL(path, import.meta.url)))

/**
 * Brands the HTML entry points. The splash is inlined (image as a data URI, styles in a <style> tag) so it paints on the
 * first frame, before the bundle loads: in Electron the window is shown before the renderer boots.
 *
 * @returns {import("vite").Plugin}
 */
export function codefluxVite() {
  const image = read("../assets/derived/screen-720.webp").toString("base64")
  const styles = read("./splash/splash.css").toString("utf8")

  const splash = [
    `<style>${styles}</style>`,
    `<div id="codeflux-splash" class="cf-splash" role="presentation">`,
    `<img alt="" draggable="false" src="data:image/webp;base64,${image}" />`,
    `<div class="cf-splash-bar"></div>`,
    `</div>`,
  ].join("")

  return {
    name: "codeflux:html",
    transformIndexHtml: {
      order: "pre",
      handler(html) {
        return html
          .replace(/(<title data-sm>)[^<]*(<\/title>)/, "$1CodeFlux$2")
          .replace(/<body[^>]*>/, (body) => `${body}${splash}`)
      },
    },
  }
}
