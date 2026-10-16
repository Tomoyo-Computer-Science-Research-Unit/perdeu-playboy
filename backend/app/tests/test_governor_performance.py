from app.services.governor_performance import governor_performance


def test_governor_performance_includes_current_interim_governor() -> None:
    result = governor_performance()
    names = [row.governor for row in result.rows]

    assert "Ricardo Couto" in names
    assert result.indicators


def test_every_published_uf_has_continuous_terms_and_capital_mayors() -> None:
    from datetime import timedelta

    from app.services.governor_performance import GOVERNOR_TERMS_BY_UF, MAYOR_TERMS_BY_UF
    from app.uf import published_ufs

    for uf in published_ufs():
        groups = [GOVERNOR_TERMS_BY_UF[uf.code]]
        if uf.code != "DF":  # o Distrito Federal nao tem prefeito
            groups.append(MAYOR_TERMS_BY_UF[uf.code][uf.capital])
        for terms in groups:
            assert terms[0].start.year <= uf.start_year, uf.code
            assert terms[-1].end is None, uf.code
            for previous, following in zip(terms, terms[1:]):
                assert previous.end is not None and previous.end + timedelta(days=1) == following.start, (uf.code, previous.governor)
