# Stage 1: Build stage
FROM node:22-alpine AS builder

# Install pnpm
RUN npm install -g pnpm@11.12.0

WORKDIR /app

# Copy lockfile and workspace configurations
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY lib/db/package.json ./lib/db/
COPY lib/api-zod/package.json ./lib/api-zod/
COPY artifacts/api-server/package.json ./artifacts/api-server/
COPY artifacts/school-report/package.json ./artifacts/school-report/
COPY artifacts/mockup-sandbox/package.json ./artifacts/mockup-sandbox/

# Install dependencies (frozen lockfile to guarantee consistent builds)
RUN pnpm install --frozen-lockfile

# Copy the rest of the application files
COPY . .

# Build all libraries and apps
RUN pnpm run build

# Stage 2: Runner stage
FROM node:22-alpine AS runner

WORKDIR /app

# Set production environment variables
ENV NODE_ENV=production
ENV PORT=8085

# Copy built code and node_modules from builder stage
COPY --from=builder /app /app

EXPOSE 8085

# Start the Express server
CMD ["node", "./artifacts/api-server/dist/index.mjs"]
