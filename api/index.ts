import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getConfig } from './config.js';
import { ExecutionPipeline } from './core/pipeline.js';

// Hobby plan caps maxDuration at 60s. Check-in runs first (fast); the redeem
// plugins each carry a hard wall-clock time budget (config.timeBudgetMs) so the
// whole invocation stays comfortably under this ceiling. Unreached codes are
// retried on the next daily run (idempotent — HoYoLAB returns -2017 if already used).
export const config = { maxDuration: 60 };

const isLocal = process.env.VERCEL_ENV !== 'production';

async function run() {
  try {
    console.log(`Initializing in ${isLocal ? 'local' : 'cloud'} mode...`);
    const config = getConfig();
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