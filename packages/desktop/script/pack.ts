#!/usr/bin/env bun
import { $ } from "bun"
import { cp, mkdir, readdir, rm, stat } from "node:fs/promises"
import path from "node:path"
import { getCurrentCli, resolveChannel } from "./utils"

// Packages the built app (out/) for OPENCODE_TARGET into dist/desktop at the repository root, unsigned:
// macOS: the .app as a tarball. Windows: the unpacked app in app/, or with OPENCODE_DESKTOP_APP, the NSIS
// installer around that (signed) app. Linux: AppImage, deb and rpm. The release workflow signs afterwards.
const dir = path.resolve(import.meta.dir, "..")

const out = path.resolve(dir, "../../dist/desktop")

const cli = getCurrentCli()

const os =
  new Map([
    ["darwin", "mac"],
    ["win32", "win"],
  ]).get(cli.os) ?? "linux"

const app = process.env.OPENCODE_DESKTOP_APP

const flags = [`--${os}`, `--${cli.cpu}`, "--publish", "never", "--config", "electron-builder.config.ts"]

process.chdir(dir)

// Every platform bundles llama.cpp's llama-server for the local CodeFlux-4B model (the second Windows pass, with an
// already packed app, has it in there already).
if (!app) await $`bun ./script/fetch-llama.ts`

await rm("dist", { recursive: true, force: true })

await rm(out, { recursive: true, force: true })

await mkdir(out, { recursive: true })

if (app) {
  // The installer uses the channel's icons; the rest of the app is already built and signed.
  await $`bun ./script/copy-icons.ts ${resolveChannel()}`
  await $`bunx electron-builder ${flags} --prepackaged ${app}`
  await cp(`dist/opencode-desktop-win-${cli.cpu}.exe`, path.join(out, `opencode-desktop-win-${cli.cpu}.exe`))
}

if (!app && os === "linux") {
  await $`bunx electron-builder ${flags}`
  const files = (await readdir("dist")).filter((file) => /\.(AppImage|deb|rpm)$/.test(file))
  await Promise.all(files.map((file) => cp(path.join("dist", file), path.join(out, file))))
}

if (!app && os === "mac") {
  await $`bunx electron-builder ${flags} --dir -c.mac.identity=null`
  const parent = path.join("dist", cli.cpu === "arm64" ? "mac-arm64" : "mac")
  const bundles = (await readdir(parent)).filter((file) => file.endsWith(".app"))

  if (bundles.length !== 1) throw new Error(`Expected one .app bundle in ${parent}, found ${bundles.join(", ")}`)
  // identity=null leaves the bundle with Electron's original signatures, which editing Info.plist and adding
  // resources invalidated. Apple Silicon reports such an app as "damaged". Re-sign everything ad hoc so the seal
  // is at least consistent; only a Developer ID signature plus notarization removes the Gatekeeper prompt.
  // --deep only signs code in the bundle's code locations, not the llama.cpp executables and libraries under
  // Resources/llama. Apple Silicon kills unsigned arm64 code, so each real file there is signed ad hoc first.
  const llama = path.join(parent, bundles[0], "Contents", "Resources", "llama")

  for (const entry of await readdir(llama, { withFileTypes: true })) {
    const file = path.join(llama, entry.name)

    if (entry.isFile() && (entry.name.endsWith(".dylib") || ((await stat(file)).mode & 0o111) !== 0))
      await $`codesign --force --sign - ${file}`
  }

  await $`codesign --force --deep --sign - ${path.join(parent, bundles[0])}`
  await $`codesign --verify --deep --strict ${path.join(parent, bundles[0])}`
  await $`tar -cf ${path.join(out, `opencode-desktop-mac-${cli.cpu}.app.tar`)} -C ${parent} ${bundles[0]}`
}

if (!app && os === "win") {
  await $`bunx electron-builder ${flags} --dir`
  await cp(path.join("dist", cli.cpu === "arm64" ? "win-arm64-unpacked" : "win-unpacked"), path.join(out, "app"), {
    recursive: true,
  })
}
