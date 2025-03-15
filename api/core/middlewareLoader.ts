import { MiddlewareConfig } from '../types/middleware.js';
import { MiddlewareResolver } from './resolver.js';
import { GlobalConfig } from '../types/common.js';
import { Middleware } from '../types/middleware.js';
import { importModule } from '../util.js';
import { LoadResult } from '../types/common.js';

export class MiddlewareLoader {
    /**
     * Loads a middleware module and wraps it in a function that returns
     * a Promise resolving to the middleware function.
     *
     * @param config - Middleware configuration
     * @param globalConfig - Global configuration
     * @returns A promise resolving to a LoadResult containing the name
     *          of the middleware and the wrapped middleware function
     */
    async load(
        config: MiddlewareConfig,
        globalConfig: GlobalConfig
    ): Promise<LoadResult<Middleware>> {
        const resolvedPath = MiddlewareResolver.resolve(config.modulePath, globalConfig);
        const module = await this.importModule(resolvedPath);

        return {
            name: config.name,
            instance: this.wrapMiddleware(module, config.options)
        };
    }

    /**
     * Wrap a middleware module's hook functions to bind the middleware options to `this`.
     * @param module - The middleware module
     * @param options - The middleware options
     */
    private wrapMiddleware(module: any, options: any): Middleware {
        return {
            preCheckin: module.preCheckin?.bind(null, options),
            postCheckin: module.postCheckin?.bind(null, options),
            onError: module.onError?.bind(null, options)
        };
    }

    // 复用PluginLoader的import逻辑
    private importModule = importModule;
}