# Perdeu, Playboy

Dashboard publico de dados sobre violencia e seguranca publica no Brasil, cobrindo todas as 27 unidades federativas (26 estados e o Distrito Federal).

O projeto agrega bases oficiais, normaliza series historicas e publica um site estatico com indicadores, mapas, rankings, tendencias e comparacoes por governo. O tom editorial e de dados civicos: sem identificacao de vitimas, sem enderecos privados e sem linguagem sensacionalista.

Site em producao: https://perdeu-playboy.online

## Status

Este repositorio contem um produto funcional, nao apenas um scaffold.

- Frontend estatico em Next.js, publicado na Vercel.
- Snapshot de dados versionado em `frontend/lib/static-data.generated.json`.
- Backend FastAPI e ETL em Python para gerar o snapshot e servir API local.
- Integracao real com bases oficiais de RJ, SP, MG, ES, PR, SC e RS.
- Testes, lint, mypy e workflow agendado para atualizar dados.

## Dados

### Rio de Janeiro

Fonte principal: Instituto de Seguranca Publica do Rio de Janeiro, ISP Dados Abertos.

- Portal: https://www.ispdados.rj.gov.br/
- Estatisticas: https://www.ispdados.rj.gov.br/estatistica.html
- Dados abertos RJ: https://dadosabertos.rj.gov.br/dataset/isp-estatisticas-de-seguranca-publica

Arquivos usados:

- `DOMensalEstadoDesde1991.csv`: serie estadual mensal.
- `BaseDPEvolucaoMensalCisp.csv`: serie mensal por CISP.
- `BaseMunicipioMensal.csv`: serie mensal por municipio.
- `ArmasApreendidasEvolucaoCisp.csv`: apreensoes de armas por CISP.
- `Relacao_RISPxAISPxCISP.csv`: relacao entre RISP, AISP, CISP, unidades territoriais e municipios.

Cobertura usada no produto:

- Estado: desde 2000 no produto.
- CISP / area policial: desde 2003 quando disponivel.
- Municipio: desde 2014 quando disponivel.
- Armas apreendidas: base propria do ISP por CISP, agregada para municipio quando necessario.

### Sao Paulo

Fonte principal: Secretaria da Seguranca Publica de Sao Paulo, via Números Sem Misterio / SSP-SP, com complemento Sinesp quando necessario.

Uso atual:

- Estado e municipios.
- Serie desde 2015.
- Sem divisao por bairro ou area policial nesta versao.

### Parana

Fonte principal: Sistema Nacional de Informacoes de Seguranca Publica, Sinesp VDE/MJSP.

- Portal: https://dados.mj.gov.br/dataset/sistema-nacional-de-estatisticas-de-seguranca-publica
- Base usada: `basededadosvde.zip`, com arquivos anuais `BancoVDE YYYY.csv`.

Uso atual:

- Estado e municipios.
- Serie desde 2015, ate o periodo mais recente publicado no VDE.
- Indicadores municipais quando o VDE informa municipio; indicadores publicados apenas como `NÃO INFORMADO` entram somente no nivel estadual.
- Sem divisao por bairro ou area policial nesta versao.

### Santa Catarina

Fonte principal: Sistema Nacional de Informacoes de Seguranca Publica, Sinesp VDE/MJSP.

- Portal: https://dados.mj.gov.br/dataset/sistema-nacional-de-estatisticas-de-seguranca-publica
- Base usada: `basededadosvde.zip`, com arquivos anuais `BancoVDE YYYY.csv`.

Uso atual:

- Estado e municipios.
- Serie desde 2015, ate o periodo mais recente publicado no VDE.
- Indicadores municipais quando o VDE informa municipio; indicadores publicados apenas como `NÃO INFORMADO` entram somente no nivel estadual.
- Sem divisao por bairro ou area policial nesta versao.

### Rio Grande do Sul

Fonte principal: Sistema Nacional de Informacoes de Seguranca Publica, Sinesp VDE/MJSP.

- Portal: https://dados.mj.gov.br/dataset/sistema-nacional-de-estatisticas-de-seguranca-publica
- Base usada: `basededadosvde.zip`, com arquivos anuais `BancoVDE YYYY.csv`.

Uso atual:

- Estado e municipios.
- Serie desde 2015, ate o periodo mais recente publicado no VDE.
- Indicadores municipais quando o VDE informa municipio; indicadores publicados apenas como `NÃO INFORMADO` entram somente no nivel estadual.
- Sem divisao por bairro ou area policial nesta versao.

### Minas Gerais

Fonte principal: Sistema Nacional de Informacoes de Seguranca Publica, Sinesp VDE/MJSP.

- Portal: https://dados.mj.gov.br/dataset/sistema-nacional-de-estatisticas-de-seguranca-publica
- Base usada: `basededadosvde.zip`, com arquivos anuais `BancoVDE YYYY.csv`.

Uso atual:

- Estado e municipios.
- Serie desde 2015, ate o periodo mais recente publicado no VDE.
- Indicadores municipais quando o VDE informa municipio; indicadores publicados apenas como `NÃO INFORMADO` entram somente no nivel estadual.
- Sem divisao por bairro ou area policial nesta versao.

### Espirito Santo

Fonte principal: Sistema Nacional de Informacoes de Seguranca Publica, Sinesp VDE/MJSP.

- Portal: https://dados.mj.gov.br/dataset/sistema-nacional-de-estatisticas-de-seguranca-publica
- Base usada: `basededadosvde.zip`, com arquivos anuais `BancoVDE YYYY.csv`.

Uso atual:

- Estado e municipios.
- Serie desde 2015, ate o periodo mais recente publicado no VDE.
- Indicadores municipais quando o VDE informa municipio; indicadores publicados apenas como `NÃO INFORMADO` entram somente no nivel estadual.
- Sem divisao por bairro ou area policial nesta versao.

### Goias

Fonte principal: Sistema Nacional de Informacoes de Seguranca Publica, Sinesp VDE/MJSP.

- Portal: https://dados.mj.gov.br/dataset/sistema-nacional-de-estatisticas-de-seguranca-publica
- Base usada: `basededadosvde.zip`, com arquivos anuais `BancoVDE YYYY.csv`.

Uso atual:

- Estado e municipios.
- Serie desde 2015, ate o periodo mais recente publicado no VDE.
- Indicadores municipais quando o VDE informa municipio; indicadores publicados apenas como `NÃO INFORMADO` entram somente no nivel estadual.
- Sem divisao por bairro ou area policial nesta versao.

### Mato Grosso

Fonte principal: Sistema Nacional de Informacoes de Seguranca Publica, Sinesp VDE/MJSP.

- Portal: https://dados.mj.gov.br/dataset/sistema-nacional-de-estatisticas-de-seguranca-publica
- Base usada: `basededadosvde.zip`, com arquivos anuais `BancoVDE YYYY.csv`.

Uso atual:

- Estado e municipios.
- Serie desde 2015, ate o periodo mais recente publicado no VDE.
- Indicadores municipais quando o VDE informa municipio; indicadores publicados apenas como `NÃO INFORMADO` entram somente no nivel estadual.
- Sem divisao por bairro ou area policial nesta versao.

### Mato Grosso do Sul

Fonte principal: Sistema Nacional de Informacoes de Seguranca Publica, Sinesp VDE/MJSP.

- Portal: https://dados.mj.gov.br/dataset/sistema-nacional-de-estatisticas-de-seguranca-publica
- Base usada: `basededadosvde.zip`, com arquivos anuais `BancoVDE YYYY.csv`.

Uso atual:

- Estado e municipios.
- Serie desde 2015, ate o periodo mais recente publicado no VDE.
- Indicadores municipais quando o VDE informa municipio; indicadores publicados apenas como `NÃO INFORMADO` entram somente no nivel estadual.
- Sem divisao por bairro ou area policial nesta versao.

### Distrito Federal

Fonte principal: Sistema Nacional de Informacoes de Seguranca Publica, Sinesp VDE/MJSP.

- Portal: https://dados.mj.gov.br/dataset/sistema-nacional-de-estatisticas-de-seguranca-publica
- Base usada: `basededadosvde.zip`, com arquivos anuais `BancoVDE YYYY.csv`.

Uso atual:

- Unidade federativa de municipio unico; o nivel estadual e o municipal coincidem em Brasilia.
- Serie desde 2015, ate o periodo mais recente publicado no VDE.
- Indicadores publicados apenas como `NÃO INFORMADO` entram somente no nivel estadual.
- Sem divisao por bairro ou area policial nesta versao.

### Nordeste (MA, PI, CE, RN, PB, PE, AL, SE, BA)

Fonte principal: Sistema Nacional de Informacoes de Seguranca Publica, Sinesp VDE/MJSP.

- Portal: https://dados.mj.gov.br/dataset/sistema-nacional-de-estatisticas-de-seguranca-publica
- Base usada: `basededadosvde.zip`, com arquivos anuais `BancoVDE YYYY.csv`.

Estados: Maranhao, Piaui, Ceara, Rio Grande do Norte, Paraiba, Pernambuco, Alagoas, Sergipe e Bahia.

Uso atual:

- Estado e municipios.
- Serie desde 2015, ate o periodo mais recente publicado no VDE.
- Indicadores municipais quando o VDE informa municipio; indicadores publicados apenas como `NÃO INFORMADO` entram somente no nivel estadual.
- Sem divisao por bairro ou area policial nesta versao.

### Norte (RO, AC, AM, RR, PA, AP, TO)

Fonte principal: Sistema Nacional de Informacoes de Seguranca Publica, Sinesp VDE/MJSP.

- Portal: https://dados.mj.gov.br/dataset/sistema-nacional-de-estatisticas-de-seguranca-publica
- Base usada: `basededadosvde.zip`, com arquivos anuais `BancoVDE YYYY.csv`.

Estados: Rondonia, Acre, Amazonas, Roraima, Para, Amapa e Tocantins.

Uso atual:

- Estado e municipios.
- Serie desde 2015, ate o periodo mais recente publicado no VDE.
- Indicadores municipais quando o VDE informa municipio; indicadores publicados apenas como `NÃO INFORMADO` entram somente no nivel estadual.
- Sem divisao por bairro ou area policial nesta versao.

### Geografia e populacao

- Malhas municipais: IBGE.
- Populacao municipal: IBGE/SIDRA, tabela 6579 quando disponivel.
- Bairros da cidade do Rio: Data.Rio / Prefeitura do Rio.
- Populacao de bairros do Rio: base publica Data.Rio usada para aproximar taxas no drilldown da capital.

## Indicadores

Indicadores publicados atualmente:

- `homicidio_doloso`
- `lesao_corp_morte`
- `latrocinio`
- `letalidade_violenta`
- `morte_interv_policial`
- `feminicidio`
- `roubo_rua`
- `roubo_veiculo`
- `roubo_carga`
- `estupro`
- `apreensao_armas`

`crime_geral` e um indicador derivado usado no mapa. Ele soma um conjunto de indicadores violentos/patrimoniais para produzir uma taxa comparavel por 100 mil habitantes. Nao e uma categoria oficial unica do ISP ou da SSP-SP.

## Produto

Paginas principais:

- `/dashboard`: indicadores acumulados do ano, comparacao com ano anterior e minima historica.
- `/trends`: series temporais por indicador, territorio e periodo.
- `/map`: mapa por taxa, valor absoluto ou variacao anual.
- `/rankings`: tabelas por municipio e CISP quando disponivel.
- `/changes`: maiores pioras e melhoras recentes.
- `/governors`: comparacao descritiva por mandato.
- `/glossary`: definicoes curtas dos indicadores.
- `/sources`: fontes e status do snapshot.
- `/methodology`: metodologia resumida.

## Arquitetura

```text
rj-violencia-dados/
  backend/
    app/
      api/          FastAPI routes
      services/     consultas e regras de agregacao
      etl/          extracao, transformacao e export do snapshot
      tests/        pytest
    alembic/        migracoes PostgreSQL/PostGIS
  frontend/
    app/            Next.js App Router
    components/     UI e visualizacoes
    lib/            API estatica e snapshot
    types/          contratos TypeScript
  data/
    raw/            caches locais de fontes oficiais
    processed/      bases intermediarias
```

O site em producao nao depende de um backend ativo. A etapa de ETL gera `frontend/lib/static-data.generated.json`, e o frontend consome esse snapshot localmente.

O backend continua util para desenvolvimento, validacao de API, testes e futura operacao com banco.

## Stack

- Python 3.10+
- FastAPI
- Pandas
- Pydantic
- PostgreSQL + PostGIS
- Alembic
- Next.js App Router
- TypeScript
- Tailwind CSS
- Recharts
- Docker Compose
- Pytest, flake8 e mypy

## Setup rapido

Requisitos:

- Python 3.10 ou superior
- Node.js 22 ou superior
- Docker, se for usar PostGIS local

Crie o `.env`:

```bash
cp .env.example .env
```

Instale dependencias Python:

```bash
make install
```

Instale dependencias do frontend:

```bash
cd frontend
npm install
```

Rode o frontend:

```bash
cd frontend
npm run dev -- --hostname 127.0.0.1 --port 3000
```

Rode o backend:

```bash
cd backend
uvicorn app.main:app --reload
```

URLs locais:

- Frontend: http://localhost:3000
- Backend: http://localhost:8000
- OpenAPI: http://localhost:8000/docs
- Health: http://localhost:8000/health

## Docker

```bash
docker compose up --build
```

Servicos:

- `postgres`: PostGIS 16.
- `backend`: FastAPI com `uvicorn --reload`.
- `frontend`: Next.js em modo dev.
- `redis`: opcional, no profile `cache`.

O Compose monta os diretorios locais para desenvolvimento com hot reload.

## ETL e snapshot

Executar pipeline principal:

```bash
make run
```

Regerar o snapshot usado pelo site:

```bash
cd backend
python -m app.etl.export_static_frontend
```

Arquivos brutos ficam em:

```text
data/raw/
```

Arquivos processados ficam em:

```text
data/processed/
```

Os downloads oficiais sao idempotentes: se um arquivo bruto valido ja existe, o processo reaproveita o cache local.

## Qualidade

Rodar lint e type-check:

```bash
make lint
```

Rodar testes:

```bash
make test
```

Build do frontend:

```bash
cd frontend
npm run build
```

Regras de qualidade adotadas:

- Python tipado onde pratico.
- Pydantic para validacao de modelos.
- `flake8 .`
- `mypy . --warn-return-any --warn-unused-ignores --ignore-missing-imports --disallow-untyped-defs --check-untyped-defs`
- Testes de regressao para transformacoes e endpoints basicos.

## Variaveis de ambiente

```text
DATABASE_URL=
REDIS_URL=
ISP_DATA_BASE_URL=
FOGOCRUZADO_API_TOKEN=
ENABLE_FOGOCRUZADO=false
NEXT_PUBLIC_API_BASE_URL=
NEXT_PUBLIC_GITHUB_URL=
CORS_ORIGINS=
```

Notas:

- `ISP_DATA_BASE_URL` aponta para o diretorio dos CSVs do ISP.
- `FOGOCRUZADO_API_TOKEN` permanece opcional; a integracao nao roda sem credencial.
- Em producao, o frontend usa snapshot estatico e nao precisa de backend publico.

## Metodologia

O projeto trabalha com registros policiais e administrativos. Esses dados podem sofrer atraso, revisao e mudanca de classificacao. O painel deve ser lido como uma ferramenta de acompanhamento de series oficiais, nao como contagem exaustiva de todos os eventos reais.

Taxas por 100 mil usam populacao IBGE quando ha denominador confiavel para o territorio. Para a cidade do Rio, o mapa por bairro e uma visualizacao derivada: os valores de seguranca publica vem de CISPs, e uma CISP pode agrupar bairros ou partes de bairros.

Fogo Cruzado e uma fonte diferente, baseada em eventos de disparo de arma de fogo. Se for integrada no futuro, deve aparecer separada das estatisticas policiais oficiais.

## Deploy

O deploy atual e feito na Vercel a partir do frontend estatico.

Deploy manual:

```bash
cd frontend
npm exec --yes vercel@latest -- deploy --prod --yes
```

Dominio atual:

```text
perdeu-playboy.online
www.perdeu-playboy.online
```

## Manutencao

Antes de publicar mudancas:

```bash
make lint
make test
cd frontend && npm run build
```

Quando os dados mudarem:

```bash
cd backend
python -m app.etl.export_static_frontend
```

Depois commitar `frontend/lib/static-data.generated.json` junto com qualquer mudanca de ETL que altere o formato do snapshot.

## Roadmap

- Melhorar a documentacao de formulas por grafico/tabela.
- Adicionar testes de contrato para cada CSV oficial usado.
- Separar melhor metadados de fonte por UF.
- Criar pagina de status de ultima atualizacao com logs resumidos do workflow.
- Integrar novas UFs mantendo o mesmo contrato de snapshot.
- Avaliar geometrias oficiais para areas policiais quando disponiveis.
- Integrar Fogo Cruzado somente como fonte separada e com credenciais autorizadas.
