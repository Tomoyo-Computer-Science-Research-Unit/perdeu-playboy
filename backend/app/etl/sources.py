from pydantic import BaseModel, ConfigDict, field_validator
from app.config import settings


class IspSource(BaseModel):
    """Official ISP source descriptor used by the bronze ETL layer."""

    model_config = ConfigDict(frozen=True)

    name: str
    url: str
    territory_type: str
    file_name: str

    @field_validator("url")
    @classmethod
    def validate_url(cls, value: str) -> str:
        """Validate source URLs while keeping a plain string for httpx."""

        if not value.startswith(("http://", "https://")):
            raise ValueError("source URL must be absolute HTTP(S)")
        return value


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
            name="isp_weapons_police_area",
            url=f"{base}/ArmasApreendidasEvolucaoCisp.csv",
            territory_type="police_area",
            file_name="ArmasApreendidasEvolucaoCisp.csv",
        ),
    ]
