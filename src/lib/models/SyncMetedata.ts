import { SyncNodeType } from './SyncNodeType';

export const SyncMetedataKey:string = '__sync_metadata__';

export interface ISyncMetadata
{
    propertyKey:PropertyKey;
    type:SyncNodeType;
}
