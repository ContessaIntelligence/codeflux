import { Schema } from "effect"
import { Rpc } from "@opencode/schema/rpc"

/** The local-model provider: Qwen3-4B served by the bundled llama.cpp `llama-server`, presented as CodeFlux-4B. */
export const LOCAL_ID = "codeflux-4b"
export const LOCAL_NAME = "CodeFlux-4B"
/** The model alias `llama-server` answers to (`--alias`). */
export const LOCAL_MODEL = "qwen3-4b"
export const LOCAL_DEFAULT_PORT = 18080
export const LOCAL_DEFAULT_BASE_URL = `http://127.0.0.1:${LOCAL_DEFAULT_PORT}/v1`

// Standard Schema keeps the definition portable, so the promise client's `rpc(definition)` accepts it.
const Empty = Schema.toStandardSchemaV1(Schema.Struct({}))

/** `probe` reports what is already on disk so the form can ask before downloading anything. */
const ProbeOutput = Schema.toStandardSchemaV1(
  Schema.Struct({
    /** The bundled `llama-server` executable exists in this build. */
    runtime: Schema.Boolean,
    /** The model file is fully downloaded. */
    model: Schema.Boolean,
    /** Approximate download size of the model, for the confirmation text. */
    sizeBytes: Schema.Int,
  }),
)

/** `setup` answers immediately and runs the download and the server start in the background. */
const SetupOutput = Schema.toStandardSchemaV1(
  Schema.Struct({
    state: Schema.Literals(["started", "joined"]),
  }),
)

const CancelOutput = Schema.toStandardSchemaV1(Schema.Struct({ cancelled: Schema.Boolean }))

const Progress = Schema.toStandardSchemaV1(
  Schema.Struct({
    stage: Schema.Literals(["checking", "downloading", "starting", "ready", "error"]),
    /** One-based step of `total`; each stage is one step. */
    step: Schema.Int,
    total: Schema.Int,
    /** Bytes of the model downloaded so far and in total, present on `downloading` events. */
    received: Schema.optional(Schema.Number),
    size: Schema.optional(Schema.Number),
    /** Download speed in bytes per second. */
    speed: Schema.optional(Schema.Number),
    /** Endpoint to connect with, present on the `ready` stage only. */
    port: Schema.optional(Schema.Int),
    baseURL: Schema.optional(Schema.String),
    /** Why the run failed, present on the `error` stage only. */
    failure: Schema.optional(Schema.String),
  }),
)

/** The `codeflux.local` RPC: the app's Local sign-in probes, then calls `setup` and renders the `progress` events. */
export const LocalRpc = Rpc.define({
  id: "codeflux.local",
  methods: {
    probe: { input: Empty, output: ProbeOutput },
    /**
     * Downloads Qwen3-4B (GGUF, resumable) when it is missing and starts the bundled `llama-server`. The work runs in
     * the background and reports through the `progress` events, because the download is gigabytes.
     */
    setup: { input: Empty, output: SetupOutput },
    /** Stops a running download; the partial file stays so the next `setup` resumes it. */
    cancel: { input: Empty, output: CancelOutput },
  },
  events: {
    progress: { schema: Progress },
  },
})
