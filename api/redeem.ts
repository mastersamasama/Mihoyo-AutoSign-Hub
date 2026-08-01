import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getConfig } from './config.js';
import { ExecutionPipeline } from './core/pipeline.js';

// Gift-code redemption, on its own cron (see vercel.json) and so its own 60s.
//
// Why it is not part of api/index.ts any more: check-in and redeem used to share
// one invocation, which left redeem a ~16s budget. HoYoLAB requires ~5.5s between
// redeem calls, so 16s can attempt only 3 codes; the configured cap was 6, so the
// tail was fired back-to-back, answered -2016 (too frequent), and had no budget
// left for the cooldown retry. Since the code order is deterministic, the same
// codes lost that race every day — a version livestream's three codes could never
// all land. Splitting the cron gives redeem the full ceiling for both games.
export const config = { maxDuration: 60 };

async function run() {
  try {
    console.log('Redeem run starting...');
    const pipeline = new ExecutionPipeline(getConfig('redeem'));
    await pipeline.initialize();
    await pipeline.execute();
  } catch (error) {
    console.error('Fatal Error:', error);
  }
}

// Node-style handler: @vercel/node ignores a returned Response, so the response
// MUST be ended via res — otherwise the invocation hangs until the 60s timeout.
export default async (_req: VercelRequest, res: VercelResponse) => {
  await run();
  console.log('Redeem execution completed');
  res.status(200).send('OK');
};
