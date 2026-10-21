import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

app.use(express.json());

// API Route: Health & Environment Status
app.get('/api/health', (_req, res) => {
  const hasSupabaseUrl = Boolean(process.env.VITE_SUPABASE_URL && !process.env.VITE_SUPABASE_URL.includes('your-project'));
  const hasAnonKey = Boolean(process.env.VITE_SUPABASE_ANON_KEY && !process.env.VITE_SUPABASE_ANON_KEY.includes('your-anon-key'));
  const hasServiceKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY.includes('your-service-role'));

  res.json({
    status: 'ok',
    platform: 'Aadi Sparsh',
    phase: 1,
    supabase: {
      configured: hasSupabaseUrl && hasAnonKey,
      hasServiceRoleKey: hasServiceKey,
      url: hasSupabaseUrl ? process.env.VITE_SUPABASE_URL : 'dev-fallback',
    },
    launchTemple: {
      name: 'Shri Adinath Bhagwan Jain Temple',
      location: 'Chickpet, Bengaluru',
      dailyFamilyCapacity: 15,
      poojaWindow: '06:00:00 - 08:00:00',
    },
    timestamp: new Date().toISOString(),
  });
});

// API Route: Inspect Available SQL Migrations
app.get('/api/migrations', (_req, res) => {
  const migrationsDir = path.resolve(__dirname, 'supabase/migrations');
  if (!fs.existsSync(migrationsDir)) {
    return res.json({ migrations: [] });
  }

  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'));
  const migrations = files.map((file) => {
    const fullPath = path.join(migrationsDir, file);
    const content = fs.readFileSync(fullPath, 'utf8');
    return {
      fileName: file,
      sizeBytes: content.length,
      preview: content.slice(0, 300),
    };
  });

  res.json({ migrations });
});

// API Route: Complete Schema SQL script for 1-click execution in Supabase Dashboard
app.get('/api/full-schema.sql', (_req, res) => {
  const fullSqlPath = path.resolve(__dirname, 'supabase/full_schema_migration.sql');
  if (fs.existsSync(fullSqlPath)) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.sendFile(fullSqlPath);
  }
  res.status(404).send('Migration file not found');
});

// Server Static / Vite Middleware Setup
async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`[Aadi Sparsh] Server running on port ${PORT} (Mode: ${isProduction ? 'Production' : 'Development'})`);
  });
}

startServer();
