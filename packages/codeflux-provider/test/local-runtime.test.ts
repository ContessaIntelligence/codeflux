import { afterEach, beforeEach, expect, test } from "bun:test"
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { downloadModel, hasModel, modelPath } from "../src/local-runtime"

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
