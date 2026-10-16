// O site mora em g0v.tomoyo.systems/perdeu-playboy: um build só com todas as UFs (o Rio na raiz, as
// demais em /<uf>/). NEXT_PUBLIC_BASE_PATH="" serve na raiz.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "/perdeu-playboy";
// Os JSON de dados ficam 7 dias em cache no nginx do g0v; cada build busca os seus com ?v=<build>.
// Fica em process.env para que os workers do build, que herdam o ambiente, vejam o mesmo valor.
process.env.NEXT_PUBLIC_DATA_VERSION ??= Date.now().toString(36);

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  basePath,
  assetPrefix: basePath || undefined,
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
    NEXT_PUBLIC_DATA_VERSION: process.env.NEXT_PUBLIC_DATA_VERSION
  }
};

module.exports = nextConfig;
