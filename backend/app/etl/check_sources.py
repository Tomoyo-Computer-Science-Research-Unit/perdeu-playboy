"""Contratos dos arquivos oficiais de cada UF: colunas, chaves, intervalos e atraso de publicacao.

``python -m app.etl.check_sources [--uf RJ] [--json saida.json]`` baixa o que faltar, valida cada arquivo
e sai com codigo 1 quando algum contrato falha. Se o ISP mudar uma coluna ou publicar um
arquivo truncado, a falha aparece aqui antes de o snapshot ser regenerado. Atraso de
publicacao (ultimo mes apurado ha mais de quatro meses) e aviso, nao falha.
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import asdict, dataclass, field
from datetime import date
from pathlib import Path

import pandas as pd

from app.config import settings
from app.etl.sources import default_isp_sources
from app.etl.transform import normalize_column_name, read_isp_csv
from app.services import brasil_repository, isp_repository, sinesp_repository, ssp_repository
from app.uf import current, set_current

STALE_AFTER_MONTHS = 4
SSP_CALLS_PER_RUN = 3_000
MAX_UNKEYED_SHARE = 0.01


@dataclass(frozen=True)
class Contract:
    columns: tuple[str, ...]
    key: tuple[str, ...]
    min_rows: int
    first_year: int | None = None
    counts: tuple[str, ...] = ()
    # Arquivos do ISP: CSV com ";" e colunas ano/mes. Consolidados de SP e do Sinesp: CSV comum (gzip).
    reader: str = "isp"
    year_column: str = "ano"
    month_column: str = "mes"


INDICATOR_COLUMNS = (
    "hom_doloso",
    "lesao_corp_morte",
    "latrocinio",
    "hom_por_interv_policial",
    "feminicidio",
    "letalidade_violenta",
    "estupro",
    "roubo_rua",
    "roubo_veiculo",
    "roubo_carga",
)

CONTRACTS: dict[str, Contract] = {
    "DOMensalEstadoDesde1991.csv": Contract(
        columns=("ano", "mes") + INDICATOR_COLUMNS,
        key=("ano", "mes"),
        min_rows=400,
        first_year=1991,
        counts=INDICATOR_COLUMNS,
    ),
    "BaseDPEvolucaoMensalCisp.csv": Contract(
        columns=("cisp", "ano", "mes", "munic") + INDICATOR_COLUMNS,
        key=("cisp", "ano", "mes"),
        min_rows=30_000,
        first_year=2003,
        counts=INDICATOR_COLUMNS,
    ),
    "BaseMunicipioMensal.csv": Contract(
        columns=("fmun_cod", "fmun", "ano", "mes") + INDICATOR_COLUMNS,
        key=("fmun_cod", "ano", "mes"),
        min_rows=12_000,
        first_year=2014,
        counts=INDICATOR_COLUMNS,
    ),
    "ArmasApreendidasEvolucaoCisp.csv": Contract(
        columns=("cisp", "ano", "mes", "arma_fogo_total"),
        key=("cisp", "ano", "mes"),
        min_rows=25_000,
        first_year=2007,
        counts=("arma_fogo_total",),
    ),
    # Uma CISP que cobre mais de um municipio aparece uma vez por municipio.
    "Relacao_RISPxAISPxCISP.csv": Contract(
        columns=("risp", "aisp", "cisp", "unidade_territorial", "municipio"),
        key=("cisp", "municipio"),
        min_rows=100,
    ),
}

# Consolidado da SSP-SP (ssp_repository): uma linha por chamada, territorio, indicador e mes.
SSP_CONTRACT = Contract(
    columns=("source", "territory_type", "territory_id", "territory_name", "indicator", "year", "month", "value"),
    key=("source", "territory_type", "territory_id", "indicator", "year", "month"),
    min_rows=1_000,
    first_year=2001,
    counts=("value",),
    reader="csv",
    year_column="year",
    month_column="month",
)
# Extrato do Sinesp VDE de uma UF (sinesp_repository).
SINESP_CONTRACT = Contract(
    columns=("municipio", "indicator", "year", "month", "value"),
    key=("municipio", "indicator", "year", "month"),
    min_rows=500,
    first_year=2015,
    counts=("value",),
    reader="csv",
    year_column="year",
    month_column="month",
)


@dataclass
class FileReport:
    file_name: str
    rows: int = 0
    latest_month: str | None = None
    lag_months: int | None = None
    problems: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.problems


def check_file(path: Path, contract: Contract, today: date | None = None) -> FileReport:
    """Validate one official CSV against its contract."""

    report = FileReport(file_name=path.name)
    today = today or date.today()
    if not path.exists() or path.stat().st_size == 0:
        report.problems.append("arquivo ausente ou vazio")
        return report
    try:
        if contract.reader == "csv":
            frame = pd.read_csv(path)
            if "indicator" in frame.columns:
                # Linhas-marcador do consolidado de SP (chamada feita, sem valor) nao entram no contrato.
                frame = frame[frame["indicator"] != "_coleta"]
        else:
            frame = read_isp_csv(path)
    except Exception as exc:  # noqa: BLE001 - qualquer falha de leitura e quebra de contrato
        report.problems.append(f"nao foi possivel ler o CSV: {exc}")
        return report

    if contract.reader != "csv":
        frame = frame.rename(columns={column: normalize_column_name(column) for column in frame.columns})
    report.rows = int(len(frame))
    missing = [column for column in contract.columns if column not in frame.columns]
    if missing:
        report.problems.append(f"colunas ausentes: {', '.join(missing)}")
        return report
    if report.rows < contract.min_rows:
        report.problems.append(f"{report.rows} linhas; esperado ao menos {contract.min_rows}")

    keyed = frame.dropna(subset=list(contract.key))
    unkeyed = report.rows - len(keyed)
    if report.rows and unkeyed / report.rows > MAX_UNKEYED_SHARE:
        report.problems.append(f"{unkeyed} linhas sem chave ({', '.join(contract.key)})")
    duplicates = int(keyed.duplicated(subset=list(contract.key)).sum())
    if duplicates:
        report.problems.append(f"{duplicates} chaves repetidas ({', '.join(contract.key)})")

    if contract.first_year is not None:
        years = pd.to_numeric(keyed[contract.year_column], errors="coerce")
        months = pd.to_numeric(keyed[contract.month_column], errors="coerce")
        bad_years = int(((years < contract.first_year) | (years > today.year) | years.isna()).sum())
        bad_months = int(((months < 1) | (months > 12) | months.isna()).sum())
        if bad_years:
            report.problems.append(f"{bad_years} linhas com ano fora de {contract.first_year}–{today.year}")
        if bad_months:
            report.problems.append(f"{bad_months} linhas com mes fora de 1–12")
        valid = keyed[years.notna() & months.notna()]
        if not valid.empty:
            ordinal = pd.to_numeric(valid[contract.year_column]).astype(int) * 12 + pd.to_numeric(valid[contract.month_column]).astype(int) - 1
            latest = int(ordinal.max())
            latest_year, latest_month = divmod(latest, 12)
            report.latest_month = f"{latest_year:04d}-{latest_month + 1:02d}"
            now = today.year * 12 + today.month - 1
            report.lag_months = now - latest
            if latest > now:
                report.problems.append(f"ultimo mes {report.latest_month} esta no futuro")
            elif report.lag_months > STALE_AFTER_MONTHS:
                report.warnings.append(f"ultimo mes apurado {report.latest_month}, ha {report.lag_months} meses")

    for column in contract.counts:
        values = pd.to_numeric(frame[column], errors="coerce")
        negatives = int((values < 0).sum())
        if negatives:
            report.problems.append(f"{negatives} valores negativos em {column}")
        if values.notna().sum() == 0:
            report.problems.append(f"coluna {column} sem nenhum numero")

    return report


def check_all(download: bool = True) -> list[FileReport]:
    """Check every official file of the current UF; downloads what is missing when ``download``."""

    uf_source = current().source
    if uf_source == "ssp":
        if download:
            # No maximo 3.000 chamadas por rodada (50 min a 1 req/s): o ano corrente primeiro, depois os
            # anos municipais que ainda faltam no consolidado, do mais recente para o mais antigo.
            ssp_repository.download(budget=SSP_CALLS_PER_RUN)
            sinesp_repository.download()
            sinesp_repository.extract_uf("SP")
            ssp_repository.consolidate()
        return [
            check_file(ssp_repository.consolidated_path(), SSP_CONTRACT),
            check_file(sinesp_repository.extract_path("SP"), SINESP_CONTRACT),
        ]
    if uf_source == "brasil":
        # O Brasil roda depois das UFs no build-site.sh: os extratos ja estao em dia; falta so o do Rio
        # (servido pelo ISP), refeito aqui, e o de qualquer UF que nao tenha o seu.
        if download:
            sinesp_repository.download()
            sinesp_repository.extract_uf("RJ")
            brasil_repository.extract_missing()
        return [check_file(sinesp_repository.extract_path(code), SINESP_CONTRACT) for code in brasil_repository.uf_codes()]
    if uf_source == "sinesp":
        if download:
            sinesp_repository.download()
            sinesp_repository.extract_uf(current().code)
        return [check_file(sinesp_repository.extract_path(current().code), SINESP_CONTRACT)]

    raw_dir = settings.data_dir / "raw" / "isp"
    reports: list[FileReport] = []
    for source in default_isp_sources():
        path = isp_repository.ensure_source_file(source) if download else raw_dir / source.file_name
        reports.append(check_file(path, CONTRACTS[source.file_name]))
    division = raw_dir / "Relacao_RISPxAISPxCISP.csv"
    if division.exists():
        reports.append(check_file(division, CONTRACTS[division.name]))
    return reports


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--uf", default="RJ", help="sigla da UF (frontend/lib/ufs.json)")
    parser.add_argument("--json", type=Path, help="grava o relatorio em JSON neste caminho")
    parser.add_argument("--no-download", action="store_true", help="nao baixa arquivos ausentes")
    args = parser.parse_args(argv)

    set_current(args.uf)
    reports = check_all(download=not args.no_download)
    for report in reports:
        status = "OK " if report.ok else "ERRO"
        latest = f" ate {report.latest_month}" if report.latest_month else ""
        print(f"{status} {report.file_name}: {report.rows} linhas{latest}")
        for problem in report.problems:
            print(f"     ! {problem}")
        for warning in report.warnings:
            print(f"     ~ {warning}")

    if args.json:
        payload = {
            "checked_at": date.today().isoformat(),
            "uf": current().code,
            "ok": all(report.ok for report in reports),
            "files": [{**asdict(report), "ok": report.ok} for report in reports],
        }
        args.json.parent.mkdir(parents=True, exist_ok=True)
        args.json.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    return 0 if all(report.ok for report in reports) else 1


if __name__ == "__main__":
    sys.exit(main())
