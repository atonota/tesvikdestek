/**
 * The cockpit's one bordered header: brand, hamburger, Spotlight, notifications, account.
 *
 * The search box is not a dialog. It is the same control, in the same place in
 * the header, that grows in place when it opens — by a click or by Cmd/Ctrl+K —
 * and shrinks back when it closes. A separate overlay would move the reader's
 * eye away from where they just were; this keeps it under their cursor.
 */

import { useEffect, useId, useRef, type ReactNode } from "react";

import { Badge, FoundationIcon, Link, SheetTrigger } from "@/foundation";
import { useContent } from "@/content";

export interface CockpitSearchItem {
  readonly id: string;
  readonly label: string;
  readonly hint?: string;
  readonly to: string;
}

export interface CognitiveSpotlightHeaderProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly query: string;
  readonly onQueryChange: (value: string) => void;
  readonly results: readonly CockpitSearchItem[];
  readonly notificationCount?: number;
  readonly accountMenu: ReactNode;
}

export function CognitiveSpotlightHeader({
  open,
  onOpenChange,
  query,
  onQueryChange,
  results,
  notificationCount = 0,
  accountMenu,
}: CognitiveSpotlightHeaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  const menuOpenLabel = useContent("cockpit.header.menu.open");
  const brandTile = useContent("cockpit.header.brand.tile");
  const brandWord = useContent("cockpit.header.brand.word");
  const searchPlaceholder = useContent("cockpit.header.search.placeholder");
  const searchLabel = useContent("cockpit.header.search.label");
  const searchClose = useContent("cockpit.header.search.close");
  const searchNoResult = useContent("cockpit.header.search.no_result");
  const searchTrigger = useContent("cockpit.header.search.trigger");
  const notificationsLabel = useContent("cockpit.header.notifications.label");
  const notificationsLabelWithCount = useContent("cockpit.header.notifications.label_with_count", {
    values: { count: String(notificationCount) },
  });
  const hintSeparator = useContent("cockpit.header.search.hint_separator");
  const shortcut = useContent("cockpit.header.search.shortcut");

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenChange(true);
      } else if (event.key.toLowerCase() === "escape" && open) {
        onOpenChange(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onOpenChange, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  return (
    <header className="cognitive-spotlight" data-open={open}>
      <SheetTrigger asChild>
        <button type="button" className="cognitive-spotlight__hamburger" aria-label={menuOpenLabel}>
          <FoundationIcon name="menu" />
        </button>
      </SheetTrigger>

      <span className="cognitive-spotlight__brand">
        <span className="cognitive-spotlight__brand-tile" aria-hidden="true">
          {brandTile}
        </span>
        <span className="cognitive-spotlight__brand-word">{brandWord}</span>
      </span>

      <div className="cognitive-spotlight__search" data-open={open}>
        <div className="cognitive-spotlight__panel" data-open={open} role="search">
          <FoundationIcon name="search" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onFocus={() => {
              if (!open) onOpenChange(true);
            }}
            onClick={() => {
              if (!open) onOpenChange(true);
            }}
            placeholder={open ? searchPlaceholder : searchTrigger}
            aria-label={searchLabel}
            aria-controls={listboxId}
          />
          {open ? (
            <button
              type="button"
              className="cognitive-spotlight__close"
              onClick={() => {
                onOpenChange(false);
                onQueryChange("");
              }}
              aria-label={searchClose}
            >
              <FoundationIcon name="close" />
            </button>
          ) : (
            <kbd>{shortcut}</kbd>
          )}
          {open && query.trim() !== "" ? (
            <ul id={listboxId} className="cognitive-spotlight__results">
              {results.length === 0 ? (
                <li className="cognitive-spotlight__no-result">{searchNoResult}</li>
              ) : (
                results.map((item) => (
                  <li key={item.id}>
                    <Link to={item.to} onClick={() => onOpenChange(false)}>
                      {item.label}
                      {item.hint ? (
                        <span className="fd-muted">
                          {hintSeparator}
                          {item.hint}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                ))
              )}
            </ul>
          ) : null}
        </div>
      </div>

      <button
        type="button"
        className="cognitive-spotlight__notifications"
        aria-label={notificationCount > 0 ? notificationsLabelWithCount : notificationsLabel}
      >
        <FoundationIcon name="notifications" />
        {notificationCount > 0 ? (
          <Badge className="cognitive-spotlight__notifications-badge">{notificationCount}</Badge>
        ) : null}
      </button>

      {accountMenu}
    </header>
  );
}
