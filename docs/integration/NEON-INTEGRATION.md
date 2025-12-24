# Neon & Encore Integration Guide

This guide explains how to connect your Neon PostgreSQL database to the Encore backend and manage SQL jobs for the Pulse platform.

## Part 1: Connecting Neon to Encore

Encore handles database connections automatically via its `storage/sqldb` package. To use Neon instead of the default local/managed DB:

### 1. Get your Neon Connection String
- Go to the [Neon Console](https://console.neon.tech/).
- Select your project and database.
- Copy the **Connection String** (it looks like `postgres://user:password@host/dbname?sslmode=require`).

### 2. Configure Encore External Database
In Encore, you can use external databases by setting the `ENCORE_DATABASE_URL` for specific environments.

**For Local Development:**
You can point your local Encore instance to Neon by running:
```bash
encore run --db-url=pulse=postgres://...
```

**For Cloud Deployment:**
1. Go to your **Encore Cloud Dashboard**.
2. Navigate to **Settings > Databases**.
3. Select the `pulse` database.
4. Choose **External Database** and paste your Neon connection string.

---

## Part 2: SQL Jobs in Neon

Neon supports "SQL Jobs" or scheduled tasks via standard PostgreSQL features or external triggers.

### 1. Using `pg_cron` (if enabled)
If your Neon plan supports `pg_cron`, you can schedule SQL jobs directly in the database:

```sql
-- Example: Clean up old chat threads every day at midnight
SELECT cron.schedule('0 0 * * *', $$
  DELETE FROM chat_threads 
  WHERE updated_at < NOW() - INTERVAL '30 days'
$$);
```

### 2. Using Encore Cron Jobs (Recommended)
Instead of putting logic inside Neon, it is better to use **Encore Cron Jobs** to trigger SQL logic. This keeps your business logic in code.

**Step 1: Create a job in `backend/db/jobs.ts`**
```typescript
import { CronJob } from "encore.dev/cron";
import { db } from "./index";

// Define the job
const dailyCleanup = new CronJob("daily-cleanup", {
  schedule: "0 0 * * *", // Every day at midnight
  handler: async () => {
    await db.exec`
      DELETE FROM chat_threads 
      WHERE updated_at < NOW() - INTERVAL '30 days'
    `;
  },
});
```

---

## Part 3: Step-by-Step Setup Checklist

1. **Environment Variables**: Ensure `NEON_DATABASE_URL` is NOT hardcoded. Use Encore's built-in DB management.
2. **Migrations**: Ensure your migrations in `backend/db/migrations` are compatible with standard PostgreSQL. Neon is 100% Postgres compatible.
3. **SSL Mode**: Always include `?sslmode=require` in your connection string for Neon.
4. **Secrets**: If you need to store the raw Neon password for other tools, use `encore secret set NeonPassword`.

---

## Troubleshooting

- **Deployment Error**: If you see `ERR_MODULE_NOT_FOUND`, ensure you have run `npm install` and your `tsconfig.json` has the correct paths (which we just fixed!).
- **Connection Timeout**: Ensure you haven't enabled strict IP allow-listing in Neon without adding the Encore egress IPs.
