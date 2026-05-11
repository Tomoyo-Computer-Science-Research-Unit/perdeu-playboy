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

INDICATOR_BY_CODE = {indicator.code: indicator for indicator in INDICATORS}

