from app.services.governor_performance import governor_performance


def test_governor_performance_includes_current_interim_governor() -> None:
    result = governor_performance()
    names = [row.governor for row in result.rows]

    assert "Ricardo Couto" in names
    assert result.indicators
