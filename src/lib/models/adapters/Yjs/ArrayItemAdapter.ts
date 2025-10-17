import * as Y from 'yjs';
import { log } from '../../../utils/logger';
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

export class YjsArrayItemAdapter implements ISyncNodeAdapter<unknown, number, unknown>
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
            && (typeof value === 'string'
                || typeof value === 'number'
                || typeof value === 'boolean'
                || value === undefined
                || value === null);
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

    public getValue(node:ArrayItemNode):ArrayItemValue | undefined
    {
        const {
            sharedSequence,
            childrenSharedMap,
        } = this._getSharedObjects(node);

        const childNodeId = sharedSequence.get(node.name);
        const value:ArrayItemValue | undefined = childrenSharedMap.get(childNodeId) as ArrayItemValue | undefined;

        // log(`%c[${this._className}] GET ARRAY ITEM VALUE: ${node.path.join(' -> ')} =`, 'color: yellow', value);

        return value;
    }

    public setValue(node:ArrayItemNode, value:ArrayItemValue | undefined, isShared:boolean):boolean
    {
        log(`%c[${this._className}] SET ARRAY ITEM VALUE: ${node.path.join(' -> ')} =`, 'color: lime', value);

        if( !isShared )
        {
            const {
                sharedSequence,
                childrenSharedMap,
            } = this._getSharedObjects(node);

            if( value != undefined && typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean' )
                throw new Error(`Property ${node.name} can be a string, number or boolean only`);

            const childNodeId = sharedSequence.get(node.name);
            const oldValue:ArrayItemValue | undefined = childrenSharedMap.get(childNodeId) as ArrayItemValue | undefined;

            if( value !== oldValue )
            {
                childrenSharedMap.set(childNodeId, value);

                return true;
            }
            else
                return false;
        }
        else
            return true;
    }

    public init(node:ArrayItemNode, value:ArrayItemValue | IYjsPreparedValue, isShared:boolean):void
    {
        log(`%c[${this._className}] INIT ARRAY ITEM VALUE: ${node.path.join(' -> ')}, isShared = ${isShared}, value =`, 'color: aqua', value);

        const { childrenSharedMap } = this._getSharedObjects(node);

        if( !node.initialized || node.deleted )
        {
            const onArrayItemChange = (mapEvent:Y.YMapEvent<unknown>):void =>
            {
                this._onArrayItemChange(node, mapEvent);
            };

            childrenSharedMap.observe(onArrayItemChange);
            node.listeners.set('valueChanged', onArrayItemChange);
        }
    }

    private _onArrayItemChange(node:ArrayItemNode, mapEvent:Y.YMapEvent<unknown>):void
    {
        const isLocal:boolean = mapEvent.transaction.local;

        if( !isLocal && !node.initialized )
        {
            log(`%c[${this._className}] ON SHARED OBJECT CHANGE DURING INITIALIZATION: ${node.path.join(' -> ')}, IsLocal = ${isLocal}`, 'background: red; color: yellow', mapEvent, mapEvent.keys);
            return;
        }

        if( !isLocal && node.deleted )
        {
            log(`%c[${this._className}] ON SHARED ARRAY CHANGE ON DELETED NODE: ${node.path.join(' -> ')}, IsLocal = ${isLocal}`, 'background: red; color: yellow', mapEvent, mapEvent.keys);
            return;
        }

        log(`%c[${this._className}] ON ARRAY ITEM CHANGE: ${node.path.join(' -> ')}, IsLocal = ${isLocal}`, 'color: salmon', mapEvent, mapEvent.keys);

        const { sharedSequence } = this._getSharedObjects(node);

        const childNodeId = sharedSequence.get(node.name);

        for( const [childName, changedValue] of mapEvent.keys )
        {
            if( childName === childNodeId )
            {
                const value:ArrayItemValue | undefined = this.getValue(node);

                if( !isLocal && value !== changedValue.oldValue )
                    node.atom.reportChanged();
            }
        }
    }

    public destroy(node:ArrayItemNode, _isShared:boolean):void
    {
        log(`%c[${this._className}] DESTROY ARRAY ITEM: ${node.path.join(' -> ')}`, 'color: orchid');

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
