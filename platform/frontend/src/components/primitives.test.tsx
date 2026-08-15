import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it, vi } from "vitest";

import {
  Badge,
  Button,
  Checkbox,
  FieldError,
  IconButton,
  Input,
  Label,
  Link,
  NumberInput,
  RadioGroup,
  Switch,
  Textarea,
  TristateSelect,
  VisuallyHidden,
} from "./primitives";
import { TRISTATE_UNKNOWN } from "@/domain/tristate";

function renderWithRouter(element: React.ReactElement) {
  const router = createMemoryRouter([{ path: "/", element }], { initialEntries: ["/"] });
  return render(<RouterProvider router={router} />);
}

describe("Button", () => {
  it("renders each variant as a real button", () => {
    for (const variant of ["primary", "secondary", "ghost", "danger"] as const) {
      const { unmount } = render(<Button variant={variant}>Kaydet</Button>);
      expect(screen.getByRole("button", { name: "Kaydet" })).toBeEnabled();
      unmount();
    }
  });

  it("blocks clicks and announces itself while loading", async () => {
    const onClick = vi.fn();
    render(
      <Button loading loadingLabel="Gönderiliyor" onClick={onClick}>
        Kaydet
      </Button>,
    );
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toBeDisabled();
    await userEvent.click(button).catch(() => undefined);
    expect(onClick).not.toHaveBeenCalled();
    expect(screen.getByText(/gönderiliyor/i)).toBeInTheDocument();
  });

  it("is disabled when asked", () => {
    render(<Button disabled>Kaydet</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });
});

describe("IconButton", () => {
  it("always carries an accessible name", () => {
    render(<IconButton label="Menüyü aç" icon="☰" />);
    expect(screen.getByRole("button", { name: "Menüyü aç" })).toBeInTheDocument();
  });
});

describe("Input and NumberInput", () => {
  it("marks itself invalid for assistive technology", () => {
    render(<Input invalid aria-label="E-posta" />);
    expect(screen.getByLabelText("E-posta")).toHaveAttribute("aria-invalid", "true");
  });

  it("uses a numeric keyboard without letting the browser localise the value", () => {
    render(<NumberInput aria-label="Çalışan sayısı" suffix="kişi" defaultValue="8" />);
    const field = screen.getByLabelText("Çalışan sayısı");
    expect(field).toHaveAttribute("inputmode", "numeric");
    expect(field).toHaveAttribute("type", "text");
  });
});

/**
 * The tri-state control is the shared custom select now, not a native one, so
 * its options exist only while it is open and are chosen by clicking rather
 * than by `selectOptions`. The assertions are the same three claims: exactly
 * three choices, "Bilinmiyor" first, and the empty wire value for unknown.
 */
describe("TristateSelect", () => {
  it("offers exactly three options with Bilinmiyor first", async () => {
    render(
      <TristateSelect aria-label="KOBİ" value={TRISTATE_UNKNOWN} onValueChange={() => {}} />,
    );
    await userEvent.click(screen.getByRole("combobox", { name: "KOBİ" }));
    const options = within(await screen.findByRole("listbox")).getAllByRole("option");
    expect(options).toHaveLength(3);
    expect(options[0]).toHaveTextContent("Bilinmiyor");
  });

  it("shows the unanswered state as Bilinmiyor rather than as a placeholder", () => {
    render(
      <TristateSelect aria-label="KOBİ" value={TRISTATE_UNKNOWN} onValueChange={() => {}} />,
    );
    expect(screen.getByRole("combobox", { name: "KOBİ" })).toHaveTextContent("Bilinmiyor");
  });

  it("emits the empty wire value for unknown, never false", async () => {
    const onValueChange = vi.fn();
    render(<TristateSelect aria-label="KOBİ" value="true" onValueChange={onValueChange} />);
    await userEvent.click(screen.getByRole("combobox", { name: "KOBİ" }));
    await screen.findByRole("listbox");
    await userEvent.click(screen.getByRole("option", { name: "Bilinmiyor" }));

    await waitFor(() => expect(onValueChange).toHaveBeenCalledWith(""));
    expect(onValueChange).not.toHaveBeenCalledWith("false");
  });
});

describe("Textarea, Checkbox, RadioGroup, Switch", () => {
  it("renders a labelled textarea", () => {
    render(<Textarea aria-label="Not" />);
    expect(screen.getByLabelText("Not")).toBeInTheDocument();
  });

  it("associates a checkbox with its label and description", () => {
    render(<Checkbox label="Onaylıyorum" description="Bu bir kullanıcı kaydıdır." />);
    const box = screen.getByRole("checkbox", { name: "Onaylıyorum" });
    expect(box).toBeInTheDocument();
    expect(box).toHaveAccessibleDescription("Bu bir kullanıcı kaydıdır.");
  });

  it("groups radios under a legend and reports the selection", async () => {
    const onValueChange = vi.fn();
    render(
      <RadioGroup
        name="density"
        legend="Yoğunluk"
        value="comfortable"
        onValueChange={onValueChange}
        options={[
          { value: "comfortable", label: "Rahat" },
          { value: "dense", label: "Yoğun" },
        ]}
      />,
    );
    expect(screen.getByRole("group", { name: "Yoğunluk" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: "Yoğun" }));
    expect(onValueChange).toHaveBeenCalledWith("dense");
  });

  it("exposes a switch role and toggles", async () => {
    const onCheckedChange = vi.fn();
    render(
      <Switch checked={false} onCheckedChange={onCheckedChange} label="Hareketi azalt" />,
    );
    await userEvent.click(screen.getByRole("switch", { name: "Hareketi azalt" }));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });
});

describe("Label, FieldError, Badge, VisuallyHidden", () => {
  it("announces a required field without relying on the asterisk alone", () => {
    render(<Label required>E-posta</Label>);
    expect(screen.getByText("(zorunlu)")).toBeInTheDocument();
  });

  it("renders nothing when there is no error", () => {
    const { container } = render(<FieldError id="x" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("announces an error via role=alert", () => {
    render(<FieldError id="x">Parola çok kısa</FieldError>);
    expect(screen.getByRole("alert")).toHaveTextContent("Parola çok kısa");
  });

  it("keeps badge text readable without colour", () => {
    render(<Badge tone="conditional">Koşullu</Badge>);
    expect(screen.getByText("Koşullu")).toBeVisible();
  });

  it("adds screen-reader-only context to a badge", () => {
    render(<Badge srDescription="Çağrı penceresi yayımlanmamış">Bilinmiyor</Badge>);
    expect(screen.getByText(/çağrı penceresi yayımlanmamış/i)).toBeInTheDocument();
  });

  it("keeps visually hidden content in the accessibility tree", () => {
    render(<VisuallyHidden>Gizli başlık</VisuallyHidden>);
    expect(screen.getByText("Gizli başlık")).toBeInTheDocument();
  });
});

describe("Link", () => {
  it("routes internally", () => {
    renderWithRouter(<Link to="/programlar">Programlar</Link>);
    expect(screen.getByRole("link", { name: "Programlar" })).toHaveAttribute(
      "href",
      "/programlar",
    );
  });

  it("marks an external link and protects the opener", () => {
    render(
      <Link href="https://tubitak.gov.tr" external>
        Kaynak
      </Link>,
    );
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noreferrer"));
    expect(link).toHaveAttribute("target", "_blank");
    expect(screen.getByText(/yeni sekmede açılır/i)).toBeInTheDocument();
  });
});
