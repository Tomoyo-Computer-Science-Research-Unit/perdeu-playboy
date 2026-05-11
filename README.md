# Perdeu Playboy

MVP de dashboard publico de dados civicos sobre violencia e seguranca publica no estado do Rio de Janeiro. A proposta e inspirada em dashboards de acompanhamento historico, mas com enquadramento serio, etico e de interesse publico: nada de identificacao de vitimas, enderecos privados, detalhes pessoais ou linguagem sensacionalista.

## O que o MVP entrega

- API FastAPI com endpoints de indicadores, periodo mais recente, resumo anual, series temporais, rankings, mapa e metodologia.
- Frontend Next.js com dashboard, tendencias, mapa, rankings e metodologia.
- Dados oficiais do ISP baixados e cacheados localmente pela API/ETL.
- Modelos SQLAlchemy e migracao Alembic para PostgreSQL + PostGIS.
- Pipeline ETL inicial para baixar CSVs do ISP, registrar checksum, normalizar colunas, transformar tabelas largas em formato longo e carregar por upsert.
- Docker Compose com PostGIS, backend, frontend e Redis opcional.

## Fontes de dados

Fonte primaria: ISP Dados Abertos / Instituto de Seguranca Publica do RJ.

Referencias:

- https://www.ispdados.rj.gov.br/
- https://www.ispdados.rj.gov.br/estatistica.html
- https://dadosabertos.rj.gov.br/dataset/isp-estatisticas-de-seguranca-publica

O portal de dados abertos do RJ lista o conjunto do ISP como ativo, com periodicidade mensal e bases CSV. O MVP centraliza os nomes de arquivos em `backend/app/etl/sources.py` para que ajustes de URL ou nomenclatura sejam feitos em um unico lugar.

Para o filtro de bairro no dashboard, o app usa tambem o CSV oficial de divisao territorial do ISP:

- https://www.ispdados.rj.gov.br/Arquivos/Relacao_RISPxAISPxCISP.csv

Esse arquivo relaciona bairros/distritos a CISP. Portanto, ao filtrar por bairro, os indicadores exibidos sao os totais da CISP associada, nao ocorrencias geocodificadas no limite exato do bairro.

Fonte populacional para taxas municipais: IBGE/SIDRA.

- https://sidra.ibge.gov.br/tabela/6579
- https://apisidra.ibge.gov.br/values/t/6579/n6/in%20n3%2033/v/9324/p/last

A API usa a estimativa populacional municipal mais recente da tabela 6579 para calcular taxas por 100 mil nos rankings de municipios. Se a estimativa nao estiver disponivel, o codigo tem fallback para a tabela 4714 do Censo 2022. Areas policiais/CISP ainda nao exibem taxa porque precisam de um denominador populacional especifico por area.

Fonte futura opcional: Fogo Cruzado API.

- https://api.fogocruzado.org.br/
- https://api.fogocruzado.org.br/docs

O Fogo Cruzado exige autorizacao previa. No MVP ele permanece desabilitado por padrao e nao deve ser misturado automaticamente aos registros policiais do ISP.

## Indicadores iniciais

- `homicidio_doloso`: Homicidio doloso
- `lesao_corp_morte`: Lesao corporal seguida de morte
- `latrocinio`: Latrocinio
- `letalidade_violenta`: Letalidade violenta
- `morte_interv_policial`: Morte por intervencao de agente do Estado
- `feminicidio`: Feminicidio
- `roubo_rua`: Roubo de rua
- `roubo_veiculo`: Roubo de veiculo
- `roubo_carga`: Roubo de carga
- `estupro`: Estupro
- `apreensao_armas`: Armas apreendidas

## Setup local

Requisitos:

- Docker e Docker Compose
- Python 3.12, se for rodar backend fora do Docker
- Node 22, se for rodar frontend fora do Docker

Crie o arquivo de ambiente:

```bash
cp .env.example .env
```

Suba a aplicacao:

```bash
docker compose up --build
```

O `docker-compose.yml` roda em modo de desenvolvimento com hot reload:

- Backend: `uvicorn --reload`, observando `backend/app`, migracoes Alembic e configuracoes montadas.
- Frontend: `next dev`, observando a pasta `frontend/` montada no container sem substituir `node_modules`.
- Em ambientes Windows/macOS via Docker Desktop, polling fica habilitado por `WATCHFILES_FORCE_POLLING`, `CHOKIDAR_USEPOLLING` e `WATCHPACK_POLLING`.

Servicos:

- Frontend: http://localhost:3000
- Backend: http://localhost:8000
- OpenAPI: http://localhost:8000/docs
- Health: http://localhost:8000/health

## Rodar backend sem Docker

```bash
cd backend
python -m venv .venv
. .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload
```

No PowerShell:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
uvicorn app.main:app --reload
```

## Rodar frontend sem Docker

```bash
cd frontend
npm install
npm run dev
```

## Rodar migracoes

Com o Postgres ativo:

```bash
cd backend
alembic upgrade head
```

## Rodar ETL

```bash
cd backend
python -m app.etl.run_pipeline
```

O extrator grava arquivos brutos em `data/raw/isp/` e registra metadados em `source_imports.jsonl`. Downloads sao idempotentes: se o arquivo ja existir, ele usa o cache local e recalcula o checksum.

## Rodar testes

```bash
cd backend
pip install -e ".[dev]"
pytest
```

## Variaveis de ambiente

- `DATABASE_URL`: URL SQLAlchemy para PostgreSQL/PostGIS.
- `REDIS_URL`: URL Redis opcional.
- `ISP_DATA_BASE_URL`: base URL dos arquivos CSV do ISP.
- `FOGOCRUZADO_API_TOKEN`: token da API Fogo Cruzado, quando houver autorizacao.
- `ENABLE_FOGOCRUZADO`: habilita a integracao futura com Fogo Cruzado.
- `NEXT_PUBLIC_API_BASE_URL`: URL publica do backend usada pelo frontend.
- `CORS_ORIGINS`: origens permitidas para o frontend.

## Metodologia e limites

O painel usa registros policiais e administrativos publicados pelo ISP. Esses dados sao fundamentais para transparencia, mas nao representam necessariamente todos os eventos reais: pode haver subnotificacao, atraso de consolidacao, revisao de classificacao e mudancas de metodo ao longo do tempo.

Letalidade violenta e tratada como indicador agregado, normalmente composto por homicidio doloso, latrocinio, lesao corporal seguida de morte e mortes por intervencao de agentes do Estado. As definicoes finais devem ser validadas contra o dicionario oficial do ISP a cada integracao.

Taxas por 100 mil habitantes em rankings municipais usam populacao oficial do IBGE/SIDRA e o codigo IBGE municipal presente na base do ISP. A taxa nao e exibida para CISP/areas policiais ate que exista uma base populacional confiavel para essas delimitacoes.

## Estrutura

```text
rj-violencia-dados/
  backend/
    app/
      api/
      services/
      etl/
      tests/
    alembic/
  frontend/
    app/
    components/
    lib/
    types/
  data/
    raw/
    processed/
```

## TODO para producao

- Confirmar todos os nomes atuais dos CSVs oficiais do ISP e adicionar testes de contrato por arquivo.
- Carregar dicionario oficial de variaveis do ISP e substituir mapeamentos aproximados por metadados validados.
- Integrar geometrias oficiais de municipios e areas policiais no PostGIS.
- Validar periodicamente a fonte populacional IBGE e explicitar no frontend o ano da estimativa usada.
- Criar agendamento de ETL mensal e reconciliacao de revisoes historicas.
- Implementar cache de consultas agregadas quando o volume real justificar.
- Adicionar testes frontend com Playwright ou Vitest.
- Implementar integracao Fogo Cruzado somente com credenciais e pagina metodologica separada.
