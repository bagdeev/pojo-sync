import { SharedMap, SharedObjectSequence } from 'fluid-framework';
import * as Y from 'yjs';
import { SyncNodeType } from './SyncNodeType';

export interface IPreparedValue<MT, ST>
{
    type:SyncNodeType;
    value:MT | string | number | boolean;
    sharedSequence?:ST;
    childrenSharedMap?:MT;
    childNodeId?:string;
    children?:Map<string | number, IPreparedValue<MT, ST> | undefined>;
}

export type IYjsPreparedValue = IPreparedValue<Y.Map<unknown>, Y.Array<string>>;
export type IFluidPreparedValue = IPreparedValue<SharedMap, SharedObjectSequence<string>>;
