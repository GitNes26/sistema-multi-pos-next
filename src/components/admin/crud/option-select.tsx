"use client";

import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { crudApi } from "@/lib/api";
import type { CrudField, SelectOption } from "./crud-config";

export function OptionSelect({
  field,
  value,
  onChange,
}: {
  field: CrudField;
  value: string;
  onChange: (v: string) => void;
}) {
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
        setOptions(
          res.rows.map((r) => ({
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

  return (
    <Select value={value ? String(value) : ""} onValueChange={onChange} disabled={loading}>
      <SelectTrigger size="sm">
        <SelectValue placeholder={loading ? "Cargando…" : field.placeholder ?? "Selecciona…"} />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}