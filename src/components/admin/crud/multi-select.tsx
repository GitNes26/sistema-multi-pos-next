"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { crudApi } from "@/lib/api";
import type { CrudField, SelectOption } from "./crud-config";

function normalize(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      value.split(",").map(String);
    }
  }
  return [];
}

export function MultiSelect({
  field,
  value,
  onChange,
}: {
  field: CrudField;
  value: unknown;
  onChange: (v: string[]) => void;
}) {
  const selected = useMemo(() => normalize(value), [value]);
  const [options, setOptions] = useState<SelectOption[]>(field.options ?? []);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!field.optionsModule) return;
    let active = true;
    setLoading(true);
    crudApi
      .list(field.optionsModule, { pageSize: 250 })
      .then((res) => {
        const valueKey = field.optionValue ?? "id";
        const labelKey = field.optionLabel ?? "name";
        if (!active) return;
        const nested = field.optionNested;
        const flat = nested
          ? res.rows.flatMap((r) => (Array.isArray(r[nested]) ? (r[nested] as Record<string, unknown>[]) : []))
          : res.rows;
        setOptions(
          flat.map((r) => ({
            value: String(r[valueKey] ?? ""),
            label: String(r[labelKey] ?? r.id ?? ""),
          }))
        );
      })
      .catch(() => setOptions([]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [field]);

  const toggle = (optValue: string) => {
    if (selected.includes(optValue)) {
      onChange(selected.filter((v) => v !== optValue));
    } else {
      onChange([...selected, optValue]);
    }
  };

  if (loading && !options.length) {
    return <Loader2 className="size-4 animate-spin text-muted-foreground" />;
  }

  return (
    <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto rounded-md border p-2">
      {options.length === 0 ? (
        <span className="text-sm text-muted-foreground">Sin opciones</span>
      ) : (
        options.map((opt) => {
          const active = selected.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggle(opt.value)}
              className="focus:outline-none"
            >
              <Badge variant={active ? "default" : "secondary"} className="cursor-pointer gap-1">
                {opt.label}
                {active && <X className="size-3" />}
              </Badge>
            </button>
          );
        })
      )}
    </div>
  );
}