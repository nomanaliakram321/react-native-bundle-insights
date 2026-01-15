import express from 'express';
import * as fs from 'fs';
import * as path from 'path';
import open from 'open';
import { Reporter } from '../cli/reporter';

export async function startServer(
  port: number,
  dataPath: string,
  shouldOpen: boolean
): Promise<void> {
  const app = express();

  // Serve static files
  app.use(express.static(path.join(__dirname, '../../public')));

  // API endpoint to get analysis data
  app.get('/api/analysis', (req, res) => {
    try {
      if (!fs.existsSync(dataPath)) {
        return res.status(404).json({ error: 'Analysis data not found' });
      }

      const data = fs.readFileSync(dataPath, 'utf-8');
      const analysis = JSON.parse(data);

      // Convert moduleMap back from array to object for easier consumption
      if (Array.isArray(analysis.moduleMap)) {
        const moduleMapObj: any = {};
        analysis.moduleMap.forEach(([key, value]: [string, any]) => {
          moduleMapObj[key] = value;
        });
        analysis.moduleMap = moduleMapObj;
      }

      res.json(analysis);
    } catch (error) {
      res.status(500).json({ error: 'Failed to load analysis data' });
    }
  });

  // Serve index.html for all other routes
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../public/index.html'));
  });

  const server = app.listen(port, () => {
    const url = `http://localhost:${port}`;
    console.log(`\n`);
    Reporter.printSuccess(`Visualization server running at ${url}`);

    if (shouldOpen) {
      open(url);
    }
  });

  // Handle graceful shutdown
  process.on('SIGTERM', () => {
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });
}
