"use client";

import { Field, Segmented } from "@/components/ui";
import type { Territory, TerritorialUnit, TerritoryType } from "@/types/api";

export type TerritorySelection = { type: TerritoryType; name: string };
export const TERRITORY_TYPES: TerritoryType[] = ["state", "municipality", "police_area"];

type Props = {
  value: TerritorySelection;
  onChange: (value: TerritorySelection) => void;
  municipalities: Territory[];
  policeAreas: Territory[];
  rioUnits: TerritorialUnit[];
  defaultMunicipality: string;
  compact?: boolean;
};

export function nextSelection(type: TerritoryType, current: TerritorySelection, rioUnits: TerritorialUnit[], policeAreas: Territory[], defaultMunicipality: string): TerritorySelection {
  if (type === current.type) {
    return current;
  }
  if (type === "state") {
    return { type, name: "" };
  }
  if (type === "municipality") {
    return { type, name: defaultMunicipality };
  }
  return { type, name: rioUnits[0]?.territorial_unit ?? policeAreas[0]?.name ?? "" };
}

/** Seletor de recorte compacto: estado inteiro, um município ou uma área integrada (CISP). */
export function TerritoryControls({ value, onChange, municipalities, policeAreas, rioUnits, defaultMunicipality, compact = false }: Props) {
  const rioUnitNames = new Set(rioUnits.map((unit) => unit.territorial_unit));
  const otherAreas = policeAreas.filter((area) => !rioUnitNames.has(area.name));

  return (
    <div className={compact ? "grid gap-2" : "flex flex-wrap items-end gap-3"}>
      <Segmented
        label="Tipo de território"
        value={value.type}
        onChange={(type) => onChange(nextSelection(type, value, rioUnits, policeAreas, defaultMunicipality))}
        options={[
          { value: "state", label: "Estado" },
          { value: "municipality", label: "Município" },
          { value: "police_area", label: "CISP" }
        ]}
      />
      {value.type === "municipality" ? (
        <Field label="Município" className={compact ? "" : "min-w-[220px]"}>
          <select value={value.name} onChange={(event) => onChange({ type: "municipality", name: event.target.value })}>
            {municipalities.map((item) => (
              <option key={item.name} value={item.name}>
                {item.name}
              </option>
            ))}
          </select>
        </Field>
      ) : null}
      {value.type === "police_area" ? (
        <Field label="Área integrada" className={compact ? "" : "min-w-[280px]"}>
          <select value={value.name} onChange={(event) => onChange({ type: "police_area", name: event.target.value })}>
            <optgroup label="Cidade do Rio de Janeiro">
              {rioUnits.map((unit) => (
                <option key={unit.police_area_name} value={unit.territorial_unit}>
                  {unit.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Demais áreas do estado">
              {otherAreas.map((area) => (
                <option key={area.name} value={area.name}>
                  {area.name}
                </option>
              ))}
            </optgroup>
          </select>
        </Field>
      ) : null}
    </div>
  );
}
