import httpx
import pandas as pd
import pytest

from app.etl import ssp_sp


def test_sinesp_rows_return_empty_frame_when_download_times_out(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The optional Sinesp complement should not crash the scheduled export."""

    def fail_download() -> None:
        raise httpx.ConnectTimeout("timeout")

    monkeypatch.setattr(ssp_sp, "_ensure_sinesp_vde_file", fail_download)

    frame = ssp_sp._sinesp_sp_rows(start_year=2025, end_year=2026)

    assert isinstance(frame, pd.DataFrame)
    assert frame.empty
