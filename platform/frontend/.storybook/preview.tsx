import type { Decorator, Preview } from "@storybook/react-vite";
import { createMemoryRouter, RouterProvider } from "react-router";

// Bundled Roboto, same two faces as the application entry: a story that renders
// in a different typeface is not a story of the real component.
import "../src/design/roboto.css";

import "../src/design/tokens.css";
import "../src/design/base.css";
import "../src/design/components.css";
// The grid and media stylesheets were missing here, so grid-backed stories
// rendered unstyled in Storybook while looking correct in the app.
import "../src/design/data-grid.css";
import "../src/design/adaptive.css";
import "../src/design/media.css";
// The application does not need this line: `/ayarlar/yapay-zeka` loads
// `provider-connections.css` through its own lazy route module. Storybook has
// no application route modules, so the sheet is imported globally here, which
// is what lets the provider subsystem's stories render under production rules.
// This import describes Storybook only and claims nothing about the
// application's eager bundle - build-contract owns that measured claim.
import "../src/design/provider-connections.css";

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
