"use client";

import { GeoJSON, MapContainer, TileLayer } from "react-leaflet";
import type { GeoFeatureCollection } from "@/types/api";

function color(value: number) {
  if (value > 400) return "#e01f1f";
  if (value > 120) return "#7a7a7a";
  if (value > 60) return "#a6a6a6";
  return "#d8d8d8";
}

export default function ChoroplethMap({ data }: { data: GeoFeatureCollection }) {
  return (
    <div className="h-[520px] overflow-hidden border border-border bg-surface shadow-hard">
      <MapContainer center={[-22.84, -43.25]} zoom={9} scrollWheelZoom={false}>
        <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <GeoJSON
          data={data as GeoJSON.GeoJsonObject}
          style={(feature) => {
            const value = Number(feature?.properties?.value ?? 0);
            return { color: "#050505", weight: 1, fillColor: color(value), fillOpacity: 0.82 };
          }}
          onEachFeature={(feature, layer) => {
            const props = feature.properties ?? {};
            layer.bindTooltip(
              `<strong>${props.territory_name ?? "Território"}</strong><br/>Valor: ${props.value ?? "-"}<br/>Taxa: ${Number(props.rate_per_100k ?? 0).toFixed(1)}<br/>Rank: ${props.rank ?? "-"}`
            );
          }}
        />
      </MapContainer>
    </div>
  );
}
