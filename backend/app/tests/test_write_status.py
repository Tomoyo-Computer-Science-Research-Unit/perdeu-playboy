from app.etl.write_status import build_status


def test_status_keeps_last_runs_and_last_published() -> None:
    snapshot = {
        "generated_at": "2026-10-13T06:30:00-03:00",
        "latest_period": {"year": 2026, "month": 8},
        "sources": [{"name": "isp_monthly_state", "url": "http://example.test/a.csv", "file_name": "a.csv"}],
    }
    runs = [{"at": f"2026-10-{day:02d}", "result": "sem mudança"} for day in range(1, 12)]
    runs.insert(3, {"at": "2026-09-30", "result": "publicado", "key": "abc"})

    status = build_status(snapshot, runs, check={"ok": True}, probe=False)

    assert status["last_run"] == runs[-1]
    assert status["last_published"]["key"] == "abc"
    assert status["runs"][0] == runs[-1]
    assert len(status["runs"]) == len(runs)
    assert status["sources"][0]["name"] == "isp_monthly_state"
    assert "remote" not in status["sources"][0]
    assert status["snapshot"]["latest_period"] == {"year": 2026, "month": 8}
