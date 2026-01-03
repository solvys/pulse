FROM node:20-alpine

WORKDIR /app/backend-hono

# Copy the compiled backend along with its existing dependencies.
# Assumes the working directory (build context) already sits inside `backend-hono/`.
COPY dist ./dist
COPY node_modules ./node_modules
ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "dist/index.js"]
