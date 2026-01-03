FROM node:20-alpine

WORKDIR /app/backend-hono

# Copy the compiled backend along with its existing dependencies.
# This assumes the repository already contains the built `dist` folder
# and the runtime `node_modules` directory.
COPY backend-hono/dist ./dist
COPY backend-hono/node_modules ./node_modules
ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "dist/index.js"]
