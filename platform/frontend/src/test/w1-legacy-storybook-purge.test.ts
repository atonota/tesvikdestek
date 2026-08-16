import { readdirSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

const srcRoot = join(process.cwd(), "src");

function storyFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return storyFiles(path);
    return /\.stories\.(?:[jt]sx?)$/.test(entry.name)
      ? [relative(process.cwd(), path)]
      : [];
  });
}

describe("W1 legacy Storybook purge", () => {
  it("keeps only clean-room master stories", () => {
    expect(storyFiles(srcRoot).sort()).toEqual([
      "src/components/cognitive-cockpit/cognitive-cockpit.stories.tsx",
      "src/components/cognitive-file-library/cognitive-file-library.stories.tsx",
      "src/components/cognitive-provider-center/cognitive-provider-center.stories.tsx",
    ]);
  });
});
