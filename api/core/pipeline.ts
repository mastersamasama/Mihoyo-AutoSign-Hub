import { GlobalConfig } from '../types/common.js';
import { Middleware, preContext, postContext, errorContext, context } from '../types/middleware.js';
import { MiddlewareLoader } from './middlewareLoader.js';
import { PluginLoader } from './pluginLoader.js';
import { PluginModule } from '../types/plugin.js';


export class ExecutionPipeline {
  private plugins: Map<string, PluginModule> = new Map();
  private middlewares: Map<string, Middleware> = new Map();
  private middlewareTargets: Map<string, string[]> = new Map();

  constructor(
    private globalConfig: GlobalConfig,
    private pluginLoader = new PluginLoader(),
    private middlewareLoader = new MiddlewareLoader()
  ) { }

  async initialize() {
    await this.loadPlugins();
    await this.loadMiddlewares();
  }

  /**
   * Asynchronously loads all plugins defined in the global configuration.
   * 
   * For each plugin configuration, it resolves the module path, imports
   * the module, and stores the plugin instance in the `plugins` map.
   * 
   * @returns {Promise<void>}
   */
  private async loadPlugins() {
    if (!this.globalConfig.plugins) return;

    for (const config of this.globalConfig.plugins) {
      const { name, instance } = await this.pluginLoader.load(config, this.globalConfig);
      this.plugins.set(name, instance);
    }
  }

  /**
   * Loads all middlewares as specified in the configuration file.
   * For each middleware, it resolves its path, loads the module,
   * and stores the middleware instance and its target plugins in this.middlewares
   * 
   * @returns {Promise<void>}
   */
  private async loadMiddlewares() {
    if (!this.globalConfig.middlewares) return;

    for (const config of this.globalConfig.middlewares) {
      const { name, instance } = await this.middlewareLoader.load(config, this.globalConfig);
      this.middlewares.set(name, instance);
      this.middlewareTargets.set(name, config.target || ['*']);
    }
  }

  /**
   * Executes all plugins in the pipeline. For each plugin, it runs the pre
   * hooks, the plugin's checkin function, the post hooks, and the error hooks
   * if the plugin's checkin function throws an error.
   *
   * @returns {Promise<void>}
   */
  async execute() {

    for (const [pluginName, plugin] of this.plugins) {
      // create a context object for the middleware in this plugin cycle
      const mwContext = this.createMiddlewareBaseContext(pluginName);

      try {
        // execute pre hooks
        await this.runPreHooks(pluginName, {
          ...mwContext,
          plugins_meta: mwContext.plugins_meta[pluginName] as any,
          plugin_options: this.getPluginOptions(pluginName)
        });

        // execute the plugin's checkin function
        const result = await plugin.checkin(this.getPluginOptions(pluginName));

        // execute post hooks
        await this.runPostHooks(pluginName, {
          ...mwContext,
          plugins_meta: mwContext.plugins_meta[pluginName] as any,
          result
        });
      } catch (error) {
        // execute error hooks
        await this.runErrorHooks(pluginName, {
          ...mwContext,
          plugins_meta: mwContext.plugins_meta[pluginName] as any,
          error: error as Error
        });
        console.log(`[${pluginName}] 插件执行失败:`, error);
      }
    }
  }


  private createMiddlewareBaseContext(name: string): context {
    return {
      plugins_meta: Object.fromEntries(
        Array.from(this.plugins).map(([name, p]) => [name, { ...p.meta }])
      ),
      timestamp: Date.now()
    };
  }

  private getPluginOptions(name: string) {
    return this.globalConfig.plugins?.find(p => p.name === name)?.options || {};
  }

  private async runPreHooks(name: string, ctx: preContext) {
    await this.runHooks('preCheckin', name, ctx);
  }

  private async runPostHooks(name: string, ctx: postContext) {
    await this.runHooks('postCheckin', name, ctx);
  }

  private async runErrorHooks(name: string, ctx: errorContext) {
    await this.runHooks('onError', name, ctx);
  }

  /**
   * Executes the specified hook for all applicable middlewares.
   *
   * @param hook - The name of the middleware hook to run (e.g., 'preCheckin', 'postCheckin', 'onError').
   * @param pluginName - The name of the plugin for which the hooks are being executed.
   * @param ctx - The context object associated with the current execution, which could be a preContext, postContext, or errorContext, depending on the hook.
   */
  private async runHooks(
    hook: keyof Middleware,
    pluginName: string,
    ctx: preContext | postContext | errorContext
  ) {
    for (const [mwName, middleware] of this.middlewares) {
      const targets = this.middlewareTargets.get(mwName) || ['*'];
      if (this.shouldApply(targets, pluginName)) {
        await middleware[hook]?.(ctx as any);
      }
    }
  }

  /**
   * Determines if a middleware should be applied to a given plugin.
   *
   * @param targets - An array of strings representing the target plugins.
   *                  A target of '*' indicates that the middleware applies to all plugins.
   * @param pluginName - The name of the plugin to check against the targets.
   * @returns A boolean indicating whether the middleware should be applied to the plugin.
   */
  private shouldApply(targets: string[], pluginName: string) {
    return targets.includes('*') || targets.includes(pluginName);
  }
}