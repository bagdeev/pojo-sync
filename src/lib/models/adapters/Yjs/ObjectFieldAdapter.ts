import * as Y from 'yjs';
import { log } from '../../../utils/logger';
import { IYjsPreparedValue } from '../../PreparedValue';
import { ISyncNode } from '../../SyncNode';
import { ISyncNodeAdapter } from '../../SyncNodeAdapter';
import { SyncNodeType } from '../../SyncNodeType';
import { ObjectFieldNode, ObjectFieldValue } from '../objectTypes';

export class YjsObjectFieldAdapter implements ISyncNodeAdapter<unknown, string, unknown>
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
                || typeof value === 'boolean'
                || value === undefined
                || value === null);
    }

    public getChildrenContainer():unknown
    {
        return undefined;
    }

    public getChild(_node:ObjectFieldNode, _childName:string):ISyncNode<unknown, unknown, unknown> | undefined
    {
        throw new Error('NOT_SUPPORTED');
    }

    public addChild(_node:ObjectFieldNode, _childNode:ISyncNode<unknown, unknown, unknown> | undefined, _childName:string, _value:ObjectFieldValue | IYjsPreparedValue, _isShared:boolean):ISyncNode<unknown, unknown, unknown> | undefined
    {
        throw new Error('NOT_SUPPORTED');
    }

    public deleteChild(_node:ObjectFieldNode, _childName:string, _isShared:boolean):ISyncNode<unknown, unknown, unknown> | undefined
    {
        throw new Error('NOT_SUPPORTED');
    }

    public getValue(node:ObjectFieldNode):ObjectFieldValue | undefined
    {
        const sharedMap:Y.Map<unknown> = node.parent?.sharedObject as Y.Map<unknown>;

        const value:ObjectFieldValue | undefined = sharedMap?.get(node.name) as ObjectFieldValue | undefined;

        // log(`%c[${this._className}] GET OBJECT FIELD VALUE: ${node.path.join(' -> ')} = `, 'color: yellow', value);

        return value;
    }

    public setValue(node:ObjectFieldNode, value:ObjectFieldValue | undefined, isShared:boolean):boolean
    {
        log(`%c[${this._className}] SET OBJECT FIELD VALUE: ${node.path.join(' -> ')} =`, 'color: lime', value);

        if( !isShared )
        {
            const sharedMap:Y.Map<unknown> = node.parent?.sharedObject as Y.Map<unknown>;

            if( value != undefined && typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean' )
                throw new Error(`Property ${node.name} can be a string, number or boolean only`);

            const oldValue:string | undefined = sharedMap.get(node.name) as string | undefined;

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

    public init(node:ObjectFieldNode, value:ObjectFieldValue | IYjsPreparedValue | undefined, isShared:boolean):void
    {
        log(`%c[${this._className}] INIT OBJECT FIELD VALUE: ${node.path.join(' -> ')}, isShared = ${isShared}, value =`, 'color: aqua', value);

        const sharedMap:Y.Map<unknown> = node.parent?.sharedObject as Y.Map<unknown>;

        if( !isShared )
            sharedMap.set(node.name, value);

        if( !node.initialized || node.deleted )
        {
            const onObjectFieldChange = (mapEvent:Y.YMapEvent<unknown>):void =>
            {
                this._onObjectFieldChange(node, mapEvent);
            };

            sharedMap.observe(onObjectFieldChange);
            node.listeners.set('valueChanged', onObjectFieldChange);
        }
    }

    private _onObjectFieldChange(node:ObjectFieldNode, mapEvent:Y.YMapEvent<unknown>):void
    {
        const isLocal:boolean = mapEvent.transaction.local;

        if( !isLocal && !node.initialized )
        {
            log(`%c[${this._className}] ON OBJECT FIELD CHANGE DURING INITIALIZATION: ${node.path.join(' -> ')}, IsLocal = ${isLocal}`, 'background: red; color: yellow', mapEvent, mapEvent.keys);
            return;
        }

        if( !isLocal && node.deleted )
        {
            log(`%c[${this._className}] ON OBJECT FIELD CHANGE ON DELETED NODE: ${node.path.join(' -> ')}, IsLocal = ${isLocal}`, 'background: red; color: yellow', mapEvent, mapEvent.keys);
            return;
        }

        log(`%c[${this._className}] ON OBJECT FIELD CHANGE: ${node.path.join(' -> ')}, IsLocal = ${isLocal}`, 'color: salmon', mapEvent, mapEvent.keys);

        for( const [childName, changedValue] of mapEvent.keys )
        {
            if( childName === node.name )
            {
                const value:ObjectFieldValue | undefined = this.getValue(node);

                if( !isLocal && value !== changedValue.oldValue )
                    node.atom.reportChanged();
            }
        }
    }

    public destroy(node:ObjectFieldNode, _isShared:boolean):void
    {
        log(`%c[${this._className}] DESTROY OBJECT FIELD: ${node.path.join(' -> ')}`, 'color: orchid');

        const sharedMap:Y.Map<unknown> = node.parent?.sharedObject as Y.Map<unknown>;

        const onObjectFieldChange = node.listeners.get('valueChanged');

        if( onObjectFieldChange )
            sharedMap.unobserve(onObjectFieldChange);

        node.listeners.delete('valueChanged');
    }

    public toJSON(node:ObjectFieldNode):unknown
    {
        return node.getValue();
    }
}
