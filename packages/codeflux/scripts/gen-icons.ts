/**
 * Generates every raster asset from the two source images in `assets/`:
 *
 *   bun run icons
 *
 * Output goes to `assets/derived/` (used by the UI and the splash) and over the existing icon files of the web app
 * and the desktop app, keeping each file's name and pixel size. Re-run after replacing a source image.
 */
import { mkdir, readdir, writeFile } from "node:fs/promises"
import path from "node:path"
import pngToIco from "png-to-ico"
import sharp from "sharp"

const root = path.join(import.meta.dirname, "..")
const repo = path.join(root, "../..")
const logo = path.join(root, "assets/codeflux-logo.png")
const screen = path.join(root, "assets/codeflux-screen.png")
const derived = path.join(root, "assets/derived")

/** The mark on a transparent square, with the margin app icons need so the swirl does not touch the edge. */
const icon = (size: number, margin = 0.1) => {
  const inner = Math.round(size * (1 - margin * 2))

  return sharp(logo)
    .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({
      top: Math.floor((size - inner) / 2),
      bottom: Math.ceil((size - inner) / 2),
      left: Math.floor((size - inner) / 2),
      right: Math.ceil((size - inner) / 2),
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9 })
}

const ico = async () => pngToIco(await Promise.all([16, 24, 32, 48, 64, 128, 256].map((size) => icon(size).toBuffer())))

const wide = async (width: number, height: number) =>
  sharp({ create: { width, height, channels: 4, background: "#ffffff" } })
    .composite([
      { input: await sharp(screen).resize({ width: Math.round(width * 0.8) }).toBuffer(), gravity: "center" },
    ])
    .png({ compressionLevel: 9 })

async function files(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])

  return (
    await Promise.all(
      entries.map((entry) => {
        const full = path.join(dir, entry.name)

        // The mobile icon sets are not shipped by the desktop or web apps.
        if (entry.isDirectory()) return entry.name === "android" || entry.name === "ios" ? [] : files(full)

        return [full]
      }),
    )
  ).flat()
}

/** Rewrites an existing icon file in place at its current size. */
async function replace(file: string) {
  const name = path.basename(file)

  if (name.endsWith(".ico")) return writeFile(file, await ico())

  if (name.endsWith(".svg")) {
    const data = (await icon(128).toBuffer()).toString("base64")

    return writeFile(
      file,
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><image width="128" height="128" href="data:image/png;base64,${data}"/></svg>\n`,
    )
  }

  if (!name.endsWith(".png")) return
  const meta = await sharp(file)
    .metadata()
    .catch(() => undefined)

  if (!meta) {
    // A symlink checked out as a text file (Windows without symlink support) holds the relative path of its target.
    const stub = (await Bun.file(file).text()).trim()
    const target = stub.length < 200 ? path.resolve(path.dirname(file), stub) : undefined

    if (target && (await Bun.file(target).exists())) return replace(target)

    return console.warn(`skipped ${path.relative(repo, file)}: not a readable image`)
  }

  if (!meta.width || !meta.height) return

  if (name.startsWith("social-share")) return writeFile(file, await (await wide(meta.width, meta.height)).toBuffer())

  if (meta.width !== meta.height) return
  await writeFile(file, await icon(meta.width).toBuffer())
}

await mkdir(derived, { recursive: true })
await Promise.all([
  ...[16, 32, 64, 128, 256, 512].map((size) =>
    icon(size, 0).toFile(path.join(derived, `logo-${size}.png`)),
  ),
  // Wide enough for the 560px splash and the connection page at 2x density; the splash inlines it as base64.
  sharp(screen).resize({ width: 720 }).webp({ quality: 82 }).toFile(path.join(derived, "screen-720.webp")),
])

// `--derived` stops here, so the web and desktop icon files are left alone.
if (process.argv.includes("--derived")) {
  console.log("wrote the derived assets")
  process.exit(0)
}

const targets = [
  ...(await files(path.join(repo, "packages/desktop/icons"))),
  ...(await files(path.join(repo, "packages/app/public"))).filter((file) =>
    /(favicon|apple-touch-icon|web-app-manifest|social-share)/.test(path.basename(file)),
  ),
]

await Promise.all(targets.map(replace))
console.log(`wrote ${targets.length} icon files and the derived assets`)
