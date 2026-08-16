/**
 * `/dosyalar` — the file library, clean-room.
 *
 * Moved out of the old `MediaRoute` so this address reaches only the clean
 * `CognitiveFileLibrary` master and its own foundation, never the rejected
 * visual component graph. This module is presentational data-plumbing only:
 * it owns the one honest read state and the retained capability/storage
 * truth, and hands both to `CognitiveFileLibrary` — the same master
 * Storybook renders.
 *
 * There is still no media backend in this repository: no table, no upload
 * endpoint, no storage adapter. `LOCAL_ONLY_CAPABILITIES` is injected
 * verbatim, the asset count is genuinely `0`, and the storage figures are
 * genuinely `null` — a browser cannot see a disk, so a measured figure here
 * would be invented.
 */

import { LOCAL_ONLY_CAPABILITIES, type StorageStatus } from "@/components/media";
import { CognitiveFileLibrary } from "@/components/cognitive-file-library";

const UNMEASURED_STORAGE: StorageStatus = {
  backend: "local",
  usedBytes: null,
  quotaBytes: null,
  assetCount: null,
  lastCheckedAt: null,
};

export function FilesRoute() {
  return (
    <CognitiveFileLibrary
      state="success"
      capabilities={LOCAL_ONLY_CAPABILITIES}
      storage={UNMEASURED_STORAGE}
      assetCount={0}
    />
  );
}
