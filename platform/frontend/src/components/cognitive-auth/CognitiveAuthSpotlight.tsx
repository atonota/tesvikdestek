/**
 * The auth family's header — the actual `CognitiveSpotlightHeader` master
 * component, in its `"public"` variant, not a second header.
 *
 * Auth has no session, so there is no workspace drawer to open, no
 * notification stream and no signed-in account menu — `variant="public"`
 * drops exactly those three from the render and nothing else. What is not
 * dropped, and must not be, is the interaction the cognitive language is
 * named for: the same search control, in the same place in the header, grows
 * in place on a click or Cmd/Ctrl+K and shrinks back on Escape or its own
 * close button — never a separate overlay or dialog. This module owns only
 * the local open/query state and the auth-scoped result list; the header
 * markup itself is the one the signed-in workspace renders too, so a review
 * of either surface is a review of both.
 */

import { useMemo, useState } from "react";

import type { CockpitSearchItem } from "@/components/cognitive-cockpit";
import { CognitiveSpotlightHeader } from "@/components/cognitive-cockpit";
import { useContent } from "@/content";

export function CognitiveAuthSpotlight() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const brandTile = useContent("auth.header.brand_tile");
  const brandWord = useContent("auth.header.brand_word");
  const searchLabel = useContent("auth.header.search.label");
  const searchPlaceholder = useContent("auth.header.search.placeholder");
  const searchTrigger = useContent("auth.header.search.trigger");
  const searchClose = useContent("auth.header.search.close");
  const shortcut = useContent("auth.header.search.shortcut");
  const programsLabel = useContent("auth.search.programs.label");
  const howLabel = useContent("auth.search.how.label");
  const loginLabel = useContent("auth.search.login.label");
  const registerLabel = useContent("auth.search.register.label");

  const items: readonly CockpitSearchItem[] = useMemo(
    () => [
      { id: "programs", label: programsLabel, to: "/programlar" },
      { id: "how", label: howLabel, to: "/nasil-calisir" },
      { id: "login", label: loginLabel, to: "/giris" },
      { id: "register", label: registerLabel, to: "/kayit" },
    ],
    [howLabel, loginLabel, programsLabel, registerLabel],
  );

  const results = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("tr-TR");
    if (needle === "") return items;
    return items.filter((item) => item.label.toLocaleLowerCase("tr-TR").includes(needle));
  }, [items, query]);

  return (
    <CognitiveSpotlightHeader
      variant="public"
      open={open}
      onOpenChange={setOpen}
      query={query}
      onQueryChange={setQuery}
      results={results}
      content={{
        brandTile,
        brandWord,
        searchLabel,
        searchPlaceholder,
        searchTrigger,
        searchClose,
        shortcut,
      }}
    />
  );
}
