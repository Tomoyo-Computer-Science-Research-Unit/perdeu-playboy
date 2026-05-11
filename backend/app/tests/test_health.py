from fastapi.testclient import TestClient

from app.main import app


def test_health_endpoint() -> None:
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_indicators_endpoint() -> None:
    client = TestClient(app)
    response = client.get("/api/indicators")
    assert response.status_code == 200
    codes = {item["code"] for item in response.json()}
    assert "homicidio_doloso" in codes
    assert "letalidade_violenta" in codes

