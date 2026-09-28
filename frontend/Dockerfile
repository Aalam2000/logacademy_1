# Прод-образ фронтенда: сборка Vite → статика в nginx.
# С 2026-09-28 сборщик — Vite (раньше Create React App), см. README.md.
FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# Адрес API вшивается в сборку; имя переменной осталось REACT_APP_*
# (envPrefix в vite.config.js), чтобы не менять docker-compose.prod.yml.
ARG REACT_APP_API_URL
ENV REACT_APP_API_URL=$REACT_APP_API_URL
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
RUN chmod -R a+rX /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3000
