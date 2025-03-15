import { PluginConfig, PluginModule } from '../types/plugin.js';
import { GlobalConfig } from '../types/common.js';
import { PluginResolver } from './resolver.js';
import { importModule } from '../util.js';
import { LoadResult } from '../types/common.js';

export class PluginLoader {
    /**
     * Loads a plugin module and wraps it in a function that returns
     * a Promise resolving to the plugin instance.
     *
     * @param config - Plugin configuration
     * @param globalConfig - Global configuration
     * @returns A promise resolving to a LoadResult containing the name
     *          of the plugin and the wrapped plugin instance
     */
    async load(
        config: PluginConfig,
        globalConfig: GlobalConfig
    ): Promise<LoadResult<PluginModule>> {
        const resolvedPath = PluginResolver.resolve(config.modulePath, globalConfig);
        const module = await this.importModule(resolvedPath);

        return {
            name: config.name,
            instance: this.validateModule(module, config.name)
        };
    }

    private importModule = importModule;

    /**
     * Validates the plugin module by checking for the existence of a 'checkin' function.
     *
     * @param module - The plugin module to validate.
     * @param name - The name of the plugin, used for error reporting.
     * @returns The validated plugin module.
     * @throws Will throw an error if the module does not export a 'checkin' function.
     */
    private validateModule(module: any, name: string): PluginModule {
        if (typeof module.checkin !== 'function') {
            throw new Error(`[${name}] 插件必须导出 checkin 函数`);
        }
        return module;
    }
}