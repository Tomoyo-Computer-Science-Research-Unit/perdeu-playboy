# Fogo Cruzado como fonte de dados

Consultado em 2026-10-13. Fontes: documentacao oficial da API v2
(https://api.fogocruzado.org.br/docs, paginas `/docs/auth`, `/docs/endpoint`,
`/docs/endpoint/states`, `/docs/endpoint/cities`, `/docs/endpoint/occurrences`), o exemplo
`https://api.fogocruzado.org.br/downloads/retorno_completo.csv` e o cliente Python oficial
`crossfire` 1.1.1 (PyPI; repositorio https://github.com/felipesbarros/crossfire). O site
institucional (fogocruzado.org.br) esta atras de Cloudflare e nao pode ser lido por script;
termos de uso e politica de citacao nao foram lidos na integra (ver "Pendencias").

## O que e

O Instituto Fogo Cruzado mantem uma base colaborativa de tiroteios e disparos de arma de fogo,
alimentada por relatos de usuarios, imprensa e checagem propria. Cobertura por estado: Rio de
Janeiro desde julho de 2016 (regiao metropolitana), Pernambuco desde abril de 2018, Bahia desde
julho de 2022, Para desde novembro de 2023. "Mais de 40 indicadores de 49 municipios" no total.
Nao e um registro oficial e nao cobre os 92 municipios do estado do RJ.

## Credenciais

- Cadastro em https://api.fogocruzado.org.br/sign-up (nome, e-mail, senha, aceite de um "Termo de
  Consentimento"). A pagina inicial diz: "Esta API requer autorizacao previa para uso. [...]
  Solicite a autorizacao [...] preenchendo os dados do formulario. Nossa equipe entrara em contato
  para apresentar os termos e condicoes." Ou seja: o acesso e aprovado manualmente e os termos
  chegam por e-mail.
- Variaveis deste projeto: `FOGOCRUZADO_EMAIL` e `FOGOCRUZADO_PASSWORD` (mesmos nomes do pacote
  `crossfire`), ou `FOGOCRUZADO_API_TOKEN` com um JWT ja emitido. `ENABLE_FOGOCRUZADO=true` liga
  a fonte; sem credenciais a flag nao tem efeito.

## API v2

Base: `https://api-service.fogocruzado.org.br/api/v2` (o host `api.fogocruzado.org.br` serve so
o site e a documentacao). Todas as respostas tem o envelope
`{"msg", "msgCode", "code", "data"}`; listas paginadas trazem tambem `pageMeta`.

### Autenticacao (JWT)

- `POST /auth/login` com `{"email", "password"}` -> HTTP 201,
  `data: {"accessToken": "<jwt>", "expiresIn": 3600}`. Credenciais erradas -> 401
  `{"msg": "Unauthorized access. Incorrect credentials.", "msgCode": "user_unauthorized"}`.
- `POST /auth/refresh` com header `Authorization: Bearer <jwt>` -> mesmo formato, novo token.
- Demais chamadas: header `Authorization: Bearer <jwt>`. Sem token -> 401.

### Endpoints

- `GET /states` -> `[{"id": uuid, "name": "Rio de Janeiro"}, ...]`. O id do RJ nao e fixo na
  documentacao (os exemplos divergem entre si); o cliente resolve pelo nome.
- `GET /cities?stateId=&cityId=&cityName=` -> `[{"id", "name": "BELFORD ROXO", "state": {...}}]`.
  Nomes em caixa alta, as vezes sem acento.
- `GET /occurrences` (principal). Filtros documentados ou usados pelo `crossfire`:
  `idState` (obrigatorio), `idCities` (repetivel), `initialdate`/`finaldate` (`AAAA-MM-DD`),
  `typeOccurrence` (`all` | `withVictim` | `withoutVictim`), `order` (`ASC`/`DESC`), `page`,
  `take`. Paginacao em
  `pageMeta: {page, take, itemCount, pageCount, hasPreviousPage, hasNextPage}`.
  Headers: `X-Last-Update`, `X-Last-Update-Timestamp`, `X-Last-Update-State`,
  `X-Last-Update-State-Id`, `X-Last-Update-State-Timestamp`.
- Datas e horas em `America/Sao_Paulo` (`-03:00`); antes da v2.2 vinham em UTC (`Z`). O cliente
  aceita os dois e reduz ao fuso de Brasilia antes de escolher o mes.

### Campos de uma ocorrencia

`id`, `documentNumber`, `address`, `state{id,name}`, `region{id,region,state,enabled}`,
`city{id,name}`, `neighborhood{id,name}`, `subNeighborhood{id,name}|null`,
`locality{id,name}|null`, `latitude`, `longitude` (strings), `date`, `policeAction` (houve acao
policial), `agentPresence` (agentes de seguranca presentes, em servico ou nao), `relatedRecord`,
`contextInfo{mainReason{name}, complementaryReasons[], clippings[], massacre, policeUnit}`,
`transports[]`, `victims[]`, `animalVictims[]`.

Vitima humana (`victims[]`): `type` = `People`; `situation` = `Dead` | `Wounded`;
`personType` = `Civilian` | `Agent`; `circumstances[]` (ex.: "Bala perdida"); `deathDate`;
`age`, `ageGroup{name}`, `genre{name}`, `race`, `place{name}`, `serviceStatus{name}` ("Em
servico", "Fora de servico", "Nao se aplica"), `qualifications[]` ("Agente de seguranca",
"Politico", ...), `politicalPosition`, `politicalStatus`, `partie`, `coorporation{name}` ("Policia
Militar", "Bombeiro", ...), `agentPosition{name}`, `agentStatus{name}`, `unit`. No exemplo CSV
oficial um registro de animal aparece dentro de `victims` com `type: "Animal"`; o cliente ignora
`type != People`.

Tabelas de dominio documentadas: motivos (`mainReason`: Acao policial, Operacao policial,
Disputa, Execucao, Homicidio/Tentativa, Tentativa/roubo, Tiros a esmo, ...), recortes
(`clippings`: Feminicidio, Chacina via `massacre`, Ataque a politico, Bar, Presidio, ...) e
qualificacoes.

### Limites

- Nao ha limite documentado de requisicoes nem de `take`. O `crossfire` trata HTTP 429 com
  `Retry-After` e usa ate 16 requisicoes paralelas; este cliente e sequencial e repete em 429/5xx
  com backoff. O antigo pacote R (API v1) exigia janelas de ate 210 dias; a v2 nao documenta.
- Nao esta documentado se `finaldate` e inclusivo. O cliente pede cada mes de `01` ate o dia `01`
  do mes seguinte, agrupa pela data real e deduplica por `id`.

## O que este projeto faz

- `backend/app/services/fogocruzado_repository.py`: cliente, cache mensal em
  `data/raw/fogocruzado/AAAA-MM.json` (envelope com `fetched_at`, `last_update`, `item_count`,
  `occurrences`), agregacao em series esparsas.
- Indicadores mensais: `tiroteios` (ocorrencias), `mortos`, `feridos`,
  `tiroteios_com_agentes` (`agentPresence` ou `policeAction`), `tiroteios_acao_policial`
  (`policeAction`), `mortos_agentes`, `feridos_agentes` (`personType = Agent`).
- Territorios: estado (`Estado do Rio de Janeiro`), municipios com o nome do ISP (casamento sem
  acento/caixa, aliases do ISP; nao casados vao em `coverage.unmatched_municipalities`) e bairros
  do municipio do Rio (nomes da malha da Prefeitura quando casam; senao caixa de titulo).
- `null` = mes sem arquivo em cache (fora da cobertura ou falha); `0` = mes baixado sem
  ocorrencias no territorio. Municipios sem nenhuma ocorrencia nao ganham serie, porque o Fogo
  Cruzado cobre so parte do estado.
- Snapshot: secao `fogo_cruzado = {indicators, territory_types, series, coverage, source}` e uma
  linha extra em `sources`, ambas so com `ENABLE_FOGOCRUZADO=true` e credenciais.

## Atribuicao

A pagina da API afirma "Este projeto e feito colaborativamente, para comunidades. Por isso, o uso
do conteudo e livre", com selo Creative Commons, e que os termos sao apresentados na aprovacao do
cadastro. Texto de credito usado no snapshot (`fogocruzado_repository.ATTRIBUTION`): "Dados de
tiroteios: Instituto Fogo Cruzado (fogocruzado.org.br), obtidos pela API Fogo Cruzado. Os dados
sao produzidos de forma colaborativa e nao substituem registros oficiais." Ajustar ao texto dos
termos quando chegarem.

## Pendencias (conferir com credenciais reais)

1. Valor maximo de `take` e se `finaldate` e inclusivo.
2. Se `/occurrences` sem `idCities` devolve todos os municipios do estado (presumido).
3. Grafia dos nomes de cidade do RJ em relacao ao ISP (acentos, "Armacao dos Buzios", "Paraty").
4. Grafia dos bairros do Rio em relacao a malha da Prefeitura; sub-bairros nao sao usados.
5. Texto exato de citacao e licenca nos termos de uso enviados na aprovacao.
6. Volume: estimar paginas por mes para 2016-2026 antes do primeiro `sync_raw` completo.
