import { IValueChanged, SharedMap, SharedObjectSequence } from 'fluid-framework';
import { log } from '../../../utils/logger';
import { IFluidPreparedValue } from '../../PreparedValue';
import { ISyncNode } from '../../SyncNode';
import { ISyncNodeAdapter } from '../../SyncNodeAdapter';
import { SyncNodeType } from '../../SyncNodeType';
import {
    ArrayItemNode,
    ArrayItemValue,
    IFluidSharedArrayObjects,
    SharedArrayItemsKey,
    SharedArrayKey,
} from '../arrayTypes';

export class FluidArrayItemAdapter implements ISyncNodeAdapter<unknown, number, unknown>
{
    protected get _className():string
    {
        return this.constructor.name;
    }

    private _getSharedObjects(node:ArrayItemNode):IFluidSharedArrayObjects
    {
        const sharedMap:SharedMap = (node.parent?.sharedObject) as SharedMap;
        const sharedSequence:SharedObjectSequence<string> = node.parent?.data.get(SharedArrayKey);
        const childrenSharedMap:SharedMap = node.parent?.data.get(SharedArrayItemsKey);

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
                || typeof value === 'boolean');
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

        const [childNodeId] = sharedSequence.getItems(node.name);
        const value:ArrayItemValue | undefined = childrenSharedMap.get(childNodeId);

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

            const [childNodeId] = sharedSequence.getItems(node.name);
            const oldValue:ArrayItemValue | undefined = childrenSharedMap.get(childNodeId);

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

    public init(node:ArrayItemNode, value:ArrayItemValue | IFluidPreparedValue, isShared:boolean):void
    {
        log(`%c[${this._className}] INIT ARRAY ITEM VALUE: ${node.path.join(' -> ')}, isShared = ${isShared}, value =`, 'color: aqua', value);

        const { childrenSharedMap } = this._getSharedObjects(node);

        if( !node.initialized || node.deleted )
        {
            const onArrayItemChange = (valueChanged:IValueChanged, isLocal:boolean):void =>
            {
                this._onArrayItemChange(node, valueChanged, isLocal);
            };

            childrenSharedMap.on('valueChanged', onArrayItemChange);
            node.listeners.set('valueChanged', onArrayItemChange);
        }
    }

    private _onArrayItemChange(node:ArrayItemNode, valueChanged:IValueChanged, isLocal:boolean):void
    {
        if( !isLocal && !node.initialized )
        {
            console.log(`%c[${this._className}] ON SHARED ARRAY ITEM CHANGE DURING INITIALIZATION: ${node.path.join(' -> ')}, IsLocal = ${isLocal}`, 'background: red; color: yellow', valueChanged, valueChanged.key);
            return;
        }

        if( !isLocal && node.deleted )
        {
            console.log(`%c[${this._className}] ON SHARED ARRAY ITEM CHANGE ON DELETED NODE: ${node.path.join(' -> ')}, IsLocal = ${isLocal}`, 'background: red; color: yellow', valueChanged, valueChanged.key);
            return;
        }

        log(`%c[${this._className}] ON ARRAY ITEM CHANGE: ${node.path.join(' -> ')}, IsLocal = ${isLocal}`, 'color: salmon', valueChanged, valueChanged.key);

        const { sharedSequence } = this._getSharedObjects(node);

        const [childNodeId] = sharedSequence.getItems(node.name);
        const childName:string | number = valueChanged.key;

        if( childName === childNodeId )
        {
            const value:ArrayItemValue | undefined = this.getValue(node);

            if( !isLocal && value !== valueChanged.previousValue )
                node.atom.reportChanged();
        }
    }

    public destroy(node:ArrayItemNode, _isShared:boolean):void
    {
        log(`%c[${this._className}] DESTROY ARRAY ITEM: ${node.path.join(' -> ')}`, 'color: orchid');

        const { childrenSharedMap } = this._getSharedObjects(node);

        const onArrayItemChange = node.listeners.get('valueChanged');

        if( onArrayItemChange )
            childrenSharedMap.off('valueChanged', onArrayItemChange);

        node.listeners.delete('valueChanged');
    }

    public toJSON(node:ArrayItemNode):unknown
    {
        return node.getValue();
    }
}
