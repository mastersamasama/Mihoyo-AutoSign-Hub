import { GlobalConfig } from '../types/common.js';


export class PluginResolver {
  /**
   * Resolves the given path to a fully qualified URL based on the provided configuration.
   * It first creates a set of default resolvers, which can be overridden by user-defined
   * path resolvers in the configuration. The function then attempts to match the provided
   * path with the resolvers and returns the resolved URL.
   *
   * @param path - The raw path that needs to be resolved to a URL.
   * @param config - The configuration object containing repository URLs and path resolvers.
   * @returns A string representing the resolved URL.
   */
  static resolve(path: string, config: GlobalConfig): string {
    // only add default rule when user didn't define @official/
    const defaultResolvers = this.createDefaultResolvers(config);
    const mergedResolvers = {
      ...defaultResolvers,
      ...(config.pathResolvers || {})
    };

    return this.resolveWithResolvers(path, mergedResolvers);
  }


  /**
   * Creates a set of default resolvers that can be used to resolve paths
   * to fully qualified URLs. The default resolvers are only added when
   * the user hasn't overridden them and the repository URL is defined.
   *
   * @param config - The configuration object containing repository URLs and path resolvers.
   * @returns An object containing the default resolvers.
   */
  private static createDefaultResolvers(config: GlobalConfig) {
    const defaults: Record<string, (path: string) => string> = {};

    // only add default rule when user didn't override @official/ and repo is defined
    if (config.plugin_repo && !config.pathResolvers?.['@official/']) {
      defaults['@official/'] = (path: string) =>
        `${config.plugin_repo}/${path.replace('@official/', '')}`;
    }

    return defaults;
  }

  /**
   * Resolves the given path to a fully qualified URL by matching it with
   * the provided resolvers. The function first finds the longest prefix
   * that matches the path, then calls the corresponding resolver to
   * generate the resolved URL. If no prefix is matched, the original
   * path is returned.
   *
   * @param rawPath - The raw path that needs to be resolved to a URL.
   * @param resolvers - An object containing resolvers, where each key is a
   *                    prefix string and the value is a function that takes
   *                    the path and returns the resolved URL.
   * @returns A string representing the resolved URL.
   */
  private static resolveWithResolvers(
    rawPath: string,
    resolvers: Record<string, (path: string) => string>
  ): string {
    const matchedPrefix = Object.keys(resolvers)
      .filter(p => rawPath.startsWith(p))
      .sort((a, b) => b.length - a.length)[0];

    return matchedPrefix
      ? resolvers[matchedPrefix](rawPath)
      : rawPath;
  }
}

export class MiddlewareResolver {
  static resolve(path: string, config: GlobalConfig): string {
    // Reuse the plugin parsing logic and replace the repository type
    return PluginResolver.resolve(path, {
      ...config,
      plugin_repo: config.middleware_repo,
      pathResolvers: {
        ...this.createMiddlewareDefaults(config),
        ...config.pathResolvers
      }
    });
  }

  private static createMiddlewareDefaults(config: GlobalConfig) {
    const defaults: Record<string, (path: string) => string> = {};

    if (config.middleware_repo && !config.pathResolvers?.['@official/']) {
      defaults['@official/'] = (path: string) =>
        `${config.middleware_repo}/${path.replace('@official/', '')}`;
    }

    return defaults;
  }
}