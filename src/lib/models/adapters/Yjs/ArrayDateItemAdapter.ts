import * as Y from 'yjs';
import { log } from '../../../utils/logger';
import { SyncNodeUtils } from '../../../utils/SyncNodeUtils';
import { IYjsPreparedValue } from '../../PreparedValue';
import { ISyncNode } from '../../SyncNode';
import { ISyncNodeAdapter } from '../../SyncNodeAdapter';
import { SyncNodeType } from '../../SyncNodeType';
import {
    ArrayItemNode,
    ArrayItemValue,
    IYjsSharedArrayObjects,
    SharedArrayItemsKey,
    SharedArrayKey,
} from '../arrayTypes';

export class YjsArrayDateItemAdapter implements ISyncNodeAdapter<unknown, number, unknown>
{
    protected get _className():string
    {
        return this.constructor.name;
    }

    private _getSharedObjects(node:ArrayItemNode):IYjsSharedArrayObjects
    {
        const sharedMap:Y.Map<unknown> = (node.parent?.sharedObject) as Y.Map<unknown>;
        const sharedSequence:Y.Array<string> = node.parent?.data.get(SharedArrayKey);
        const childrenSharedMap:Y.Map<unknown> = node.parent?.data.get(SharedArrayItemsKey);

        return {
            sharedMap,
            sharedSequence,
            childrenSharedMap,
        };
    }

    public isSupportedValue(parentType:SyncNodeType | undefined,
                            value:any,
                            _isShared:boolean):boolean
    {
        return parentType === SyncNodeType.ARRAY
            && (value instanceof Date
                || SyncNodeUtils.isISODateString(value));
    }

    public getChildrenContainer():unknown
    {
        return undefined;
    }

    public getChild(_node:ArrayItemNode, _childName:number):ISyncNode<unknown, unknown, unknown> | undefined
    {
        throw new Error('NOT_SUPPORTED');
    }

    public addChild(_node:ArrayItemNode, _childNode:ISyncNode<unknown, unknown, unknown> | undefined, _childName:string, _value:ArrayItemValue, _isShared:boolean):ISyncNode<unknown, unknown, unknown> | undefined
    {
        throw new Error('NOT_SUPPORTED');
    }

    public deleteChild(_node:ArrayItemNode, _childName:string, _isShared:boolean):ISyncNode<unknown, unknown, unknown> | undefined
    {
        throw new Error('NOT_SUPPORTED');
    }

    public getValue(node:ArrayItemNode):Date | undefined
    {
        const {
            sharedSequence,
            childrenSharedMap,
        } = this._getSharedObjects(node);

        const childNodeId = sharedSequence.get(node.name);
        const value:ArrayItemValue | undefined = childrenSharedMap.get(childNodeId) as ArrayItemValue | undefined;

        // log(`%c[${this._className}] GET ARRAY ITEM VALUE: ${node.path.join(' -> ')} =`, 'color: yellow', value);

        return typeof value === 'string' ? new Date(value) : undefined;
    }

    public setValue(node:ArrayItemNode, value:Date | string | undefined, isShared:boolean):boolean
    {
        log(`%c[${this._className}] SET ARRAY DATE ITEM VALUE: ${node.path.join(' -> ')} =`, 'color: lime', value);

        if( !isShared )
        {
            const {
                sharedSequence,
                childrenSharedMap,
            } = this._getSharedObjects(node);

            if( !(value instanceof Date) && !SyncNodeUtils.isISODateString(value) )
                throw new Error(`Property ${node.name} can be a Date or ISO date string only`);

            const childNodeId = sharedSequence.get(node.name);
            const newValue:string | undefined = typeof value === 'string' ? value : value?.toISOString();
            const oldValue:string | undefined = childrenSharedMap.get(childNodeId) as string | undefined;

            if( newValue !== oldValue )
            {
                childrenSharedMap.set(childNodeId, newValue);

                return true;
            }
            else
                return false;
        }
        else
            return true;
    }

    public init(node:ArrayItemNode, value:Date | string | IYjsPreparedValue, isShared:boolean):void
    {
        log(`%c[${this._className}] INIT ARRAY DATE ITEM VALUE: ${node.path.join(' -> ')}, isShared = ${isShared}, value =`, 'color: aqua', value);

        const { childrenSharedMap } = this._getSharedObjects(node);

        if( !node.initialized || node.deleted )
        {
            const onArrayDateItemChange = (mapEvent:Y.YMapEvent<unknown>):void =>
            {
                this._onArrayDateItemChange(node, mapEvent);
            };

            childrenSharedMap.observe(onArrayDateItemChange);
            node.listeners.set('valueChanged', onArrayDateItemChange);
        }
    }

    private _onArrayDateItemChange(node:ArrayItemNode, mapEvent:Y.YMapEvent<unknown>):void
    {
        const isLocal:boolean = mapEvent.transaction.local;

        if( !isLocal && !node.initialized )
        {
            log(`%c[${this._className}] ON SHARED ARRAY DATE ITEM CHANGE DURING INITIALIZATION: ${node.path.join(' -> ')}, IsLocal = ${isLocal}`, 'background: red; color: yellow', mapEvent, mapEvent.keys);
            return;
        }

        if( !isLocal && node.deleted )
        {
            log(`%c[${this._className}] ON SHARED ARRAY DATE ITEM CHANGE ON DELETED NODE: ${node.path.join(' -> ')}, IsLocal = ${isLocal}`, 'background: red; color: yellow', mapEvent, mapEvent.keys);
            return;
        }

        log(`%c[${this._className}] ON ARRAY DATE ITEM CHANGE: ${node.path.join(' -> ')}, IsLocal = ${isLocal}`, 'color: salmon', mapEvent, mapEvent.keys);

        const { sharedSequence } = this._getSharedObjects(node);

        const childNodeId = sharedSequence.get(node.name);

        for( const [childName, changedValue] of mapEvent.keys )
        {
            if( childName === childNodeId )
            {
                const value:Date | undefined = this.getValue(node);
                const newValue:string | undefined = value?.toISOString();

                if( !isLocal && newValue !== changedValue.oldValue )
                    node.atom.reportChanged();
            }
        }
    }

    public destroy(node:ArrayItemNode, _isShared:boolean):void
    {
        log(`%c[${this._className}] DESTROY ARRAY DATE ITEM: ${node.path.join(' -> ')}`, 'color: orchid');

        const { childrenSharedMap } = this._getSharedObjects(node);

        const onArrayItemChange = node.listeners.get('valueChanged');

        if( onArrayItemChange )
            childrenSharedMap.unobserve(onArrayItemChange);

        node.listeners.delete('valueChanged');
    }

    public toJSON(node:ArrayItemNode):unknown
    {
        return node.getValue();
    }
}
