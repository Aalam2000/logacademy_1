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

FROM node:18-slim
WORKDIR /app
RUN npm install -g serve
COPY --from=build /app/build ./build
EXPOSE 3000
CMD ["serve", "-s", "build", "-l", "3000"]