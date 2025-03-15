import { getConfig } from './config.js';
import { ExecutionPipeline } from './core/pipeline.js';

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

export default async (req: Request, res: Response) => {
  await run();
  console.log('Execution completed');
  return new Response('OK', { status: 200 });
};

if (process.env.NODE_ENV === 'development') {
  run();
}