import { afterEach, beforeEach, expect, test } from "bun:test"
import { copyFile, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { downloadModel, hasModel, listProcesses, modelPath, strayPids } from "../src/local-runtime"

const model = Buffer.concat([Buffer.from("GGUF"), Buffer.alloc(200_000, 7)])

let dir: string
let server: ReturnType<typeof Bun.serve> | undefined
const ranges: (string | null)[] = []

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "codeflux-model-"))
  process.env.CODEFLUX_MODELS_DIR = dir
  ranges.length = 0
})

afterEach(async () => {
  server?.stop(true)
  server = undefined
  delete process.env.CODEFLUX_MODELS_DIR
  delete process.env.CODEFLUX_MODEL_URL
  await rm(dir, { recursive: true, force: true })
})

// Serves `body` with Range support, like Hugging Face does; `/broken` always fails.
const serve = (body: Buffer) => {
  server = Bun.serve({
    port: 0,
    fetch(request) {
      const url = new URL(request.url)
      if (url.pathname === "/broken") return new Response("no", { status: 500 })
      const range = request.headers.get("range")
      ranges.push(range)
      const start = range ? Number(/bytes=(\d+)-/.exec(range)?.[1]) : 0
      if (start >= body.length) return new Response(null, { status: 416 })

      return new Response(body.subarray(start), { status: range ? 206 : 200 })
    },
  })

  return `http://127.0.0.1:${server.port}`
}

test("a fresh download writes the model into place", async () => {
  process.env.CODEFLUX_MODEL_URL = `${serve(model)}/model.gguf`

  expect(await downloadModel(() => {})).toBeUndefined()
  expect(hasModel()).toBe(true)
  expect(Buffer.compare(await readFile(modelPath()), model)).toBe(0)
  expect(await stat(`${modelPath()}.part`).catch(() => undefined)).toBeUndefined()
})

test("an interrupted download resumes from the partial file with a Range request", async () => {
  process.env.CODEFLUX_MODEL_URL = `${serve(model)}/model.gguf`
  await writeFile(`${modelPath()}.part`, model.subarray(0, 50_000))

  expect(await downloadModel(() => {})).toBeUndefined()
  expect(ranges).toEqual(["bytes=50000-"])
  expect(Buffer.compare(await readFile(modelPath()), model)).toBe(0)
})

test("a failing source falls through to the next one", async () => {
  const origin = serve(model)
  process.env.CODEFLUX_MODEL_URL = `${origin}/broken,${origin}/model.gguf`

  expect(await downloadModel(() => {})).toBeUndefined()
  expect(hasModel()).toBe(true)
})

test("a file that is not GGUF is rejected and never installed", async () => {
  process.env.CODEFLUX_MODEL_URL = `${serve(Buffer.alloc(1_000, 1))}/model.gguf`

  expect(await downloadModel(() => {})).toBe("The downloaded file is not a valid GGUF model")
  expect(hasModel()).toBe(false)
})

// Real command lines of the CodeFlux local model server, and the look-alikes a forced stop must leave alone.
test.each([
  {
    name: "Windows, quoted program path with spaces",
    command: String.raw`"C:\Program Files\CodeFlux\resources\llama\llama-server.exe" -m C:\Users\a\.codeflux\models\Qwen3-4B-Q4_K_M.gguf --host 127.0.0.1 --port 18080 --alias qwen3-4b --jinja -c 16384 -ngl 99`,
    stray: true,
  },
  {
    name: "macOS",
    command: "/Applications/CodeFlux.app/Contents/Resources/llama/llama-server -m /Users/a/.codeflux/models/Qwen3-4B-Q4_K_M.gguf --host 127.0.0.1 --port 18080 --alias qwen3-4b --jinja -c 16384 -ngl 99",
    stray: true,
  },
  { name: "the alias is the last word", command: "/opt/llama/llama-server --port 18080 --alias qwen3-4b", stray: true },
  {
    name: "another llama-server with its own alias",
    command: "/opt/llama/llama-server -m /models/mine.gguf --port 8080 --alias my-model",
    stray: false,
  },
  {
    name: "an alias that only starts with ours",
    command: "/opt/llama/llama-server --port 8080 --alias qwen3-4b-instruct",
    stray: false,
  },
  {
    name: "a llama-server without any alias",
    command: "/opt/llama/llama-server -m /models/mine.gguf --port 8080",
    stray: false,
  },
  {
    name: "another program that mentions both",
    command: "grep -r llama-server --alias qwen3-4b notes.txt",
    stray: false,
  },
  {
    name: "a program whose name only contains llama-server",
    command: "/usr/bin/llama-server-helper --alias qwen3-4b",
    stray: false,
  },
])("a forced stop $name: stray=$stray", ({ command, stray }) => {
  expect(strayPids([{ pid: 4321, command }])).toEqual(stray ? [4321] : [])
})

// Reads the real process list of this operating system. It never calls the forced stop itself: that ends every CodeFlux
// local model server on the computer, including one the developer is using. A random alias keeps this test's stand-ins
// apart from any real server.
test("the process list finds a server by its alias and not another llama-server", async () => {
  // Stand-ins: a copy of this runtime, named llama-server so the program check accepts it.
  const bin = path.join(dir, "llama-server" + (process.platform === "win32" ? ".exe" : ""))
  await copyFile(process.execPath, bin)
  const alias = `cf-test-${crypto.randomUUID()}`
  const spawnStandIn = (name: string) =>
    Bun.spawn([bin, "-e", "setInterval(() => {}, 1000)", "--", "--alias", name], { stdout: "ignore", stderr: "ignore" })
  const ours = spawnStandIn(alias)
  const other = spawnStandIn(`${alias}-other`)

  try {
    // The process list is read once the stand-ins are running; give the system a moment to show them.
    let found: number[] = []
    for (let i = 0; i < 20 && !found.includes(ours.pid); i++) {
      await Bun.sleep(250)
      found = strayPids(await listProcesses(), alias)
    }

    expect(found).toEqual([ours.pid])
  } finally {
    ours.kill()
    other.kill()
    await Promise.all([ours.exited, other.exited])
  }
})
