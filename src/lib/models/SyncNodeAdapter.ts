import { IPreparedValue } from './PreparedValue';
import { ISyncNode } from './SyncNode';
import { SyncNodeType } from './SyncNodeType';

export interface ISyncNodeAdapter<CCT, NT, CNT>
{
    isSupportedValue(parentType:SyncNodeType | undefined,
                     value:any,
                     isShared:boolean):boolean;
    getChildrenContainer():CCT;
    getChild(node:ISyncNode<CCT, NT, CNT>, childName:CNT):ISyncNode<unknown, CNT, unknown> | undefined;
    addChild(node:ISyncNode<CCT, NT, CNT>, childNode:ISyncNode<unknown, CNT, unknown> | undefined, childName:CNT, value:any, isShared:boolean):ISyncNode<unknown, CNT, unknown> | undefined;
    deleteChild(node:ISyncNode<CCT, NT, CNT>, childName:CNT, isShared:boolean):ISyncNode<unknown, CNT, unknown> | undefined;
    getValue(node:ISyncNode<CCT, NT, CNT>):unknown | undefined;
    setValue(node:ISyncNode<CCT, NT, CNT>, value:unknown | IPreparedValue<unknown, unknown> | undefined, isShared:boolean):boolean;
    init(node:ISyncNode<CCT, NT, CNT>, value:unknown | IPreparedValue<unknown, unknown> | undefined, isShared:boolean):void;
    destroy(node:ISyncNode<CCT, NT, CNT>, isShared:boolean):void;
    toJSON(node:ISyncNode<CCT, NT, CNT>):unknown;
}

export type SyncNodeAdapters = Record<SyncNodeType, ISyncNodeAdapter<unknown, unknown, unknown>>;
