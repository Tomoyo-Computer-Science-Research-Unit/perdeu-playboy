"""Unidade da federacao do snapshot em construcao.

A lista de UFs vem de uma configuracao unica, ``frontend/lib/ufs.json``, lida aqui e pelo frontend
(seletor de UF) e pelo ``deploy/g0v/build-site.sh`` (laco de ETL, build e publicacao). Cada UF diz de
qual fonte vem (``isp`` no Rio, ``ssp`` em Sao Paulo, ``sinesp`` para as demais) e se e publicada.

O Brasil entra na mesma lista com a sigla ``BR`` e a fonte ``brasil``: o pais faz o papel do estado e as
27 UFs o dos municipios (``app.services.brasil_repository``). Nao e uma UF: :func:`published_ufs` o deixa
de fora, e :func:`main` o imprime por ultimo, porque o snapshot nacional depende dos extratos das UFs.

O ETL roda uma UF por processo: ``python -m app.etl.export_static_frontend --uf SP`` chama
:func:`set_current` antes de ler qualquer coisa, e os repositorios consultam :func:`current`.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from types import ModuleType

UFS_PATH = Path(__file__).resolve().parents[2] / "frontend" / "lib" / "ufs.json"


@dataclass(frozen=True)
class UfConfig:
    code: str
    ibge_code: int
    name: str
    state_name: str
    capital: str
    source: str
    start_year: int
    published: bool

    @property
    def source_name(self) -> str:
        return {"isp": "ISP Dados Abertos", "ssp": "SSP-SP"}.get(self.source, "Sinesp VDE/MJSP")


@lru_cache(maxsize=1)
def all_ufs() -> dict[str, UfConfig]:
    rows = json.loads(UFS_PATH.read_text(encoding="utf-8"))
    return {row["code"]: UfConfig(**row) for row in rows}


COUNTRY_SOURCE = "brasil"


def published_ufs() -> list[UfConfig]:
    """As 27 UFs publicadas (sem o Brasil)."""

    return [uf for uf in all_ufs().values() if uf.published and uf.source != COUNTRY_SOURCE]


def country() -> UfConfig:
    """O nivel nacional (sigla BR)."""

    return next(uf for uf in all_ufs().values() if uf.source == COUNTRY_SOURCE)


def published_levels() -> list[UfConfig]:
    """UFs publicadas e, por ultimo, o Brasil, se publicado: a ordem do ETL no build-site.sh."""

    return [*published_ufs(), *([country()] if country().published else [])]


_current = "RJ"


def set_current(code: str) -> UfConfig:
    global _current
    key = code.upper()
    if key not in all_ufs():
        raise ValueError(f"UF desconhecida: {code}")
    _current = key
    return all_ufs()[key]


def current() -> UfConfig:
    return all_ufs()[_current]


def repository() -> ModuleType:
    """Repositorio de dados criminais da UF corrente (mesma interface: rows, territories, latest_period)."""

    source = current().source
    if source == "isp":
        from app.services import isp_repository

        return isp_repository
    if source == "ssp":
        from app.services import ssp_repository

        return ssp_repository
    if source == COUNTRY_SOURCE:
        from app.services import brasil_repository

        return brasil_repository
    from app.services import sinesp_repository

    return sinesp_repository


def main() -> None:
    """Imprime as siglas publicadas, uma por linha, o Brasil por ultimo (usado pelo build-site.sh)."""

    for uf in published_levels():
        print(uf.code)


if __name__ == "__main__":
    main()
