// One-shot FULL pipeline run (check-in + redeem) against the live APIs, using .env.local.
// Redeem plugins are repointed to the LOCAL api/plugins/redeem.js (not yet pushed to @official).
//
//   npx tsc && node --env-file=.env.local dist/api/run-once.js
import path from 'path';
import { getConfig } from './config.js';
import { ExecutionPipeline } from './core/pipeline.js';

async function main() {
  const startedAt = Date.now();
  console.log('================ full pipeline · check-in + redeem ================');
  console.log('Started:', new Date().toISOString());

  const config = getConfig();
  // Use local @official modules until they are published to the remote main.
  const localRedeem = path.resolve(process.cwd(), 'api/plugins/redeem.js');
  for (const p of config.plugins ?? []) {
    if (p.name?.endsWith('-redeem')) {
      p.modulePath = localRedeem;
      if (p.options) (p.options as any).maxPerRun = 50; // claim all codes this manual run
    }
  }
  for (const m of config.middlewares ?? []) {
    m.modulePath = path.resolve(process.cwd(), `api/middlewares/${m.name}.js`);
  }
  console.log('Plugins   :', config.plugins?.map(p => p.name).join(', '));

  const pipeline = new ExecutionPipeline(config);
  console.log('\n---- initialize ----');
  await pipeline.initialize();
  console.log('\n---- execute ----');
  await pipeline.execute();

  console.log(`\n================ done in ${Date.now() - startedAt}ms ================`);
}

main().catch(e => { console.error('Fatal:', e); process.exitCode = 1; });
