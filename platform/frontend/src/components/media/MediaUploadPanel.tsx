/**
 * Upload intake: drag-and-drop, a real file picker, and the queue.
 *
 * The rule this component exists to enforce: **no transport, no controls.**
 * Without an `onUpload` callback nothing can carry a byte anywhere, so the
 * picker renders disabled and says why. An uploader that accepts a file and
 * paints a progress bar with no endpoint behind it produces the single most
 * damaging bug class in a document product - the user believes the file is
 * filed, and it is nowhere.
 *
 * Drag-and-drop is an enhancement layered on top of the input, never a
 * replacement for it: a drop zone alone is unusable by keyboard and invisible
 * to a screen reader.
 *
 * The `File` objects themselves never leave this component's event handler.
 * They are converted to queue metadata immediately and handed to the caller's
 * transport; nothing durable and nothing raw is retained.
 */

import { useCallback, useId, useState } from "react";

import { cn } from "@/lib/cn";
import { formatBytes, uploadPhaseLabel } from "./vocabulary";
import { Badge, Button } from "../primitives";
import { isRetryable, summariseQueue, uploadOutcomeMessage } from "./upload-machine";
import type { MediaCapabilities, UploadItem, UploadOutcome } from "./types";

export interface MediaUploadPanelProps {
  readonly capabilities: MediaCapabilities;
  readonly items: readonly UploadItem[];
  /**
   * The transport. Its absence is meaningful: the panel refuses to offer
   * uploading at all rather than pretending.
   */
  readonly onUpload?: (files: readonly { name: string; size: number; type: string }[]) => void;
  readonly onRetry?: (id: string) => void;
  readonly onCancel?: (id: string) => void;
  readonly onPause?: (id: string) => void;
  readonly onResume?: (id: string) => void;
  readonly accept?: string;
  readonly className?: string;
}

function outcomeNote(outcome: UploadOutcome): string | null {
  return outcome === null ? null : uploadOutcomeMessage(outcome);
}

/**
 * States: no-transport (disabled) · no-permission · idle · dragging · queued ·
 * uploading · paused · failed · completed · cancelled.
 */
export function MediaUploadPanel({
  capabilities,
  items,
  onUpload,
  onRetry,
  onCancel,
  onPause,
  onResume,
  accept,
  className,
}: MediaUploadPanelProps) {
  const inputId = useId();
  const [dragging, setDragging] = useState(false);

  const canTransport = typeof onUpload === "function";
  const permitted = capabilities.permissions.canUpload;
  const disabled = !canTransport || !permitted;
  const summary = summariseQueue(items);

  const handOff = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || !onUpload) return;
      // Metadata only. The File objects stay in this closure and are not stored.
      onUpload(
        Array.from(fileList).map((file) => ({
          name: file.name,
          size: file.size,
          type: file.type,
        })),
      );
    },
    [onUpload],
  );

  const blockedReason = !canTransport
    ? "Yükleme ucu yok: bu ekrana bir taşıma geri çağrısı verilmedi, dolayısıyla hiçbir dosya hiçbir yere gönderilemez."
    : !permitted
      ? "Bu oturumda dosya yükleme yetkisi tanımlı değil."
      : null;

  return (
    <section className={cn("dt-media-upload", className)} aria-label="Dosya yükleme">
      <div
        className={cn(
          "dt-media-upload__zone",
          dragging && "is-dragging",
          disabled && "is-disabled",
        )}
        onDragOver={(event) => {
          if (disabled) return;
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          if (disabled) return;
          event.preventDefault();
          setDragging(false);
          handOff(event.dataTransfer.files);
        }}
      >
        <p className="dt-media-upload__hint">
          Dosyaları buraya sürükleyin ya da seçin. Sürükle-bırak yalnızca kolaylıktır; her işlem
          klavyeyle de yapılabilir.
        </p>

        {/* One control, not two.
            The input *is* the picker: it is focusable, it is announced as a
            file-select button, and Enter or Space opens the dialog. An extra
            styled button duplicating it would create a second tab stop with the
            same accessible name, which reads to a screen-reader user as two
            different ways to do two different things. The label supplies the
            visible affordance and the accessible name together. */}
        <label className="dt-media-upload__label" htmlFor={inputId}>
          Dosya seç
        </label>
        <input
          id={inputId}
          type="file"
          multiple
          className="dt-media-upload__input"
          disabled={disabled}
          {...(accept ? { accept } : {})}
          {...(blockedReason ? { "aria-describedby": `${inputId}-blocked` } : {})}
          onChange={(event) => {
            handOff(event.target.files);
            event.target.value = "";
          }}
        />

        {blockedReason ? (
          <p id={`${inputId}-blocked`} className="dt-media-upload__blocked">
            {blockedReason}
          </p>
        ) : null}
      </div>

      <p className="dt-visually-hidden" role="status" aria-live="polite">
        {summary.total === 0
          ? "Kuyruk boş."
          : `Kuyrukta ${summary.total} dosya: ${summary.active} işlemde, ${summary.completed} tamamlandı, ${summary.failed} başarısız.`}
      </p>

      {items.length > 0 ? (
        <ul className="dt-media-upload__queue" aria-label="Yükleme kuyruğu">
          {items.map((item) => {
            const note = outcomeNote(item.outcome);
            return (
              <li key={item.id} className="dt-media-upload__item">
                <div className="dt-media-upload__item-head">
                  <span className="dt-media-upload__file">{item.fileName}</span>
                  <Badge tone={item.phase === "completed" ? "candidate" : item.phase === "failed" ? "ineligible" : "neutral"}>
                    {uploadPhaseLabel(item.phase)}
                  </Badge>
                  <span className="dt-muted">{formatBytes(item.sizeBytes)}</span>
                </div>

                {item.phase === "uploading" || item.phase === "paused" ? (
                  <progress
                    className="dt-media-upload__progress"
                    max={100}
                    value={item.progress}
                    aria-label={`${item.fileName} yükleme ilerlemesi`}
                  >
                    {item.progress}%
                  </progress>
                ) : null}

                {note ? <p className="dt-media-upload__note">{note}</p> : null}
                {item.error && !note ? <p className="dt-media-upload__note">{item.error}</p> : null}
                {item.attempts > 0 ? (
                  <p className="dt-muted">Yeniden deneme: {item.attempts}</p>
                ) : null}

                <div className="dt-media-upload__item-actions">
                  {item.phase === "uploading" && onPause ? (
                    <Button size="sm" variant="ghost" onClick={() => onPause(item.id)}>
                      Duraklat
                    </Button>
                  ) : null}
                  {item.phase === "paused" && onResume ? (
                    <Button size="sm" variant="ghost" onClick={() => onResume(item.id)}>
                      Sürdür
                    </Button>
                  ) : null}
                  {isRetryable(item) && onRetry ? (
                    <Button size="sm" variant="ghost" onClick={() => onRetry(item.id)}>
                      Tekrar dene
                    </Button>
                  ) : null}
                  {item.phase !== "completed" && item.phase !== "cancelled" && onCancel ? (
                    <Button size="sm" variant="ghost" onClick={() => onCancel(item.id)}>
                      İptal
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
