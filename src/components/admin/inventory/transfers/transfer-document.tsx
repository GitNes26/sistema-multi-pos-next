"use client"

import type { TransferDetail } from "@/lib/inventory/transfers-client"
import { TRANSFER_STATUS_LABELS } from "@/lib/inventory/transfers-client"

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("es-MX", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"

/** Formato de la solicitud de traslado: se imprime en carta y se firma al entregar y recibir. */
export function TransferDocument({ t }: { t: TransferDetail }) {
  const units = t.items.reduce((s, i) => s + i.quantity, 0)
  const received = t.status === "received"
  const requestedAt = t.timeline.find((e) => e.key === "requested")?.at ?? null
  const dispatchedAt = t.timeline.find((e) => e.key === "dispatched")?.at ?? null
  const receivedAt = t.timeline.find((e) => e.key === "received")?.at ?? null

  return (
    <article id="transfer-doc-print" className="mx-auto w-full max-w-3xl space-y-5 rounded-lg border bg-white p-6 text-sm text-black">
      <header className="flex items-start justify-between gap-4 border-b border-black/20 pb-3">
        <div>
          <p className="text-xs font-semibold tracking-widest uppercase text-black/60">Solicitud de traslado</p>
          <h2 className="font-mono text-2xl font-bold">{t.folio}</h2>
        </div>
        <dl className="text-right text-xs">
          <div><dt className="inline text-black/60">Estado: </dt><dd className="inline font-semibold">{TRANSFER_STATUS_LABELS[t.status]}</dd></div>
          <div><dt className="inline text-black/60">Solicitado: </dt><dd className="inline">{when(requestedAt)}</dd></div>
          {t.requestedBy && <div><dt className="inline text-black/60">Por: </dt><dd className="inline">{t.requestedBy}</dd></div>}
          {t.expectedAt && <div><dt className="inline text-black/60">Llegada estimada: </dt><dd className="inline">{when(t.expectedAt)}</dd></div>}
        </dl>
      </header>

      <section className="grid grid-cols-2 gap-4">
        <div className="rounded border border-black/20 p-3">
          <p className="text-xs font-semibold uppercase text-black/60">Origen · {t.from.type === "cedis" ? "CEDIS" : "Sucursal"}</p>
          <p className="font-semibold">{t.from.name}</p>
          {t.from.address && <p className="text-xs text-black/70">{t.from.address}</p>}
        </div>
        <div className="rounded border border-black/20 p-3">
          <p className="text-xs font-semibold uppercase text-black/60">Destino · {t.to.type === "cedis" ? "CEDIS" : "Sucursal"}</p>
          <p className="font-semibold">{t.to.name}</p>
          {t.to.address && <p className="text-xs text-black/70">{t.to.address}</p>}
        </div>
      </section>

      <table className="w-full border-collapse">
        <thead>
          <tr className="border-y border-black/40 text-left text-xs uppercase">
            <th className="w-10 py-1.5">#</th>
            <th className="py-1.5">Producto</th>
            <th className="py-1.5 text-right">Enviado</th>
            <th className="w-28 py-1.5 text-right">Recibido</th>
          </tr>
        </thead>
        <tbody>
          {t.items.map((i, n) => (
            <tr key={i.id} className="border-b border-black/10">
              <td className="py-1.5 tabular-nums">{n + 1}</td>
              <td className="py-1.5">
                {i.productName}
                {i.variantName && i.variantName !== "Default" ? ` · ${i.variantName}` : ""}
                {i.receiveNote && <span className="block text-xs text-black/60">{i.receiveNote}</span>}
              </td>
              <td className="py-1.5 text-right tabular-nums">{i.quantity} {i.unit ?? "pza"}</td>
              <td className="py-1.5 text-right tabular-nums">{i.receivedQty != null ? `${i.receivedQty} ${i.unit ?? "pza"}` : "______"}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-semibold">
            <td colSpan={2} className="pt-2 text-right">Total de unidades</td>
            <td className="pt-2 text-right tabular-nums">{units}</td>
            <td />
          </tr>
        </tfoot>
      </table>

      <section className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
        <p><span className="text-black/60">Chofer: </span>{t.driverName ?? "________________"}</p>
        <p><span className="text-black/60">Vehículo: </span>{t.vehicle ?? "________________"}</p>
        <p><span className="text-black/60">Salida: </span>{when(dispatchedAt)}</p>
        <p><span className="text-black/60">Recepción: </span>{when(receivedAt)}</p>
        {t.notes && <p className="col-span-2"><span className="text-black/60">Notas: </span>{t.notes}</p>}
        {received && t.receiveNotes && <p className="col-span-2"><span className="text-black/60">Observaciones de recepción: </span>{t.receiveNotes}</p>}
      </section>

      <section className="grid grid-cols-3 gap-6 pt-10 text-center text-xs">
        {[
          ["Entrega", t.requestedBy],
          ["Transporta", t.driverName],
          ["Recibe", t.receivedBy],
        ].map(([label, name]) => (
          <div key={label}>
            <div className="border-t border-black pt-1 font-semibold">{label}</div>
            <div className="min-h-4 text-black/70">{name ?? ""}</div>
            <div className="text-black/50">Nombre y firma</div>
          </div>
        ))}
      </section>
    </article>
  )
}
