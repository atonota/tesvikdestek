/**
 * The connection inventory.
 *
 * A thin arrangement over the accepted DataGrid, which is the point: the grid
 * already knows how to be a table on a desktop, a card list at 320px, keyboard
 * operable, sortable with `aria-sort`, and honest about the fact that it only
 * ever sees the rows it was handed.
 *
 * The scope line above the table restates that in words, because the grid's
 * live region announces it once and a person reading the table an hour later
 * will not have heard it. There is no "select every matching record" control
 * anywhere in this surface: this client has never seen the server's full set
 * and cannot say how large it is, so any control implying otherwise would be
 * writing a cheque the client cannot cash.
 */

import { cn } from "@/lib/cn";
import { DataGrid } from "../data-grid/DataGrid";
import type { GridStatus } from "../data-grid/types";
import { PartialDataNotice } from "../patterns";
import { providerConnectionsGridConfig, type ProviderGridActions } from "./configs";
import type {
  ProviderConnection,
  ProviderConnectionCapabilities,
  ProviderConnectionPort,
} from "./types";

export interface ConnectionInventoryProps {
  readonly connections: readonly ProviderConnection[];
  readonly capabilities: ProviderConnectionCapabilities;
  readonly port?: ProviderConnectionPort;
  readonly actions?: ProviderGridActions;
  readonly status?: GridStatus;
  readonly errorMessage?: string;
  readonly onRefresh?: () => void;
  readonly now?: Date;
  readonly className?: string;
}

/** States: idle · loading · refreshing · error · empty · no-results. */
export function ConnectionInventory({
  connections,
  capabilities,
  port = {},
  actions = {},
  status = "idle",
  errorMessage,
  onRefresh,
  now = new Date(),
  className,
}: ConnectionInventoryProps) {
  const config = providerConnectionsGridConfig(capabilities, now, port, actions);

  return (
    <section className={cn("dt-provider-inventory", className)} aria-label="Bağlantı envanteri">
      <p className="dt-muted">
        Bu tablo yalnızca bu oturumda yüklenmiş {connections.length} bağlantıyı gösterir. Arama,
        filtre, sıralama ve toplu eylemler bu satırların dışına çıkmaz.
      </p>

      <DataGrid
        config={config}
        rows={connections}
        status={status}
        {...(errorMessage ? { errorMessage } : {})}
        {...(onRefresh ? { onRefresh } : {})}
      />

      <PartialDataNotice
        what="Sunucu genelinde bir seçim ya da eylem sunulmuyor."
        because="Bu istemci sunucudaki bağlantıların tamamını hiç görmedi; sayısını da bilemez. Yüklenmemiş bir satır üzerinde işlem vaat eden bir düğme, tutulamayacak bir söz olurdu."
      />
    </section>
  );
}
