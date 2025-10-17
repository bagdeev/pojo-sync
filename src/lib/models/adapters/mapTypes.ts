import { ISyncNode } from '../SyncNode';

export const MapProxyKey:string = '__map_proxy__';
export const SharedMapKey:string = '__shared_map__';

export type MapChildNodeType = ISyncNode<unknown, string, unknown>;
export type MapNodeType<NT> = ISyncNode<Map<string, MapChildNodeType>, NT, string>;
