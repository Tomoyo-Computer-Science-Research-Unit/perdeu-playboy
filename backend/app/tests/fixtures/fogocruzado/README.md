# Fixtures sinteticas da API Fogo Cruzado

**Dados ficticios.** Os arquivos desta pasta foram escritos a mao a partir da documentacao
publica da API v2 (https://api.fogocruzado.org.br/docs/endpoint/occurrences, consultada em
2026-10-13) e do exemplo `retorno_completo.csv` publicado la. Ids, enderecos, coordenadas, datas e
vitimas nao correspondem a ocorrencias reais; os bairros e municipios sao reais apenas para
exercitar o casamento de nomes com o ISP e com a malha de bairros do Rio.

- `login.json`: resposta de `POST /auth/login`.
- `states.json`: resposta de `GET /states`.
- `occurrences_page1.json`, `occurrences_page2.json`: duas paginas de `GET /occurrences`
  (`take=3`) para julho de 2016, com `pageMeta` como documentado.
