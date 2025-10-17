import { ISyncNode } from '../SyncNode';

export const ObjectProxyKey:string = '__object_proxy__';

export type ObjectChildNodeType = ISyncNode<unknown, string, unknown>;
export type ObjectNodeType<NT> = ISyncNode<Map<string, ObjectChildNodeType>, NT, string>;

export type ObjectFieldValue = string | number | boolean | null;
export type ObjectFieldNode = ISyncNode<unknown, string, unknown>;
