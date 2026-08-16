import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CognitiveSpotlightHeader } from "@/components/cognitive-cockpit/CognitiveSpotlightHeader";
import { Sheet } from "@/foundation";

describe("W3A cognitive Spotlight persistence", () => {
  it("keeps one input DOM node while expanding in place", () => {
    const onOpenChange = vi.fn();
    const props = {
      query: "",
      onQueryChange: () => undefined,
      results: [],
      notificationCount: 0,
      accountMenu: <button type="button">Hesap</button>,
    } as const;

    const { rerender } = render(
      <Sheet open={false} onOpenChange={() => undefined}>
        <CognitiveSpotlightHeader
          {...props}
          open={false}
          onOpenChange={onOpenChange}
        />
      </Sheet>,
    );
    const inputBefore = screen.getByRole("textbox", { name: /ara|komut|spotlight/iu });
    inputBefore.focus();
    expect(onOpenChange).toHaveBeenCalledWith(true);

    rerender(
      <Sheet open={false} onOpenChange={() => undefined}>
        <CognitiveSpotlightHeader
          {...props}
          open
          onOpenChange={onOpenChange}
        />
      </Sheet>,
    );

    expect(screen.getByRole("textbox", { name: /ara|komut|spotlight/iu })).toBe(inputBefore);
    expect(inputBefore).toHaveFocus();
  });
});
