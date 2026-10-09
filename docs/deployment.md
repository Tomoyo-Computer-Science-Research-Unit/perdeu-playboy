# Deploy

Produção: https://g0v.tomoyo.systems/perdeu-playboy/

- Servidor: droplet `mail.tomoyo.systems` (DigitalOcean, `doctl compute droplet list`).
- Container: `g0v-static` (nginx:alpine) em `/root/g0v`, atrás do Traefik com o middleware
  `cloudflare-only` e certificado Let's Encrypt via DNS Cloudflare (`traefik.http.routers.g0v`).
- DNS: wildcard `*.tomoyo.systems` → droplet, proxied pela Cloudflare.
- Publicar: `scripts/deploy-g0v.sh` (build com `NEXT_PUBLIC_BASE_PATH=/perdeu-playboy`, rsync, compose).

A raiz `https://g0v.tomoyo.systems/` é `deploy/g0v/index.html`, a lista de projetos da frente g0v.

## Domínio antigo

`perdeu-playboy.online` continua na Vercel só como redirecionamento 308 para o endereço novo
(`deploy/vercel-redirect/vercel.json`). O workflow semanal de dados não publica mais na Vercel.
