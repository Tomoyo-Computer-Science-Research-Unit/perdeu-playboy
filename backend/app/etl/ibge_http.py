"""GET nos servidores do IBGE tolerando a cadeia de certificado incompleta.

Em outubro de 2026 os servidores do IBGE (servicodados, apisidra) passaram a servir o certificado sem o
intermediario da Sectigo ("Public Server Authentication CA DV R36"); navegadores completam a cadeia pelo
AIA, httpx e curl nao. Quando a verificacao falha por isso, o intermediario e baixado do endereco AIA
publicado no proprio certificado e somado as raizes do certifi. A verificacao continua ligada.
"""

from __future__ import annotations

import ssl
from functools import lru_cache
from typing import Any

import certifi
import httpx

SECTIGO_DV_R36_URL = "http://crt.sectigo.com/SectigoPublicServerAuthenticationCADVR36.crt"


@lru_cache(maxsize=1)
def _context() -> ssl.SSLContext:
    der = httpx.get(SECTIGO_DV_R36_URL, timeout=30, follow_redirects=True).content
    context = ssl.create_default_context(cafile=certifi.where())
    context.load_verify_locations(cadata=ssl.DER_cert_to_PEM_cert(der))
    return context


def get(url: str, timeout: float = 90, **kwargs: Any) -> httpx.Response:
    try:
        return httpx.get(url, timeout=timeout, follow_redirects=True, **kwargs)
    except httpx.ConnectError as exc:
        if "CERTIFICATE_VERIFY_FAILED" not in str(exc):
            raise
    return httpx.get(url, timeout=timeout, follow_redirects=True, verify=_context(), **kwargs)
