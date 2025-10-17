export const getEnvName = ():string => process.env.ENV_NAME as string;
export const USE_FLUID:boolean = process.env.USE_FLUID == 'true';
export const IS_LOCAL:boolean = USE_FLUID
    ? process.env.USE_LOCAL_AZURE_RELAY == 'true'
    : process.env.USE_LOCAL_YJS_SERVER == 'true';

export const AZURE_RELAY_URL:string = IS_LOCAL
    ? 'http://localhost:7070' // 'https://tinylicious.api.dev.ist'
    : process.env.AZURE_RELAY_URL as string;
export const AZURE_RELAY_TENANT_ID:string = process.env.AZURE_RELAY_TENANT_ID as string;
export const AZURE_RELAY_ACCESS_KEY:string = process.env.AZURE_RELAY_ACCESS_KEY as string;

export const getYjsServerUrl = ():string => IS_LOCAL
    ? 'ws://127.0.0.1:5174'
    : process.env.YJS_SERVER_URL as string;
