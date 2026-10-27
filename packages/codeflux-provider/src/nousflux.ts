import { Effect, Stream } from "effect"
import { define } from "@opencode/plugin/effect/plugin"
import { Form } from "@opencode/schema/form"
import { Integration } from "@opencode/schema/integration"
import { Model } from "@opencode/schema/model"
import {
  normalizeBaseURL,
  NOUSFLUX_DEFAULT_URL,
  NOUSFLUX_ID,
  NOUSFLUX_NAME,
  OPENAI_COMPATIBLE_PACKAGE,
  parseModels,
} from "./settings.js"

const fields = Form.Fields.make([
  {
    type: "string",
    key: "baseURL",
    title: "NousFlux URL",
    placeholder: NOUSFLUX_DEFAULT_URL,
    default: NOUSFLUX_DEFAULT_URL,
    required: true,
  },
  {
    type: "string",
    key: "models",
    title: "Models",
    placeholder: "model-a, model-b",
    description: "Model IDs separated by commas or new lines.",
    required: true,
  },
])

/**
 * NousFlux as an OpenAI-compatible provider. The URL and model list come from the connection form and are stored as
 * the key credential's metadata, so a reconnect with a new URL or model list replaces them.
 */
export const NousFluxPlugin = define({
  id: "codeflux.provider.nousflux",
  effect: Effect.fn(function* (ctx) {
    const loaded = { baseURL: normalizeBaseURL(undefined), models: [] as string[] }

    const sync = Effect.fn("NousFluxPlugin.sync")(function* () {
      const connection = yield* ctx.integration.connection.active(NOUSFLUX_ID)
      const credential = connection
        ? yield* ctx.integration.connection.resolve(connection).pipe(Effect.orElseSucceed(() => undefined))
        : undefined
      const metadata = credential?.type === "key" ? credential.metadata : undefined
      const next = { baseURL: normalizeBaseURL(metadata?.baseURL), models: parseModels(metadata?.models) }

      if (next.baseURL === loaded.baseURL && next.models.join() === loaded.models.join()) return
      Object.assign(loaded, next)
      yield* ctx.provider.reload()
    })

    yield* ctx.integration.transform((editor) => {
      editor.update(NOUSFLUX_ID, (integration) => {
        integration.name = NOUSFLUX_NAME
      })
      editor.method.update({
        integrationID: NOUSFLUX_ID,
        method: { type: "key", label: "API key", form: fields },
      })
    })

    yield* ctx.provider.transform((providers) => {
      providers.update(NOUSFLUX_ID, (provider) => {
        provider.name = NOUSFLUX_NAME
        provider.package = OPENAI_COMPATIBLE_PACKAGE
        provider.integrationID = Integration.ID.make(NOUSFLUX_ID)
        provider.settings = { ...provider.settings, baseURL: loaded.baseURL, provider: NOUSFLUX_ID }
      })
      loaded.models.forEach((id) =>
        providers.models.update(NOUSFLUX_ID, id, (model) => {
          model.modelID = Model.ID.make(id)
          model.name = id
        }),
      )
    })

    yield* sync()
    yield* ctx.event
      .subscribe({ types: ["credential.updated", "credential.switched"] })
      .pipe(Stream.runForEach(sync), Effect.forkScoped({ startImmediately: true }))
  }),
})
