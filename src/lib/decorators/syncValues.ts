import 'reflect-metadata';
import { BaseSyncState } from '../models/BaseSyncState';
import { ISyncMetadata, SyncMetedataKey } from '../models/SyncMetedata';
import { ISyncNode } from '../models/SyncNode';
import { SyncNodeType } from '../models/SyncNodeType';
import { log } from '../utils/logger';

function syncDecoratorImpl<T>(
    type:SyncNodeType,
    target:BaseSyncState,
    propertyKey:PropertyKey,
):TypedPropertyDescriptor<T>
{
    log(`%cSA decorator descriptor for propertyKey ${propertyKey as string} in class ${target.constructor.name}`, 'color: orange');

    const syncMetadata:ISyncMetadata[] = Reflect.getMetadata(SyncMetedataKey, target) || [];

    syncMetadata.push({ propertyKey, type });

    Reflect.defineMetadata(SyncMetedataKey, syncMetadata, target);

    const descriptor:TypedPropertyDescriptor<T> = {
        get(this:BaseSyncState):any
        {
            if( !this.initialized || typeof propertyKey !== 'string' )
                return undefined;

            // log(`%c[${type}Decorator] GET: ${propertyKey}`, 'color: steelblue');

            this.syncNode.atom.reportObserved();

            const childNode:ISyncNode<unknown, string, unknown> | undefined = this.syncNode.getChild(propertyKey);

            // log(`%c[${type}Decorator] CHILD NODE GET: ${propertyKey} =`, 'color: violet', childNode);

            return childNode?.getValue();
        },
        set(this:BaseSyncState, value:any):void
        {
            if( !this.initialized )
                return;

            // log(`%c[${type}Decorator] SET: ${propertyKey as string}`, 'color: steelblue');

            if( typeof propertyKey !== 'string' )
                return;

            const childNode:ISyncNode<unknown, string, unknown> | undefined = this.syncNode.getChild(propertyKey);

            // log(`%c[${type}Decorator] CHILD NODE SET: ${propertyKey} =`, 'color: violet', childNode);

            if( childNode )
                childNode.setValue(value, false);
            else
                this.syncNode.addChild(propertyKey, value, false);
        },
        enumerable: true,
        configurable: false,
    };

    return descriptor;
}

export type IfEquals<X, Y, A, B> = (<T>() => T extends X ? 1 : 2) extends (<T>() => T extends Y ? 1 : 2) ? A : B;

export type WritableKeysOf<T> = {
    [P in keyof T]:IfEquals<{ [Q in P]:T[P] }, { -readonly [Q in P]:T[P] }, P, never>
}[keyof T];

export type OmitObjectsUnsupported<T> = {
    [P in keyof T as T[P] extends Array<unknown> | string | number | boolean | Function | Map<unknown, unknown> ? never : P]:T[P]
}

export type PickObjects<T> = {
    [P in WritableKeysOf<OmitObjectsUnsupported<T>> as T[P] extends object ? P : never]:T[P]
}

export type PickMaps<T> = {
    [P in WritableKeysOf<T> as T[P] extends Map<unknown, unknown> ? P : never]:T[P]
}

export type PickArrays<T> = {
    [P in WritableKeysOf<T> as T[P] extends Array<unknown> ? P : never]:T[P]
}

export type PickValues<T> = {
    [P in WritableKeysOf<T> as T[P] extends string | number | boolean ? P : never]:T[P]
}

export function syncObject<T extends BaseSyncState, P extends keyof PickObjects<T>>(target:T, propertyKey:P):any
{
    return syncDecoratorImpl(SyncNodeType.OBJECT, target, propertyKey);
}

export function syncMap<T extends BaseSyncState, P extends keyof PickMaps<T>>(target:T, propertyKey:P):any
{
    return syncDecoratorImpl(SyncNodeType.MAP, target, propertyKey);
}

export function syncArray<T extends BaseSyncState, P extends keyof PickArrays<T>>(target:T, propertyKey:P):any
{
    return syncDecoratorImpl(SyncNodeType.ARRAY, target, propertyKey);
}

export function syncValue<T extends BaseSyncState, P extends keyof PickValues<T>>(target:T, propertyKey:P):any
{
    return syncDecoratorImpl(SyncNodeType.OBJECT_FIELD, target, propertyKey);
}
