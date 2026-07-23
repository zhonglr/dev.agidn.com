import { useState } from "react";
import type { ExportContextResponse } from "@agidn/api-protocol";
import { useI18n, type MessageDescriptor, type StudioLocale } from "../../i18n.js";
import { message, messageFromError } from "../../i18n/types.js";
import { useStudioSession } from "../../studio-session.js";
import type { ThemeKind } from "../../themes/index.js";
import { Button, Dialog, StudioUiProvider } from "../ui/index.js";

export interface ExportDialogProps {
  locale: StudioLocale;
  colorScheme: ThemeKind;
  onClose: () => void;
}

export default function ExportDialog({ locale, colorScheme, onClose }: ExportDialogProps) {
  const session = useStudioSession();
  const { format, t } = useI18n();
  const [state, setState] = useState<"idle" | "exporting" | "success" | "error">("idle");
  const [result, setResult] = useState<ExportContextResponse>();
  const [error, setError] = useState<MessageDescriptor>();

  const run = async (): Promise<void> => {
    setState("exporting");
    setError(undefined);
    try {
      const response = await session.exportRevision();
      setResult(response);
      if (!response.ok) {
        setError(message("errors.exportRevisionUnavailable", {
          revision: response.requestedRevision,
          current: response.currentRevision
        }));
        setState("error");
        return;
      }
      setState("success");
    } catch (caught) {
      setError(messageFromError(caught, "errors.exportFailed"));
      setState("error");
    }
  };

  const actionLabel = state === "exporting"
    ? t("exportDialog.exporting")
    : state === "error"
      ? t("exportDialog.retry")
      : state === "success"
        ? t("exportDialog.again")
        : t("exportDialog.revision");

  return (
    <StudioUiProvider locale={locale} colorScheme={colorScheme} boundary="overlay">
      <Dialog
        isOpen
        title={t("exportDialog.title")}
        onDismiss={onClose}
        actions={(
          <>
            <Button variant="secondary" onPress={onClose}>{t("common.close")}</Button>
            <Button isPending={state === "exporting"} onPress={() => void run()}>{actionLabel}</Button>
          </>
        )}
      >
        <div className="export-dialog-content">
          <p>{t("exportDialog.description", { revision: session.revision })}</p>
          {state === "success" && result?.ok ? (
            <div className="export-result" role="status">
              <strong>{t("exportDialog.complete")}</strong>
              <code>{result.outputDirectory}</code>
              <span>{t("exportDialog.fileSummary", {
                count: Object.keys(result.manifest.files).length,
                hash: result.manifest.contentHash.slice(0, 12)
              })}</span>
            </div>
          ) : null}
          {state === "error" && error ? <div className="modal-error" role="alert">{format(error)}</div> : null}
        </div>
      </Dialog>
    </StudioUiProvider>
  );
}
