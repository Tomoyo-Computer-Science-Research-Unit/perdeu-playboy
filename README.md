# Perdeu, Playboy

Painel público de dados sobre violência e segurança pública no **Estado do Rio de Janeiro**, da Tomoyo.

O projeto baixa as bases do ISP, normaliza as séries e publica um site estático: indicadores acumulados, séries
desde 1991, mapa, rankings, mudanças recentes e comparação por mandato. Vítimas não são identificadas e endereços
não são publicados. O visual é o de [tomoyo.systems](https://tomoyo.systems): tinta sobre papel, Shippori Mincho e
Archivo, tema claro e escuro.

Site em produção: https://g0v.tomoyo.systems/perdeu-playboy/ (perdeu-playboy.online redireciona para lá).

## Escopo

Somente Rio de Janeiro. O suporte a outras UFs (SSP-SP e Sinesp VDE) foi removido em outubro de 2026 para
concentrar o trabalho na qualidade da série fluminense; o código anterior continua no histórico do git
(último commit com suporte multi-UF: `43b2bcf`).

## Dados

Fonte principal: Instituto de Segurança Pública do Rio de Janeiro, [ISP Dados Abertos](https://www.ispdados.rj.gov.br/).

| Arquivo | Nível | Cobertura no site |
| --- | --- | --- |
| `DOMensalEstadoDesde1991.csv` | Estado | desde 1991-01 |
| `BaseDPEvolucaoMensalCisp.csv` | Área integrada (CISP) | desde 2003-01 |
| `BaseMunicipioMensal.csv` | Município | desde 2014-01 |
| `ArmasApreendidasEvolucaoCisp.csv` | CISP (agregado para município e estado) | desde 2007-01 |
| `Relacao_RISPxAISPxCISP.csv` | Divisão territorial | – |

Alguns indicadores começam depois: lesão corporal seguida de morte (1999), morte por intervenção de agente do
Estado (1998), estupro (2003), feminicídio (2024-10). Esses meses ficam **sem dado** no snapshot, nunca zero.

População, para taxas por 100 mil habitantes, vem do IBGE/SIDRA por ano: censos de 1991, 2000, 2010 e 2022,
contagem de 2007 e estimativas anuais (tabela 6579). Anos sem publicação (1992–1999 e 2023) são interpolados
linearmente e marcados como tal. Geometrias: malhas do IBGE (municípios) e Data.Rio (bairros, com população do
Censo 2022 por bairro).

Indicadores publicados: `homicidio_doloso`, `lesao_corp_morte`, `latrocinio`, `letalidade_violenta`,
`morte_interv_policial`, `feminicidio`, `roubo_rua`, `roubo_veiculo`, `roubo_carga`, `estupro`,
`apreensao_armas`. `crime_geral` é derivado (letalidade violenta + roubo de rua + roubo de veículo + roubo de
carga + estupro) e só existe num mês quando todos os componentes têm dado.

## Produto

Tudo cabe numa tela de 1280×720 ou mais, sem rolagem de página; abaixo disso a página rola, o
layout não cede. Teclas `1`–`7` trocam de tela, `T` tema, `F` efeitos de impressão, setas e `M`/`V`/`R`
por tela. A mira e os elementos quebráveis são os do tomoyo.systems; o mon com sangue é inquebrável.

- `/` Panorama: acumulado do ano por indicador contra os mesmos meses do ano anterior, mínimo e máximo históricos
  no mesmo período, sparkline anual, gráfico anual com faixas de mandato e pequenos múltiplos de todos os
  indicadores. Recorte por estado, município ou área integrada.
- `/series` Séries: anual, mensal ou soma móvel de 12 meses; ocorrências ou por 100 mil; intervalo de anos;
  tabela ano a ano; CSV. Permalinks em `?indicator=&type=&name=&view=&metric=&from=&to=`.
- `/mapa` Mapa: coropleto de municípios e, ao clicar no Rio, de bairros agregados por CISP. Escala por posição.
- `/rankings`, `/mudancas`, `/mandatos`, `/metodologia`, `/glossario`, `/fontes`.

## Arquitetura

```text
backend/app/
  etl/export_static_frontend.py   gera os dois snapshots do frontend
  services/isp_repository.py      lê e normaliza os CSVs do ISP (sem dado ≠ zero, nomes reparados)
  services/population_repository.py  população anual do IBGE, com interpolação marcada
  services/governor_performance.py   mandatos e comparação descritiva
frontend/
  lib/static-data.generated.json  séries esparsas, população, mandatos, fontes (~2,6 MB)
  lib/static-geo.generated.json   geometrias, carregadas só no mapa (~2,3 MB)
  lib/static-api.ts               toda a leitura e os cálculos (acumulados, anuais, rankings, mapa)
  app/, components/               Next.js App Router, Tailwind com tokens em CSS, Recharts
data/raw/                         caches dos arquivos oficiais
```

O site em produção não depende de backend ativo. As séries do snapshot são esparsas, no formato
`{"from": "AAAA-MM", "values": [...]}`, com `null` para meses não apurados.

## Setup

Requisitos: Python 3.10+ (CI usa 3.12), Node 22+.

```bash
cp .env.example .env
cd backend && uv venv --python 3.12 .venv && uv pip install --python .venv/bin/python -e ".[dev]"
cd ../frontend && npm ci
```

Regerar o snapshot (baixa os CSVs do ISP e as tabelas do IBGE na primeira vez; ~2 min):

```bash
cd backend && .venv/bin/python -m app.etl.export_static_frontend
```

Rodar o site:

```bash
cd frontend && npm run dev
```

## Qualidade

```bash
make lint            # flake8 + mypy
make test            # pytest
cd frontend && npx tsc --noEmit && npm run build && npm run test:visual
```

O CI (`.github/workflows/ci.yml`) roda os testes do backend e os testes visuais do frontend com Playwright.

## Deploy

O site vive em `g0v.tomoyo.systems/perdeu-playboy`, no servidor principal da Tomoyo (droplet
`mail.tomoyo.systems` na DigitalOcean), como um nginx estático atrás do Traefik, ao lado dos outros
serviços. O subdomínio `g0v` reúne as frentes políticas da Tomoyo inspiradas no g0v de Taiwan; a
página raiz lista os projetos (`deploy/g0v/index.html`).

Fluxo normal, sem intervenção: o workflow `update-data.yml` ("Dados e site") roda todo dia às 06:23
de Brasília, baixa de novo os arquivos do ISP e do IBGE, regenera os snapshots e, se algum dado mudou
(ignorando `generated_at`), commita em `main` e publica o site construído no branch `site`. Um push em
`main` que toque `frontend/` ou `deploy/g0v/site/` também republica. No droplet, o cron roda
`deploy/g0v/pull-site.sh` (instalado em `/root/g0v/pull-site.sh`) a cada hora: puxa o branch `site`
e, quando o commit mudou, troca os arquivos e recarrega o nginx. Nenhuma credencial sai do GitHub: o
droplet só lê o repositório público.

Deploy manual, para publicar na hora ou quando o Actions estiver fora:

```bash
scripts/deploy-g0v.sh   # build com NEXT_PUBLIC_BASE_PATH=/perdeu-playboy, rsync e docker compose
```

O script resolve o droplet pelo `doctl`, sobe `frontend/out` para `/root/g0v/site/perdeu-playboy`,
sincroniza `deploy/g0v/conf` (o nginx; só o script manual leva mudanças de configuração) e recarrega o
container `g0v-static` (`deploy/g0v/docker-compose.yml`). O certificado vem do Traefik (Let's Encrypt via
DNS Cloudflare) e o DNS é o wildcard `*.tomoyo.systems`.

O projeto Vercel antigo (`perdeu-playboy.online`) só redireciona (`deploy/vercel-redirect`).

## Roadmap

- Página de status da última atualização com o log resumido do workflow.
- Testes de contrato para cada CSV oficial.
- Geometrias oficiais das CISPs, quando o ISP publicar.
- Fogo Cruzado como fonte separada, com credenciais autorizadas.
- Dividir o snapshot por indicador para reduzir o JavaScript inicial.
