"""Fogo Cruzado (tiroteios) como fonte separada, restrita ao estado do Rio de Janeiro.

Documentacao da API: https://api.fogocruzado.org.br/docs (v2). Resumo em
``backend/docs/fogo-cruzado.md``. A fonte e opcional: so entra no snapshot quando
``ENABLE_FOGOCRUZADO=true`` e ha credenciais (``FOGOCRUZADO_EMAIL`` + ``FOGOCRUZADO_PASSWORD``
ou ``FOGOCRUZADO_API_TOKEN``).

Fluxo:

1. ``FogoCruzadoClient`` faz login (JWT), guarda o token em memoria e renova uma vez em 401.
2. ``sync_raw`` baixa as ocorrencias do RJ mes a mes (paginado) e grava cada mes em
   ``data/raw/fogocruzado/AAAA-MM.json``. Meses passados nunca sao rebaixados; o mes corrente e
   o anterior sao sempre atualizados.
3. ``aggregate`` transforma os arquivos em series mensais esparsas (mesmo formato das series do
   ISP: ``{"from": "AAAA-MM", "values": [...]}``) por estado, municipio e bairro do Rio.

Semantica de ``null`` vs ``0``: um mes com arquivo em cache e sem ocorrencias para o territorio
vale ``0``; um mes sem arquivo (fora da cobertura ou falha de download) vale ``null``.
"""

from __future__ import annotations

import hashlib
import json
import logging
import re
import time
import unicodedata
from calendar import monthrange
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable, Iterable, Mapping
from zoneinfo import ZoneInfo

import httpx

from app.config import settings
from app.etl.extract import checksum_file

logger = logging.getLogger(__name__)

SOURCE_NAME = "Fogo Cruzado"
SOURCE_URL = "https://fogocruzado.org.br"
API_DOCS_URL = "https://api.fogocruzado.org.br/docs"
SIGN_UP_URL = "https://api.fogocruzado.org.br/sign-up"
# Texto de credito. O Fogo Cruzado apresenta os termos de uso ao aprovar o cadastro; ate la o
# texto segue o credito usado nos proprios relatorios do instituto ("Fonte: Instituto Fogo
# Cruzado") e deve ser conferido com os termos recebidos.
ATTRIBUTION = (
    "Dados de tiroteios: Instituto Fogo Cruzado (fogocruzado.org.br), obtidos pela API Fogo "
    "Cruzado. Os dados sao produzidos de forma colaborativa e nao substituem registros oficiais."
)

STATE_NAME = "Rio de Janeiro"
STATE_TERRITORY_NAME = "Estado do Rio de Janeiro"
RIO_CITY_NAME = "Rio de Janeiro"
# Inicio da cobertura do RJ segundo a documentacao da API ("Rio de Janeiro (desde julho de 2016)").
COVERAGE_START = (2016, 7)
PAGE_SIZE = 100  # a API nao documenta o maximo de ``take``; a paginacao segue ``pageMeta``.
LOCAL_TZ = ZoneInfo("America/Sao_Paulo")
TERRITORY_TYPES = ("state", "municipality", "neighborhood")
RAW_SUBDIR = Path("raw") / "fogocruzado"

INDICATORS: list[dict[str, str]] = [
    {
        "code": "tiroteios",
        "name": "Tiroteios e disparos",
        "category": "Fogo Cruzado",
        "description": "Ocorrencias de tiroteio ou disparo de arma de fogo registradas pelo Fogo Cruzado.",
        "unit": "ocorrencias",
    },
    {
        "code": "mortos",
        "name": "Mortos em tiroteios",
        "category": "Fogo Cruzado",
        "description": "Vitimas humanas mortas (situation = Dead) nas ocorrencias registradas.",
        "unit": "vitimas",
    },
    {
        "code": "feridos",
        "name": "Feridos em tiroteios",
        "category": "Fogo Cruzado",
        "description": "Vitimas humanas feridas (situation = Wounded) nas ocorrencias registradas.",
        "unit": "vitimas",
    },
    {
        "code": "tiroteios_com_agentes",
        "name": "Tiroteios com agentes de seguranca",
        "category": "Fogo Cruzado",
        "description": "Ocorrencias com presenca de agentes de seguranca (agentPresence) ou acao policial (policeAction).",
        "unit": "ocorrencias",
    },
    {
        "code": "tiroteios_acao_policial",
        "name": "Tiroteios em acao policial",
        "category": "Fogo Cruzado",
        "description": "Ocorrencias marcadas como acao policial (policeAction = true).",
        "unit": "ocorrencias",
    },
    {
        "code": "mortos_agentes",
        "name": "Agentes de seguranca mortos",
        "category": "Fogo Cruzado",
        "description": "Vitimas mortas com personType = Agent.",
        "unit": "vitimas",
    },
    {
        "code": "feridos_agentes",
        "name": "Agentes de seguranca feridos",
        "category": "Fogo Cruzado",
        "description": "Vitimas feridas com personType = Agent.",
        "unit": "vitimas",
    },
]
INDICATOR_CODES = [indicator["code"] for indicator in INDICATORS]

Series = dict[str, object]
SeriesStore = dict[str, dict[str, dict[str, Series]]]


class FogoCruzadoError(RuntimeError):
    """Erro de autenticacao ou de resposta da API Fogo Cruzado."""


# --- Configuracao ---------------------------------------------------------------------------


def credentials_available() -> bool:
    return bool(settings.fogocruzado_api_token) or bool(
        settings.fogocruzado_email and settings.fogocruzado_password
    )


def enabled() -> bool:
    """Fonte ativa: flag ligada e credenciais presentes."""

    return bool(settings.enable_fogocruzado) and credentials_available()


def raw_dir() -> Path:
    return (settings.data_dir / RAW_SUBDIR).resolve()


# --- Cliente HTTP ---------------------------------------------------------------------------


class FogoCruzadoClient:
    """Cliente minimo da API v2: login JWT, refresh em 401, retry em 429/5xx."""

    def __init__(
        self,
        email: str | None = None,
        password: str | None = None,
        token: str | None = None,
        base_url: str | None = None,
        http: httpx.Client | None = None,
        timeout: float = 60.0,
        max_retries: int = 4,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        self.base_url = (base_url or settings.fogocruzado_api_base_url).rstrip("/")
        self.email = email if email is not None else settings.fogocruzado_email
        self.password = password if password is not None else settings.fogocruzado_password
        self._token = token if token is not None else settings.fogocruzado_api_token
        self._token_expires_at: datetime | None = None
        self._http = http or httpx.Client(timeout=timeout, follow_redirects=True)
        self._max_retries = max_retries
        self._sleep = sleep
        self.last_update: str | None = None
        self.last_update_state: str | None = None

    # -- autenticacao --

    def login(self) -> str:
        if not (self.email and self.password):
            raise FogoCruzadoError(
                "Sem credenciais: defina FOGOCRUZADO_EMAIL e FOGOCRUZADO_PASSWORD "
                "(ou FOGOCRUZADO_API_TOKEN)."
            )
        response = self._http.post(
            f"{self.base_url}/auth/login", json={"email": self.email, "password": self.password}
        )
        if response.status_code == 401:
            raise FogoCruzadoError(f"Credenciais recusadas pela API Fogo Cruzado: {response.text}")
        response.raise_for_status()
        self._store_token(response.json())
        return str(self._token)

    def refresh(self) -> str:
        if not self._token:
            return self.login()
        response = self._http.post(
            f"{self.base_url}/auth/refresh", headers={"Authorization": f"Bearer {self._token}"}
        )
        if response.status_code in (400, 401, 403):
            logger.info("Fogo Cruzado: refresh recusado (%s); refazendo login", response.status_code)
            return self.login()
        response.raise_for_status()
        self._store_token(response.json())
        return str(self._token)

    def _store_token(self, payload: Mapping[str, Any]) -> None:
        data = payload.get("data") or {}
        token = data.get("accessToken")
        if not token:
            raise FogoCruzadoError(f"Resposta de autenticacao sem accessToken: {payload}")
        self._token = str(token)
        expires_in = int(data.get("expiresIn") or 3600)
        # Margem de 60 s para nao usar um token prestes a expirar.
        self._token_expires_at = datetime.now(timezone.utc) + timedelta(seconds=max(expires_in - 60, 30))

    def token(self) -> str:
        if self._token and (self._token_expires_at is None or datetime.now(timezone.utc) < self._token_expires_at):
            return self._token
        if self._token and self._token_expires_at is not None:
            return self.refresh()
        return self.login()

    # -- requisicoes --

    def get(self, path: str, params: Mapping[str, Any] | None = None) -> httpx.Response:
        url = f"{self.base_url}/{path.lstrip('/')}"
        refreshed = False
        attempt = 0
        while True:
            response = self._http.get(
                url, params=dict(params or {}), headers={"Authorization": f"Bearer {self.token()}"}
            )
            if response.status_code == 401 and not refreshed:
                refreshed = True
                self.refresh()
                continue
            if response.status_code == 429 or response.status_code >= 500:
                attempt += 1
                if attempt > self._max_retries:
                    response.raise_for_status()
                wait = _retry_after(response, attempt)
                logger.warning("Fogo Cruzado: HTTP %s em %s; nova tentativa em %.1fs", response.status_code, url, wait)
                self._sleep(wait)
                continue
            response.raise_for_status()
            self.last_update = response.headers.get("X-Last-Update", self.last_update)
            self.last_update_state = response.headers.get("X-Last-Update-State", self.last_update_state)
            return response

    def get_json(self, path: str, params: Mapping[str, Any] | None = None) -> dict[str, Any]:
        payload = self.get(path, params).json()
        if not isinstance(payload, dict):
            raise FogoCruzadoError(f"Resposta inesperada em {path}: {type(payload).__name__}")
        return payload

    # -- endpoints --

    def states(self) -> list[dict[str, Any]]:
        return list(self.get_json("states").get("data") or [])

    def state_id(self, name: str = STATE_NAME) -> str:
        for state in self.states():
            if _name_key(str(state.get("name") or "")) == _name_key(name):
                return str(state["id"])
        raise FogoCruzadoError(f"Estado {name!r} nao encontrado em /states")

    def cities(self, state_id: str) -> list[dict[str, Any]]:
        return list(self.get_json("cities", {"stateId": state_id}).get("data") or [])

    def occurrences_page(
        self,
        state_id: str,
        initial_date: date,
        final_date: date,
        page: int,
        take: int = PAGE_SIZE,
    ) -> dict[str, Any]:
        return self.get_json(
            "occurrences",
            {
                "idState": state_id,
                "initialdate": initial_date.isoformat(),
                "finaldate": final_date.isoformat(),
                "typeOccurrence": "all",
                "order": "ASC",
                "page": page,
                "take": take,
            },
        )


def _retry_after(response: httpx.Response, attempt: int) -> float:
    header = response.headers.get("Retry-After")
    if header:
        try:
            return max(float(header), 0.5)
        except ValueError:
            pass
    return float(min(2 ** attempt, 60))


# --- Paginacao e cache mensal ---------------------------------------------------------------


def collect_pages(fetch_page: Callable[[int], Mapping[str, Any]], max_pages: int = 10_000) -> list[dict[str, Any]]:
    """Junta ``data`` de todas as paginas seguindo ``pageMeta`` (pageCount/hasNextPage)."""

    items: list[dict[str, Any]] = []
    page = 1
    while page <= max_pages:
        payload = fetch_page(page)
        data = payload.get("data") or []
        items.extend(dict(item) for item in data)
        meta = payload.get("pageMeta") or {}
        page_count = meta.get("pageCount")
        has_next = meta.get("hasNextPage")
        if has_next is False or (page_count is not None and page >= int(page_count)) or (not data and has_next is None):
            break
        page += 1
    return items


def month_bounds(year: int, month: int) -> tuple[date, date]:
    """Primeiro dia do mes e primeiro dia do mes seguinte.

    A documentacao nao diz se ``finaldate`` e inclusivo; pedindo ate o primeiro dia do mes seguinte
    nada se perde em nenhum dos casos. A agregacao usa a data real da ocorrencia e deduplica por id.
    """

    first = date(year, month, 1)
    last_day = monthrange(year, month)[1]
    return first, date(year, month, last_day) + timedelta(days=1)


def months_between(start: tuple[int, int], end: tuple[int, int]) -> list[tuple[int, int]]:
    year, month = start
    output: list[tuple[int, int]] = []
    while (year, month) <= end:
        output.append((year, month))
        year, month = (year + 1, 1) if month == 12 else (year, month + 1)
    return output


def month_key(year: int, month: int) -> str:
    return f"{year:04d}-{month:02d}"


def months_to_refresh(today: date) -> set[str]:
    """Mes corrente e anterior sao sempre rebaixados (registros entram com atraso)."""

    current = (today.year, today.month)
    previous = (today.year - 1, 12) if today.month == 1 else (today.year, today.month - 1)
    return {month_key(*current), month_key(*previous)}


def fetch_month(client: FogoCruzadoClient, state_id: str, year: int, month: int, take: int = PAGE_SIZE) -> list[dict[str, Any]]:
    first, final = month_bounds(year, month)
    return collect_pages(lambda page: client.occurrences_page(state_id, first, final, page, take))


def sync_raw(
    client: FogoCruzadoClient | None = None,
    directory: Path | None = None,
    today: date | None = None,
    start: tuple[int, int] = COVERAGE_START,
) -> list[Path]:
    """Garante um arquivo ``AAAA-MM.json`` por mes desde ``start`` ate hoje. Retorna os caminhos."""

    client = client or FogoCruzadoClient()
    directory = (directory or raw_dir()).resolve()
    directory.mkdir(parents=True, exist_ok=True)
    today = today or datetime.now(LOCAL_TZ).date()
    refresh = months_to_refresh(today)
    state_id: str | None = None
    paths: list[Path] = []

    for year, month in months_between(start, (today.year, today.month)):
        key = month_key(year, month)
        path = directory / f"{key}.json"
        if path.exists() and path.stat().st_size > 0 and key not in refresh:
            paths.append(path)
            continue
        if state_id is None:
            state_id = client.state_id()
        logger.info("Fogo Cruzado: baixando %s", key)
        occurrences = fetch_month(client, state_id, year, month)
        payload = {
            "source": SOURCE_NAME,
            "state_id": state_id,
            "month": key,
            "fetched_at": datetime.now(LOCAL_TZ).isoformat(timespec="seconds"),
            "last_update": client.last_update,
            "last_update_state": client.last_update_state,
            "item_count": len(occurrences),
            "occurrences": occurrences,
        }
        tmp = path.with_suffix(".json.tmp")
        tmp.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
        tmp.replace(path)
        paths.append(path)
    return paths


def load_cached(directory: Path | None = None) -> dict[str, list[dict[str, Any]]]:
    """Le ``AAAA-MM.json`` do cache. Aceita o envelope gravado por ``sync_raw`` ou uma lista crua."""

    directory = (directory or raw_dir()).resolve()
    output: dict[str, list[dict[str, Any]]] = {}
    if not directory.exists():
        return output
    for path in sorted(directory.glob("????-??.json")):
        if not re.fullmatch(r"\d{4}-\d{2}", path.stem):
            continue
        raw = json.loads(path.read_text(encoding="utf-8"))
        occurrences = raw.get("occurrences", []) if isinstance(raw, dict) else raw
        output[path.stem] = [dict(item) for item in occurrences]
    return output


# --- Agregacao ------------------------------------------------------------------------------


@dataclass
class OccurrenceRow:
    occurrence_id: str
    month: str
    municipality_key: str
    municipality_raw: str
    neighborhood_raw: str | None
    police_action: bool
    agent_presence: bool
    dead: int
    wounded: int
    dead_agents: int
    wounded_agents: int

    def indicator_values(self) -> dict[str, int]:
        with_agents = int(self.agent_presence or self.police_action)
        return {
            "tiroteios": 1,
            "mortos": self.dead,
            "feridos": self.wounded,
            "tiroteios_com_agentes": with_agents,
            "tiroteios_acao_policial": int(self.police_action),
            "mortos_agentes": self.dead_agents,
            "feridos_agentes": self.wounded_agents,
        }


@dataclass
class Aggregate:
    series: SeriesStore
    coverage: dict[str, object]
    unmatched_municipalities: dict[str, int] = field(default_factory=dict)
    unmatched_neighborhoods: dict[str, int] = field(default_factory=dict)


def parse_occurrence(raw: Mapping[str, Any]) -> OccurrenceRow | None:
    occurred_at = _parse_datetime(raw.get("date"))
    if occurred_at is None:
        return None
    city = raw.get("city") or {}
    neighborhood = raw.get("neighborhood") or {}
    city_name = str(city.get("name") or "").strip()
    neighborhood_name = str(neighborhood.get("name") or "").strip() or None

    dead = wounded = dead_agents = wounded_agents = 0
    for victim in raw.get("victims") or []:
        if str(victim.get("type") or "People") != "People":
            continue
        situation = str(victim.get("situation") or "").casefold()
        is_agent = str(victim.get("personType") or "").casefold() == "agent"
        if situation == "dead":
            dead += 1
            dead_agents += int(is_agent)
        elif situation == "wounded":
            wounded += 1
            wounded_agents += int(is_agent)

    return OccurrenceRow(
        occurrence_id=str(raw.get("id") or raw.get("documentNumber") or ""),
        month=month_key(occurred_at.year, occurred_at.month),
        municipality_key=_name_key(city_name),
        municipality_raw=city_name,
        neighborhood_raw=neighborhood_name,
        police_action=bool(raw.get("policeAction")),
        agent_presence=bool(raw.get("agentPresence")),
        dead=dead,
        wounded=wounded,
        dead_agents=dead_agents,
        wounded_agents=wounded_agents,
    )


def aggregate(
    cached: Mapping[str, Iterable[Mapping[str, Any]]],
    isp_municipalities: Iterable[str],
    rio_neighborhoods: Iterable[str] = (),
    municipality_aliases: Mapping[str, str] | None = None,
) -> Aggregate:
    """Series mensais esparsas por estado, municipio (nomes do ISP) e bairro do Rio.

    ``cached`` mapeia ``AAAA-MM`` -> ocorrencias cruas daquele arquivo. Meses presentes em
    ``cached`` formam a cobertura: dentro dela, ausencia de ocorrencias vale 0; meses sem arquivo
    entre o primeiro e o ultimo valem ``null``.
    """

    canonical_municipalities = {_name_key(name): name for name in isp_municipalities}
    for alias, official in (municipality_aliases or {}).items():
        if _name_key(official) in canonical_municipalities:
            canonical_municipalities[_name_key(alias)] = canonical_municipalities[_name_key(official)]
    canonical_neighborhoods = {_name_key(name): name for name in rio_neighborhoods}
    rio_key = _name_key(RIO_CITY_NAME)

    measured_months = sorted(cached)
    if not measured_months:
        return Aggregate(series={code: {kind: {} for kind in TERRITORY_TYPES} for code in INDICATOR_CODES}, coverage=_empty_coverage())

    totals: dict[str, dict[str, dict[str, dict[str, int]]]] = {kind: {} for kind in TERRITORY_TYPES}
    unmatched_municipalities: dict[str, int] = {}
    unmatched_neighborhoods: dict[str, int] = {}
    seen: set[str] = set()
    occurrence_count = 0

    for file_month in measured_months:
        for raw in cached[file_month]:
            row = parse_occurrence(raw)
            if row is None:
                continue
            if row.occurrence_id:
                if row.occurrence_id in seen:
                    continue
                seen.add(row.occurrence_id)
            # Ocorrencia datada fora dos meses baixados (ex.: primeiro dia do mes seguinte): nao
            # ha arquivo que a represente por completo, entao ela nao entra em nenhuma serie.
            if row.month not in cached:
                continue
            occurrence_count += 1
            values = row.indicator_values()
            _add(totals["state"], STATE_TERRITORY_NAME, row.month, values)

            municipality = canonical_municipalities.get(row.municipality_key)
            if municipality:
                _add(totals["municipality"], municipality, row.month, values)
            elif row.municipality_raw:
                unmatched_municipalities[row.municipality_raw] = unmatched_municipalities.get(row.municipality_raw, 0) + 1

            if row.municipality_key == rio_key and row.neighborhood_raw:
                key = _name_key(row.neighborhood_raw)
                name = canonical_neighborhoods.get(key)
                if name is None and canonical_neighborhoods:
                    unmatched_neighborhoods[row.neighborhood_raw] = unmatched_neighborhoods.get(row.neighborhood_raw, 0) + 1
                _add(totals["neighborhood"], name or _display_name(row.neighborhood_raw), row.month, values)

    if unmatched_municipalities:
        logger.warning("Fogo Cruzado: cidades sem correspondencia no ISP: %s", sorted(unmatched_municipalities))
    if unmatched_neighborhoods:
        logger.info("Fogo Cruzado: %s bairros sem correspondencia no mapa do Rio", len(unmatched_neighborhoods))

    first, last = measured_months[0], measured_months[-1]
    window = [month_key(y, m) for y, m in months_between(_split_key(first), _split_key(last))]
    measured = set(measured_months)
    series: SeriesStore = {}
    for code in INDICATOR_CODES:
        series[code] = {}
        for kind in TERRITORY_TYPES:
            series[code][kind] = {}
            for territory_name in sorted(totals[kind]):
                by_month = totals[kind][territory_name]
                points: list[int | None] = [
                    (by_month.get(month, {}).get(code, 0) if month in measured else None) for month in window
                ]
                series[code][kind][territory_name] = {"from": first, "values": points}

    coverage: dict[str, object] = {
        "first_month": first,
        "last_month": last,
        "months_measured": len(measured_months),
        "months_missing": [month for month in window if month not in measured],
        "occurrences": occurrence_count,
        "territories": {kind: len(totals[kind]) for kind in TERRITORY_TYPES},
        "unmatched_municipalities": dict(sorted(unmatched_municipalities.items())),
        "unmatched_neighborhoods": len(unmatched_neighborhoods),
    }
    return Aggregate(series, coverage, unmatched_municipalities, unmatched_neighborhoods)


def _empty_coverage() -> dict[str, object]:
    return {
        "first_month": None,
        "last_month": None,
        "months_measured": 0,
        "months_missing": [],
        "occurrences": 0,
        "territories": {kind: 0 for kind in TERRITORY_TYPES},
        "unmatched_municipalities": {},
        "unmatched_neighborhoods": 0,
    }


def _add(store: dict[str, dict[str, dict[str, int]]], territory: str, month: str, values: Mapping[str, int]) -> None:
    bucket = store.setdefault(territory, {}).setdefault(month, {})
    for code, value in values.items():
        bucket[code] = bucket.get(code, 0) + value


def _split_key(key: str) -> tuple[int, int]:
    return int(key[:4]), int(key[5:7])


def _parse_datetime(value: object) -> datetime | None:
    """ISO 8601 com offset (``-03:00``) ou ``Z``. Datas sao reduzidas ao fuso de Brasilia."""

    if not value:
        return None
    text = str(value).strip()
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed
    return parsed.astimezone(LOCAL_TZ)


def _name_key(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    without_marks = "".join(ch for ch in normalized if not unicodedata.combining(ch))
    return re.sub(r"\s+", " ", without_marks.casefold().replace("-", " ")).strip()


_LOWER_WORDS = {"de", "da", "do", "das", "dos", "e"}


def _display_name(value: str) -> str:
    words = value.strip().split()
    output: list[str] = []
    for index, word in enumerate(words):
        lowered = word.casefold()
        output.append(lowered if index and lowered in _LOWER_WORDS else lowered.capitalize())
    return " ".join(output)


# --- Snapshot -------------------------------------------------------------------------------


def static_section(
    isp_municipalities: Iterable[str],
    rio_neighborhoods: Iterable[str] = (),
    directory: Path | None = None,
    sync: bool = True,
) -> dict[str, Any]:
    """Secao ``fogo_cruzado`` do snapshot. Baixa/atualiza o cache quando ``sync`` e verdadeiro."""

    from app.services.isp_repository import MUNICIPALITY_NAME_ALIASES

    directory = (directory or raw_dir()).resolve()
    if sync:
        try:
            sync_raw(directory=directory)
        except (httpx.HTTPError, FogoCruzadoError) as error:
            # A API limita logins (429). Com cache, o snapshot sai com os meses ja baixados.
            if not any(directory.glob("????-??.json")):
                raise
            logger.warning("Fogo Cruzado: sincronizacao falhou (%s); usando o cache", error)
    cached = load_cached(directory)
    result = aggregate(cached, isp_municipalities, rio_neighborhoods, MUNICIPALITY_NAME_ALIASES)
    return {
        "indicators": [{**indicator, "source_name": SOURCE_NAME} for indicator in INDICATORS],
        "territory_types": list(TERRITORY_TYPES),
        "series": result.series,
        "coverage": result.coverage,
        "source": source_row(directory),
    }


def source_row(directory: Path | None = None) -> dict[str, object]:
    """Linha para a lista ``sources`` do snapshot (checksum conjunto dos arquivos mensais)."""

    directory = (directory or raw_dir()).resolve()
    files = sorted(directory.glob("????-??.json")) if directory.exists() else []
    digest = hashlib.sha256()
    size = 0
    for path in files:
        digest.update(path.name.encode("utf-8"))
        digest.update(checksum_file(path).encode("ascii"))
        size += path.stat().st_size
    return {
        "name": "fogo_cruzado_occurrences_rj",
        "category": "shootings",
        "url": API_DOCS_URL,
        "file_name": f"fogocruzado/*.json ({len(files)} meses)",
        "checksum_sha256": digest.hexdigest() if files else None,
        "size_bytes": size if files else None,
        "available": bool(files),
        "source_name": SOURCE_NAME,
        "source_url": SOURCE_URL,
        "attribution": ATTRIBUTION,
    }
