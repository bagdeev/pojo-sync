import * as Y from 'yjs';
import { ISyncNode } from '../models/SyncNode';
import { EventName, ISyncNodeEvents } from '../models/SyncNodeEvents';
import { SyncNodeEventsTargetKey } from '../models/SyncNodeEventsTarget';
import { SyncNodeType } from '../models/SyncNodeType';
import { ITypedEventDisposer, ITypedEventListener } from '../models/TypedEventEmitter';

export class SyncUtils
{
    public static on<N extends EventName, E extends ISyncNodeEvents[N]>(target:any, eventName:N, listener:ITypedEventListener<E>):ITypedEventDisposer
    {
        const targetNode:ISyncNode<unknown, unknown, unknown> | undefined = target?.[SyncNodeEventsTargetKey];

        if( !targetNode )
            throw new Error('target is not the sync events emitter');

        return targetNode.on(eventName, listener);
    }

    public static onField<N extends EventName, E extends ISyncNodeEvents[N]>(target:any, fieldName:string, eventName:N, listener:ITypedEventListener<E>):ITypedEventDisposer
    {
        const targetNode:ISyncNode<unknown, unknown, unknown> | undefined = target?.[SyncNodeEventsTargetKey];

        if( !targetNode )
            throw new Error('target is not the sync events emitter');

        const childNode = targetNode.getChild(fieldName);

        if( !childNode )
            throw new Error('target field is not the sync events emitter');

        return childNode.on(eventName, listener);
    }

    public static once<N extends EventName, E extends ISyncNodeEvents[N]>(target:any, eventName:N, listener:ITypedEventListener<E>):ITypedEventDisposer
    {
        const targetNode:ISyncNode<unknown, unknown, unknown> | undefined = target?.[SyncNodeEventsTargetKey];

        if( !targetNode )
            throw new Error('target is not the sync events emitter');

        return targetNode.once(eventName, listener);
    }

    public static onceField<N extends EventName, E extends ISyncNodeEvents[N]>(target:any, fieldName:string, eventName:N, listener:ITypedEventListener<E>):ITypedEventDisposer
    {
        const targetNode:ISyncNode<unknown, unknown, unknown> | undefined = target?.[SyncNodeEventsTargetKey];

        if( !targetNode )
            throw new Error('target is not the sync events emitter');

        const childNode = targetNode.getChild(fieldName);

        if( !childNode )
            throw new Error('target field is not the sync events emitter');

        return childNode.once(eventName, listener);
    }

    public static off<N extends EventName, E extends ISyncNodeEvents[N]>(target:any, eventName:N, listener:ITypedEventListener<E>):void
    {
        const targetNode:ISyncNode<unknown, unknown, unknown> | undefined = target?.[SyncNodeEventsTargetKey];

        if( !targetNode )
            throw new Error('target is not the sync events emitter');

        targetNode.off(eventName, listener);
    }

    public static offField<N extends EventName, E extends ISyncNodeEvents[N]>(target:any, fieldName:string, eventName:N, listener:ITypedEventListener<E>):void
    {
        const targetNode:ISyncNode<unknown, unknown, unknown> | undefined = target?.[SyncNodeEventsTargetKey];

        if( !targetNode )
            throw new Error('target is not the sync events emitter');

        const childNode = targetNode.getChild(fieldName);

        if( !childNode )
            throw new Error('target field is not the sync events emitter');

        childNode.off(eventName, listener);
    }

    public static cloneValue<T>(target:T):T
    {
        if( !target )
            return target;

        const targetNode:ISyncNode<unknown, unknown, unknown> | undefined = (target as any)?.[SyncNodeEventsTargetKey];

        if( !targetNode )
            throw new Error('target is not the sync node');

        return targetNode.toJSON() as T;
    }

    public static cloneDeepValue<T>(target:T):T
    {
        if( !target )
            return target;

        const targetNode:ISyncNode<unknown, unknown, unknown> | undefined = (target as any)?.[SyncNodeEventsTargetKey];

        if( targetNode )
            return targetNode.toJSON() as T;
        else if( Array.isArray(target) )
            return target.map((value) => SyncUtils.cloneDeepValue(value)) as T;
        else if( target instanceof Date )
            return target;
        else if( target instanceof Map )
        {
            const result:Map<unknown, unknown> = new Map();

            target.forEach((value, key) =>
            {
                result.set(key, SyncUtils.cloneDeepValue(value));
            });

            return result as T;
        }
        else if( typeof target === 'object' )
        {
            const result:Record<string, any> = {};

            Object.entries(target).forEach(([key, value]) =>
            {
                result[key] = SyncUtils.cloneDeepValue(value);
            });

            return result as T;
        }
        else
            return target;
    }

    public static isSyncValue<T>(target:T):boolean
    {
        const targetNode:ISyncNode<unknown, unknown, unknown> | undefined = (target as any)?.[SyncNodeEventsTargetKey];

        return !!targetNode;
    }

    public static isSyncArray<T>(target:T):boolean
    {
        const targetNode:ISyncNode<unknown, unknown, unknown> | undefined = (target as any)?.[SyncNodeEventsTargetKey];

        return !!(targetNode && targetNode.type === SyncNodeType.ARRAY);
    }

    public static transaction<T>(target:T, callback:() => void):void
    {
        const targetNode:ISyncNode<unknown, unknown, unknown> | undefined = (target as any)?.[SyncNodeEventsTargetKey];

        if( !targetNode )
            throw new Error('target is not the sync node');

        (targetNode.container.container as Y.Doc).transact(() =>
        {
            callback();
        });
    }
}
