# Curated source snapshots and programme catalogue

## What a snapshot file in this directory is — and is not

Each `source_snapshots/<id>.txt` file is a **curated extract**: a human-readable summary, in
Turkish, of the conditions an official page publishes, together with that page's URL and the
date the extract was written.

**It is not an automated capture of the live page.** This change package deliberately does not
run a crawler (see unknown-unknowns #11), and no live fetch was performed while writing these
files. Treating a curated extract as if it were a verified capture is exactly the kind of
false confidence this product exists to avoid.

Accordingly:

- `content_hash` is the SHA-256 of **this file's bytes**, computed by the loader at load time.
  It is therefore always true, always verifiable, and never a fabricated constant. It proves
  "which text this system reasoned over", not "what the official page said that day".
- `review_status` is `pending_review` for every snapshot here. None of them has been verified
  by a domain expert. Promoting one to `verified` is a human act, not a code change.
- `effective_from`, `effective_to` and the call window are `null` wherever the official page
  does not publish them. They are never guessed. A null call window makes every decision that
  depends on it `conditional` — which is the correct answer, not a limitation.
- No published reference amount is recorded. The official pages carry rates and ceilings, but
  none was read during this package, so writing one down would be an invention. The UI says so
  in plain Turkish.

## Refresh path

Refreshing a snapshot means: read the official page, rewrite the extract, update `captured_at`
in the programme JSON, and have a domain expert set `review_status`. Old decisions are **never**
rewritten by a refresh; they are flagged `review_required` instead.

## Files

| Snapshot id | Official source |
|---|---|
| `snap-tubitak-1501-2026-08-14` | https://tubitak.gov.tr/tr/destekler/sanayi/ulusal-destek-programlari/1501-tubitak-sanayi-ar-ge-projeleri-destekleme-programi |
| `snap-tubitak-1507-2026-08-14` | https://tubitak.gov.tr/tr/destekler/sanayi/ulusal-destek-programlari/1507-tubitak-kobi-ar-ge-baslangic-destek-programi |
| `snap-kosgeb-girisimci-2026-08-14` | https://kosgeb.gov.tr/site/tr/genel/destekdetay/1231/girisimci-destek-programi |
