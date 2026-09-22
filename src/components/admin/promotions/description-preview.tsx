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
      couponCode: (values.couponCode as string) || null,
      requiresCustomer: Boolean(values.requiresCustomer),
      exclusive: Boolean(values.exclusive),
      maxUses: values.maxUses ? Number(values.maxUses) : null,
      maxUsesPerCustomer: values.maxUsesPerCustomer ? Number(values.maxUsesPerCustomer) : null,
      targetLocations: Array.isArray(values.targetLocations) ? values.targetLocations as string[] : [],
      targetCategories: Array.isArray(values.targetCategories) ? values.targetCategories as string[] : [],
      targetProducts: Array.isArray(values.targetProducts) ? values.targetProducts as string[] : [],
      targetVariants: Array.isArray(values.targetVariants) ? values.targetVariants as string[] : [],
      rewardVariants: Array.isArray(values.rewardVariants) ? values.rewardVariants as string[] : [],
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
    values.couponCode,
    values.requiresCustomer,
    values.exclusive,
    values.maxUses,
    values.maxUsesPerCustomer,
    values.targetLocations,
    values.targetCategories,
    values.targetProducts,
    values.targetVariants,
    values.rewardVariants,
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
