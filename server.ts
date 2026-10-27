import express from 'express';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import path from 'path';

async function startServer() {
  const app = express();
  const port = parseInt(process.env.PORT || '3000', 10);

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Persistent access logs file
  const LOGS_FILE = path.resolve(process.cwd(), '.access_logs.json');

  function loadLogs() {
    try {
      if (fs.existsSync(LOGS_FILE)) {
        const raw = fs.readFileSync(LOGS_FILE, 'utf-8');
        return JSON.parse(raw);
      }
    } catch {
      // ignore
    }
    return [];
  }

  function saveLogs(logs: unknown[]) {
    try {
      fs.writeFileSync(LOGS_FILE, JSON.stringify(logs, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to write access logs:', err);
    }
  }

  let accessLogs: Array<{
    id: string;
    timestamp: string;
    formattedTime: string;
    weekId: string;
    weekLabel: string;
    viewerId: string;
    ip?: string;
    deviceType: string;
    browser: string;
    os: string;
    screenResolution?: string;
    userAgent?: string;
    isOwnerView?: boolean;
  }> = loadLogs();

  // API 1: Silent access log recording
  app.post('/api/access-logs', (req, res) => {
    try {
      const body = req.body || {};
      const clientIp =
        (req.headers['x-forwarded-for'] as string) ||
        req.socket.remoteAddress ||
        '127.0.0.1';

      const entry = {
        id: 'log_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        timestamp: body.timestamp || new Date().toISOString(),
        formattedTime: body.formattedTime || new Date().toLocaleString(),
        weekId: body.weekId || '미지정',
        weekLabel: body.weekLabel || '미지정',
        viewerId: body.viewerId || 'anon',
        ip: String(clientIp).split(',')[0].trim(),
        deviceType: body.deviceType || 'Desktop',
        browser: body.browser || 'Browser',
        os: body.os || 'OS',
        screenResolution: body.screenResolution || '',
        userAgent: body.userAgent || (req.headers['user-agent'] as string) || '',
        isOwnerView: Boolean(body.isOwnerView),
      };

      // Add to beginning of array
      accessLogs.unshift(entry);
      // Keep up to 1000 latest entries
      if (accessLogs.length > 1000) {
        accessLogs = accessLogs.slice(0, 1000);
      }

      saveLogs(accessLogs);
      res.json({ ok: true, count: accessLogs.length });
    } catch (err) {
      console.error('Error logging access:', err);
      res.status(500).json({ error: 'Failed to record log' });
    }
  });

  // API 2: Retrieve access logs for owner audit
  app.get('/api/access-logs', (_req, res) => {
    try {
      res.json({ ok: true, logs: accessLogs });
    } catch (err) {
      console.error('Error fetching access logs:', err);
      res.status(500).json({ error: 'Failed to fetch logs' });
    }
  });

  // API 3: Clear all access logs
  app.delete('/api/access-logs', (_req, res) => {
    try {
      accessLogs = [];
      saveLogs(accessLogs);
      res.json({ ok: true, message: 'Access logs cleared successfully' });
    } catch (err) {
      console.error('Error clearing access logs:', err);
      res.status(500).json({ error: 'Failed to clear logs' });
    }
  });

  // Persistent workspace file (Products master, dataStore, lines, shiftRules)
  const WORKSPACE_FILE = path.resolve(process.cwd(), '.workspace_data.json');

  function loadWorkspace() {
    try {
      if (fs.existsSync(WORKSPACE_FILE)) {
        const raw = fs.readFileSync(WORKSPACE_FILE, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.warn('Failed to load workspace file:', err);
    }
    return null;
  }

  function saveWorkspace(data: unknown) {
    try {
      fs.writeFileSync(WORKSPACE_FILE, JSON.stringify(data, null, 2), 'utf-8');
      return true;
    } catch (err) {
      console.error('Failed to write workspace file:', err);
      return false;
    }
  }

  // API 4: Get saved workspace data
  app.get('/api/workspace', (_req, res) => {
    const data = loadWorkspace();
    res.json({ ok: true, data });
  });

  // API 5: Save persistent workspace data to server disk
  app.post('/api/workspace', (req, res) => {
    try {
      const payload = req.body || {};
      const success = saveWorkspace(payload);
      if (success) {
        res.json({ ok: true, savedAt: new Date().toISOString() });
      } else {
        res.status(500).json({ error: 'Failed to write workspace file' });
      }
    } catch (err: any) {
      console.error('Error saving workspace:', err);
      res.status(500).json({ error: err.message || 'Failed to save workspace' });
    }
  });

  // Persistent revisions file (Published immutable baselines)
  const REVISIONS_FILE = path.resolve(process.cwd(), '.revisions_data.json');

  function loadRevisions(): Record<string, any> {
    try {
      if (fs.existsSync(REVISIONS_FILE)) {
        const raw = fs.readFileSync(REVISIONS_FILE, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.warn('Failed to load revisions file:', err);
    }
    return {};
  }

  function saveRevisions(data: Record<string, any>) {
    try {
      fs.writeFileSync(REVISIONS_FILE, JSON.stringify(data, null, 2), 'utf-8');
      return true;
    } catch (err) {
      console.error('Failed to write revisions file:', err);
      return false;
    }
  }

  // API 6: List published revisions
  app.get('/api/revisions', (req, res) => {
    try {
      const all = loadRevisions();
      const weekId = req.query.weekId as string | undefined;
      const list = Object.values(all)
        .filter((rev: any) => !weekId || rev.weekId === weekId)
        .map((rev: any) => ({
          id: rev.id,
          weekId: rev.weekId,
          versionNumber: rev.versionNumber,
          title: rev.title,
          memo: rev.memo,
          createdAt: rev.createdAt,
          createdBy: rev.createdBy,
        }))
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      res.json({ ok: true, revisions: list });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch revisions' });
    }
  });

  // API 7: Fetch single published revision by ID
  app.get('/api/revisions/:id', (req, res) => {
    try {
      const all = loadRevisions();
      const rev = all[req.params.id];
      if (rev) {
        res.json({ ok: true, revision: rev });
      } else {
        res.status(404).json({ error: 'Revision not found' });
      }
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch revision' });
    }
  });

  // API 8: Publish and save a new immutable revision snapshot
  app.post('/api/revisions', (req, res) => {
    try {
      const payload = req.body?.revision || req.body || {};
      if (!payload.id || !payload.weekId || !Array.isArray(payload.products)) {
        return res.status(400).json({ error: 'Invalid revision payload' });
      }

      const all = loadRevisions();
      all[payload.id] = {
        ...payload,
        createdAt: payload.createdAt || new Date().toISOString(),
      };

      saveRevisions(all);
      res.json({ ok: true, id: payload.id, revision: all[payload.id] });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to save revision' });
    }
  });

  // Vite middleware in dev or static files in production
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`[PSI Server] Running at http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('[PSI Server] Failed to start:', err);
  process.exit(1);
});
