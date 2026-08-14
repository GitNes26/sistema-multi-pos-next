"use client";

import { useEffect, useState } from "react";
import { portalApi, type LoyaltyData } from "@/lib/portal/client";
import { money } from "@/lib/pos/money";
import { Skeleton } from "@/components/ui/skeleton";

const KIND_LABELS: Record<string, string> = {
  earn: "Ganados",
  redeem: "Canjeados",
  adjust: "Ajuste",
  expire: "Expirados",
};

export function LoyaltyClient() {
  const [data, setData] = useState<LoyaltyData | null>(null);

  useEffect(() => {
    let active = true;
    portalApi
      .loyalty()
      .then((d) => active && setData(d))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  if (!data) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-lg font-semibold">Puntos y lealtad</h1>

      <div className="rounded-xl bg-gradient-to-br from-primary to-primary/70 p-4 text-primary-foreground">
        <p className="text-xs opacity-80">Puntos acumulados</p>
        <p className="text-2xl font-bold">{money(data.points)}</p>
      </div>

      <div className="space-y-2">
        {data.transactions.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Sin movimientos</p>
        ) : (
          data.transactions.map((t) => (
            <div key={t.id} className="flex items-center justify-between rounded-xl border p-3 text-sm">
              <div>
                <p className="font-medium">{KIND_LABELS[t.kind] ?? t.kind}</p>
                {t.note && <p className="text-xs text-muted-foreground">{t.note}</p>}
                <p className="text-xs text-muted-foreground">
                  {new Date(t.createdAt).toLocaleDateString("es-MX", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>
              <span className={t.points >= 0 ? "font-semibold text-emerald-600" : "font-semibold text-destructive"}>
                {t.points >= 0 ? "+" : ""}
                {money(t.points)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
