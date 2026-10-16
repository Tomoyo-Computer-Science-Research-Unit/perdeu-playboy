"use client";

import { Field, Segmented } from "@/components/ui";
import { ufConfig } from "@/lib/uf";
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
  if (type === "state" || (type === "police_area" && policeAreas.length === 0)) {
    return { type: "state", name: "" };
  }
  if (type === "municipality") {
    return { type, name: defaultMunicipality };
  }
  return { type, name: rioUnits[0]?.territorial_unit ?? policeAreas[0]?.name ?? "" };
}

/** Seletor de recorte compacto: estado inteiro, um município ou uma área policial (CISP no Rio, DP em SP). */
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
          // UFs sem dado por área policial (Sinesp) ficam sem a opção.
          ...(policeAreas.length > 0 ? [{ value: "police_area" as TerritoryType, label: ufConfig().policeAreaShort }] : [])
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
        <Field label={ufConfig().policeAreaField} className={compact ? "" : "min-w-[280px]"}>
          <select value={value.name} onChange={(event) => onChange({ type: "police_area", name: event.target.value })}>
            <optgroup label={ufConfig().capitalLabel}>
              {rioUnits.map((unit) => (
                <option key={unit.police_area_name} value={unit.territorial_unit}>
                  {unit.name}
                </option>
              ))}
            </optgroup>
            {otherAreas.length > 0 ? (
              <optgroup label={ufConfig().otherPoliceAreasLabel}>
                {otherAreas.map((area) => (
                  <option key={area.name} value={area.name}>
                    {area.name}
                  </option>
                ))}
              </optgroup>
            ) : null}
          </select>
        </Field>
      ) : null}
    </div>
  );
}
