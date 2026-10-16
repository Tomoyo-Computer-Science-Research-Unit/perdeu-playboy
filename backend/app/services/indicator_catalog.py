from app.schemas import IndicatorOut


INDICATORS: list[IndicatorOut] = [
    IndicatorOut(
        code="homicidio_doloso",
        name="Homicidio doloso",
        category="Crimes contra a vida",
        description="Mortes intencionais registradas como homicidio doloso.",
    ),
    IndicatorOut(
        code="lesao_corp_morte",
        name="Lesao corporal seguida de morte",
        category="Crimes contra a vida",
        description="Lesao corporal com resultado morte.",
    ),
    IndicatorOut(
        code="latrocinio",
        name="Latrocinio",
        category="Crimes contra o patrimonio com morte",
        description="Roubo seguido de morte.",
    ),
    IndicatorOut(
        code="letalidade_violenta",
        name="Letalidade violenta",
        category="Indicador agregado",
        description="Soma de homicidio doloso, latrocinio, lesao corporal seguida de morte e morte por intervencao de agente do Estado.",
    ),
    IndicatorOut(
        code="morte_interv_policial",
        name="Morte por intervencao de agente do Estado",
        category="Atividade policial",
        description="Mortes decorrentes de intervencao de agentes do Estado, conforme registro oficial.",
    ),
    IndicatorOut(
        code="feminicidio",
        name="Feminicidio",
        category="Violencia de genero",
        description="Homicidio contra mulher por razoes da condicao de sexo feminino, conforme lei aplicavel.",
    ),
    IndicatorOut(
        code="roubo_rua",
        name="Roubo de rua",
        category="Crimes contra o patrimonio",
        description="Agregado usual de roubos em via publica, conforme disponibilidade do ISP.",
    ),
    IndicatorOut(
        code="roubo_veiculo",
        name="Roubo de veiculo",
        category="Crimes contra o patrimonio",
        description="Subtracao de veiculo mediante violencia ou grave ameaca.",
    ),
    IndicatorOut(
        code="roubo_carga",
        name="Roubo de carga",
        category="Crimes contra o patrimonio",
        description="Roubo de carga registrado em ocorrencias policiais.",
    ),
    IndicatorOut(
        code="estupro",
        name="Estupro",
        category="Violencia sexual",
        description="Registros de estupro conforme classificacao policial.",
    ),
    IndicatorOut(
        code="apreensao_armas",
        name="Armas apreendidas",
        category="Apreensoes",
        description="Armas de fogo apreendidas quando disponiveis na base selecionada.",
        unit="armas",
    ),
]

# Sao Paulo: a SSP-SP nao separa roubo de rua (transeunte, celular, coletivo). O equivalente
# honesto e o "roubo - outros" da SSP, todos os roubos que nao sao de veiculo, de carga ou a banco,
# com nome proprio para nao ser comparado ao roubo de rua do ISP.
ROUBO_OUTROS = IndicatorOut(
    code="roubo_outros",
    name="Roubo (outros)",
    category="Crimes contra o patrimônio",
    description="Roubos que a SSP-SP não classifica como de veículo, de carga ou a banco: pessoas na rua, celulares, residências, comércio.",
)

SP_INDICATOR_CODES = [
    "homicidio_doloso",
    "lesao_corp_morte",
    "latrocinio",
    "letalidade_violenta",
    "morte_interv_policial",
    "feminicidio",
    "roubo_outros",
    "roubo_veiculo",
    "roubo_carga",
    "estupro",
    "apreensao_armas",
]

INDICATOR_BY_CODE = {indicator.code: indicator for indicator in [*INDICATORS, ROUBO_OUTROS]}


# UFs sem fonte estadual propria e o Brasil (Sinesp VDE): o VDE nao tem roubo a transeunte nem roubo em geral.
SINESP_INDICATOR_CODES = [code for code in SP_INDICATOR_CODES if code != "roubo_outros"]


# Nomes acentuados para as UFs novas. O snapshot do Rio guarda os nomes sem acento de sempre; trocar
# os do Rio mudaria rotulos e testes ja publicados.
ACCENTED: dict[str, dict[str, str]] = {
    "homicidio_doloso": {"name": "Homicídio doloso", "description": "Vítimas de homicídio doloso."},
    "lesao_corp_morte": {"name": "Lesão corporal seguida de morte", "description": "Lesão corporal com resultado morte."},
    "latrocinio": {"name": "Latrocínio", "category": "Crimes contra o patrimônio com morte", "description": "Vítimas de roubo seguido de morte."},
    "letalidade_violenta": {
        "description": "Soma de homicídio doloso, latrocínio, lesão corporal seguida de morte e morte por intervenção de agente do Estado.",
    },
    "morte_interv_policial": {
        "name": "Morte por intervenção de agente do Estado",
        "category": "Atividade policial",
        "description": "Mortes decorrentes de intervenção de agentes do Estado, conforme registro oficial.",
    },
    "feminicidio": {
        "name": "Feminicídio",
        "category": "Violência de gênero",
        "description": "Homicídio de mulher por razões da condição de sexo feminino (Lei 13.104/2015).",
    },
    "roubo_veiculo": {"name": "Roubo de veículo", "category": "Crimes contra o patrimônio", "description": "Subtração de veículo mediante violência ou grave ameaça."},
    "roubo_carga": {"category": "Crimes contra o patrimônio", "description": "Roubo de carga registrado em ocorrência policial."},
    "estupro": {"category": "Violência sexual", "description": "Estupro e estupro de vulnerável."},
    "apreensao_armas": {"description": "Armas de fogo apreendidas."},
}


def _accented(code: str) -> IndicatorOut:
    return INDICATOR_BY_CODE[code].model_copy(update=ACCENTED.get(code, {}))


def indicators_for(source: str) -> list[IndicatorOut]:
    """Indicadores publicados no snapshot de uma UF conforme a fonte (isp, ssp, sinesp), na ordem dos cartoes."""

    if source == "ssp":
        return [_accented(code) for code in SP_INDICATOR_CODES]
    if source in ("sinesp", "brasil"):
        return [_accented(code) for code in SINESP_INDICATOR_CODES]
    return list(INDICATORS)
