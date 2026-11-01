# Build stage: all dependencies, compile TypeScript to dist/
FROM node:24.22.2-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

# Final stage: production dependencies and compiled output only
FROM node:24.22.2-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
# The node image ships an unprivileged "node" user
USER node
EXPOSE 3000
CMD ["node", "dist/server.js"]
