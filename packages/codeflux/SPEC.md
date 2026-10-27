# CodeFlux SPEC

CodeFlux is a rebrand and extension of OpenCode 2.1.4 (MIT). New work lives in two directories; upstream files only get small hook points.

## Directories

| Path | Role |
|---|---|
| `packages/codeflux` (`@codeflux/gui`) | Brand constants, dictionary rebranding, logo/wordmark, splash, provider picker, NousFlux form, free-model filter, Vite plugin, icon script |
| `packages/codeflux-provider` (`@codeflux/provider-nousflux`) | Core plugin that registers the `nousflux` integration and an OpenAI-compatible provider |

`@codeflux/gui` depends on Solid and `@opencode/ui` only. `@codeflux/provider-nousflux` depends on `@opencode/plugin` and `@opencode/schema` only. Core imports the plugin in one line.

## Images

| Source (edit these) | Derived (generated, committed) |
|---|---|
| `packages/codeflux/assets/codeflux-logo.png` | `assets/derived/logo-{16..512}.png`, desktop `icons/*`, app `public/{favicon,apple-touch-icon,web-app-manifest}*` |
| `packages/codeflux/assets/codeflux-screen.png` | `assets/derived/screen-720.webp` (splash, NousFlux page image), `public/social-share*.png` |

Regenerate: from `packages/codeflux`, `bun run scripts/gen-icons.ts --derived` (derived only) or `bun run icons` (also overwrites the web and desktop icon files).

## Hook points in upstream files

| File | Change |
|---|---|
| `packages/app/vite.js` | `codefluxVite()`: title, inline splash |
| `packages/app/src/entry.tsx` | `removeSplash()` after first render |
| `packages/app/src/runtime/i18n/language.tsx` | `brandDictionary()` on every loaded dictionary |
| `packages/app/src/runtime/i18n/desktop-native.ts` | English native strings say CodeFlux; new key `desktop.menu.codefluxSupport` |
| `packages/app/src/shell/commands/desktop-menu.ts` | Help menu: CodeFlux Support (https://www.nousflux.com) and Export Logs |
| `packages/app/src/providers/connect/dialog.tsx` | Picker replaced by `CodeFluxProviderPicker`; NousFlux form branch; title |
| `packages/app/src/providers/connect/controller.ts` | `connectKey(key, answer?)` |
| `packages/app/src/providers/models/unpaid.tsx` | Empty model picker shows the four provider buttons |
| `packages/app/src/providers/catalog/providers.ts` | `withoutFreeCatalog()` hides OpenCode free models everywhere |
| `packages/app/src/providers/opencode-logo.tsx`, `models/provider-group.tsx` | CodeFlux mark |
| `packages/app/src/{new-session/view,servers/connect/screen,settings/about/about}.tsx` | `CodeFluxWordmark` |
| `packages/desktop/src/renderer/startup/splash.tsx` | Renders `CodeFluxSplash` |
| `packages/desktop/src/main/{constants,windows/early,windows/appearance}.ts`, `electron-builder.config.ts` | Product and window names; upstream update feed removed |
| `packages/core/src/plugin/provider.ts`, `packages/core/package.json` | Registers `NousFluxPlugin` |

## Behaviour

- **NousFlux connect**: form (URL default `https://www.nousflux.com`, API key, models) calls `integration.connect.key` with `answer: { baseURL, models }`; the plugin reads the stored credential metadata, builds `baseURL/v1` and the model list, and the original post-connect flow follows. Provider ID and display name are fixed (`nousflux`, `NousFlux`).
- **Free models**: `useProviders()` drops free models of provider `opencode`; paid ones stay.
- **Rebrand**: only the capitalised word `OpenCode` in dictionary values changes; commands, files, URLs and env vars are untouched. Overrides in `packages/codeflux/src/i18n/overrides.ts`.

## License

MIT. `LICENSE` keeps the OpenCode copyright line and gains a CodeFlux line; `NOTICE.md` states the derivation. Keep both in every distribution. The OpenCode name and logo are not covered by the license and are not used.

## Known gaps

- `packages/desktop/src/renderer/startup/splash.css` is unused; delete it.
- TUI and CLI are unchanged by design. The deep-link scheme (`opencode://`) and appId are unchanged.
- Upstream links in the About page credits and Console/Zen flows remain; the Console provider is no longer reachable from the picker.
