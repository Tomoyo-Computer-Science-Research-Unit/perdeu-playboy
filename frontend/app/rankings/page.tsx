import { CoverageNotice } from "@/components/CoverageNotice";
import { MethodologyDrawer } from "@/components/MethodologyDrawer";
import { RankingsExplorer } from "@/components/RankingsExplorer";
import { SourceBadge } from "@/components/SourceBadge";
import { getIndicators, getRankings } from "@/lib/api";

export default async function RankingsPage() {
  const [indicators, municipalityRows, policeAreaRows] = await Promise.all([
    getIndicators(),
    getRankings("letalidade_violenta", "count", "municipality", 2026, 3),
    getRankings("letalidade_violenta", "count", "police_area", 2026, 3)
  ]);

  return (
    <div className="grid gap-8">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between border-l-4 border-border pl-4">
        <div>
          <p className="font-mono text-xs font-bold uppercase tracking-widest text-muted">Rankings</p>
          <h2 className="mt-1 text-4xl font-display text-foreground m-0 leading-none uppercase">Territórios por indicador</h2>
        </div>
        <SourceBadge label="ISP / SSP-SP / Sinesp" />
      </section>

      <CoverageNotice>
        Cobertura: rankings municipais usam dados oficiais e população IBGE; RJ município começa em 2014, RJ CISP em 2003 e SP município em 2015. Área policial/CISP só existe para RJ nesta versão.
      </CoverageNotice>

      <RankingsExplorer
        indicators={indicators}
        initialMunicipalityRows={municipalityRows}
        initialPoliceAreaRows={policeAreaRows}
      />

      <MethodologyDrawer
        csvs={["BaseMunicipioMensal.csv", "BaseDPEvolucaoMensalCisp.csv", "SSP-SP API mensal", "Sinesp VDE"]}
        columns={["ano", "mes", "indicador selecionado", "fmun ou cisp", "população IBGE quando município"]}
        period="Ano e mês escolhidos no filtro; valor acumulado até o mês."
        formula="Valor = soma de janeiro até o mês; taxa = valor/população*100.000; variação = comparação contra o mesmo período do ano anterior; semáforo: piorando se alta >=10% e >=3 casos, melhorando se queda <=-10% e <=-3 casos, estável se não bater os cortes, inconclusivo com base baixa."
        limits={["Taxa por 100 mil não é calculada para CISP sem população própria.", "CISP pode cobrir partes de bairros ou grupos de bairros.", "SP não tem CISP/bairro nesta versão.", "Valores baixos podem gerar variações percentuais grandes."]}
      />
    </div>
  );
}
