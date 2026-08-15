/**
 * The words this subsystem is allowed to use about a file.
 *
 * The single most dangerous sentence a document library can render is a
 * reassuring one about a file nobody checked. Antivirus scanning needs a
 * backend that does not exist yet, so *every* asset in this build is either
 * `unscanned` or carries a verdict a host injected. This module is where the
 * difference is kept honest:
 *
 *  - `isTreatedAsClean` returns true for exactly one state;
 *  - no label for a non-clean state contains a calming word;
 *  - the tone a badge gets never says "fine" for "unknown".
 *
 * Plain TypeScript on purpose: the same rules apply in a test, a story and a
 * component, and none of them should be able to disagree.
 */

import type { LifecycleState, ScanState, StorageBackendId, UploadPhase } from "./types";

/* ------------------------------------------------------------------ scan */

/**
 * The one state that means a scanner looked and found nothing.
 *
 * Written as an equality against a single literal rather than a "not infected"
 * test, because the negative form silently absorbs every state added later -
 * including the next one that means "we do not know".
 */
export function isTreatedAsClean(state: ScanState): boolean {
  return state === "clean";
}

/** True when a verdict exists at all, clean or not. */
export function hasScanVerdict(state: ScanState): boolean {
  return state === "clean" || state === "infected";
}

const SCAN_LABELS: Record<ScanState, string> = {
  unscanned: "Taranmadı",
  pending: "Tarama sırada",
  clean: "Temiz",
  infected: "Zararlı bulundu",
  failed: "Tarama başarısız",
  unavailable: "Tarayıcı yanıt vermedi",
};

export function scanStateLabel(state: ScanState): string {
  return SCAN_LABELS[state];
}

const SCAN_EXPLANATIONS: Record<ScanState, string> = {
  unscanned: "Bu dosya hiç taranmadı. Tarayıcı ucu yok; içeriği hakkında bir iddiada bulunulmuyor.",
  pending: "Tarama kuyruğa alındı ve henüz sonuçlanmadı.",
  clean: "Tarayıcı dosyayı inceledi ve zararlı içerik bildirmedi.",
  infected: "Tarayıcı zararlı içerik bildirdi. Dosya karantinada; indirme kapalı.",
  failed: "Tarama denendi ve tamamlanamadı. Sonuç bilinmiyor.",
  unavailable: "Tarayıcıya ulaşılamadı. Sonuç bilinmiyor.",
};

export function scanStateExplanation(state: ScanState): string {
  return SCAN_EXPLANATIONS[state];
}

/**
 * Badge tone, in the design system's existing vocabulary.
 *
 * Only a real clean verdict earns the affirmative tone. Everything unknown is
 * "warning", because neutral grey would read as "nothing to see here" and that
 * is precisely the message this product must not send about an unchecked file.
 *
 * The literals match `BadgeTone` in the primitives, but the type is not
 * imported: this module stays free of anything React-shaped so the same rules
 * can be asserted in a plain unit test.
 */
export function scanStateTone(state: ScanState): "candidate" | "ineligible" | "warning" {
  if (state === "clean") return "candidate";
  if (state === "infected") return "ineligible";
  return "warning";
}

/** Downloading is refused only for a positive infection verdict. */
export function isDownloadBlocked(state: ScanState): boolean {
  return state === "infected";
}

/* ------------------------------------------------------------- lifecycle */

const LIFECYCLE_LABELS: Record<LifecycleState, string> = {
  active: "Etkin",
  trashed: "Çöp kutusunda",
  "purge-pending": "Kalıcı silme sırasında",
};

export function lifecycleLabel(state: LifecycleState): string {
  return LIFECYCLE_LABELS[state];
}

/* ----------------------------------------------------------------- queue */

const PHASE_LABELS: Record<UploadPhase, string> = {
  queued: "Sırada",
  validating: "Doğrulanıyor",
  uploading: "Yükleniyor",
  paused: "Duraklatıldı",
  failed: "Başarısız",
  completed: "Tamamlandı",
  cancelled: "İptal edildi",
};

export function uploadPhaseLabel(phase: UploadPhase): string {
  return PHASE_LABELS[phase];
}

/* --------------------------------------------------------------- storage */

const BACKEND_LABELS: Record<StorageBackendId, string> = {
  local: "Yerel disk",
  s3: "S3 uyumlu depolama",
};

export function storageBackendLabel(id: StorageBackendId): string {
  return BACKEND_LABELS[id];
}

/** Byte formatting in Turkish, binary units, no invented precision. */
export function formatBytes(bytes: number | null): string {
  if (bytes === null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KiB", "MiB", "GiB", "TiB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} ${units[unit]}`;
}
