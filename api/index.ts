import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getConfig } from './config.js';
import { ExecutionPipeline } from './core/pipeline.js';

// Check-in only. Redeem moved to its own cron/function (api/redeem.ts): sharing
// one 60s invocation left the redeem loop ~16s, which at the measured 8.1s per
// code can attempt just 2 — the rest were fired un-throttled, earned -2016, and
// were dropped on every single run.
export const config = { maxDuration: 60 };

const isLocal = process.env.VERCEL_ENV !== 'production';

async function run() {
  try {
    console.log(`Initializing in ${isLocal ? 'local' : 'cloud'} mode...`);
    const config = getConfig('checkin');
    const pipeline = new ExecutionPipeline(config);
    await pipeline.initialize();
    await pipeline.execute();
  } catch (error) {
    console.error('Fatal Error:', error);
    process.exit(1);
  }
}

// Node-style handler: @vercel/node ignores a returned Response, so we MUST end the
// response via res. A previous `return new Response()` never sent anything, which
// made every invocation hang until the 60s function timeout (504).
export default async (_req: VercelRequest, res: VercelResponse) => {
  await run();
  console.log('Execution completed');
  res.status(200).send('OK');
};

if (process.env.NODE_ENV === 'development') {
  run();
}