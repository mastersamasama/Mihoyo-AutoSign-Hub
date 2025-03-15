export interface context {
    plugins_meta: { [name: string]: Record<string, string> }, // meta data of plugins
    timestamp: number; // timeStamps of checkin process started
}

export interface preContext extends context {
    plugin_options: any; // options of plugins
}

// post context extends pre context
export interface postContext extends context {
    result: any; // result of checkin
}

export interface errorContext extends context {
    error: any; // error of checkin
}

export interface Middleware {
    preCheckin?(ctx: preContext): Promise<void>;
    postCheckin?(ctx: postContext): Promise<void>;
    onError?(ctx: errorContext): Promise<void>;
}

export interface MiddlewareConfig {
    name: string
    modulePath: string
    target?: string[]
    options?: Record<string, any>
}