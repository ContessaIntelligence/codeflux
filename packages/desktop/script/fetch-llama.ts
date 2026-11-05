#!/usr/bin/env bun
import { cp, mkdir, mkdtemp, readdir, rm, stat } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { getCurrentCli } from "./utils"

// Downloads the llama.cpp build for OPENCODE_TARGET (default: this machine) into resources/llama/, so the desktop app
// ships `llama-server` for the local CodeFlux-4B model: Vulkan on Windows and Linux (NVIDIA, AMD and Intel GPUs without
// a driver SDK; the server falls back to the CPU on its own), Metal on macOS. Set LLAMA_CPP_TAG (for example b12119)
// to pin a release; without it the newest release that carries the archive is used. The release workflow pins it so
// all three platforms ship the same build.
const dir = path.resolve(import.meta.dir, "..")

const out = path.join(dir, "resources", "llama")

const cli = getCurrentCli()

const target = {
  win32: { suffix: `-bin-win-vulkan-${cli.cpu}.zip`, server: "llama-server.exe" },
  darwin: { suffix: `-bin-macos-${cli.cpu}.tar.gz`, server: "llama-server" },
  linux: { suffix: `-bin-ubuntu-vulkan-${cli.cpu}.tar.gz`, server: "llama-server" },
}[cli.os]

if ((await stat(path.join(out, target.server)).catch(() => undefined))?.isFile()) {
  console.log(`${target.server} already present, skipping`)
  process.exit(0)
}

type Release = { tag_name: string; assets: { name: string; browser_download_url: string }[] }

const api = async (url: string) => {
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      // Deliberately not GITHUB_TOKEN or GH_TOKEN: electron-builder (which `pack` runs next) reads those and then
      // assumes a GitHub publish target, which fails in CI when it cannot detect the repository.
      ...(process.env.LLAMA_GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.LLAMA_GITHUB_TOKEN}` } : {}),
    },
  })

  if (!response.ok) throw new Error(`Could not read the llama.cpp releases: HTTP ${response.status}`)

  return response.json()
}

const wanted = (item: Release["assets"][number]) => item.name.endsWith(target.suffix)

// `releases/latest` points at a tag-only release without binaries (v0.9.0), so the builds (bNNNN tags, published as
// prereleases) are found by scanning the recent releases for the first one that carries the archive.
const release = process.env.LLAMA_CPP_TAG
  ? ((await api(`https://api.github.com/repos/ggml-org/llama.cpp/releases/tags/${process.env.LLAMA_CPP_TAG}`)) as Release)
  : ((await api("https://api.github.com/repos/ggml-org/llama.cpp/releases?per_page=30")) as Release[]).find((item) =>
      item.assets.some(wanted),
    )

if (!release) throw new Error(`No recent llama.cpp release carries a *${target.suffix} archive; set LLAMA_CPP_TAG`)

const asset = release.assets.find(wanted)

if (!asset) throw new Error(`llama.cpp ${release.tag_name} has no *${target.suffix} archive`)

console.log(`Fetching ${asset.name} (${release.tag_name})`)

const work = await mkdtemp(path.join(tmpdir(), "llama-"))

const archive = path.join(work, asset.name)

const response = await fetch(asset.browser_download_url)

if (!response.ok) throw new Error(`Could not download ${asset.name}: HTTP ${response.status}`)

await Bun.write(archive, response)

const extracted = path.join(work, "extracted")

await mkdir(extracted)

const expand =
  cli.os === "win32"
    ? // Not `tar`: under Git Bash (the CI shell) `tar` is GNU tar, which cannot read zip archives.
      Bun.spawnSync(
        [
          "powershell",
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          "Expand-Archive -LiteralPath $env:LLAMA_ARCHIVE -DestinationPath $env:LLAMA_OUT -Force",
        ],
        { env: { ...process.env, LLAMA_ARCHIVE: archive, LLAMA_OUT: extracted }, stdout: "inherit", stderr: "inherit" },
      )
    : // Relative paths: GNU tar reads a Windows drive letter ("C:\...") as a remote host.
      Bun.spawnSync(["tar", "-xzf", asset.name, "-C", "extracted"], { cwd: work, stdout: "inherit", stderr: "inherit" })

if (expand.exitCode !== 0) throw new Error(`Could not extract ${asset.name}`)

const files = await readdir(extracted, { recursive: true, withFileTypes: true })

const server = files.find((entry) => entry.isFile() && entry.name === target.server)

if (!server) throw new Error(`${target.server} is missing from the llama.cpp archive`)

await rm(out, { recursive: true, force: true })

await mkdir(path.dirname(out), { recursive: true })

// The macOS and Linux archives link libraries through symlinks (libllama.so -> libllama.so.0 -> ...). `cp -a` keeps
// them as symlinks; Node's cp would rewrite them to absolute paths into the temporary directory.
if (cli.os === "win32") await cp(server.parentPath, out, { recursive: true })

if (cli.os !== "win32") {
  const copied = Bun.spawnSync(["cp", "-a", server.parentPath, out], { stdout: "inherit", stderr: "inherit" })

  if (copied.exitCode !== 0) throw new Error("Could not copy the llama.cpp files into resources/llama")
}

await rm(work, { recursive: true, force: true })

console.log(`llama.cpp ${release.tag_name} staged in ${out}`)
