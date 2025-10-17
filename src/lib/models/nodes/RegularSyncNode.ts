import { ISharedObject } from '@fluidframework/shared-object-base/src/types';
import { action, createAtom, IAtom } from 'mobx';
import * as Y from 'yjs';
import { log } from '../../utils/logger';
import { SyncNodeUtils } from '../../utils/SyncNodeUtils';
import { SyncUtils } from '../../utils/SyncUtils';
import { syncNodeAdapters } from '../adapters/adapters';
import { IInitializedContainer } from '../Container';
import { IPreparedValue } from '../PreparedValue';
import { USE_FLUID } from '../syncConfig';
import { ISyncNode } from '../SyncNode';
import { ISyncNodeAdapter } from '../SyncNodeAdapter';
import { ISyncNodeEvents } from '../SyncNodeEvents';
import { SyncNodeType } from '../SyncNodeType';
import { TypedEventEmitter } from '../TypedEventEmitter';

export class RegularSyncNode<CCT, NT, CNT> extends TypedEventEmitter<ISyncNodeEvents> implements ISyncNode<CCT, NT, CNT>
{
    public children:CCT;
    public readonly atom:IAtom;
    public sharedObject?:ISharedObject | Y.AbstractType<unknown>;
    public readonly listeners:Map<string, (...args:any[]) => void>;
    public data:Map<string, any>;
    public initialized:boolean;
    public deleted:boolean;

    protected constructor(public container:IInitializedContainer,
                          public parent:ISyncNode<unknown, unknown, NT> | undefined,
                          public readonly type:SyncNodeType,
                          public readonly name:NT)
    {
        super();

        this.atom = createAtom(
            `${name} (${type})`,
            () =>
            {
                log(`%c[${this._className}] OBSERVED: ${this.path.join(' -> ')}`, 'color: moccasin');
            },
            () =>
            {
                log(`%c[${this._className}] UNOBSERVED: ${this.path.join(' -> ')}`, 'color: darkkhaki');
            },
        );

        this.children = this.adapter.getChildrenContainer();

        this.sharedObject = undefined;
        this.listeners = new Map();
        this.data = new Map();
        this.initialized = false;
        this.deleted = false;
    }

    protected get _className():string
    {
        return this.constructor.name;
    }

    public get path():(string | number)[]
    {
        const path:(string | number)[] = [this.name as any];
        let parent:ISyncNode<unknown, unknown, unknown> | undefined = this.parent;

        while( parent )
        {
            path.unshift(parent.name as any);
            parent = parent.parent;
        }

        return path;
    }

    public get adapter():ISyncNodeAdapter<CCT, NT, CNT>
    {
        return syncNodeAdapters[this.type] as ISyncNodeAdapter<CCT, NT, CNT>;
    }

    public prepareSharedValue(parentType:SyncNodeType | undefined,
                              value:any):Promise<IPreparedValue<unknown, unknown> | undefined> | IPreparedValue<unknown, unknown> | undefined
    {
        if( USE_FLUID )
            return SyncNodeUtils.prepareFluidSharedValue(
                syncNodeAdapters,
                parentType,
                value,
            );
        else
            return SyncNodeUtils.prepareYjsSharedValue(
                syncNodeAdapters,
                parentType,
                value,
            );
    }

    public getChild(childName:CNT):ISyncNode<unknown, CNT, unknown> | undefined
    {
        this.atom.reportObserved();

        return this.adapter.getChild(this, childName);
    }

    @action.bound
    public addChild(childName:CNT, value:any, isShared:boolean):ISyncNode<unknown, CNT, unknown> | undefined
    {
        if( this.initialized && this.deleted )
        {
            console.warn(`%c[${this._className}] ADD CHILD CALL ON DELETED NODE`, 'color: hotpink');
            return undefined;
        }

        if( SyncUtils.isSyncValue(value) )
            value = SyncUtils.cloneValue(value);

        const childNode:ISyncNode<unknown, CNT, unknown> | undefined = RegularSyncNode.create(
            this.container,
            this,
            childName,
            value,
            isShared,
        );

        this.adapter.addChild(this, childNode as any, childName, value, isShared);

        if( childNode )
        {
            log(`%c[${this._className}] CHILD ADDED: ${this.name} => ${childName} =`, 'color: palevioletred', value);

            childNode.deleted = false;

            this.atom.reportChanged();

            this.emit(
                'add',
                {
                    eventName: 'add',
                    target: this.getValue(),
                    path: this.path,
                    key: childName as any,
                    value: childNode.toJSON(),
                    isLocal: !isShared,
                },
            );
        }

        return childNode;
    }

    @action.bound
    public deleteChild(childName:CNT, isShared:boolean):ISyncNode<unknown, CNT, unknown> | undefined
    {
        if( this.initialized && this.deleted )
        {
            console.warn(`%c[${this._className}] DELETE CHILD CALL ON DELETED NODE`, 'color: hotpink');
            return undefined;
        }

        const childNode:ISyncNode<unknown, CNT, unknown> | undefined = this.adapter.deleteChild(this, childName, isShared);

        log(`%c[${this._className}] CHILD DELETED: ${this.name} => ${childName}`, 'color: palevioletred');

        if( childNode )
        {
            childNode.deleted = true;

            this.atom.reportChanged();

            this.emit(
                'remove',
                {
                    eventName: 'remove',
                    target: this.getValue(),
                    path: this.path,
                    key: childName as any,
                    value: childNode.toJSON(),
                    isLocal: !isShared,
                },
            );
        }

        return childNode;
    }

    public getValue():any
    {
        this.atom.reportObserved();

        return this.adapter.getValue(this);
    }

    @action.bound
    public setValue(value:unknown | IPreparedValue<unknown, unknown> | undefined, isShared:boolean):boolean
    {
        log(`%c[${this._className}] SET VALUE: ${this.name}, isShared = ${isShared}, value =`, 'color: hotpink', value);

        if( this.initialized && this.deleted )
        {
            console.warn(`%c[${this._className}] SET VALUE CALL ON DELETED NODE`, 'color: hotpink');
            return false;
        }

        if( SyncUtils.isSyncValue(value) )
            value = SyncUtils.cloneValue(value);

        const type:SyncNodeType | undefined = isShared
            ? (value as IPreparedValue<unknown, unknown>).type
            : SyncNodeUtils.getSyncNodeType(
                syncNodeAdapters,
                this.parent?.type,
                value,
                isShared,
            );

        if( value && type !== this.type )
            throw new Error('Unsupported value');

        const isChanged:boolean = this.adapter.setValue(this, value, isShared);

        if( isChanged )
        {
            log(`%c[${this._className}] SET VALUE CHANGED: ${this.name} =`, 'color: palevioletred', value);

            this.atom.reportChanged();

            this.emit(
                'change',
                {
                    eventName: 'change',
                    target: this.getValue(),
                    path: this.path,
                    key: undefined,
                    value: this.toJSON(),
                    isLocal: true,
                },
            );
        }

        return isChanged;
    }

    @action.bound
    protected init(value:unknown | IPreparedValue<unknown, unknown> | undefined, isShared:boolean):void
    {
        log(`%c[${this._className}] INIT: ${this.name}, isShared = ${isShared}, value =`, 'color: hotpink', value);

        if( SyncUtils.isSyncValue(value) )
            value = SyncUtils.cloneValue(value);

        this.adapter.init(this, value, isShared);

        this.initialized = true;

        this.atom.reportChanged();
    }

    @action.bound
    public destroy(isShared:boolean):void
    {
        this.emit(
            'destroy',
            {
                eventName: 'destroy',
                target: this.getValue(),
                path: this.path,
                key: undefined,
                value: this.toJSON(),
                isLocal: !isShared,
            },
        );

        this.adapter.destroy(this, isShared);

        this.sharedObject = undefined;

        this.listeners.clear();
        this.data.clear();

        // this.initialized = false;
        this.deleted = true;

        this.parent = undefined;
        this.container = undefined as any;

        this.offAll();
    }

    public toJSON():unknown
    {
        return this.adapter.toJSON(this);
    }

    public static create<CCT, NT, CNT>(container:IInitializedContainer,
                                       parent:ISyncNode<unknown, unknown, NT> | undefined,
                                       name:NT,
                                       value:unknown | IPreparedValue<unknown, unknown> | undefined,
                                       isShared:boolean):ISyncNode<CCT, NT, CNT> | undefined
    {
        if( SyncUtils.isSyncValue(value) )
            value = SyncUtils.cloneValue(value);

        const type:SyncNodeType | undefined = isShared
            ? value
                ? (value as IPreparedValue<unknown, unknown>).type
                : undefined
            : SyncNodeUtils.getSyncNodeType(
                syncNodeAdapters,
                parent?.type,
                value,
                isShared,
            );

        if( type === SyncNodeType.ARRAY && !parent )
        {
            console.log('%cINVALID NODE CREATED: ', 'background: red, color white', type);
            debugger;
        }

        if( !type )
            return undefined;

        const node:RegularSyncNode<CCT, NT, CNT> = new RegularSyncNode<CCT, NT, CNT>(
            container,
            parent,
            type,
            name,
        );

        node.init(value, isShared);

        return node;
    }
}
