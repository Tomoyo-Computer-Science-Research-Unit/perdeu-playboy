from __future__ import annotations

from datetime import date

import pandas as pd
from pydantic import BaseModel, ConfigDict

from app.schemas import GovernorPerformanceOut, GovernorPerformanceRow
from app.services.indicator_catalog import INDICATOR_BY_CODE
from app.uf import current as current_uf, repository

SCORE_INDICATORS = [
    "homicidio_doloso",
    "lesao_corp_morte",
    "latrocinio",
    "letalidade_violenta",
    "morte_interv_policial",
    "feminicidio",
    "roubo_rua",
    "roubo_veiculo",
    "roubo_carga",
    "estupro",
]


class GovernorTerm(BaseModel):
    """Validated governor term used by the performance calculator."""

    model_config = ConfigDict(frozen=True)

    governor: str
    party_or_condition: str
    start: date
    end: date | None


GOVERNOR_TERMS = [
    GovernorTerm(
        governor="Leonel Brizola",
        party_or_condition="PDT",
        start=date(1991, 1, 1),
        end=date(1994, 12, 31),
    ),
    GovernorTerm(
        governor="Marcello Alencar",
        party_or_condition="PSDB",
        start=date(1995, 1, 1),
        end=date(1998, 12, 31),
    ),
    GovernorTerm(
        governor="Anthony Garotinho",
        party_or_condition="PDT",
        start=date(1999, 1, 1),
        end=date(2002, 4, 5),
    ),
    GovernorTerm(
        governor="Benedita da Silva",
        party_or_condition="em exercício",
        start=date(2002, 4, 6),
        end=date(2002, 12, 31),
    ),
    GovernorTerm(
        governor="Rosinha Garotinho",
        party_or_condition="PSB",
        start=date(2003, 1, 1),
        end=date(2006, 12, 31),
    ),
    GovernorTerm(
        governor="Sérgio Cabral",
        party_or_condition="PMDB",
        start=date(2007, 1, 1),
        end=date(2014, 4, 3),
    ),
    GovernorTerm(
        governor="Luiz Fernando Pezão",
        party_or_condition="PMDB",
        start=date(2014, 4, 4),
        end=date(2018, 12, 31),
    ),
    GovernorTerm(
        governor="Wilson Witzel",
        party_or_condition="PSC",
        start=date(2019, 1, 1),
        end=date(2020, 8, 27),
    ),
    GovernorTerm(
        governor="Cláudio Castro",
        party_or_condition="PSC/PL",
        start=date(2020, 8, 28),
        end=date(2026, 3, 23),
    ),
    GovernorTerm(
        governor="Ricardo Couto",
        party_or_condition="interino/em exercício",
        start=date(2026, 3, 24),
        end=None,
    ),
]


# Prefeitos da cidade do Rio de Janeiro desde 1989, para as faixas de mandato quando o recorte
# e o municipio do Rio ou uma de suas areas integradas. Nao entram no ranking de desempenho.
MAYOR_TERMS: dict[str, list[GovernorTerm]] = {
    "Rio de Janeiro": [
        GovernorTerm(governor="Marcello Alencar", party_or_condition="PDT", start=date(1989, 1, 1), end=date(1992, 12, 31)),
        GovernorTerm(governor="César Maia", party_or_condition="PMDB", start=date(1993, 1, 1), end=date(1996, 12, 31)),
        GovernorTerm(governor="Luiz Paulo Conde", party_or_condition="PFL", start=date(1997, 1, 1), end=date(2000, 12, 31)),
        GovernorTerm(governor="César Maia", party_or_condition="PTB / PFL / DEM", start=date(2001, 1, 1), end=date(2008, 12, 31)),
        GovernorTerm(governor="Eduardo Paes", party_or_condition="PMDB", start=date(2009, 1, 1), end=date(2016, 12, 31)),
        GovernorTerm(governor="Marcelo Crivella", party_or_condition="PRB / Republicanos", start=date(2017, 1, 1), end=date(2020, 12, 31)),
        GovernorTerm(governor="Eduardo Paes", party_or_condition="DEM / PSD", start=date(2021, 1, 1), end=None),
    ],
}


# Governadores de Sao Paulo desde o inicio da serie da SSP (2001). Datas de posse e saida conforme a
# lista de governantes do estado (Covas morreu em 6/3/2001; Alckmin, Serra, Alckmin e Doria renunciaram
# para disputar eleicoes; Tarcisio foi reeleito em 4/10/2026).
SP_GOVERNOR_TERMS = [
    GovernorTerm(governor="Mário Covas", party_or_condition="PSDB", start=date(1995, 1, 1), end=date(2001, 3, 5)),
    GovernorTerm(governor="Geraldo Alckmin", party_or_condition="PSDB", start=date(2001, 3, 6), end=date(2006, 3, 30)),
    GovernorTerm(governor="Cláudio Lembo", party_or_condition="PFL", start=date(2006, 3, 31), end=date(2006, 12, 31)),
    GovernorTerm(governor="José Serra", party_or_condition="PSDB", start=date(2007, 1, 1), end=date(2010, 4, 1)),
    GovernorTerm(governor="Alberto Goldman", party_or_condition="PSDB", start=date(2010, 4, 2), end=date(2010, 12, 31)),
    GovernorTerm(governor="Geraldo Alckmin", party_or_condition="PSDB", start=date(2011, 1, 1), end=date(2018, 4, 5)),
    GovernorTerm(governor="Márcio França", party_or_condition="PSB", start=date(2018, 4, 6), end=date(2018, 12, 31)),
    GovernorTerm(governor="João Doria", party_or_condition="PSDB", start=date(2019, 1, 1), end=date(2022, 3, 31)),
    GovernorTerm(governor="Rodrigo Garcia", party_or_condition="PSDB", start=date(2022, 4, 1), end=date(2022, 12, 31)),
    GovernorTerm(governor="Tarcísio de Freitas", party_or_condition="Republicanos", start=date(2023, 1, 1), end=None),
]

# Prefeitos da cidade de Sao Paulo desde 2001.
SP_MAYOR_TERMS: dict[str, list[GovernorTerm]] = {
    "São Paulo": [
        GovernorTerm(governor="Marta Suplicy", party_or_condition="PT", start=date(2001, 1, 1), end=date(2004, 12, 31)),
        GovernorTerm(governor="José Serra", party_or_condition="PSDB", start=date(2005, 1, 1), end=date(2006, 3, 30)),
        GovernorTerm(governor="Gilberto Kassab", party_or_condition="PFL / DEM / PSD", start=date(2006, 3, 31), end=date(2012, 12, 31)),
        GovernorTerm(governor="Fernando Haddad", party_or_condition="PT", start=date(2013, 1, 1), end=date(2016, 12, 31)),
        GovernorTerm(governor="João Doria", party_or_condition="PSDB", start=date(2017, 1, 1), end=date(2018, 4, 5)),
        GovernorTerm(governor="Bruno Covas", party_or_condition="PSDB", start=date(2018, 4, 6), end=date(2021, 5, 15)),
        GovernorTerm(governor="Ricardo Nunes", party_or_condition="MDB", start=date(2021, 5, 16), end=None),
    ],
}

# Minas Gerais (UF de teste da fonte Sinesp VDE, serie desde 2015). Zema renunciou em 22/3/2026.
MG_GOVERNOR_TERMS = [
    GovernorTerm(governor="Fernando Pimentel", party_or_condition="PT", start=date(2015, 1, 1), end=date(2018, 12, 31)),
    GovernorTerm(governor="Romeu Zema", party_or_condition="Novo", start=date(2019, 1, 1), end=date(2026, 3, 21)),
    GovernorTerm(governor="Mateus Simões", party_or_condition="PSD", start=date(2026, 3, 22), end=None),
]
MG_MAYOR_TERMS: dict[str, list[GovernorTerm]] = {
    "Belo Horizonte": [
        GovernorTerm(governor="Marcio Lacerda", party_or_condition="PSB", start=date(2009, 1, 1), end=date(2016, 12, 31)),
        GovernorTerm(governor="Alexandre Kalil", party_or_condition="PHS / PSD", start=date(2017, 1, 1), end=date(2022, 3, 28)),
        GovernorTerm(governor="Fuad Noman", party_or_condition="PSD", start=date(2022, 3, 29), end=date(2025, 3, 25)),
        GovernorTerm(governor="Álvaro Damião", party_or_condition="União Brasil", start=date(2025, 3, 26), end=None),
    ],
}


# Demais UFs servidas pelo Sinesp VDE (serie desde 2015): quem exerceu o cargo, com posse e saida
# (renuncias para disputar eleicoes, cassacoes, afastamentos judiciais, interinos). Viagens e licencas
# curtas do titular ficam de fora. Conferido em 2026-10-16 nas listas de governadores e prefeitos da
# Wikipedia e em noticias de cada troca; o primeiro mandato comeca na posse do titular, mesmo antes de 2015.
T = GovernorTerm
AC_GOVERNOR_TERMS = [
    T(governor="Tião Viana", party_or_condition="PT", start=date(2011, 1, 1), end=date(2018, 12, 31)),
    T(governor="Gladson Cameli", party_or_condition="PP", start=date(2019, 1, 1), end=date(2026, 4, 1)),
    T(governor="Mailza Assis", party_or_condition="PP", start=date(2026, 4, 2), end=None),
]
AC_MAYOR_TERMS = {
    "Rio Branco": [
        T(governor="Marcus Alexandre", party_or_condition="PT", start=date(2013, 1, 1), end=date(2018, 4, 5)),
        T(governor="Socorro Neri", party_or_condition="PSB", start=date(2018, 4, 6), end=date(2020, 12, 31)),
        T(governor="Tião Bocalom", party_or_condition="PP / PL", start=date(2021, 1, 1), end=date(2026, 4, 2)),
        T(governor="Alysson Bestene", party_or_condition="PP", start=date(2026, 4, 3), end=None),
    ],
}
# Renan Filho renunciou em 2/4/2022; o presidente do TJAL governou ate a eleicao indireta. Dantas foi
# afastado pelo STJ de 11 a 23/10/2022.
AL_GOVERNOR_TERMS = [
    T(governor="Renan Filho", party_or_condition="MDB", start=date(2015, 1, 1), end=date(2022, 4, 1)),
    T(governor="Klever Loureiro", party_or_condition="interino (presidente do TJAL)", start=date(2022, 4, 2), end=date(2022, 5, 14)),
    T(governor="Paulo Dantas", party_or_condition="MDB", start=date(2022, 5, 15), end=date(2022, 10, 10)),
    T(governor="José Wanderley Neto", party_or_condition="em exercício", start=date(2022, 10, 11), end=date(2022, 10, 23)),
    T(governor="Paulo Dantas", party_or_condition="MDB", start=date(2022, 10, 24), end=None),
]
AL_MAYOR_TERMS = {
    "Maceió": [
        T(governor="Rui Palmeira", party_or_condition="PSDB", start=date(2013, 1, 1), end=date(2020, 12, 31)),
        T(governor="JHC", party_or_condition="PSB / PL", start=date(2021, 1, 1), end=date(2026, 4, 4)),
        T(governor="Rodrigo Cunha", party_or_condition="Podemos", start=date(2026, 4, 5), end=None),
    ],
}
AP_GOVERNOR_TERMS = [
    T(governor="Waldez Góes", party_or_condition="PDT", start=date(2015, 1, 1), end=date(2022, 12, 31)),
    T(governor="Clécio Luís", party_or_condition="Solidariedade", start=date(2023, 1, 1), end=None),
]
# Furlan e o vice foram afastados pelo STF em 4/3/2026; o presidente da Camara governa interinamente.
AP_MAYOR_TERMS = {
    "Macapá": [
        T(governor="Clécio Luís", party_or_condition="PSOL / Rede", start=date(2013, 1, 1), end=date(2020, 12, 31)),
        T(governor="Dr. Furlan", party_or_condition="Cidadania / MDB", start=date(2021, 1, 1), end=date(2026, 3, 3)),
        T(governor="Pedro DaLua", party_or_condition="União Brasil, interino", start=date(2026, 3, 4), end=None),
    ],
}
# Jose Melo assumiu com a renuncia de Omar Aziz (4/4/2014) e teve o mandato cassado pelo TSE em 2017;
# Wilson Lima e o vice renunciaram em abril de 2026 e a Assembleia elegeu Roberto Cidade em 4/5/2026.
AM_GOVERNOR_TERMS = [
    T(governor="José Melo", party_or_condition="PROS", start=date(2014, 4, 4), end=date(2017, 5, 8)),
    T(governor="David Almeida", party_or_condition="PSD, interino", start=date(2017, 5, 9), end=date(2017, 10, 3)),
    T(governor="Amazonino Mendes", party_or_condition="PDT", start=date(2017, 10, 4), end=date(2018, 12, 31)),
    T(governor="Wilson Lima", party_or_condition="PSC / União Brasil", start=date(2019, 1, 1), end=date(2026, 4, 4)),
    T(governor="Roberto Cidade", party_or_condition="União Brasil", start=date(2026, 4, 5), end=None),
]
AM_MAYOR_TERMS = {
    "Manaus": [
        T(governor="Arthur Virgílio Neto", party_or_condition="PSDB", start=date(2013, 1, 1), end=date(2020, 12, 31)),
        T(governor="David Almeida", party_or_condition="Avante", start=date(2021, 1, 1), end=date(2026, 3, 30)),
        T(governor="Renato Junior", party_or_condition="Avante", start=date(2026, 3, 31), end=None),
    ],
}
BA_GOVERNOR_TERMS = [
    T(governor="Rui Costa", party_or_condition="PT", start=date(2015, 1, 1), end=date(2022, 12, 31)),
    T(governor="Jerônimo Rodrigues", party_or_condition="PT", start=date(2023, 1, 1), end=None),
]
BA_MAYOR_TERMS = {
    "Salvador": [
        T(governor="ACM Neto", party_or_condition="DEM", start=date(2013, 1, 1), end=date(2020, 12, 31)),
        T(governor="Bruno Reis", party_or_condition="DEM / União Brasil", start=date(2021, 1, 1), end=None),
    ],
}
CE_GOVERNOR_TERMS = [
    T(governor="Camilo Santana", party_or_condition="PT", start=date(2015, 1, 1), end=date(2022, 4, 1)),
    T(governor="Izolda Cela", party_or_condition="PDT", start=date(2022, 4, 2), end=date(2022, 12, 31)),
    T(governor="Elmano de Freitas", party_or_condition="PT", start=date(2023, 1, 1), end=None),
]
CE_MAYOR_TERMS = {
    "Fortaleza": [
        T(governor="Roberto Cláudio", party_or_condition="PSB / PDT", start=date(2013, 1, 1), end=date(2020, 12, 31)),
        T(governor="José Sarto", party_or_condition="PDT", start=date(2021, 1, 1), end=date(2024, 12, 31)),
        T(governor="Evandro Leitão", party_or_condition="PT", start=date(2025, 1, 1), end=None),
    ],
}
# Ibaneis foi afastado pelo STF de 9/1 a 14/3/2023 e renunciou em marco de 2026. O DF nao tem prefeito.
DF_GOVERNOR_TERMS = [
    T(governor="Rodrigo Rollemberg", party_or_condition="PSB", start=date(2015, 1, 1), end=date(2018, 12, 31)),
    T(governor="Ibaneis Rocha", party_or_condition="MDB", start=date(2019, 1, 1), end=date(2023, 1, 8)),
    T(governor="Celina Leão", party_or_condition="PP, em exercício", start=date(2023, 1, 9), end=date(2023, 3, 14)),
    T(governor="Ibaneis Rocha", party_or_condition="MDB", start=date(2023, 3, 15), end=date(2026, 3, 29)),
    T(governor="Celina Leão", party_or_condition="PP", start=date(2026, 3, 30), end=None),
]
DF_MAYOR_TERMS: dict[str, list[GovernorTerm]] = {}
ES_GOVERNOR_TERMS = [
    T(governor="Paulo Hartung", party_or_condition="PMDB", start=date(2015, 1, 1), end=date(2018, 12, 31)),
    T(governor="Renato Casagrande", party_or_condition="PSB", start=date(2019, 1, 1), end=date(2026, 4, 1)),
    T(governor="Ricardo Ferraço", party_or_condition="MDB", start=date(2026, 4, 2), end=None),
]
ES_MAYOR_TERMS = {
    "Vitória": [
        T(governor="Luciano Rezende", party_or_condition="PPS", start=date(2013, 1, 1), end=date(2020, 12, 31)),
        T(governor="Lorenzo Pazolini", party_or_condition="Republicanos", start=date(2021, 1, 1), end=date(2026, 4, 3)),
        T(governor="Cris Samorini", party_or_condition="PP", start=date(2026, 4, 4), end=None),
    ],
}
GO_GOVERNOR_TERMS = [
    T(governor="Marconi Perillo", party_or_condition="PSDB", start=date(2011, 1, 1), end=date(2018, 4, 6)),
    T(governor="José Eliton", party_or_condition="PSDB", start=date(2018, 4, 7), end=date(2018, 12, 31)),
    T(governor="Ronaldo Caiado", party_or_condition="DEM / União Brasil", start=date(2019, 1, 1), end=date(2026, 3, 30)),
    T(governor="Daniel Vilela", party_or_condition="MDB", start=date(2026, 3, 31), end=None),
]
# Maguito Vilela, eleito em 2020, nao chegou a exercer o cargo (morreu em 13/1/2021).
GO_MAYOR_TERMS = {
    "Goiânia": [
        T(governor="Paulo Garcia", party_or_condition="PT", start=date(2013, 1, 1), end=date(2016, 12, 31)),
        T(governor="Iris Rezende", party_or_condition="PMDB", start=date(2017, 1, 1), end=date(2020, 12, 31)),
        T(governor="Rogério Cruz", party_or_condition="Republicanos", start=date(2021, 1, 1), end=date(2024, 12, 31)),
        T(governor="Sandro Mabel", party_or_condition="União Brasil", start=date(2025, 1, 1), end=None),
    ],
}
MA_GOVERNOR_TERMS = [
    T(governor="Flávio Dino", party_or_condition="PCdoB / PSB", start=date(2015, 1, 1), end=date(2022, 4, 1)),
    T(governor="Carlos Brandão", party_or_condition="PSB", start=date(2022, 4, 2), end=None),
]
MA_MAYOR_TERMS = {
    "São Luís": [
        T(governor="Edivaldo Holanda Júnior", party_or_condition="PTC / PDT", start=date(2013, 1, 1), end=date(2020, 12, 31)),
        T(governor="Eduardo Braide", party_or_condition="Podemos / PSD", start=date(2021, 1, 1), end=date(2026, 3, 30)),
        T(governor="Esmênia Miranda", party_or_condition="PSD", start=date(2026, 3, 31), end=None),
    ],
}
MT_GOVERNOR_TERMS = [
    T(governor="Pedro Taques", party_or_condition="PDT / PSDB", start=date(2015, 1, 1), end=date(2018, 12, 31)),
    T(governor="Mauro Mendes", party_or_condition="DEM / União Brasil", start=date(2019, 1, 1), end=date(2026, 3, 30)),
    T(governor="Otaviano Pivetta", party_or_condition="Republicanos", start=date(2026, 3, 31), end=None),
]
# Emanuel Pinheiro foi afastado pela Justica de 19/10 a 25/11/2021.
MT_MAYOR_TERMS = {
    "Cuiabá": [
        T(governor="Mauro Mendes", party_or_condition="PSB", start=date(2013, 1, 1), end=date(2016, 12, 31)),
        T(governor="Emanuel Pinheiro", party_or_condition="MDB", start=date(2017, 1, 1), end=date(2021, 10, 18)),
        T(governor="José Roberto Stopa", party_or_condition="PV, em exercício", start=date(2021, 10, 19), end=date(2021, 11, 25)),
        T(governor="Emanuel Pinheiro", party_or_condition="MDB", start=date(2021, 11, 26), end=date(2024, 12, 31)),
        T(governor="Abilio Brunini", party_or_condition="PL", start=date(2025, 1, 1), end=None),
    ],
}
MS_GOVERNOR_TERMS = [
    T(governor="Reinaldo Azambuja", party_or_condition="PSDB", start=date(2015, 1, 1), end=date(2022, 12, 31)),
    T(governor="Eduardo Riedel", party_or_condition="PSDB / PP", start=date(2023, 1, 1), end=None),
]
# Bernal foi cassado pela Camara em 2014 e voltou por decisao do TJMS em agosto de 2015.
MS_MAYOR_TERMS = {
    "Campo Grande": [
        T(governor="Gilmar Olarte", party_or_condition="PP", start=date(2014, 3, 13), end=date(2015, 8, 26)),
        T(governor="Alcides Bernal", party_or_condition="PP", start=date(2015, 8, 27), end=date(2016, 12, 31)),
        T(governor="Marquinhos Trad", party_or_condition="PSD", start=date(2017, 1, 1), end=date(2022, 4, 1)),
        T(governor="Adriane Lopes", party_or_condition="Patriota / PP", start=date(2022, 4, 2), end=None),
    ],
}
PR_GOVERNOR_TERMS = [
    T(governor="Beto Richa", party_or_condition="PSDB", start=date(2011, 1, 1), end=date(2018, 4, 5)),
    T(governor="Cida Borghetti", party_or_condition="PP", start=date(2018, 4, 6), end=date(2018, 12, 31)),
    T(governor="Ratinho Júnior", party_or_condition="PSD", start=date(2019, 1, 1), end=None),
]
PR_MAYOR_TERMS = {
    "Curitiba": [
        T(governor="Gustavo Fruet", party_or_condition="PDT", start=date(2013, 1, 1), end=date(2016, 12, 31)),
        T(governor="Rafael Greca", party_or_condition="PMN / DEM", start=date(2017, 1, 1), end=date(2024, 12, 31)),
        T(governor="Eduardo Pimentel", party_or_condition="PSD", start=date(2025, 1, 1), end=None),
    ],
}
PB_GOVERNOR_TERMS = [
    T(governor="Ricardo Coutinho", party_or_condition="PSB", start=date(2011, 1, 1), end=date(2018, 12, 31)),
    T(governor="João Azevêdo", party_or_condition="PSB", start=date(2019, 1, 1), end=date(2026, 4, 1)),
    T(governor="Lucas Ribeiro", party_or_condition="PP", start=date(2026, 4, 2), end=None),
]
PB_MAYOR_TERMS = {
    "João Pessoa": [
        T(governor="Luciano Cartaxo", party_or_condition="PT / PSD", start=date(2013, 1, 1), end=date(2020, 12, 31)),
        T(governor="Cícero Lucena", party_or_condition="PP / MDB", start=date(2021, 1, 1), end=date(2026, 4, 1)),
        T(governor="Léo Bezerra", party_or_condition="PSB", start=date(2026, 4, 2), end=None),
    ],
}
PA_GOVERNOR_TERMS = [
    T(governor="Simão Jatene", party_or_condition="PSDB", start=date(2011, 1, 1), end=date(2018, 12, 31)),
    T(governor="Helder Barbalho", party_or_condition="MDB", start=date(2019, 1, 1), end=date(2026, 4, 1)),
    T(governor="Hana Ghassan", party_or_condition="MDB", start=date(2026, 4, 2), end=None),
]
PA_MAYOR_TERMS = {
    "Belém": [
        T(governor="Zenaldo Coutinho", party_or_condition="PSDB", start=date(2013, 1, 1), end=date(2020, 12, 31)),
        T(governor="Edmilson Rodrigues", party_or_condition="PSOL", start=date(2021, 1, 1), end=date(2024, 12, 31)),
        T(governor="Igor Normando", party_or_condition="MDB", start=date(2025, 1, 1), end=None),
    ],
}
PE_GOVERNOR_TERMS = [
    T(governor="Paulo Câmara", party_or_condition="PSB", start=date(2015, 1, 1), end=date(2022, 12, 31)),
    T(governor="Raquel Lyra", party_or_condition="PSDB / PSD", start=date(2023, 1, 1), end=None),
]
PE_MAYOR_TERMS = {
    "Recife": [
        T(governor="Geraldo Júlio", party_or_condition="PSB", start=date(2013, 1, 1), end=date(2020, 12, 31)),
        T(governor="João Campos", party_or_condition="PSB", start=date(2021, 1, 1), end=date(2026, 4, 1)),
        T(governor="Victor Marques", party_or_condition="PCdoB", start=date(2026, 4, 2), end=None),
    ],
}
PI_GOVERNOR_TERMS = [
    T(governor="Wellington Dias", party_or_condition="PT", start=date(2015, 1, 1), end=date(2022, 3, 30)),
    T(governor="Regina Sousa", party_or_condition="PT", start=date(2022, 3, 31), end=date(2022, 12, 31)),
    T(governor="Rafael Fonteles", party_or_condition="PT", start=date(2023, 1, 1), end=None),
]
PI_MAYOR_TERMS = {
    "Teresina": [
        T(governor="Firmino Filho", party_or_condition="PSDB", start=date(2013, 1, 1), end=date(2020, 12, 31)),
        T(governor="Dr. Pessoa", party_or_condition="MDB", start=date(2021, 1, 1), end=date(2024, 12, 31)),
        T(governor="Silvio Mendes", party_or_condition="União Brasil", start=date(2025, 1, 1), end=None),
    ],
}
RN_GOVERNOR_TERMS = [
    T(governor="Robinson Faria", party_or_condition="PSD", start=date(2015, 1, 1), end=date(2018, 12, 31)),
    T(governor="Fátima Bezerra", party_or_condition="PT", start=date(2019, 1, 1), end=None),
]
RN_MAYOR_TERMS = {
    "Natal": [
        T(governor="Carlos Eduardo Alves", party_or_condition="PDT", start=date(2013, 1, 1), end=date(2018, 4, 5)),
        T(governor="Álvaro Dias", party_or_condition="MDB / PSDB", start=date(2018, 4, 6), end=date(2024, 12, 31)),
        T(governor="Paulinho Freire", party_or_condition="União Brasil", start=date(2025, 1, 1), end=None),
    ],
}
RS_GOVERNOR_TERMS = [
    T(governor="José Ivo Sartori", party_or_condition="PMDB", start=date(2015, 1, 1), end=date(2018, 12, 31)),
    T(governor="Eduardo Leite", party_or_condition="PSDB", start=date(2019, 1, 1), end=date(2022, 3, 30)),
    T(governor="Ranolfo Vieira Júnior", party_or_condition="PSDB", start=date(2022, 3, 31), end=date(2022, 12, 31)),
    T(governor="Eduardo Leite", party_or_condition="PSDB / PSD", start=date(2023, 1, 1), end=None),
]
RS_MAYOR_TERMS = {
    "Porto Alegre": [
        T(governor="José Fortunati", party_or_condition="PDT", start=date(2010, 3, 30), end=date(2016, 12, 31)),
        T(governor="Nelson Marchezan Júnior", party_or_condition="PSDB", start=date(2017, 1, 1), end=date(2020, 12, 31)),
        T(governor="Sebastião Melo", party_or_condition="MDB", start=date(2021, 1, 1), end=None),
    ],
}
RO_GOVERNOR_TERMS = [
    T(governor="Confúcio Moura", party_or_condition="PMDB", start=date(2011, 1, 1), end=date(2018, 4, 5)),
    T(governor="Daniel Pereira", party_or_condition="PSB", start=date(2018, 4, 6), end=date(2018, 12, 31)),
    T(governor="Marcos Rocha", party_or_condition="PSL / União Brasil", start=date(2019, 1, 1), end=None),
]
RO_MAYOR_TERMS = {
    "Porto Velho": [
        T(governor="Mauro Nazif", party_or_condition="PSB", start=date(2013, 1, 1), end=date(2016, 12, 31)),
        T(governor="Hildon Chaves", party_or_condition="PSDB", start=date(2017, 1, 1), end=date(2024, 12, 31)),
        T(governor="Léo Moraes", party_or_condition="Podemos", start=date(2025, 1, 1), end=None),
    ],
}
# Intervencao federal de 10 a 31/12/2018. Denarium renunciou em marco de 2026; o TSE cassou o sucessor
# e o presidente da Assembleia governa interinamente.
RR_GOVERNOR_TERMS = [
    T(governor="Suely Campos", party_or_condition="PP", start=date(2015, 1, 1), end=date(2018, 12, 9)),
    T(governor="Antonio Denarium", party_or_condition="interventor federal", start=date(2018, 12, 10), end=date(2018, 12, 31)),
    T(governor="Antonio Denarium", party_or_condition="PSL / PP", start=date(2019, 1, 1), end=date(2026, 3, 26)),
    T(governor="Edilson Damião", party_or_condition="União Brasil", start=date(2026, 3, 27), end=date(2026, 4, 29)),
    T(governor="Soldado Sampaio", party_or_condition="Republicanos, interino", start=date(2026, 4, 30), end=None),
]
RR_MAYOR_TERMS = {
    "Boa Vista": [
        T(governor="Teresa Surita", party_or_condition="PMDB", start=date(2013, 1, 1), end=date(2020, 12, 31)),
        T(governor="Arthur Henrique", party_or_condition="MDB / PL", start=date(2021, 1, 1), end=date(2026, 4, 1)),
        T(governor="Marcelo Zeitoune", party_or_condition="PL", start=date(2026, 4, 2), end=None),
    ],
}
# Carlos Moises foi afastado duas vezes nos processos de impeachment (2020 e 2021).
SC_GOVERNOR_TERMS = [
    T(governor="Raimundo Colombo", party_or_condition="PSD", start=date(2011, 1, 1), end=date(2018, 4, 5)),
    T(governor="Eduardo Pinho Moreira", party_or_condition="MDB", start=date(2018, 4, 6), end=date(2018, 12, 31)),
    T(governor="Carlos Moisés", party_or_condition="PSL", start=date(2019, 1, 1), end=date(2020, 10, 26)),
    T(governor="Daniela Reinehr", party_or_condition="em exercício", start=date(2020, 10, 27), end=date(2020, 11, 26)),
    T(governor="Carlos Moisés", party_or_condition="PSL", start=date(2020, 11, 27), end=date(2021, 3, 25)),
    T(governor="Daniela Reinehr", party_or_condition="em exercício", start=date(2021, 3, 26), end=date(2021, 5, 6)),
    T(governor="Carlos Moisés", party_or_condition="PSL / Republicanos", start=date(2021, 5, 7), end=date(2022, 12, 31)),
    T(governor="Jorginho Mello", party_or_condition="PL", start=date(2023, 1, 1), end=None),
]
SC_MAYOR_TERMS = {
    "Florianópolis": [
        T(governor="César Souza Júnior", party_or_condition="PSD", start=date(2013, 1, 1), end=date(2016, 12, 31)),
        T(governor="Gean Loureiro", party_or_condition="PMDB / DEM", start=date(2017, 1, 1), end=date(2022, 3, 30)),
        T(governor="Topázio Neto", party_or_condition="Republicanos / PSD", start=date(2022, 3, 31), end=None),
    ],
}
SE_GOVERNOR_TERMS = [
    T(governor="Jackson Barreto", party_or_condition="PMDB", start=date(2013, 12, 2), end=date(2018, 4, 5)),
    T(governor="Belivaldo Chagas", party_or_condition="PSD", start=date(2018, 4, 6), end=date(2022, 12, 31)),
    T(governor="Fábio Mitidieri", party_or_condition="PSD", start=date(2023, 1, 1), end=None),
]
SE_MAYOR_TERMS = {
    "Aracaju": [
        T(governor="João Alves Filho", party_or_condition="DEM", start=date(2013, 1, 1), end=date(2016, 12, 31)),
        T(governor="Edvaldo Nogueira", party_or_condition="PCdoB / PDT", start=date(2017, 1, 1), end=date(2024, 12, 31)),
        T(governor="Emília Corrêa", party_or_condition="PL", start=date(2025, 1, 1), end=None),
    ],
}
# Marcelo Miranda foi cassado pelo TSE em 2018 e voltou 12 dias por liminar; Carlesse foi afastado pelo
# STJ em 2021 e renunciou em 2022; Wanderlei foi afastado pelo STJ de 3/9 a 4/12/2025.
TO_GOVERNOR_TERMS = [
    T(governor="Marcelo Miranda", party_or_condition="PMDB", start=date(2015, 1, 1), end=date(2018, 3, 26)),
    T(governor="Mauro Carlesse", party_or_condition="PHS, interino", start=date(2018, 3, 27), end=date(2018, 4, 6)),
    T(governor="Marcelo Miranda", party_or_condition="MDB, por liminar", start=date(2018, 4, 7), end=date(2018, 4, 18)),
    T(governor="Mauro Carlesse", party_or_condition="PHS / DEM / PSL", start=date(2018, 4, 19), end=date(2021, 10, 19)),
    T(governor="Wanderlei Barbosa", party_or_condition="Republicanos", start=date(2021, 10, 20), end=date(2025, 9, 2)),
    T(governor="Laurez Moreira", party_or_condition="PSD, em exercício", start=date(2025, 9, 3), end=date(2025, 12, 4)),
    T(governor="Wanderlei Barbosa", party_or_condition="Republicanos", start=date(2025, 12, 5), end=None),
]
TO_MAYOR_TERMS = {
    "Palmas": [
        T(governor="Carlos Amastha", party_or_condition="PSB", start=date(2013, 1, 1), end=date(2018, 4, 2)),
        T(governor="Cinthia Ribeiro", party_or_condition="PSDB", start=date(2018, 4, 3), end=date(2024, 12, 31)),
        T(governor="Eduardo Siqueira Campos", party_or_condition="Podemos", start=date(2025, 1, 1), end=None),
    ],
}

# Brasil (sigla BR, serie nacional do Sinesp desde 2015): presidentes da Republica. Dilma foi afastada
# pela abertura do processo de impeachment no Senado em 12/5/2016 e Temer assumiu como interino no mesmo
# dia; o Senado a condenou em 31/8/2016 e Temer tomou posse como titular na mesma tarde. Conferido em
# 2026-10-16 na lista de presidentes do Planalto e nas atas do Senado.
BR_PRESIDENT_TERMS = [
    T(governor="Dilma Rousseff", party_or_condition="PT", start=date(2011, 1, 1), end=date(2016, 5, 11)),
    T(governor="Michel Temer", party_or_condition="PMDB, interino", start=date(2016, 5, 12), end=date(2016, 8, 30)),
    T(governor="Michel Temer", party_or_condition="PMDB / MDB", start=date(2016, 8, 31), end=date(2018, 12, 31)),
    T(governor="Jair Bolsonaro", party_or_condition="PSL / PL", start=date(2019, 1, 1), end=date(2022, 12, 31)),
    T(governor="Luiz Inácio Lula da Silva", party_or_condition="PT", start=date(2023, 1, 1), end=None),
]

# Mandatos por UF. Uma UF publicada sem entrada aqui fica com a tela Mandatos vazia ate alguem
# acrescentar as datas verificadas.
GOVERNOR_TERMS_BY_UF: dict[str, list[GovernorTerm]] = {
    "RJ": GOVERNOR_TERMS,
    "SP": SP_GOVERNOR_TERMS,
    "MG": MG_GOVERNOR_TERMS,
    "AC": AC_GOVERNOR_TERMS,
    "AL": AL_GOVERNOR_TERMS,
    "AP": AP_GOVERNOR_TERMS,
    "AM": AM_GOVERNOR_TERMS,
    "BA": BA_GOVERNOR_TERMS,
    "CE": CE_GOVERNOR_TERMS,
    "DF": DF_GOVERNOR_TERMS,
    "ES": ES_GOVERNOR_TERMS,
    "GO": GO_GOVERNOR_TERMS,
    "MA": MA_GOVERNOR_TERMS,
    "MT": MT_GOVERNOR_TERMS,
    "MS": MS_GOVERNOR_TERMS,
    "PR": PR_GOVERNOR_TERMS,
    "PB": PB_GOVERNOR_TERMS,
    "PA": PA_GOVERNOR_TERMS,
    "PE": PE_GOVERNOR_TERMS,
    "PI": PI_GOVERNOR_TERMS,
    "RN": RN_GOVERNOR_TERMS,
    "RS": RS_GOVERNOR_TERMS,
    "RO": RO_GOVERNOR_TERMS,
    "RR": RR_GOVERNOR_TERMS,
    "SC": SC_GOVERNOR_TERMS,
    "SE": SE_GOVERNOR_TERMS,
    "TO": TO_GOVERNOR_TERMS,
    "BR": BR_PRESIDENT_TERMS,
}
MAYOR_TERMS_BY_UF: dict[str, dict[str, list[GovernorTerm]]] = {
    "RJ": MAYOR_TERMS,
    "SP": SP_MAYOR_TERMS,
    "MG": MG_MAYOR_TERMS,
    "AC": AC_MAYOR_TERMS,
    "AL": AL_MAYOR_TERMS,
    "AP": AP_MAYOR_TERMS,
    "AM": AM_MAYOR_TERMS,
    "BA": BA_MAYOR_TERMS,
    "CE": CE_MAYOR_TERMS,
    "DF": DF_MAYOR_TERMS,
    "ES": ES_MAYOR_TERMS,
    "GO": GO_MAYOR_TERMS,
    "MA": MA_MAYOR_TERMS,
    "MT": MT_MAYOR_TERMS,
    "MS": MS_MAYOR_TERMS,
    "PR": PR_MAYOR_TERMS,
    "PB": PB_MAYOR_TERMS,
    "PA": PA_MAYOR_TERMS,
    "PE": PE_MAYOR_TERMS,
    "PI": PI_MAYOR_TERMS,
    "RN": RN_MAYOR_TERMS,
    "RS": RS_MAYOR_TERMS,
    "RO": RO_MAYOR_TERMS,
    "RR": RR_MAYOR_TERMS,
    "SC": SC_MAYOR_TERMS,
    "SE": SE_MAYOR_TERMS,
    "TO": TO_MAYOR_TERMS,
}


SOURCE_PHRASE = {"isp": "do ISP", "ssp": "da SSP-SP"}


def _indicator_name(code: str) -> str:
    from app.services.indicator_catalog import indicators_for

    names = {indicator.code: indicator.name for indicator in indicators_for(current_uf().source)}
    return names.get(code, INDICATOR_BY_CODE[code].name)


def governor_terms() -> list[GovernorTerm]:
    return GOVERNOR_TERMS_BY_UF.get(current_uf().code, [])


def mayor_terms() -> dict[str, list[GovernorTerm]]:
    return MAYOR_TERMS_BY_UF.get(current_uf().code, {})


def score_indicators() -> list[str]:
    """Indicadores do ranking: os do Rio, trocando roubo de rua pelo equivalente da fonte, se houver."""

    from app.services.indicator_catalog import indicators_for

    available = {indicator.code for indicator in indicators_for(current_uf().source)}
    output = [code if code != "roubo_rua" or "roubo_rua" in available else "roubo_outros" for code in SCORE_INDICATORS]
    return [code for code in output if code in available]


def governor_performance() -> GovernorPerformanceOut:
    latest_year, latest_month = repository().latest_period()
    latest_date = pd.Timestamp(latest_year, latest_month, 1) + pd.offsets.MonthEnd(0)
    rows = [_term_performance(term, latest_date.date()) for term in governor_terms()]

    ranked = [row for row in rows if row.average_reduction_percent is not None]
    ranked.sort(key=lambda row: row.average_reduction_percent or float("-inf"), reverse=True)
    # A mesma pessoa pode ter mais de uma passagem (afastamentos, volta por liminar): chave com a posse.
    rank_by_term = {(row.governor, row.term_start): index for index, row in enumerate(ranked, start=1)}
    for row in rows:
        row.rank = rank_by_term.get((row.governor, row.term_start))

    rows.sort(
        key=lambda row: (
            row.rank is None,
            row.rank if row.rank is not None else 999,
            row.term_start,
        )
    )
    return GovernorPerformanceOut(
        methodology=(
            f"Ranking calculado com dados mensais estaduais {SOURCE_PHRASE.get(current_uf().source, 'do Sinesp VDE')}. Para cada governador, compara a média mensal "
            "dos indicadores durante o período de governo com a média mensal dos 12 meses anteriores à posse. "
            "Percentual positivo significa redução média; mandatos curtos entram proporcionalmente pelo número de meses disponíveis."
        ),
        indicators=[_indicator_name(indicator) for indicator in score_indicators()],
        rows=rows,
    )


def _term_performance(term: GovernorTerm, latest_date: date) -> GovernorPerformanceRow:
    term_end = min(term.end or latest_date, latest_date)
    if term.start > latest_date:
        return _empty_row(term, term_end, "Sem dados publicados para o período.")
    if (term_end - term.start).days < 28:
        return _empty_row(term, term_end, "Menos de um mês no cargo.")

    indicator_changes: dict[str, float] = {}
    current_values: list[float] = []
    baseline_values: list[float] = []
    months_count = 0
    baseline_months_count = 0

    for indicator in score_indicators():
        frame = repository().rows(indicator, "state", current_uf().state_name)
        frame = frame.sort_values("period_date").copy()
        frame["period_date"] = pd.to_datetime(frame["period_date"]).dt.date
        current = frame[(frame["period_date"] >= term.start) & (frame["period_date"] <= term_end)]
        baseline = frame[frame["period_date"] < term.start].tail(12)

        if current.empty or baseline.empty:
            continue

        current_avg = float(current["value"].mean())
        baseline_avg = float(baseline["value"].mean())
        if baseline_avg <= 0:
            continue

        months_count = max(months_count, len(current))
        baseline_months_count = max(baseline_months_count, len(baseline))
        current_values.append(current_avg)
        baseline_values.append(baseline_avg)
        indicator_changes[indicator] = (baseline_avg - current_avg) / baseline_avg * 100

    if not indicator_changes:
        return _empty_row(term, term_end, "Sem linha de base suficiente nos dados oficiais.")

    best_indicator, best_value = max(indicator_changes.items(), key=lambda item: item[1])
    worst_indicator, worst_value = min(indicator_changes.items(), key=lambda item: item[1])
    note = None
    if months_count < 12:
        if months_count == 1:
            note = "Base curta: 1 mes disponivel no mandato."
        else:
            note = f"Base curta: {months_count} meses disponiveis no mandato."

    return GovernorPerformanceRow(
        rank=None,
        governor=term.governor,
        party_or_condition=term.party_or_condition,
        term_start=term.start,
        term_end=term.end,
        months_count=months_count,
        baseline_months_count=baseline_months_count,
        average_reduction_percent=round(sum(indicator_changes.values()) / len(indicator_changes), 1),
        annualized_current_value=round(sum(current_values) * 12, 1),
        annualized_baseline_value=round(sum(baseline_values) * 12, 1),
        best_indicator=_indicator_name(best_indicator),
        worst_indicator=_indicator_name(worst_indicator),
        best_indicator_change=round(-best_value, 1),
        worst_indicator_change=round(-worst_value, 1),
        note=note,
    )


def _empty_row(term: GovernorTerm, term_end: date, note: str) -> GovernorPerformanceRow:
    return GovernorPerformanceRow(
        rank=None,
        governor=term.governor,
        party_or_condition=term.party_or_condition,
        term_start=term.start,
        term_end=term.end or term_end,
        months_count=0,
        baseline_months_count=0,
        note=note,
    )
