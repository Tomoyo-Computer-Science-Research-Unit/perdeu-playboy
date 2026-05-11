from dataclasses import dataclass

from app.config import settings


@dataclass(frozen=True)
class IspSource:
    name: str
    url: str
    territory_type: str
    file_name: str


def default_isp_sources() -> list[IspSource]:
    base = settings.isp_data_base_url.rstrip("/")
    return [
        IspSource(
            name="isp_monthly_state",
            url=f"{base}/DOMensalEstadoDesde1991.csv",
            territory_type="state",
            file_name="DOMensalEstadoDesde1991.csv",
        ),
        IspSource(
            name="isp_monthly_police_area",
            url=f"{base}/BaseDPEvolucaoMensalCisp.csv",
            territory_type="police_area",
            file_name="BaseDPEvolucaoMensalCisp.csv",
        ),
        IspSource(
            name="isp_monthly_municipality",
            url=f"{base}/BaseMunicipioMensal.csv",
            territory_type="municipality",
            file_name="BaseMunicipioMensal.csv",
        ),
        IspSource(
            name="isp_feminicide_police_area",
            url=f"{base}/BaseFeminicidioEvolucaoMensalCisp.csv",
            territory_type="police_area",
            file_name="BaseFeminicidioEvolucaoMensalCisp.csv",
        ),
        IspSource(
            name="isp_weapons_police_area",
            url=f"{base}/ArmasApreendidasEvolucaoCisp.csv",
            territory_type="police_area",
            file_name="ArmasApreendidasEvolucaoCisp.csv",
        ),
    ]
