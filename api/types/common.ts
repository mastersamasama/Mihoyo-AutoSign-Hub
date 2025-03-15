import { MiddlewareConfig } from "./middleware.js";
import { PluginConfig } from "./plugin.js";

export interface LoadResult<T> {
    name: string
    instance: T
}

export interface GlobalConfig {
    plugin_repo?: string
    middleware_repo?: string
    pathResolvers?: Record<string, (rawPath: string) => string>;
    plugins?: PluginConfig[]
    middlewares?: MiddlewareConfig[]
}

export type PathResolver = (rawPath: string) => string;