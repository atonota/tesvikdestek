/**
 * The cockpit's one scrim-and-blur owner.
 *
 * Every modal surface in this package — `NavigationSheet` today, any future
 * dialog — renders through Radix with no `Overlay` of its own. What sits
 * beneath an open layer (the page content, or a shallower modal layer) is
 * blurred and covered by a cool-grey scrim here, and only here, so a second
 * organism can never paint a second, slightly different overlay behind the
 * first.
 *
 * `page` and `nested` are the only two levels this cockpit needs today: a
 * layer opened directly over the page (the navigation sheet), and a layer
 * opened over an already-open layer (an account menu popped up from inside
 * the sheet, for instance). Both scrim colour and blur amount come from the
 * approved tokens below — a new modal type is a token, never a new branch
 * of markup here.
 */

import { useUiStore } from "@/store/ui";

export type ModalLayerLevel = "page" | "nested";

export interface ModalLayerHostProps {
  readonly activeLayers: readonly ModalLayerLevel[];
  /** Fired when the reader clicks a layer's scrim — normally closes it. */
  readonly onDismiss?: (layer: ModalLayerLevel) => void;
}

const LAYERS: readonly ModalLayerLevel[] = ["page", "nested"];

export function ModalLayerHost({ activeLayers, onDismiss }: ModalLayerHostProps) {
  const reducedMotion = useUiStore((store) => store.reducedMotion);

  return (
    <div className="modal-layer-host" data-reduced-motion={reducedMotion ? "true" : "false"}>
      {LAYERS.map((layer) => {
        const active = activeLayers.includes(layer);
        return (
          <div
            key={layer}
            className={`modal-layer-host__scrim modal-layer-host__scrim--${layer}`}
            data-layer={layer}
            data-active={active}
            aria-hidden="true"
            onClick={active ? () => onDismiss?.(layer) : undefined}
          />
        );
      })}
    </div>
  );
}
