# Perdeu, Playboy

Painel público de dados sobre violência e segurança pública por estado, da Tomoyo: **Rio de Janeiro** (ISP),
**São Paulo** (SSP-SP) e as demais UFs pelo Sinesp VDE do Ministério da Justiça (Minas Gerais como UF de teste).

O projeto baixa as bases do ISP, normaliza as séries e publica um site estático: indicadores acumulados, séries
desde 1991, mapa, rankings, mudanças recentes e comparação por mandato. Vítimas não são identificadas e endereços
não são publicados. O visual é o de [tomoyo.systems](https://tomoyo.systems): tinta sobre papel, Shippori Mincho e
Archivo, tema claro e escuro.

Site em produção: https://g0v.tomoyo.systems/perdeu-playboy/ (perdeu-playboy.online redireciona para lá).
São Paulo em https://g0v.tomoyo.systems/perdeu-playboy/sp/; cada UF publicada mora em `/perdeu-playboy/<uf>/`.

## UFs

A lista única é `frontend/lib/ufs.json`: sigla, código IBGE, nome, capital, fonte (`isp`, `ssp` ou `sinesp`),
ano inicial e se a UF é publicada. O ETL, o seletor de UF do cabeçalho (tecla `U`) e o `build-site.sh`
leem o mesmo arquivo. Publicar uma UF nova servida pelo Sinesp é marcar `"published": true`, acrescentar
os mandatos em `backend/app/services/governor_performance.py` e gerar o snapshot:

```bash
cd backend && .venv/bin/python -m app.services.sinesp_repository --uf MG   # baixa o VDE e extrai a UF
.venv/bin/python -m app.etl.export_static_frontend --uf MG                 # frontend/data/mg/
```

Cada build contém uma UF: `scripts/use-uf.sh <uf>` copia `frontend/data/<uf>/` para `frontend/lib/`
(o `npm run build`, `dev` e `typecheck` fazem isso sozinhos a partir de `NEXT_PUBLIC_UF`). Tiroteios só
existe no Rio, onde há fonte.

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

### São Paulo

| Fonte | Formato | Cobertura |
| --- | --- | --- |
| SSP-SP, [dados mensais](https://www.ssp.sp.gov.br/estatistica/dados-mensais) (`v1/OcorrenciasMensais/RecuperaDadosMensaisAgrupados`) | JSON, uma chamada por território, ano e grupo (criminal, produtividade) | estado e 93 DPs da capital desde 2001-01; 645 municípios desde 2023-01 no snapshot de 2026-10-14 |
| SSP-SP, violência contra a mulher (`v1/ViolenciaMulher/RecuperaDadosPorAno`) | JSON | feminicídio estadual desde 2018-01 |
| Sinesp VDE/MJSP (`bancovde-AAAA.xlsx`) | XLSX anual, todas as UFs | morte por intervenção de agente do Estado, só total estadual, desde 2015 |

O download respeita uma chamada por segundo; as respostas ficam em `data/raw/ssp_sp/monthly/` (ignoradas)
e o consolidado `data/raw/ssp_sp/ssp_monthly.csv.gz` é versionado, então a rodada diária só baixa o ano
corrente (e o anterior até março). `python -m app.services.ssp_repository --download` faz tudo.
Lacuna conhecida: a coleta municipal de 2001 a 2022 (cerca de 28 mil chamadas, 8 horas a 1 req/s) não
foi feita; o `check_sources --uf SP` do servidor baixa até 3.000 chamadas por rodada, do ano mais recente
para o mais antigo, e o snapshot ganha esses anos em cerca de dez rodadas.
Homicídio doloso e latrocínio contam vítimas; as demais naturezas, ocorrências. Roubo (outros) é o total de
roubos menos carga e banco (não equivale ao roubo de rua do ISP). Lesão corporal seguida de morte começa em
2016-09; letalidade violenta e crime geral só existem para o estado, desde 2016-09. Não há mapa por DP:
a SSP não publica os limites, então o mapa de SP é só por município.

### Demais UFs (Sinesp VDE)

O Sinesp VDE cobre as 27 UFs desde 2015, mês a mês. Homicídio doloso, latrocínio, lesão corporal seguida
de morte e feminicídio vêm por município; morte por intervenção, estupro, roubo de veículo, roubo de carga
e armas apreendidas só com o total estadual. Não há roubo a pessoa nem recorte por delegacia.

### Rio de Janeiro

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
  uf.py                           UF corrente e lista de UFs (lê frontend/lib/ufs.json)
  etl/export_static_frontend.py   gera o snapshot de uma UF (--uf) em frontend/data/<uf>/
  services/ssp_repository.py      SSP-SP: download a 1 req/s, consolidado, mesma interface do ISP
  services/sinesp_repository.py   Sinesp VDE: download dos XLSX anuais, extrato por UF
  services/isp_repository.py      lê e normaliza os CSVs do ISP (sem dado ≠ zero, nomes reparados)
  services/population_repository.py  população anual do IBGE, com interpolação marcada
  services/governor_performance.py   mandatos e comparação descritiva
  etl/check_sources.py            contrato de cada CSV do ISP (colunas, chaves, intervalos, atraso)
  etl/write_status.py             status.json servido pelo site
frontend/
  data/<uf>/                      snapshot de cada UF (versionado); use-uf.sh copia para lib/
  lib/ufs.json                    lista única de UFs
  lib/uf.ts                       textos e nomes por UF (Método, Glossário, avisos, seletor)
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
cd backend && .venv/bin/python -m app.etl.export_static_frontend --uf RJ
.venv/bin/python -m app.services.ssp_repository --download   # SP: só o que falta, 1 req/s
.venv/bin/python -m app.etl.export_static_frontend --uf SP
```

Rodar o site:

```bash
cd frontend && npm run dev
```

## Qualidade

```bash
make lint            # flake8 + mypy
make test            # pytest
cd frontend && npm run typecheck && npm run build && npm run test:visual:all   # RJ e SP
```

O CI (`.github/workflows/ci.yml`) roda os testes do backend e os testes visuais do frontend com Playwright.

## Deploy

O site vive em `g0v.tomoyo.systems/perdeu-playboy`, no servidor principal da Tomoyo (droplet
`mail.tomoyo.systems` na DigitalOcean), como um nginx estático atrás do Traefik, ao lado dos outros
serviços. A landing, a configuração do nginx e o cron de todos os projetos ficam no repositório
[g0v](https://github.com/Tomoyo-Computer-Science-Research-Unit/g0v); aqui só o que publica este site.

Fluxo normal, sem intervenção, todo dia às 06:23 de Brasília no próprio servidor: o cron
(`/etc/cron.d/g0v-build-site`) roda `deploy/g0v/build-site.sh` (instalado em `/root/g0v/build-site.sh`,
clone em `/root/g0v/src`, log em `/root/g0v/build-site.log`). O script puxa `main` e, para cada UF
publicada em `frontend/lib/ufs.json`, baixa de novo os arquivos oficiais, confere o contrato
(`check_sources --uf`) e regenera o snapshot (`export_static_frontend --uf`); falha numa UF deixa só
aquela com o snapshot commitado. Se o commit ou os dados mudaram desde o último build (ignorando
`generated_at`), constrói um site por UF: o Rio em `/root/g0v/site/perdeu-playboy` (o rsync da raiz
exclui as pastas das outras UFs) e as demais em `/root/g0v/site/perdeu-playboy/<uf>/`. Cada rodada vira
uma linha em `/root/g0v/runs.jsonl` e um `status.json` por UF (`/perdeu-playboy/status.json`,
`/perdeu-playboy/sp/status.json`); contrato, ETL ou build quebrados mandam e-mail para
`arete@tomoyo.systems` pelo mailserver da própria máquina. Para publicar na hora, depois de um push
em `main`:

```bash
ssh root@mail.tomoyo.systems 'FORCE=1 SKIP_DATA=1 /root/g0v/build-site.sh'
```

O workflow `update-data.yml` faz só a parte dos dados do Rio, às 05:53: regenera o snapshot e commita
em `main` quando mudou, para manter o repositório em dia.

Build manual de uma UF:

```bash
cd frontend
NEXT_PUBLIC_UF=RJ NEXT_PUBLIC_BASE_PATH=/perdeu-playboy npm run build
NEXT_PUBLIC_UF=SP NEXT_PUBLIC_BASE_PATH=/perdeu-playboy/sp npm run build
```

Deploy a partir desta máquina, com build local (serve para testar mudanças não commitadas):

```bash
scripts/deploy-g0v.sh          # todas as UFs publicadas
scripts/deploy-g0v.sh SP       # só São Paulo
```

O script resolve o droplet pelo `doctl` e sobe cada build para `/root/g0v/site/perdeu-playboy[/<uf>]`.
O certificado vem do Traefik (Let's Encrypt via DNS Cloudflare) e o DNS é o wildcard `*.tomoyo.systems`.

Fogo Cruzado é opcional: com `FOGOCRUZADO_EMAIL`, `FOGOCRUZADO_PASSWORD` e `ENABLE_FOGOCRUZADO=true`
no ambiente (no servidor, em `/root/g0v/.env-perdeu`), o ETL baixa as ocorrências e o snapshot ganha a
seção `fogo_cruzado`; sem isso o export é idêntico.

O projeto Vercel antigo (`perdeu-playboy.online`) só redireciona (`deploy/vercel-redirect`).

## Roadmap

- Geometrias oficiais das CISPs, quando o ISP publicar.
- Mapa de tiroteios por bairro, com as geometrias já usadas no mapa do ISP.
