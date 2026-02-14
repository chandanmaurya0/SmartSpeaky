# 🐳 Docker Deployment Guide for Ito Server

This guide covers building and deploying the Ito backend server using Docker.

## 📋 Prerequisites

Before building the Docker image, ensure you have:

1. **Docker** installed (v20.10+)
2. **Docker Compose** installed (v2.0+)
3. **Environment variables** configured in `.env` file

## 🔧 Essential Requirements Checklist

### 1. Environment Configuration

Create a `.env` file with all required variables:

```bash
# Copy example and customize
cp .env.example .env
```

**Required Variables:**

- ✅ `PORT` - Server port (default: 3000)
- ✅ `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME` - PostgreSQL config
- ✅ `GROQ_API_KEY` - For AI transcription
- ✅ `BLOB_STORAGE_BUCKET` - S3 bucket name
- ✅ `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` - S3/MinIO config

**Optional Variables:**

- `REQUIRE_AUTH` - Enable Auth0 (default: false)
- `AUTH0_DOMAIN`, `AUTH0_AUDIENCE` - Auth0 config (if auth enabled)
- `CEREBRAS_API_KEY` - Alternative AI provider

### 2. Database Migrations

Ensure all migrations are ready:

```bash
# Check migrations directory
ls -la src/migrations/

# Test migrations locally first
bun run local-db-up
bun run db:migrate
```

### 3. Protocol Buffer Files

Ensure proto files are present:

```bash
# Check proto file exists
ls -la src/ito.proto

# Generate types locally to verify
bun run proto:gen:server
```

## 🚀 Building the Docker Image

### Option 1: Using Docker Compose (Recommended)

This starts all services (server + PostgreSQL + MinIO):

```bash
# Build and start all services
docker compose up --build -d

# View logs
docker compose logs -f ito-grpc-server

# Run migrations
docker compose exec ito-grpc-server bun run db:migrate

# Check status
docker compose ps
```

### Option 2: Build Standalone Image

Build just the server image:

```bash
# Build the image
docker build -t ito-server:latest .

# Run with external database
docker run -d \
  --name ito-server \
  -p 3000:3000 \
  --env-file .env \
  ito-server:latest
```

## 📦 What's Included in the Docker Image

The Docker image includes:

1. **Base Image**: `oven/bun:1-alpine` (lightweight Bun runtime)
2. **Dependencies**: All npm packages from `package.json`
3. **Source Code**: Complete TypeScript source
4. **Proto Generation**: Auto-generated gRPC types
5. **Build Output**: Compiled JavaScript in `/dist`
6. **Migration Scripts**: Database migration tools

## 🏗️ Docker Compose Services

Your `docker-compose.yml` includes:

### 1. **ito-grpc-server** (Main Application)

- Runs the Ito backend server
- Exposes port 3000
- Depends on PostgreSQL and MinIO
- Auto-restarts on failure

### 2. **db** (PostgreSQL Database)

- PostgreSQL 16
- Persistent volume for data
- Exposed on port 5432
- Auto-configured from `.env`

### 3. **minio** (S3-Compatible Storage)

- MinIO server for audio storage
- API on port 9000
- Console on port 9001
- Persistent volume for files

### 4. **createbuckets** (Initialization)

- One-time setup container
- Creates required S3 buckets
- Sets bucket permissions
- Exits after completion

## 🔍 Verifying the Deployment

### 1. Check Container Status

```bash
docker compose ps
```

Expected output:

```
NAME              STATUS    PORTS
ito-server        Up        0.0.0.0:3000->3000/tcp
ito-postgres      Up        0.0.0.0:5432->5432/tcp
ito-minio         Up        0.0.0.0:9000-9001->9000-9001/tcp
```

### 2. Test Health Endpoint

```bash
curl http://localhost:3000/
```

Expected: `Welcome to the Ito Connect RPC server!`

### 3. Check Logs

```bash
# Server logs
docker compose logs -f ito-grpc-server

# Database logs
docker compose logs -f db

# MinIO logs
docker compose logs -f minio
```

### 4. Verify Database Connection

```bash
docker compose exec ito-grpc-server bun run db:migrate
```

### 5. Access MinIO Console

Open http://localhost:9001 in browser:

- Username: `minioadmin` (or your `S3_ACCESS_KEY_ID`)
- Password: `minioadmin` (or your `S3_SECRET_ACCESS_KEY`)

## 🛠️ Common Operations

### Start Services

```bash
docker compose up -d
```

### Stop Services

```bash
docker compose down
```

### Restart Server Only

```bash
docker compose restart ito-grpc-server
```

### View Real-time Logs

```bash
docker compose logs -f
```

### Run Migrations

```bash
docker compose exec ito-grpc-server bun run db:migrate
```

### Access Server Shell

```bash
docker compose exec ito-grpc-server sh
```

### Rebuild After Code Changes

```bash
docker compose up --build -d ito-grpc-server
```

## 🔧 Troubleshooting

### Issue: Build Fails with TypeScript Errors

**Solution**: Fix TypeScript errors before building:

```bash
# Check for errors
bun run build

# Fix errors in source code
# Then rebuild Docker image
docker compose up --build
```

### Issue: Database Connection Failed

**Solution**: Ensure database is ready:

```bash
# Check database status
docker compose ps db

# View database logs
docker compose logs db

# Verify environment variables
docker compose exec ito-grpc-server env | grep DB_
```

### Issue: MinIO Bucket Not Created

**Solution**: Check bucket creation logs:

```bash
# View createbuckets logs
docker compose logs createbuckets

# Manually create bucket
docker compose exec minio mc mb /data/ito-blob-storage
```

### Issue: Proto Generation Fails

**Solution**: Generate proto files locally first:

```bash
# Install dependencies
bun install

# Generate proto types
bun run proto:gen:server

# Then rebuild Docker
docker compose up --build
```

### Issue: Port Already in Use

**Solution**: Change ports in `.env`:

```bash
# Edit .env
PORT=3001
DB_PORT=5433

# Update docker-compose.yml if needed
# Then restart
docker compose down
docker compose up -d
```

## 🚢 Production Deployment

### 1. Multi-Stage Build (Optimized)

For production, use a multi-stage Dockerfile:

```dockerfile
# Build stage
FROM oven/bun:1-alpine AS builder
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run proto:gen:server
RUN bun build src/index.ts --outdir dist --target bun

# Production stage
FROM oven/bun:1-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/scripts ./scripts
EXPOSE 3000
CMD ["bun", "run", "start"]
```

### 2. Environment Variables

Use Docker secrets or environment variable injection:

```bash
# Using Docker secrets
docker secret create db_password /path/to/password
docker service create --secret db_password ito-server

# Using environment file
docker run --env-file .env.production ito-server
```

### 3. Health Checks

Add health check to Dockerfile:

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD curl -f http://localhost:3000/ || exit 1
```

### 4. Resource Limits

Set resource limits in docker-compose.yml:

```yaml
services:
  ito-grpc-server:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
```

## 📊 Monitoring

### View Resource Usage

```bash
docker stats ito-server
```

### Export Logs

```bash
docker compose logs --since 1h > server-logs.txt
```

### Database Backup

```bash
docker compose exec db pg_dump -U devuser devdb > backup.sql
```

## 🔒 Security Best Practices

1. **Don't commit `.env` file** - Use `.env.example` as template
2. **Use strong passwords** - For database and MinIO
3. **Enable Auth0** - Set `REQUIRE_AUTH=true` in production
4. **Use HTTPS** - Put behind reverse proxy (nginx/traefik)
5. **Limit network exposure** - Use Docker networks
6. **Regular updates** - Keep base images updated

## 📝 Next Steps

After successful deployment:

1. ✅ Run database migrations
2. ✅ Test API endpoints
3. ✅ Configure monitoring
4. ✅ Set up backups
5. ✅ Configure SSL/TLS
6. ✅ Set up CI/CD pipeline

---

## 🆘 Support

If you encounter issues:

1. Check logs: `docker compose logs -f`
2. Verify environment variables
3. Test locally without Docker first
4. Check [GitHub Issues](https://github.com/heyito/ito/issues)
