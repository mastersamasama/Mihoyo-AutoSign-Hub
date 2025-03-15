export type checkin = (ctx: PluginOptions) => any;

export interface PluginOptions {
    [key: string]: any;
}

export interface PluginConfig {
    name: string;
    modulePath: string;
    options: PluginOptions;
}

export interface PluginModule {
    meta?: Record<string, string>;
    checkin: checkin;
}

export interface loadedPlugin {
    name: string;
    instance: PluginModule;
}