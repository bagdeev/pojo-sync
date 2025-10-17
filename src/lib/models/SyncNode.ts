import { ISharedObject } from '@fluidframework/shared-object-base/src/types';
import { IAtom } from 'mobx';
import * as Y from 'yjs';
import { IInitializedContainer } from './Container';
import { IPreparedValue } from './PreparedValue';
import { ISyncNodeEvents } from './SyncNodeEvents';
import { SyncNodeType } from './SyncNodeType';
import { TypedEventEmitter } from './TypedEventEmitter';

export interface ISyncNode<CCT, NT, CNT> extends TypedEventEmitter<ISyncNodeEvents>
{
    readonly container:IInitializedContainer,
    readonly type:SyncNodeType,
    name:NT,
    parent:ISyncNode<unknown, unknown, NT> | undefined,
    children:CCT;
    readonly atom:IAtom;
    readonly listeners:Map<string, (...args:any[]) => void>;
    sharedObject?:ISharedObject | Y.AbstractType<unknown>;
    data:Map<string, any>;
    initialized:boolean;
    deleted:boolean;

    readonly path:(string | number)[];

    prepareSharedValue(parentType:SyncNodeType | undefined, value:any):Promise<IPreparedValue<unknown, unknown> | undefined> | IPreparedValue<unknown, unknown> | undefined;

    getChild(childName:CNT):ISyncNode<unknown, CNT, unknown> | undefined;
    addChild(childName:CNT, value:any, isShared:boolean):ISyncNode<unknown, CNT, unknown> | undefined;
    deleteChild(childName:CNT, isShared:boolean):ISyncNode<unknown, CNT, unknown> | undefined;
    getValue():any;
    setValue(value:unknown | IPreparedValue<unknown, unknown> | undefined, isShared:boolean):boolean;
    destroy(isShared:boolean):void;
    toJSON():unknown;
}
