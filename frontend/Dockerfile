FROM node:18-slim AS build
WORKDIR /app
COPY package*.json ./
ENV NODE_ENV=development
ENV NPM_CONFIG_PRODUCTION=false
RUN npm install --no-audit --no-fund
RUN test -f node_modules/.bin/react-scripts || (echo "!!! react-scripts NOT installed" && exit 1)
COPY . .
ARG REACT_APP_API_URL
ENV REACT_APP_API_URL=$REACT_APP_API_URL
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3000