"use client";

import { useCallback, useEffect, useState } from "react";
import { FormCombobox, type ComboboxOption } from "@/components/base/form-combobox";
import { CrudCreateDialog } from "./crud-create-dialog";
import { crudApi } from "@/lib/api";
import type { CrudField } from "./crud-config";

export function OptionSelect({
  field,
  value,
  onChange,
  id,
}: {
  field: CrudField;
  value: string;
  onChange: (v: string) => void;
  id?: string;
}) {
  const [options, setOptions] = useState<ComboboxOption[]>(field.options ?? []);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const valueKey = field.optionValue ?? "id";
  const labelKey = field.optionLabel ?? "name";

  const load = useCallback(async () => {
    if (!field.optionsModule) return;
    setLoading(true);
    try {
      const res = await crudApi.list(field.optionsModule, { pageSize: 250 });
      setOptions(
        res.rows.map((r) => ({
          value: String(r[valueKey] ?? ""),
          label: String(r[labelKey] ?? r.id ?? ""),
        }))
      );
    } catch {
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }, [field.optionsModule, valueKey, labelKey]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <FormCombobox
        id={id}
        label={field.label}
        required={field.required}
        helper={field.help}
        options={options}
        value={value ? String(value) : null}
        onChange={onChange}
        onSync={field.optionsModule ? load : undefined}
        onCreate={field.optionsModule ? () => setCreateOpen(true) : undefined}
        loading={loading}
        searchable={Boolean(field.optionsModule)}
        clearable={false}
        placeholder={loading ? "Cargando…" : field.placeholder ?? "Selecciona…"}
        searchPlaceholder="Buscar…"
        emptyText="Sin resultados"
      />
      {createOpen && field.optionsModule && (
        <CrudCreateDialog
          module={field.optionsModule}
          onClose={() => setCreateOpen(false)}
          onCreated={(record) => {
            onChange(String(record.id ?? ""));
            setCreateOpen(false);
            void load();
          }}
        />
      )}
    </>
  );
}
