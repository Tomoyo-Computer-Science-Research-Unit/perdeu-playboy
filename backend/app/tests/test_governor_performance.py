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


def test_small_base_indicators_do_not_drive_the_average() -> None:
    from app.services.governor_performance import MIN_BASELINE_ANNUAL
    from app.uf import set_current

    set_current("AM")
    wilson = next(row for row in governor_performance().rows if row.governor == "Wilson Lima")
    # Roubo de carga subiu 748% sobre uma base minuscula; fora do ranking, o governo nao fica em +126%.
    assert MIN_BASELINE_ANNUAL == 30
    assert wilson.average_reduction_percent is not None and wilson.average_reduction_percent > -50
    assert wilson.worst_indicator_change is not None and wilson.worst_indicator_change < 500
