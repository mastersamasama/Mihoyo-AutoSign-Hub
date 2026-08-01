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
    /** Run the plugins concurrently instead of one after another. Only safe when the
     *  plugins do not share a rate limit — measured true for redeem (HoYoLAB's 5s
     *  redemption cooldown is per game account, verified independent across
     *  Genshin/Star Rail). Check-in stays sequential. */
    concurrent?: boolean
}

export type PathResolver = (rawPath: string) => string;