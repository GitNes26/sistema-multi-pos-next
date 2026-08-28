"use client";

import { useMemo } from "react";
import { FileText } from "lucide-react";
import { generateDescriptionFinal, type DescriptionInput } from "@/lib/promotions/description";

/**
 * Preview en tiempo real de la descripción final de una promoción.
 * Se renderiza dentro del formulario CRUD y observa los valores del formulario.
 */
export function PromotionDescriptionPreview({
  values,
}: {
  values: Record<string, unknown>;
}) {
  const description = useMemo(() => {
    const input: DescriptionInput = {
      benefit: values.benefit as string,
      scope: values.scope as string,
      value: Number(values.value ?? 0),
      buyQuantity: Number(values.buyQuantity ?? 0),
      getQuantity: Number(values.getQuantity ?? 0),
      minAmount: Number(values.minAmount ?? 0),
      minQuantity: Number(values.minQuantity ?? 0),
      startsAt: (values.startsAt as string) || null,
      endsAt: (values.endsAt as string) || null,
      weekdays: Array.isArray(values.weekdays) ? values.weekdays : null,
      startTime: (values.startTime as string) || null,
      endTime: (values.endTime as string) || null,
    };
    return generateDescriptionFinal(input);
  }, [
    values.benefit,
    values.scope,
    values.value,
    values.buyQuantity,
    values.getQuantity,
    values.minAmount,
    values.minQuantity,
    values.startsAt,
    values.endsAt,
    values.weekdays,
    values.startTime,
    values.endTime,
  ]);

  return (
    <div className="sm:col-span-2 rounded-xl border border-dashed border-primary/30 bg-primary/5 p-4">
      <div className="flex items-center gap-2 mb-2">
        <FileText className="size-4 text-primary" />
        <p className="text-xs font-semibold text-primary">
          Descripción que verá el cliente
        </p>
      </div>
      <p className="text-sm text-foreground/80 leading-relaxed">
        {description}
      </p>
    </div>
  );
}
