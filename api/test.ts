/**
 * One-shot REAL run of the check-in pipeline against the LIVE HoYoLAB API,
 * using the cookies in your environment, printing every step's logs.
 *
 * It performs an actual daily check-in. This is idempotent — HoYoLAB returns
 * retcode -5003 ("already checked in") on repeat — so it is safe to re-run.
 *
 * Usage:
 *   # PowerShell
 *   $env:GENSHIN_COOKIES="..."; $env:STARRAIL_COOKIES="..."; npm test
 *
 *   # or drop a .env file next to package.json, then:
 *   tsc && node --env-file=.env dist/api/test.js
 *
 * `npm test` compiles with tsc and runs this file. Plugins/middlewares are
 * fetched from the remote @official repo at runtime, so this exercises the
 * full resolve -> fetch -> import -> checkin -> middleware chain end to end.
 */
import { getConfig } from './config.js';
import { ExecutionPipeline } from './core/pipeline.js';

async function main() {
  const startedAt = Date.now();
  console.log('================ mihoyo-sign · real run ================');
  console.log('Started:', new Date().toISOString());

  try {
    const config = getConfig();
    console.log('Plugins    :', config.plugins?.map(p => p.name).join(', ') || '(none)');
    console.log('Middlewares:', config.middlewares?.map(m => m.name).join(', ') || '(none)');

    const pipeline = new ExecutionPipeline(config);

    console.log('\n---------------- initialize (loading modules) ----------------');
    await pipeline.initialize();

    console.log('\n---------------- execute (checking in) ----------------');
    await pipeline.execute();

    console.log(`\n================ done in ${Date.now() - startedAt}ms ================`);
    process.exitCode = 0;
  } catch (error) {
    console.error('\n================ run FAILED ================');
    console.error(error);
    process.exitCode = 1;
  }
}

main();
