import { SourceBadge } from "@/components/SourceBadge";
import { getIndicators } from "@/lib/api";

const differences = [
  {
    title: "Letalidade violenta",
    body: "Indicador agregado usado no RJ para reunir mortes violentas intencionais: homicídio doloso, latrocínio, lesão corporal seguida de morte e morte por intervenção de agente do Estado."
  },
  {
    title: "Homicídio doloso",
    body: "Morte intencional registrada como homicídio. Não inclui automaticamente latrocínio ou morte por intervenção policial quando essas categorias aparecem separadas."
  },
  {
    title: "Latrocínio",
    body: "Roubo seguido de morte. É crime patrimonial com resultado morte e também compõe a letalidade violenta."
  },
  {
    title: "Morte por intervenção de agente do Estado",
    body: "Morte decorrente de intervenção de agentes estatais, conforme registro policial. Também compõe a letalidade violenta."
  },
  {
    title: "Roubo de rua",
    body: "Agregado de roubos em via pública usado pelo ISP, incluindo subcategorias como transeunte, celular e coletivo conforme a base oficial."
  },
  {
    title: "Feminicídio",
    body: "Homicídio contra mulher por razões da condição de sexo feminino, conforme tipificação legal e registro policial."
  }
];

export default async function GlossaryPage() {
  const indicators = await getIndicators();

  return (
    <div className="grid gap-8">
      <section className="flex flex-col gap-4 border-b border-border pb-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-mono text-xs font-bold uppercase tracking-widest text-muted">Glossário</p>
          <h2 className="m-0 mt-1 text-4xl font-display uppercase leading-none text-foreground">Como ler os indicadores</h2>
        </div>
        <SourceBadge label="Definições ISP" />
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {differences.map((item) => (
          <article key={item.title} className="border border-border bg-surface p-5 shadow-hard">
            <h3 className="m-0 text-2xl font-display uppercase leading-none text-foreground">{item.title}</h3>
            <p className="mt-3 font-mono text-xs uppercase leading-5 tracking-wide text-muted">{item.body}</p>
          </article>
        ))}
      </section>

      <section className="overflow-x-auto border border-border bg-surface shadow-hard">
        <table className="w-full min-w-[760px] divide-y divide-border text-sm">
          <thead className="bg-background text-left font-mono text-xs font-bold uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Código</th>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Categoria</th>
              <th className="px-4 py-3">Unidade</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {indicators.map((indicator) => (
              <tr key={indicator.code} className="hover:bg-background/50">
                <td className="px-4 py-3 font-mono text-xs text-muted">{indicator.code}</td>
                <td className="px-4 py-3 text-xs font-semibold uppercase text-foreground">{indicator.name}</td>
                <td className="px-4 py-3 font-mono text-xs uppercase tracking-wide text-muted">{indicator.category}</td>
                <td className="px-4 py-3 font-mono text-xs uppercase tracking-wide text-muted">{indicator.unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
