let isLoggerEnabled:boolean = false;

export function log(...args:Array<any>):void
{
    isLoggerEnabled && console.log(...args);
}

export function setSyncLoggerOptions(isEnabled:boolean):void
{
    isLoggerEnabled = isEnabled;
}
