# Optional: Render can run this as a Docker service, but the native Node runtime (render.yaml) is simpler.
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 5080
CMD ["node", "src/index.js"]
