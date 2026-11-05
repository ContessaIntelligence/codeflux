import { Effect, Stream } from "effect"
import { define } from "@opencode/plugin/effect/plugin"
import { Form } from "@opencode/schema/form"
import { Integration } from "@opencode/schema/integration"
import { Model } from "@opencode/schema/model"
import { normalizeBaseURL, OPENAI_COMPATIBLE_PACKAGE, parseModels } from "./settings.js"
import {
  cancelDownload,
  downloadModel,
  ensureServer,
  hasModel,
  hasRuntime,
  MODEL,
  stopServer,
} from "./local-runtime.js"
import {
  LOCAL_DEFAULT_BASE_URL,
  LOCAL_DEFAULT_PORT,
  LOCAL_ID,
  LOCAL_MODEL,
  LOCAL_NAME,
  LocalRpc,
} from "./local-rpc.js"

const fields = Form.Fields.make([
  {
    type: "string",
    key: "baseURL",
    title: "CodeFlux-4B URL",
    default: LOCAL_DEFAULT_BASE_URL,
    hidden: true,
  },
  {
    type: "string",
    key: "models",
    title: "Models",
    default: LOCAL_MODEL,
    hidden: true,
  },
])

type Stage = "checking" | "downloading" | "starting" | "ready" | "error"

// One process-global run: a second sign-in joins the running one instead of racing it with a second download.
let activeRun = false

/**
 * The local CodeFlux-4B provider: Qwen3-4B served by the bundled llama.cpp `llama-server`. The connection stores the
 * endpoint and model list as key credential metadata like the CodeFlux provider does. The `codeflux.local` RPC runs
 * the model download and server start as a background workflow that reports through `progress` events. An existing
 * connection starts the server again whenever the service boots.
 */
export const CodeFluxLocalPlugin = define({
  id: "codeflux.provider.local",
  effect: Effect.fn(function* (ctx) {
    const localBaseURL = (input: unknown) =>
      typeof input === "string" && input.trim() !== "" ? normalizeBaseURL(input) : LOCAL_DEFAULT_BASE_URL

    const loaded = { baseURL: LOCAL_DEFAULT_BASE_URL, models: [] as string[] }

    const sync = Effect.fn("CodeFluxLocalPlugin.sync")(function* () {
      const connection = yield* ctx.integration.connection.active(LOCAL_ID)
      const credential = connection
        ? yield* ctx.integration.connection.resolve(connection).pipe(Effect.orElseSucceed(() => undefined))
        : undefined
      const metadata = credential?.type === "key" ? credential.metadata : undefined
      const next = { baseURL: localBaseURL(metadata?.baseURL), models: parseModels(metadata?.models) }

      if (next.baseURL === loaded.baseURL && next.models.join() === loaded.models.join()) return
      Object.assign(loaded, next)
      yield* ctx.provider.reload()
    })

    // Brings the server up for an existing connection, and follows the port when the saved one was taken.
    const resume = Effect.fn("CodeFluxLocalPlugin.resume")(function* () {
      if (loaded.models.length === 0 || activeRun || !hasRuntime() || !hasModel()) return
      const saved = Number(URL.parse(loaded.baseURL)?.port) || LOCAL_DEFAULT_PORT
      const server = yield* Effect.promise(() => ensureServer(saved))

      if (typeof server === "string") return yield* Effect.logInfo(`codeflux.local: resume failed: ${server}`)
      const baseURL = localBaseURL(server.origin)

      if (baseURL === loaded.baseURL) return
      loaded.baseURL = baseURL
      yield* ctx.provider.reload()
    })

    yield* ctx.integration.transform((editor) => {
      editor.update(LOCAL_ID, (integration) => {
        integration.name = LOCAL_NAME
      })
      editor.method.update({
        integrationID: LOCAL_ID,
        method: { type: "key", label: "API key", form: fields },
      })
    })

    yield* ctx.provider.transform((providers) => {
      providers.update(LOCAL_ID, (provider) => {
        provider.name = LOCAL_NAME
        provider.package = OPENAI_COMPATIBLE_PACKAGE
        provider.integrationID = Integration.ID.make(LOCAL_ID)
        provider.settings = { ...provider.settings, baseURL: loaded.baseURL, provider: LOCAL_ID }
      })
      loaded.models.forEach((id) =>
        providers.models.update(LOCAL_ID, id, (model) => {
          model.modelID = Model.ID.make(id)
          model.name = id
        }),
      )
    })

    yield* Effect.addFinalizer(() => Effect.sync(stopServer))

    // Late-bound: the workflow closes over `registration`, and the handler only runs after registration resolves.
    let launch: () => Effect.Effect<void> = () => Effect.void

    const registration = yield* ctx.rpc
      .register(LocalRpc, {
        probe: () =>
          Effect.succeed({ runtime: hasRuntime(), model: hasModel(), sizeBytes: MODEL.approximateSize }),
        setup: () =>
          Effect.sync(() => {
            if (activeRun) return { state: "joined" as const }
            activeRun = true
            // Detached from the request fiber: the run outlives this RPC and reports through progress events.
            Effect.runFork(launch())

            return { state: "started" as const }
          }),
        cancel: () => Effect.succeed({ cancelled: cancelDownload() }),
      })
      .pipe(Effect.orDie)

    /** The whole setup, from the model download to the ready endpoint, reporting every step as `progress` events. */
    const workflow = Effect.fn("CodeFluxLocalPlugin.run")(function* () {
      const current = { stage: "checking" as Stage, step: 1 }

      const emit = (extra: {
        received?: number
        size?: number
        speed?: number
        port?: number
        baseURL?: string
        failure?: string
      }) =>
        Effect.runFork(
          registration.events.emit("progress", { stage: current.stage, step: current.step, total: 4, ...extra }),
        )

      const enter = (stage: Stage, step: number) => {
        current.stage = stage
        current.step = step
        emit({})
      }

      const fail = (failure: string) => {
        current.stage = "error"
        emit({ failure })
      }

      try {
        enter("checking", 1)
        if (!hasRuntime()) return fail("The local model runtime is not included in this build of CodeFlux")

        if (!hasModel()) {
          enter("downloading", 2)
          const failure = yield* Effect.promise(() => downloadModel((progress) => emit(progress)))

          if (failure) {
            yield* Effect.logInfo(`codeflux.local: download failed: ${failure}`)
            return fail(failure)
          }
        }

        enter("starting", 3)
        const server = yield* Effect.promise(() => ensureServer(LOCAL_DEFAULT_PORT))

        if (typeof server === "string") {
          yield* Effect.logInfo(`codeflux.local: start failed: ${server}`)
          return fail(server)
        }

        // One `ready` event that already carries the endpoint: the form connects on the first `ready` it sees, so an
        // earlier one without `baseURL` would save an empty URL that then overrides the provider's own setting.
        current.stage = "ready"
        current.step = 4
        yield* Effect.logInfo("codeflux.local: ready")
        emit({ port: server.port, baseURL: localBaseURL(server.origin) })
      } catch (error) {
        yield* Effect.logInfo(`codeflux.local: run crashed: ${String(error)}`)
        fail(String(error))
      } finally {
        activeRun = false
      }
    })

    launch = () => workflow()

    yield* sync()
    yield* resume().pipe(Effect.forkScoped({ startImmediately: true }))
    yield* ctx.event
      .subscribe({ types: ["credential.updated", "credential.switched"] })
      .pipe(Stream.runForEach(() => sync().pipe(Effect.andThen(resume()))), Effect.forkScoped({ startImmediately: true }))
  }),
})
