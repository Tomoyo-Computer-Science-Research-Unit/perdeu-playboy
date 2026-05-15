import { CoverageNotice } from "@/components/CoverageNotice";
import { MethodologyDrawer } from "@/components/MethodologyDrawer";
import { TrendsExplorer } from "@/components/TrendsExplorer";
import { ANALYSIS_START_YEAR } from "@/lib/constants";
import { getIndicators, getTerritories, getTimeseries } from "@/lib/api";

export default async function TrendsPage() {
  const [indicators, territories, timeseries] = await Promise.all([
    getIndicators(),
    getTerritories("state"),
    getTimeseries("roubo_rua", "state", "Estado do Rio de Janeiro", ANALYSIS_START_YEAR, 2026)
  ]);

  return (
    <div className="grid gap-8">
      <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between border-l-4 border-border pl-4">
        <div>
          <p className="font-mono text-xs font-bold uppercase tracking-widest text-muted">Tendências</p>
          <h2 className="mt-1 text-4xl font-display text-foreground m-0 leading-none uppercase">Séries históricas por indicador</h2>
        </div>
      </section>

      <CoverageNotice>
        Cobertura: RJ usa ISP desde 2000/2003/2014 conforme território; SP usa SSP-SP + Sinesp desde 2015 para estado e municípios. Área policial/CISP só existe para RJ nesta versão.
      </CoverageNotice>

      <TrendsExplorer indicators={indicators} initialTerritories={territories} initialData={timeseries} />

      <MethodologyDrawer
        csvs={["DOMensalEstadoDesde1991.csv", "BaseDPEvolucaoMensalCisp.csv", "BaseMunicipioMensal.csv", "SSP-SP API mensal", "Sinesp VDE"]}
        columns={["ano", "mes", "indicador selecionado", "territory_type", "territory_name"]}
        period="Faixa de anos selecionada pelo usuário."
        formula="Cada ponto é o total mensal oficial do indicador; média móvel usa janela de 3 meses; comparação anual usa o mesmo mês do ano anterior."
        limits={["Mudanças de classificação e revisão administrativa podem alterar séries históricas.", "Municípios RJ começam em 2014; SP começa em 2015.", "CISP começa em 2003 e só se aplica ao RJ."]}
      />
    </div>
  );
}
