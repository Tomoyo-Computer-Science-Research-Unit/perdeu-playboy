import { CoverageNotice } from "@/components/CoverageNotice";
import { MethodologyDrawer } from "@/components/MethodologyDrawer";
import { MunicipalityChoroplethPanel } from "@/components/MunicipalityChoroplethPanel";
import { SourceBadge } from "@/components/SourceBadge";
import { getIndicators, getLatestPeriod, getMapData } from "@/lib/api";

export default async function MapPage() {
  const [indicators, latest] = await Promise.all([getIndicators(), getLatestPeriod()]);
  const mapData = await getMapData("letalidade_violenta", "count", latest.year, latest.month);

  return (
    <div className="grid gap-8">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between border-l-4 border-border pl-4">
        <div>
          <p className="font-mono text-xs font-bold uppercase tracking-widest text-muted">Mapa</p>
          <h2 className="mt-1 text-4xl font-display text-foreground m-0 leading-none uppercase">Municípios do estado</h2>
        </div>
        <SourceBadge label="ISP + IBGE + Data.Rio" />
      </section>

      <CoverageNotice>
        Cobertura do mapa: municípios começam em 2014; ao clicar em Rio de Janeiro, bairros usam dados CISP desde 2003. Bairro/CISP é aproximação territorial oficial, não ocorrência geocodificada no bairro exato.
      </CoverageNotice>

      <MunicipalityChoroplethPanel
        indicators={indicators}
        initialData={mapData}
        latestYear={latest.year}
        latestMonth={latest.month}
      />

      <MethodologyDrawer
        csvs={["BaseMunicipioMensal.csv", "BaseDPEvolucaoMensalCisp.csv", "Relacao_RISPxAISPxCISP.csv", "malhas IBGE", "Data.Rio bairros/população 2022"]}
        columns={["ano", "mes", "indicador selecionado", "fmun/cisp", "geometry", "population"]}
        period="Mês selecionado na linha do tempo."
        formula="Indicadores oficiais usam valor acumulado até o mês; crime geral usa soma móvel de 12 meses por 100 mil habitantes."
        limits={["Município do Rio abre CISP/bairros em camada separada.", "Bairros herdam valores da CISP correspondente.", "Alguns bairros novos podem não casar perfeitamente com a tabela CISP."]}
      />
    </div>
  );
}
