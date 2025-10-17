import { SharedMap, SharedObjectSequence } from 'fluid-framework';
import * as Y from 'yjs';
import { ISyncNode } from '../SyncNode';

export const ArrayProxyKey:string = '__array_proxy__';
export const SharedArrayKey:string = '__shared_array__';
export const SharedArrayItemsKey:string = '__shared_array_items__';

export type ArrayChildNodeType = ISyncNode<unknown, number, unknown>;

export type IMutateArrayValue =
    {
        __shared_array__:boolean;
        sequence:string[];
    }

export interface IArrayChildNodes
{
    sequence:string[];
    children:Map<string, ArrayChildNodeType>;
}

export type ArrayNodeType<NT> = ISyncNode<IArrayChildNodes, NT, number>;

export interface ISharedArrayObjects<MT, ST>
{
    sharedMap:MT;
    sharedSequence:ST;
    childrenSharedMap:MT;
}

export type IYjsSharedArrayObjects = ISharedArrayObjects<Y.Map<unknown>, Y.Array<string>>;
export type IFluidSharedArrayObjects = ISharedArrayObjects<SharedMap, SharedObjectSequence<string>>;

export type ArrayItemValue = string | number | boolean | null;
export type ArrayItemNode = ISyncNode<unknown, number, unknown>;
