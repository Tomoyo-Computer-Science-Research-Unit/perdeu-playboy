"use client";

import { Field, Segmented } from "@/components/ui";
import type { Territory, TerritorialUnit, TerritoryType } from "@/types/api";

export type TerritorySelection = { type: TerritoryType; name: string };

type Props = {
  value: TerritorySelection;
  onChange: (value: TerritorySelection) => void;
  municipalities: Territory[];
  policeAreas: Territory[];
  rioUnits: TerritorialUnit[];
  defaultMunicipality: string;
};

/** Seletor de recorte: estado inteiro, um município ou uma área integrada (CISP). */
export function TerritoryPicker({ value, onChange, municipalities, policeAreas, rioUnits, defaultMunicipality }: Props) {
  const rioUnitNames = new Set(rioUnits.map((unit) => unit.territorial_unit));
  const otherAreas = policeAreas.filter((area) => !rioUnitNames.has(area.name));

  function changeType(type: TerritoryType) {
    if (type === "state") {
      onChange({ type, name: "" });
    } else if (type === "municipality") {
      onChange({ type, name: defaultMunicipality });
    } else {
      onChange({ type, name: rioUnits[0]?.territorial_unit ?? policeAreas[0]?.name ?? "" });
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-[auto_1fr] md:items-end">
      <Segmented
        label="Tipo de território"
        value={value.type}
        onChange={changeType}
        options={[
          { value: "state", label: "Estado" },
          { value: "municipality", label: "Município" },
          { value: "police_area", label: "Área (CISP)" }
        ]}
      />
      {value.type === "municipality" ? (
        <Field label="Município">
          <select value={value.name} onChange={(event) => onChange({ type: "municipality", name: event.target.value })}>
            {municipalities.map((item) => (
              <option key={item.name} value={item.name}>
                {item.name}
              </option>
            ))}
          </select>
        </Field>
      ) : value.type === "police_area" ? (
        <Field label="Área integrada de segurança pública">
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
      ) : (
        <p className="text-[12px] leading-6 tracking-[0.04em] text-ash md:pb-2">Estado do Rio de Janeiro inteiro. Série mensal do ISP desde janeiro de 1991.</p>
      )}
    </div>
  );
}
