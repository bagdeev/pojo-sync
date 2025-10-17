import { IValueChanged, SharedMap } from 'fluid-framework';
import { log } from '../../../utils/logger';
import { IFluidPreparedValue } from '../../PreparedValue';
import { ISyncNode } from '../../SyncNode';
import { ISyncNodeAdapter } from '../../SyncNodeAdapter';
import { SyncNodeType } from '../../SyncNodeType';
import { ObjectFieldNode, ObjectFieldValue } from '../objectTypes';

export class FluidObjectFieldAdapter implements ISyncNodeAdapter<unknown, string, unknown>
{
    protected get _className():string
    {
        return this.constructor.name;
    }

    public isSupportedValue(parentType:SyncNodeType | undefined,
                            value:any,
                            _isShared:boolean):boolean
    {
        return parentType === SyncNodeType.OBJECT
            && (typeof value === 'string'
                || typeof value === 'number'
                || typeof value === 'boolean');
    }

    public getChildrenContainer():unknown
    {
        return undefined;
    }

    public getChild(_node:ObjectFieldNode, _childName:string):ISyncNode<unknown, unknown, unknown> | undefined
    {
        throw new Error('NOT_SUPPORTED');
    }

    public addChild(_node:ObjectFieldNode, _childNode:ISyncNode<unknown, unknown, unknown> | undefined, _childName:string, _value:ObjectFieldValue | IFluidPreparedValue, _isShared:boolean):ISyncNode<unknown, unknown, unknown> | undefined
    {
        throw new Error('NOT_SUPPORTED');
    }

    public deleteChild(_node:ObjectFieldNode, _childName:string, _isShared:boolean):ISyncNode<unknown, unknown, unknown> | undefined
    {
        throw new Error('NOT_SUPPORTED');
    }

    public getValue(node:ObjectFieldNode):ObjectFieldValue | undefined
    {
        const sharedMap:SharedMap = node.parent?.sharedObject as SharedMap;

        const value:ObjectFieldValue | undefined = sharedMap?.get(node.name);

        // log(`%c[${this._className}] GET OBJECT FIELD VALUE: ${node.path.join(' -> ')} = `, 'color: yellow', value);

        return value;
    }

    public setValue(node:ObjectFieldNode, value:ObjectFieldValue, isShared:boolean):boolean
    {
        log(`%c[${this._className}] SET OBJECT FIELD VALUE: ${node.path.join(' -> ')} =`, 'color: lime', value);

        if( !isShared )
        {
            const sharedMap:SharedMap = node.parent?.sharedObject as SharedMap;

            if( value != undefined && typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean' )
                throw new Error(`Property ${node.name} can be a string, number or boolean only`);

            const oldValue:string | undefined = sharedMap.get(node.name);

            if( value !== oldValue )
            {
                sharedMap.set(node.name, value);

                return true;
            }
            else
                return false;
        }
        else
            return true;
    }

    public init(node:ObjectFieldNode, value:ObjectFieldValue | IFluidPreparedValue, isShared:boolean):void
    {
        log(`%c[${this._className}] INIT OBJECT FIELD VALUE: ${node.path.join(' -> ')}, isShared = ${isShared}, value =`, 'color: aqua', value);

        const sharedMap:SharedMap = node.parent?.sharedObject as SharedMap;

        if( !isShared )
            sharedMap.set(node.name, value);

        if( !node.initialized || node.deleted )
        {
            const onObjectFieldChange = (valueChanged:IValueChanged, isLocal:boolean):void =>
            {
                this._onObjectFieldChange(node, valueChanged, isLocal);
            };

            sharedMap.on('valueChanged', onObjectFieldChange);
            node.listeners.set('valueChanged', onObjectFieldChange);
        }
    }

    private _onObjectFieldChange(node:ObjectFieldNode, valueChanged:IValueChanged, isLocal:boolean):void
    {
        if( !isLocal && !node.initialized )
        {
            console.log(`%c[${this._className}] ON OBJECT FIELD CHANGE DURING INITIALIZATION: ${node.path.join(' -> ')}, IsLocal = ${isLocal}`, 'background: red; color: yellow', valueChanged, valueChanged.key);
            return;
        }

        if( !isLocal && node.deleted )
        {
            console.log(`%c[${this._className}] ON OBJECT FIELD CHANGE ON DELETED NODE: ${node.path.join(' -> ')}, IsLocal = ${isLocal}`, 'background: red; color: yellow', valueChanged, valueChanged.key);
            return;
        }

        log(`%c[${this._className}] ON OBJECT FIELD CHANGE: ${node.path.join(' -> ')}, IsLocal = ${isLocal}`, 'color: salmon', valueChanged, valueChanged.key);

        const childName:string | number = valueChanged.key;

        if( childName === node.name )
        {
            const value:ObjectFieldValue | undefined = this.getValue(node);

            if( !isLocal && value !== valueChanged.previousValue )
                node.atom.reportChanged();
        }
    }

    public destroy(node:ObjectFieldNode, _isShared:boolean):void
    {
        log(`%c[${this._className}] DESTROY OBJECT FIELD: ${node.path.join(' -> ')}`, 'color: orchid');

        const sharedMap:SharedMap = node.parent?.sharedObject as SharedMap;

        const onObjectFieldChange = node.listeners.get('valueChanged');

        if( onObjectFieldChange )
            sharedMap.off('valueChanged', onObjectFieldChange);

        node.listeners.delete('valueChanged');
    }

    public toJSON(node:ObjectFieldNode):unknown
    {
        return node.getValue();
    }
}
