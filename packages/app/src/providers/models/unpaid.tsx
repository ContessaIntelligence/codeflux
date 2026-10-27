import { DialogBody, DialogHeader, DialogTitle, Dialog } from "@opencode/ui/dialog"
import { useDialog } from "@opencode/ui/context/dialog"
import { CodeFluxProviderPicker } from "@codeflux/gui/providers"
import type { Component } from "solid-js"
import { useLocal, type ModelSelection } from "@/providers/models/selection"
import { decode64 } from "@/runtime/persistence/base64"
import { useLanguage } from "@/runtime/i18n/language"

type ModelState = ModelSelection

// CodeFlux has no keyless model catalog to list here, so the empty model picker goes straight to connecting a
// provider: NousFlux, OpenAI, Anthropic or Google.
export const DialogSelectModelUnpaid: Component<{ model?: ModelState }> = (props) => {
  const local = useLocal()
  const model = props.model ?? local.model
  const dialog = useDialog()
  const directory = () => decode64(local.slug())
  const language = useLanguage()

  const openProviders = (provider?: string) => {
    void import("@/providers/connect/dialog").then((x) => {
      const controller = x.useProviderConnectController()
      controller.select(provider)
      void dialog.show(() => (
        <x.DialogConnectProvider controller={controller} directory={directory()} selection={model} />
      ))
    })
  }

  return (
    <Dialog
      fit
      containerClass="!h-auto max-h-[calc(100vh_-_16px)] !w-[min(calc(100vw_-_16px),640px)]"
      class="[font-family:var(--v2-font-family-sans)] [&_[data-slot=dialog-header]]:!px-5 [&_[data-slot=dialog-header-title]]:!text-[15px] [&_[data-slot=dialog-header-title]]:!tracking-[-0.13px]"
    >
      <DialogHeader closeLabel={language.t("common.close")}>
        <DialogTitle>{language.t("dialog.model.select.title")}</DialogTitle>
      </DialogHeader>
      <DialogBody class="max-h-[calc(100vh_-_68px)] min-h-0 flex-none gap-0 overflow-y-auto px-2 pb-2">
        <CodeFluxProviderPicker locale={language.locale()} onSelect={openProviders} />
      </DialogBody>
    </Dialog>
  )
}
