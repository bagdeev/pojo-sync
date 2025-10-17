import { SharedMap, SharedObjectSequence } from 'fluid-framework';
import * as Y from 'yjs';
import { SharedArrayItemsKey, SharedArrayKey } from '../models/adapters/arrayTypes';
import { SharedMapKey } from '../models/adapters/mapTypes';
import { IFluidPreparedValue, IYjsPreparedValue } from '../models/PreparedValue';
import { SyncNodeAdapters } from '../models/SyncNodeAdapter';
import { SyncNodeType } from '../models/SyncNodeType';
import { FluidUtils } from './FluidUtils';

const objectPrototype = Object.prototype;

export class SyncNodeUtils
{
    public static getCheckedIndex(value:unknown):{ isNumber:boolean; index:number; }
    {
        const isNumber:boolean = typeof value === 'number'
            || (typeof value === 'string' && /^[0-9]*$/.test(value));

        return {
            isNumber,
            index: isNumber ? parseInt(value as string) : NaN,
        };
    }

    public static hasProp(target:Object, prop:PropertyKey):boolean
    {
        return objectPrototype.hasOwnProperty.call(target, prop);
    }

    public static isISODateString(value:unknown | undefined):boolean
    {
        // 2023-12-11T11:35:24.168Z
        if( typeof value !== 'string' || !/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/.test(value) )
            return false;

        const date = new Date(value);

        return date instanceof Date && !isNaN(date.getTime()) && date.toISOString() === value;
    }

    public static getSyncNodeType(syncNodeAdapters:SyncNodeAdapters,
                                  parentType:SyncNodeType | undefined,
                                  value:any,
                                  isShared:boolean):SyncNodeType | undefined
    {
        for( const [syncNodeType, syncNodeAdapter] of Object.entries(syncNodeAdapters) )
        {
            if( syncNodeAdapter.isSupportedValue(parentType, value, isShared) )
                return syncNodeType as SyncNodeType;
        }

        return undefined;
    }

    public static prepareYjsSharedValue(syncNodeAdapters:SyncNodeAdapters,
                                        parentType:SyncNodeType | undefined,
                                        value:any):IYjsPreparedValue | undefined
    {
        const type:SyncNodeType | undefined = SyncNodeUtils.getSyncNodeType(
            syncNodeAdapters,
            parentType,
            value,
            true,
        );

        if( !type )
            return undefined;

        if( type === SyncNodeType.OBJECT || type === SyncNodeType.MAP )
        {
            const sharedMap:Y.Map<unknown> = value as Y.Map<unknown>;
            const children:Map<string | number, IYjsPreparedValue | undefined> = new Map();

            for( let [childName, childValue] of sharedMap.entries() )
            {
                if( childName !== SharedMapKey )
                {
                    const preparedValue:IYjsPreparedValue | undefined = SyncNodeUtils.prepareYjsSharedValue(
                        syncNodeAdapters,
                        type,
                        childValue,
                    );

                    children.set(
                        childName,
                        preparedValue,
                    );
                }
            }

            return {
                type,
                value: sharedMap,
                children,
            };
        }
        else if( type === SyncNodeType.ARRAY )
        {
            const sharedMap:Y.Map<unknown> = value as Y.Map<unknown>;
            const sharedSequence:Y.Array<string> = sharedMap.get(SharedArrayKey) as Y.Array<string>;
            const childrenSharedMap:Y.Map<unknown> = sharedMap.get(SharedArrayItemsKey) as Y.Map<unknown>;

            const children:Map<string | number, IYjsPreparedValue | undefined> = new Map();

            const length:number = sharedSequence.length;

            for( let childIndex = 0; childIndex < length; childIndex++ )
            {
                const childNodeId = sharedSequence.get(childIndex);

                let childValue = childrenSharedMap.get(childNodeId);

                const preparedValue:IYjsPreparedValue | undefined = SyncNodeUtils.prepareYjsSharedValue(
                    syncNodeAdapters,
                    type,
                    childValue,
                );

                if( preparedValue )
                    preparedValue.childNodeId = childNodeId;

                children.set(
                    childIndex,
                    preparedValue,
                );
            }

            return {
                type,
                value: sharedMap,
                sharedSequence,
                childrenSharedMap,
                children,
            };
        }
        else if( type )
        {
            return {
                type,
                value,
            };
        }

        return undefined;
    }

    public static async prepareFluidSharedValue(syncNodeAdapters:SyncNodeAdapters,
                                                parentType:SyncNodeType | undefined,
                                                value:any):Promise<IFluidPreparedValue | undefined>
    {
        if( FluidUtils.isSharedObjectHandle(value) )
            value = await value.get();

        const type:SyncNodeType | undefined = SyncNodeUtils.getSyncNodeType(
            syncNodeAdapters,
            parentType,
            value,
            true,
        );

        if( !type )
            return undefined;

        if( type === SyncNodeType.OBJECT || type === SyncNodeType.MAP )
        {
            const sharedMap:SharedMap = value as SharedMap;
            const children:Map<string | number, IFluidPreparedValue | undefined> = new Map();

            for( let [childName, childValue] of sharedMap.entries() )
            {
                if( childName !== SharedMapKey )
                {
                    const preparedValue:IFluidPreparedValue | undefined = await SyncNodeUtils.prepareFluidSharedValue(
                        syncNodeAdapters,
                        type,
                        childValue,
                    );

                    children.set(
                        childName,
                        preparedValue,
                    );
                }
            }

            return {
                type,
                value: sharedMap,
                children,
            };
        }
        else if( type === SyncNodeType.ARRAY )
        {
            const sharedMap:SharedMap = value as SharedMap;
            const sharedSequence:SharedObjectSequence<string> = await sharedMap.get(SharedArrayKey)
                .get() as SharedObjectSequence<string>;
            const childrenSharedMap:SharedMap = await sharedMap.get(SharedArrayItemsKey).get() as SharedMap;

            const children:Map<string | number, IFluidPreparedValue | undefined> = new Map();

            const length:number = sharedSequence.getLength();

            for( let childIndex = 0; childIndex < length; childIndex++ )
            {
                const [childNodeId] = sharedSequence.getItems(childIndex);

                let childValue = childrenSharedMap.get(childNodeId);

                const preparedValue:IFluidPreparedValue | undefined = await SyncNodeUtils.prepareFluidSharedValue(
                    syncNodeAdapters,
                    type,
                    childValue,
                );

                if( preparedValue )
                    preparedValue.childNodeId = childNodeId;

                children.set(
                    childIndex,
                    preparedValue,
                );
            }

            return {
                type,
                value: sharedMap,
                sharedSequence,
                childrenSharedMap,
                children,
            };
        }
        else if( type )
        {
            return {
                type,
                value,
            };
        }

        return undefined;
    }
}
