import { execFile, spawn, type ChildProcess } from "node:child_process"
import { existsSync } from "node:fs"
import { mkdir, open, rename, stat } from "node:fs/promises"
import { createServer } from "node:net"
import { homedir } from "node:os"
import path from "node:path"
import { promisify } from "node:util"
import { LOCAL_DEFAULT_PORT, LOCAL_MODEL } from "./local-rpc.js"

/** Qwen3-4B, Q4_K_M. The mirror is tried when the first source cannot be reached (for example from mainland China). */
export const MODEL = {
  file: "Qwen3-4B-Q4_K_M.gguf",
  approximateSize: 2_600_000_000,
  sources: [
    "https://huggingface.co/Qwen/Qwen3-4B-GGUF/resolve/main/Qwen3-4B-Q4_K_M.gguf",
    "https://hf-mirror.com/Qwen/Qwen3-4B-GGUF/resolve/main/Qwen3-4B-Q4_K_M.gguf",
  ],
} as const

/** `CODEFLUX_MODEL_URL` (comma-separated) puts the user's own mirrors ahead of the built-in sources. */
const sources = () => [...(process.env.CODEFLUX_MODEL_URL?.split(",").map((item) => item.trim()).filter(Boolean) ?? []), ...MODEL.sources]

/** `CODEFLUX_MODELS_DIR` overrides the default `~/.codeflux/models`. */
export const modelsDir = () => process.env.CODEFLUX_MODELS_DIR || path.join(homedir(), ".codeflux", "models")

export const modelPath = () => path.join(modelsDir(), MODEL.file)

/**
 * The bundled llama.cpp directory. The desktop app passes `CODEFLUX_LLAMA_DIR` because the CLI runs from a staged
 * copy elsewhere; next to the executable is the fallback for a CLI shipped beside it.
 */
export const llamaServerPath = () => {
  const name = process.platform === "win32" ? "llama-server.exe" : "llama-server"
  const dir = process.env.CODEFLUX_LLAMA_DIR || path.join(path.dirname(process.execPath), "llama")

  return path.join(dir, name)
}

export const hasRuntime = () => existsSync(llamaServerPath())

export const hasModel = () => existsSync(modelPath())

export type DownloadProgress = { received: number; size: number; speed: number }

let abort: AbortController | undefined

/** Aborts the running download. The partial file stays on disk for the next run to resume. */
export const cancelDownload = () => {
  if (!abort) return false
  abort.abort()

  return true
}

/**
 * Downloads the model to `<file>.part` with HTTP Range resume, trying each source in order, then renames it into
 * place. Resolves with a failure message, or undefined on success.
 */
export async function downloadModel(onProgress: (progress: DownloadProgress) => void) {
  await mkdir(modelsDir(), { recursive: true })
  abort = new AbortController()
  const signal = abort.signal
  const partial = `${modelPath()}.part`
  const failures: string[] = []

  try {
    for (const source of sources()) {
      const failure = await fetchInto(source, partial, signal, onProgress).then(
        () => undefined,
        (error: unknown) => (signal.aborted ? "cancelled" : error instanceof Error ? error.message : String(error)),
      )

      if (!failure) {
        if (!(await hasGgufMagic(partial))) return "The downloaded file is not a valid GGUF model"
        await rename(partial, modelPath())

        return undefined
      }
      if (signal.aborted) return failure
      failures.push(`${new URL(source).host}: ${failure}`)
    }

    return failures.join(" · ")
  } finally {
    abort = undefined
  }
}

async function fetchInto(url: string, partial: string, signal: AbortSignal, onProgress: (p: DownloadProgress) => void) {
  const start = await stat(partial).then(
    (info) => info.size,
    () => 0,
  )
  const response = await fetch(url, {
    headers: start > 0 ? { Range: `bytes=${start}-` } : {},
    redirect: "follow",
    signal,
  })

  // 416: the partial file already holds the whole model.
  if (response.status === 416) return
  if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`)
  const resumed = response.status === 206
  const offset = resumed ? start : 0
  const size = offset + Number(response.headers.get("content-length") ?? 0)
  const file = await open(partial, resumed ? "a" : "w")
  let received = offset
  let last = { time: Date.now(), received }
  let speed = 0

  try {
    const reader = response.body.getReader()

    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      await file.write(chunk.value)
      received += chunk.value.byteLength
      const now = Date.now()
      if (now - last.time < 500) continue
      speed = ((received - last.received) / (now - last.time)) * 1000
      last = { time: now, received }
      onProgress({ received, size, speed })
    }
  } finally {
    await file.close()
  }

  if (size > 0 && received < size) throw new Error("The connection closed before the download finished")
  onProgress({ received, size: received, speed })
}

async function hasGgufMagic(file: string) {
  const handle = await open(file, "r")
  const head = Buffer.alloc(4)
  await handle.read(head, 0, 4, 0)
  await handle.close()

  return head.toString("latin1") === "GGUF"
}

export type Server = { port: number; origin: string }

let running: { child: ChildProcess; server: Server } | undefined
let starting: Promise<Server | string> | undefined
// Bumped by a forced stop, so a start that is under way gives up instead of retrying on the CPU after its server died.
let epoch = 0

/** Whether this process has a llama-server running, and on which port. */
export const serverStatus = () =>
  running && running.child.exitCode === null
    ? { running: true as const, port: running.server.port }
    : { running: false as const }

/** Stops the llama-server this process started. */
export const stopServer = () => {
  running?.child.kill()
  running = undefined
}

process.on("exit", stopServer)

/**
 * The ids of the CodeFlux local model servers in a process list. A CodeFlux server is a `llama-server` executable
 * started with the model alias, whichever install started it, so this also finds one left behind by an earlier run or
 * another install, and leaves any other llama-server, or any other program that merely mentions one, alone.
 */
export function strayPids(processes: readonly { pid: number; command: string }[], alias = LOCAL_MODEL) {
  const flag = new RegExp(String.raw`\s--alias\s+${alias}(\s|$)`)

  return processes
    .filter((item) => {
      // The program is the first word of the command line, quoted when its path has spaces.
      const first = /^\s*(?:"([^"]+)"|(\S+))/.exec(item.command)
      const program = first?.[1] ?? first?.[2] ?? ""

      return /(^|[\\/])llama-server(\.exe)?$/i.test(program) && flag.test(item.command)
    })
    .map((item) => item.pid)
}

const run = promisify(execFile)

/** The running llama-server processes with their command lines, from the operating system. */
export async function listProcesses(): Promise<{ pid: number; command: string }[]> {
  if (process.platform === "win32") {
    const { stdout } = await run(
      "powershell",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "Get-CimInstance Win32_Process -Filter \"Name='llama-server.exe'\" | Select-Object ProcessId,CommandLine | ConvertTo-Json -Compress",
      ],
      { timeout: 15_000, windowsHide: true },
    )
    const text = stdout.trim()
    if (!text) return []
    const parsed: unknown = JSON.parse(text)
    // One process prints an object, several print an array.
    const rows = Array.isArray(parsed) ? parsed : [parsed]

    return rows.flatMap((row) =>
      typeof row === "object" && row !== null && "ProcessId" in row && "CommandLine" in row
        ? [{ pid: Number(row.ProcessId), command: String(row.CommandLine ?? "") }]
        : [],
    )
  }

  const { stdout } = await run("ps", ["-axo", "pid=,command="], { timeout: 15_000 })

  return stdout.split(/\r?\n/).flatMap((line) => {
    const match = /^\s*(\d+)\s+(.*)$/.exec(line)

    return match ? [{ pid: Number(match[1]), command: match[2] }] : []
  })
}

/**
 * Force stop: ends every CodeFlux local model server, the one this process tracks and any other, and cancels a start
 * that is under way. Resolves with how many servers it ended. Listing the processes can fail, in which case only the
 * tracked server is stopped.
 */
export async function forceStopServers() {
  epoch++
  const tracked = running?.child.pid
  stopServer()
  const found = await listProcesses().then(strayPids, () => [] as number[])
  const pids = [...new Set([...found, ...(tracked === undefined ? [] : [tracked])])]

  const killed = pids.filter((pid) => {
    try {
      process.kill(pid, "SIGKILL")

      return true
    } catch {
      // Already gone, or not ours to end.
      return false
    }
  })

  // A start that was waiting on a server we just ended finishes at once; give it a moment to let go.
  await Promise.race([starting?.catch(() => undefined), new Promise((resolve) => setTimeout(resolve, 5_000))])

  return killed.length
}

/**
 * Starts llama-server (or joins the running one) and waits until `/health` answers. Resolves with the endpoint, or a
 * failure message. A GPU start that dies early is retried on the CPU.
 */
export const ensureServer = (preferredPort: number | undefined): Promise<Server | string> => {
  if (running && running.child.exitCode === null) return Promise.resolve(running.server)
  starting ??= launch(preferredPort).finally(() => (starting = undefined))

  return starting
}

async function launch(preferredPort: number | undefined) {
  const mine = epoch
  const port = await freePort(preferredPort ?? LOCAL_DEFAULT_PORT)
  const server = { port, origin: `http://127.0.0.1:${port}` }
  const gpu = await tryStart(server, 99)
  if (typeof gpu !== "string") return gpu
  // A forced stop ended the server this start was waiting on: do not start another one.
  if (mine !== epoch) return "The start was cancelled"
  const cpu = await tryStart(server, 0)

  return typeof cpu !== "string" ? cpu : `${cpu} (GPU: ${gpu})`
}

async function tryStart(server: Server, gpuLayers: number): Promise<Server | string> {
  const context = process.env.CODEFLUX_LOCAL_CTX || "16384"
  const child = spawn(
    llamaServerPath(),
    [
      ...["-m", modelPath()],
      ...["--host", "127.0.0.1", "--port", String(server.port)],
      ...["--alias", LOCAL_MODEL],
      // Tool calling needs the model's own chat template.
      "--jinja",
      ...["-c", context],
      ...["-ngl", String(gpuLayers)],
    ],
    { windowsHide: true, stdio: ["ignore", "ignore", "pipe"], cwd: path.dirname(llamaServerPath()) },
  )
  let tail = ""
  child.stderr?.on("data", (chunk: Buffer) => (tail = (tail + chunk.toString()).slice(-2_000)))
  const exited = new Promise<string>((resolve) => {
    child.on("error", (error) => resolve(error.message))
    child.on("close", (code) => resolve(`llama-server exited with code ${code}: ${lastLines(tail)}`))
  })

  const ready = await Promise.race([waitHealthy(server.origin), exited])
  if (ready === true) {
    running = { child, server }
    child.on("close", () => (running = undefined))

    return server
  }
  child.kill()

  return typeof ready === "string" ? ready : `llama-server did not become ready: ${lastLines(tail)}`
}

const lastLines = (value: string) =>
  value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-3)
    .join(" · ")

// Loading a 2.5 GB model from a cold disk can take a while; /health answers 503 until it is loaded.
async function waitHealthy(origin: string) {
  for (let i = 0; i < 240; i++) {
    const ok = await fetch(`${origin}/health`, { signal: AbortSignal.timeout(1_000) }).then(
      (response) => response.ok,
      () => false,
    )
    if (ok) return true
    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  return false
}

/** The first free loopback port at or after `from`. */
async function freePort(from: number) {
  for (let port = from; port < from + 50; port++) {
    const free = await new Promise<boolean>((resolve) => {
      const probe = createServer()
      probe.once("error", () => resolve(false))
      probe.listen(port, "127.0.0.1", () => probe.close(() => resolve(true)))
    })
    if (free) return port
  }

  return from
}

