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
- `/tiroteios` Tiroteios: ocorrências, mortos e feridos registrados pelo Instituto Fogo Cruzado desde julho
  de 2016, por estado, município e bairro do Rio, com ranking do recorte. Fonte colaborativa, separada do ISP;
  entra no build só com credenciais (ver Deploy).
- `/status` Status: última checagem e último build no servidor, mês mais recente, cada arquivo do ISP
  (data de modificação no servidor deles, tamanho, SHA-256, contrato) e as últimas rodadas. Lê o
  `status.json` que o `build-site.sh` escreve a cada rodada.

## Arquitetura

```text
backend/app/
  etl/export_static_frontend.py   gera os dois snapshots do frontend
  services/isp_repository.py      lê e normaliza os CSVs do ISP (sem dado ≠ zero, nomes reparados)
  services/population_repository.py  população anual do IBGE, com interpolação marcada
  services/governor_performance.py   mandatos e comparação descritiva
  etl/check_sources.py            contrato de cada CSV do ISP (colunas, chaves, intervalos, atraso)
  etl/write_status.py             status.json servido pelo site
frontend/
  lib/static-data.generated.json  metadados, séries do estado, população, mandatos, fontes (~230 KB)
  lib/static-series/<ind>.generated.json  séries por município e CISP de um indicador (~230 KB cada),
                                  carregadas só quando o recorte pede; crime_geral já vem somado
  lib/static-geo.generated.json   geometrias, carregadas só no mapa (~2,3 MB)
  lib/static-api.ts               toda a leitura e os cálculos (acumulados, anuais, rankings, mapa)
  app/, components/               Next.js App Router, Tailwind com tokens em CSS, Recharts
data/raw/                         caches dos arquivos oficiais
```

O site em produção não depende de backend ativo. As séries do snapshot são esparsas, no formato
`{"from": "AAAA-MM", "values": [...]}`, com `null` para meses não apurados.

Contrato dos arquivos oficiais: `python -m app.etl.check_sources` baixa o que falta e confere, por
CSV, colunas obrigatórias, chave única, ano e mês dentro do intervalo, valores não negativos e o
último mês apurado (atraso acima de quatro meses é aviso). Sai com código 1 quando algo quebra; o
servidor então avisa por e-mail e mantém o snapshot anterior.

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
serviços. A landing, a configuração do nginx e o cron de todos os projetos ficam no repositório
[g0v](https://github.com/Tomoyo-Computer-Science-Research-Unit/g0v); aqui só o que publica este site.

Fluxo normal, sem intervenção, todo dia às 06:23 de Brasília no próprio servidor: o cron
(`/etc/cron.d/g0v-build-site`) roda `deploy/g0v/build-site.sh` (instalado em `/root/g0v/build-site.sh`,
clone em `/root/g0v/src`, log em `/root/g0v/build-site.log`). O script puxa `main`, baixa de novo os
arquivos do ISP e do IBGE, confere o contrato de cada um, regenera os snapshots e, se o commit ou os
dados mudaram desde o último build (ignorando `generated_at`), constrói o site e troca os arquivos
em `/root/g0v/site/perdeu-playboy`. Cada rodada vira uma linha em `/root/g0v/runs.jsonl` e o
`status.json` da página `/status`; contrato, ETL ou build quebrados mandam e-mail para
`arete@tomoyo.systems` pelo mailserver da própria máquina. Para publicar na hora, depois de um push
em `main`:

```bash
ssh root@mail.tomoyo.systems 'FORCE=1 SKIP_DATA=1 /root/g0v/build-site.sh'
```

O workflow `update-data.yml` faz só a parte dos dados, às 05:53: regenera o snapshot e commita em
`main` quando mudou, para manter o repositório em dia.

Deploy a partir desta máquina, com build local (serve para testar mudanças não commitadas):

```bash
scripts/deploy-g0v.sh   # build com NEXT_PUBLIC_BASE_PATH=/perdeu-playboy, rsync e docker compose
```

O script resolve o droplet pelo `doctl` e sobe `frontend/out` para `/root/g0v/site/perdeu-playboy`.
O certificado vem do Traefik (Let's Encrypt via DNS Cloudflare) e o DNS é o wildcard `*.tomoyo.systems`.

Fogo Cruzado é opcional: com `FOGOCRUZADO_EMAIL`, `FOGOCRUZADO_PASSWORD` e `ENABLE_FOGOCRUZADO=true`
no ambiente (no servidor, em `/root/g0v/.env-perdeu`), o ETL baixa as ocorrências e o snapshot ganha a
seção `fogo_cruzado`; sem isso o export é idêntico.

O projeto Vercel antigo (`perdeu-playboy.online`) só redireciona (`deploy/vercel-redirect`).

## Roadmap

- Geometrias oficiais das CISPs, quando o ISP publicar.
- Mapa de tiroteios por bairro, com as geometrias já usadas no mapa do ISP.
