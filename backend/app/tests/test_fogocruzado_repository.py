"""Testes offline do repositorio Fogo Cruzado (fixtures sinteticas; sem rede)."""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path
from typing import Any

import httpx
import pytest

from app.etl import export_static_frontend
from app.services import fogocruzado_repository as fc

FIXTURES = Path(__file__).parent / "fixtures" / "fogocruzado"
ISP_MUNICIPALITIES = ["Rio de Janeiro", "São Gonçalo", "Niterói", "Duque de Caxias", "Magé"]
RIO_NEIGHBORHOODS = ["Copacabana", "São Cristóvão", "Mangueira"]


def _fixture(name: str) -> dict[str, Any]:
    payload: dict[str, Any] = json.loads((FIXTURES / name).read_text(encoding="utf-8"))
    return payload


def _page(number: int) -> dict[str, Any]:
    return _fixture(f"occurrences_page{number}.json")


class FakeApi:
    """Transporte httpx que imita a API v2: login, refresh, states e occurrences paginadas."""

    def __init__(self, fail_first_with: int | None = None, expire_first_token: bool = False) -> None:
        self.calls: list[tuple[str, str, dict[str, str]]] = []
        self.logins = 0
        self.refreshes = 0
        self.fail_first_with = fail_first_with
        self.expire_first_token = expire_first_token
        self.transport = httpx.MockTransport(self.handle)

    def handle(self, request: httpx.Request) -> httpx.Response:
        params = dict(request.url.params)
        self.calls.append((request.method, request.url.path, params))
        if request.url.path.endswith("/auth/login"):
            self.logins += 1
            body = json.loads(request.content)
            if body != {"email": "user@example.org", "password": "secret"}:
                return httpx.Response(401, json={"msg": "Unauthorized access. Incorrect credentials.", "code": 401})
            payload = _fixture("login.json")
            payload["data"]["accessToken"] = f"token-{self.logins}"
            return httpx.Response(201, json=payload)
        if request.url.path.endswith("/auth/refresh"):
            self.refreshes += 1
            payload = _fixture("login.json")
            payload["data"]["accessToken"] = f"refreshed-{self.refreshes}"
            return httpx.Response(201, json=payload)

        auth = request.headers.get("Authorization", "")
        if not auth.startswith("Bearer ") or (self.expire_first_token and auth == "Bearer token-1"):
            return httpx.Response(401, json={"msg": "Unauthorized", "code": 401})
        if self.fail_first_with is not None:
            status, self.fail_first_with = self.fail_first_with, None
            return httpx.Response(status, headers={"Retry-After": "0"}, json={"msg": "busy"})

        if request.url.path.endswith("/states"):
            return httpx.Response(200, json=_fixture("states.json"))
        if request.url.path.endswith("/occurrences"):
            page = int(params.get("page", "1"))
            if params.get("initialdate", "").startswith("2016-07"):
                return httpx.Response(200, json=_page(page), headers={"X-Last-Update": "2026-10-13T10:00:00-03:00"})
            empty = {"msg": "ok", "code": 200, "pageMeta": {"page": 1, "take": 100, "itemCount": 0, "pageCount": 0, "hasPreviousPage": False, "hasNextPage": False}, "data": []}
            return httpx.Response(200, json=empty)
        return httpx.Response(404, json={"msg": "not found"})


def _client(api: FakeApi, **kwargs: Any) -> fc.FogoCruzadoClient:
    return fc.FogoCruzadoClient(
        email="user@example.org",
        password="secret",
        token="",
        base_url="https://api.test/api/v2",
        http=httpx.Client(transport=api.transport),
        sleep=lambda _seconds: None,
        **kwargs,
    )


# --- cliente -----------------------------------------------------------------------------------


def test_login_sends_credentials_and_uses_bearer_token() -> None:
    api = FakeApi()
    client = _client(api)

    states = client.states()

    assert api.logins == 1
    assert [state["name"] for state in states][:2] == ["Rio de Janeiro", "Pernambuco"]
    assert client.state_id() == "00000000-0000-4000-8000-00000000rj01"
    assert api.logins == 1, "token em memoria e reutilizado"


def test_wrong_credentials_raise() -> None:
    api = FakeApi()
    client = fc.FogoCruzadoClient(email="x@y", password="bad", token="", base_url="https://api.test/api/v2", http=httpx.Client(transport=api.transport))

    with pytest.raises(fc.FogoCruzadoError):
        client.states()


def test_401_triggers_single_refresh_then_retry() -> None:
    api = FakeApi(expire_first_token=True)
    client = _client(api)

    client.states()

    assert api.refreshes == 1
    paths = [path for _method, path, _params in api.calls]
    assert paths == ["/api/v2/auth/login", "/api/v2/states", "/api/v2/auth/refresh", "/api/v2/states"]


@pytest.mark.parametrize("status", [429, 503])
def test_transient_errors_are_retried(status: int) -> None:
    api = FakeApi(fail_first_with=status)
    client = _client(api)

    assert client.states()
    assert [path for _m, path, _p in api.calls].count("/api/v2/states") == 2


# --- paginacao --------------------------------------------------------------------------------


def test_collect_pages_follows_page_meta() -> None:
    requested: list[int] = []

    def fetch(page: int) -> dict[str, Any]:
        requested.append(page)
        return _page(page)

    items = fc.collect_pages(fetch)

    assert requested == [1, 2]
    assert [item["id"] for item in items] == ["occ-0001", "occ-0002", "occ-0003", "occ-0004", "occ-0005"]


def test_fetch_month_requests_month_window_with_filters() -> None:
    api = FakeApi()
    client = _client(api)

    items = fc.fetch_month(client, "rj", 2016, 7, take=3)

    assert len(items) == 5
    occurrence_calls = [params for _m, path, params in api.calls if path.endswith("/occurrences")]
    assert [call["page"] for call in occurrence_calls] == ["1", "2"]
    assert occurrence_calls[0]["idState"] == "rj"
    assert occurrence_calls[0]["initialdate"] == "2016-07-01"
    assert occurrence_calls[0]["finaldate"] == "2016-08-01"
    assert occurrence_calls[0]["typeOccurrence"] == "all"
    assert occurrence_calls[0]["take"] == "3"


def test_sync_raw_caches_months_and_only_refreshes_recent_ones(tmp_path: Path) -> None:
    api = FakeApi()
    client = _client(api)
    stale = tmp_path / "2016-08.json"
    stale.write_text(json.dumps({"month": "2016-08", "occurrences": [{"id": "old"}]}), encoding="utf-8")

    paths = fc.sync_raw(client, directory=tmp_path, today=date(2016, 10, 15))

    assert [path.name for path in paths] == ["2016-07.json", "2016-08.json", "2016-09.json", "2016-10.json"]
    cached = fc.load_cached(tmp_path)
    assert len(cached["2016-07"]) == 5
    assert cached["2016-08"] == [{"id": "old"}], "mes passado em cache nao e rebaixado"
    envelope = json.loads((tmp_path / "2016-07.json").read_text(encoding="utf-8"))
    assert envelope["item_count"] == 5 and envelope["last_update"] == "2026-10-13T10:00:00-03:00"
    months_fetched = sorted({params["initialdate"][:7] for _m, path, params in api.calls if path.endswith("/occurrences")})
    assert months_fetched == ["2016-07", "2016-09", "2016-10"]

    # Segunda rodada: so o mes corrente e o anterior sao refeitos.
    api.calls.clear()
    fc.sync_raw(client, directory=tmp_path, today=date(2016, 10, 15))
    months_fetched = sorted({params["initialdate"][:7] for _m, path, params in api.calls if path.endswith("/occurrences")})
    assert months_fetched == ["2016-09", "2016-10"]


# --- agregacao --------------------------------------------------------------------------------


def _cached_sample() -> dict[str, list[dict[str, Any]]]:
    july = _page(1)["data"] + _page(2)["data"]
    august_extra = {
        "id": "occ-0006",
        "city": {"id": "city-mage", "name": "MAGE"},
        "neighborhood": {"id": "nb-x", "name": "PIABETA"},
        "date": "2016-08-10T12:00:00.000-03:00",
        "policeAction": False,
        "agentPresence": False,
        "victims": [{"type": "People", "situation": "Dead", "personType": "Civilian"}],
    }
    unknown_city: dict[str, Any] = {
        "id": "occ-0007",
        "city": {"id": "city-?", "name": "CIDADE INEXISTENTE"},
        "neighborhood": None,
        "date": "2016-08-11T12:00:00.000-03:00",
        "policeAction": True,
        "agentPresence": True,
        "victims": [],
    }
    # occ-0005 (02:30Z = 23:30 de 31/jul em Brasilia) tambem vem no arquivo de agosto: deduplicado
    # e contado em julho.
    return {
        "2016-07": july,
        "2016-08": [_page(2)["data"][1], august_extra, unknown_city],
        "2016-10": [],
    }


def test_aggregate_builds_sparse_series_with_null_outside_measured_months() -> None:
    result = fc.aggregate(_cached_sample(), ISP_MUNICIPALITIES, RIO_NEIGHBORHOODS)

    state = result.series["tiroteios"]["state"][fc.STATE_TERRITORY_NAME]
    # Julho: occ-0001..0005. Agosto: occ-0006 e occ-0007 (occ-0005 repetido e descartado).
    assert state == {"from": "2016-07", "values": [5, 2, None, 0]}
    assert result.coverage["first_month"] == "2016-07"
    assert result.coverage["last_month"] == "2016-10"
    assert result.coverage["months_missing"] == ["2016-09"]
    assert result.coverage["occurrences"] == 7


def test_aggregate_counts_victims_and_agents() -> None:
    result = fc.aggregate(_cached_sample(), ISP_MUNICIPALITIES, RIO_NEIGHBORHOODS)
    state = {code: result.series[code]["state"][fc.STATE_TERRITORY_NAME]["values"] for code in fc.INDICATOR_CODES}

    assert state["mortos"] == [2, 1, None, 0]
    assert state["feridos"] == [2, 0, None, 0]
    assert state["mortos_agentes"] == [1, 0, None, 0]
    assert state["feridos_agentes"] == [1, 0, None, 0]
    assert state["tiroteios_com_agentes"] == [2, 1, None, 0]
    assert state["tiroteios_acao_policial"] == [1, 1, None, 0]


def test_aggregate_matches_municipalities_to_isp_names_and_reports_unmatched() -> None:
    result = fc.aggregate(_cached_sample(), ISP_MUNICIPALITIES, RIO_NEIGHBORHOODS)
    municipalities = result.series["tiroteios"]["municipality"]

    assert set(municipalities) == {"Rio de Janeiro", "São Gonçalo", "Niterói", "Magé"}
    assert municipalities["Rio de Janeiro"] == {"from": "2016-07", "values": [3, 0, None, 0]}
    assert municipalities["São Gonçalo"]["values"] == [1, 0, None, 0], "mes medido sem ocorrencia vale 0"
    assert municipalities["Magé"]["values"] == [0, 1, None, 0]
    assert result.unmatched_municipalities == {"CIDADE INEXISTENTE": 1}
    assert result.coverage["unmatched_municipalities"] == {"CIDADE INEXISTENTE": 1}
    # Municipios do ISP sem nenhuma ocorrencia nao ganham serie (cobertura do Fogo Cruzado e parcial).
    assert "Duque de Caxias" not in municipalities


def test_aggregate_neighborhoods_only_for_rio_city_with_map_names() -> None:
    result = fc.aggregate(_cached_sample(), ISP_MUNICIPALITIES, RIO_NEIGHBORHOODS)
    neighborhoods = result.series["tiroteios"]["neighborhood"]

    assert set(neighborhoods) == {"Copacabana", "São Cristóvão"}, "CENTRO de Niteroi/Sao Goncalo fica de fora"
    assert neighborhoods["Copacabana"]["values"] == [2, 0, None, 0]
    assert neighborhoods["São Cristóvão"]["values"] == [1, 0, None, 0]
    assert result.unmatched_neighborhoods == {}


def test_aggregate_without_map_names_falls_back_to_title_case() -> None:
    result = fc.aggregate(_cached_sample(), ISP_MUNICIPALITIES)

    assert set(result.series["tiroteios"]["neighborhood"]) == {"Copacabana", "Sao Cristovao"}


def test_municipality_alias_is_applied() -> None:
    cached = {"2020-01": [{"id": "a", "city": {"name": "BOM JESUS DE ITABAPOANA"}, "date": "2020-01-02T10:00:00-03:00", "victims": []}]}

    result = fc.aggregate(cached, ["Bom Jesus do Itabapoana"], municipality_aliases={"Bom Jesus de Itabapoana": "Bom Jesus do Itabapoana"})

    assert result.series["tiroteios"]["municipality"] == {"Bom Jesus do Itabapoana": {"from": "2020-01", "values": [1]}}
    assert result.unmatched_municipalities == {}


def test_parse_occurrence_converts_utc_to_brasilia_month() -> None:
    row = fc.parse_occurrence({"id": "z", "city": {"name": "RIO DE JANEIRO"}, "date": "2016-08-01T02:30:00.000Z", "victims": []})

    assert row is not None
    assert row.month == "2016-07"
    assert fc.parse_occurrence({"id": "no-date", "date": None}) is None


def test_aggregate_empty_cache() -> None:
    result = fc.aggregate({}, ISP_MUNICIPALITIES)

    assert result.coverage["first_month"] is None
    assert all(result.series[code][kind] == {} for code in fc.INDICATOR_CODES for kind in fc.TERRITORY_TYPES)


# --- snapshot ---------------------------------------------------------------------------------


def test_source_is_disabled_by_default(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(fc.settings, "enable_fogocruzado", False)
    monkeypatch.setattr(fc.settings, "fogocruzado_email", "user@example.org")
    monkeypatch.setattr(fc.settings, "fogocruzado_password", "secret")
    assert fc.enabled() is False

    monkeypatch.setattr(fc.settings, "enable_fogocruzado", True)
    monkeypatch.setattr(fc.settings, "fogocruzado_email", None)
    monkeypatch.setattr(fc.settings, "fogocruzado_password", None)
    monkeypatch.setattr(fc.settings, "fogocruzado_api_token", None)
    assert fc.enabled() is False, "flag ligada sem credenciais nao ativa a fonte"

    monkeypatch.setattr(fc.settings, "fogocruzado_api_token", "jwt")
    assert fc.enabled() is True


def test_sources_list_unchanged_when_disabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(fc.settings, "enable_fogocruzado", False)
    names = [row["name"] for row in export_static_frontend._source_metadata()]
    assert "fogo_cruzado_occurrences_rj" not in names

    monkeypatch.setattr(fc.settings, "enable_fogocruzado", True)
    monkeypatch.setattr(fc.settings, "fogocruzado_api_token", "jwt")
    names = [row["name"] for row in export_static_frontend._source_metadata()]
    assert names[-1] == "fogo_cruzado_occurrences_rj"


def test_static_section_uses_cache_without_network(tmp_path: Path) -> None:
    (tmp_path / "2016-07.json").write_text(json.dumps({"month": "2016-07", "occurrences": _page(1)["data"] + _page(2)["data"]}), encoding="utf-8")

    section = fc.static_section(ISP_MUNICIPALITIES, RIO_NEIGHBORHOODS, directory=tmp_path, sync=False)

    assert [indicator["code"] for indicator in section["indicators"]] == fc.INDICATOR_CODES
    assert section["series"]["tiroteios"]["state"][fc.STATE_TERRITORY_NAME] == {"from": "2016-07", "values": [5]}
    source = section["source"]
    assert source["available"] is True and source["checksum_sha256"] and source["size_bytes"]
    assert "Fogo Cruzado" in source["attribution"]
    assert section["coverage"]["territories"] == {"state": 1, "municipality": 3, "neighborhood": 2}
