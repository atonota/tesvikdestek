/**
 * `/dosyalar` - the file and media library.
 *
 * This route exists because a finished capability that only Storybook can reach
 * is not a capability the product has. The media subsystem - the library
 * workbench, the accessible picker, the queue machine, the folder tree, the
 * scan vocabulary, the storage panel - was complete and covered, and no user
 * could open any of it. Mounting it is the point of this file.
 *
 * **What makes mounting it honest.** There is no media backend in this
 * repository: no `media_assets` table, no upload endpoint, no storage adapter,
 * no scanner. So this route does not claim files work. It claims something
 * narrower and true - *here is the library, here is precisely what it cannot do
 * today, and here is the reason for each one* - and it is built so that the
 * claim cannot drift:
 *
 *   - No transport callback is passed to `MediaUploadPanel`. That is not an
 *     omission; it is the mechanism. Without one the picker renders disabled
 *     and prints the reason, because an uploader that accepts a file with no
 *     endpoint behind it is the single most damaging bug a document product can
 *     ship: the user believes the file is filed, and it is nowhere.
 *   - `LOCAL_ONLY_CAPABILITIES` is injected verbatim. Every permission in it is
 *     false and every server-side feature is off, which is the truth about a
 *     deployment with no authorisation system and no media service.
 *   - The asset list is genuinely empty and the storage figures are genuinely
 *     `null`. A browser cannot see a disk, so a capacity number computed here
 *     would be invented; `null` renders as an em dash rather than a confident
 *     zero, and there is no seeded row anywhere on this screen.
 *
 * **Nothing from the test tree is imported.** `src/test/media-fixtures.ts`
 * exists and would make this page look magnificent. It is exactly what must
 * never appear in a runtime module, and `media-route.test.tsx` fails if it
 * ever does.
 *
 * **The stylesheet is imported here and nowhere else - and the stylesheet is
 * the only half that is lazy.** `main.tsx` used to load `media.css` globally
 * while no route rendered a media component, so every user downloaded rules
 * nothing could apply; it was then removed entirely. Now that a route does
 * render them, the import belongs to that route: this module is only ever
 * reached through the router's dynamic `import()`, so the bundler emits the
 * media rules as this chunk's own stylesheet and a visitor who never opens
 * `/dosyalar` never downloads them.
 *
 * The JavaScript is a different story and this file does not claim otherwise.
 * `src/components/index.ts` re-exports `./media`, and every route imports that
 * barrel, so the media components travel in the shared component chunk whether
 * or not anybody opens this route. Restructuring that barrel is not this
 * route's business; stating the cost accurately is. The provider connection
 * centre is the subsystem that shows what avoiding the barrel buys - both its
 * code and its rules stay out of the eager graph - and
 * `build-contract.test.ts` measures each of these claims against the built
 * artifact rather than taking this comment's word for it.
 */

import {
  LOCAL_ONLY_CAPABILITIES,
  MediaLibrary,
  MediaOrganizer,
  MediaStoragePanel,
  MediaUploadPanel,
  blockedMediaCapabilities,
  type StorageStatus,
} from "@/components/media";
import { Card, DisclaimerBlock } from "@/components";

import "@/design/media.css";

import { Shell } from "./app";

/**
 * What this deployment can say about its own storage: the target, and nothing
 * else.
 *
 * `local` is not a guess - it is the declared default and the only target
 * `LOCAL_ONLY_CAPABILITIES` admits. Every other field is `null` because no
 * endpoint reports it. A quota of zero, a usage of zero and a file count of
 * zero would each be a measurement, and there was no measurement.
 */
const UNMEASURED_STORAGE: StorageStatus = {
  backend: "local",
  usedBytes: null,
  quotaBytes: null,
  assetCount: null,
  lastCheckedAt: null,
};

/**
 * The blocked half of the media ledger, on the screen it is about.
 *
 * The capability matrix at `/yetenekler` already carries the product-wide
 * picture. This is the subsystem's own ledger rendered where somebody is
 * actually trying to upload a file, because "why is this button grey" is a
 * question asked here and answered two clicks away.
 */
function BlockedCapabilityLedger() {
  const blocked = blockedMediaCapabilities();
  return (
    <section aria-label="Sunucu gerektiren yetenekler">
      <Card title="Bugün yapılamayanlar" headingLevel={2}>
        <p className="dt-muted">
          Aşağıdaki {blocked.length} yetenek arayüz tarafında hazırdır ve sunucu tarafında yoktur.
          Hiçbiri taklit edilmez: ilgili kontroller kapalı gösterilir ve gerekçesi yazılır.
        </p>
        <ul className="dt-list">
          {blocked.map((capability) => (
            <li key={capability.id}>
              <strong>{capability.title}</strong>
              <p className="dt-muted">{capability.reason}</p>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}

export function MediaRoute() {
  return (
    <Shell title="Dosyalar">
      <div className="dt-stack">
        <h1>Dosya kütüphanesi</h1>
        <p className="dt-lede">
          Kütüphane, arama, süzgeç, sıralama ve görünüm denetimleri gerçektir ve bu ekrana verilen
          satırlar üzerinde çalışır. Bugün verilen satır sayısı sıfırdır, çünkü dosyaları saklayacak
          bir sunucu ucu yoktur. Yükleme, indirme, tarama ve kalıcı üstveri bu yüzden kapalıdır.
        </p>

        <MediaStoragePanel storage={UNMEASURED_STORAGE} capabilities={LOCAL_ONLY_CAPABILITIES} />

        {/*
          * No `onUpload`, deliberately.
          *
          * The panel treats an absent transport as a refusal to offer uploading
          * at all, which is the only correct behaviour when nothing can carry a
          * byte anywhere. Passing a no-op callback here to "make the button
          * work" would turn a disabled control with a reason into an enabled
          * control that silently discards the user's file.
          */}
        <MediaUploadPanel capabilities={LOCAL_ONLY_CAPABILITIES} items={[]} />

        <MediaLibrary assets={[]} capabilities={LOCAL_ONLY_CAPABILITIES} />

        {/*
          * Folders and metadata, mounted with nothing in them.
          *
          * `MediaOrganizer` - and the `FolderTree` it owns - was the last
          * finished part of this subsystem that only Storybook could reach, and
          * the reason it stayed there was never the tree: it was the temptation
          * to hand it a folder so it would look like something. So it is given
          * exactly what this deployment has, which is no folders, and it renders
          * the tree's own empty state rather than a fabricated hierarchy.
          *
          * No `draft` and no `onDraftChange`, for the same reason `MediaUploadPanel`
          * gets no `onUpload`: `LOCAL_ONLY_CAPABILITIES` blocks both metadata
          * editing and durable metadata, so the panel refuses the editor and
          * prints why. An editor whose writes evaporate on refresh is the
          * document-product version of an upload that goes nowhere.
          */}
        <MediaOrganizer folders={[]} capabilities={LOCAL_ONLY_CAPABILITIES} />

        <BlockedCapabilityLedger />

        <DisclaimerBlock variant="compact" />
      </div>
    </Shell>
  );
}
