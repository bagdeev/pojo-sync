import { BaseSyncState } from '../models/BaseSyncState';

export interface SyncStateConstructor extends Function
{
    new(...args:Array<any>):BaseSyncState;
}

export function syncState<CT extends SyncStateConstructor>(syncStateConstructor:CT):CT
{
    if( syncStateConstructor && syncStateConstructor.prototype.constructor )
        return syncStateConstructor;
    else
        throw new Error('@syncState decorator should be used on class only');
}
