# Imagen oficial de Playwright (incluye Chromium + dependencias del SO).
# La version DEBE coincidir con la del paquete playwright en package.json.
FROM mcr.microsoft.com/playwright:v1.60.0-jammy

# Bun (el monorepo usa Bun como runtime/instalador)
RUN npm install -g bun@1.3.14

WORKDIR /app

# Los navegadores ya vienen en la imagen base: evita re-descargarlos al instalar.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

# 1) Manifiestos primero (cache de capa de dependencias).
COPY package.json bunfig.toml ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/scraper/package.json apps/scraper/package.json
RUN bun install

# 2) Codigo fuente.
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/scraper apps/scraper

WORKDIR /app/apps/scraper
CMD ["bun", "run", "start"]
