/**
 * Retrieves a secret from the environment variables.
 * @param {string} key The name of the secret to retrieve.
 * @returns {string} The secret value.
 * @throws If the secret is not found.
 */
export const getSecret = (key: string) => {
    const secret = process.env[key];
    if (!secret) {
        console.log(process.env);
        throw new Error(`Secret ${key} is not found`);
    }
    return secret;
};

import { pathToFileURL, fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Import a module, either from a remote URL or a local path.
 * 
 * @param modulePath The path to the module to import. Can be a URL or a local path.
 * @returns A Promise that resolves to the imported module.
 * @throws If the module path is invalid or the module cannot be imported.
 */
export async function importModule(modulePath: string): Promise<any> {
    if (!modulePath) throw new Error('Module path is required');

    // handle remote module import first
    if (modulePath.startsWith('http://') || modulePath.startsWith('https://')) {
        try {
            const response = await fetch(modulePath);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            // originally use fetch to text and the do btoa(), but this not support utf-8 file name
            // turn the response bit data into ArrayBuffer
            const buffer = await response.arrayBuffer();
            // convert the buffer to base64 string
            const base64 = Buffer.from(buffer).toString('base64');

            console.log('Get Remote Module:', modulePath);

            return import(`data:text/javascript;base64,${base64}`);
        } catch (error: any) {
            console.error('Remote Module Import Failed:', {
                url: modulePath,
                error: error.message
            });
            throw error;
        }
    }

    // handle local module import
    let resolvedPath: string;
    if (modulePath.startsWith('.')) {
        // resolve relative path to absolute path
        resolvedPath = path.join(__dirname, modulePath);
    } else {
        // retain the module path
        resolvedPath = modulePath;
    }

    // transform to file URL instead of path
    const fileUrl = pathToFileURL(
        resolvedPath.endsWith('.js') ? resolvedPath : `${resolvedPath}.js`
    ).href;

    console.log('Get Local Module:', fileUrl);

    try {
        return import(fileUrl);
    } catch (error) {
        console.error('Local Module Import Failed:', error);
        throw error;
    }
}