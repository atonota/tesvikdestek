import type { Decorator, Preview } from "@storybook/react-vite";
import { createMemoryRouter, RouterProvider } from "react-router";

// Bundled Roboto, same two faces as the application entry: a story that renders
// in a different typeface is not a story of the real component.
import "../src/design/roboto.css";

// Tailwind first, for the reason `main.tsx` records: it establishes the layer
// order that lets a utility beat a `.dt-*` component rule. A Storybook that
// loads these sheets in a different order is not showing the real component.
import "../src/design/tailwind.css";

import "../src/design/tokens.css";
import "../src/design/base.css";
import "../src/design/components.css";
// The grid stylesheet was missing here, so grid-backed stories rendered
// unstyled in Storybook while looking correct in the app. The W2 clean-room
// file library and provider center packages import their own stylesheets
// directly, so this file no longer needs `media.css` or
// `provider-connections.css` — both were deleted with the rejected visual
// implementation.
import "../src/design/data-grid.css";
import "../src/design/adaptive.css";

/**
 * Every story renders inside a router: several components link, and a story
 * that cannot link is not a story of the real component.
 */
const withRouter: Decorator = (Story) => {
  const router = createMemoryRouter([{ path: "*", element: <Story /> }], {
    initialEntries: ["/"],
  });
  return <RouterProvider router={router} />;
};

/** Density and theme are product-level switches, so they are story globals. */
const withAppearance: Decorator = (Story, context) => {
  const density = (context.globals["density"] as string) ?? "comfortable";
  const theme = (context.globals["theme"] as string) ?? "light";
  document.documentElement.dataset["density"] = density;
  document.documentElement.dataset["theme"] = theme;
  return (
    <div style={{ padding: "1rem", background: "var(--dt-color-bg)", minHeight: "100vh" }}>
      <Story />
    </div>
  );
};

const preview: Preview = {
  parameters: {
    controls: { expanded: true },
    a11y: { test: "error" },
  },
  globalTypes: {
    density: {
      description: "Satır yoğunluğu",
      defaultValue: "comfortable",
      toolbar: {
        title: "Yoğunluk",
        items: ["comfortable", "compact", "dense"],
      },
    },
    theme: {
      description: "Renk teması",
      defaultValue: "light",
      toolbar: { title: "Tema", items: ["light", "dark"] },
    },
  },
  decorators: [withAppearance, withRouter],
};

export default preview;
