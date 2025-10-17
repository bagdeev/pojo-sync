import * as Y from 'yjs';
import { log } from '../../../utils/logger';
import { SyncNodeUtils } from '../../../utils/SyncNodeUtils';
import { IYjsPreparedValue } from '../../PreparedValue';
import { ISyncNode } from '../../SyncNode';
import { ISyncNodeAdapter } from '../../SyncNodeAdapter';
import { SyncNodeType } from '../../SyncNodeType';
import { ObjectFieldNode, ObjectFieldValue } from '../objectTypes';

export class YjsObjectDateFieldAdapter implements ISyncNodeAdapter<unknown, string, unknown>
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
            && (value instanceof Date
                || SyncNodeUtils.isISODateString(value));
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

    public getValue(node:ObjectFieldNode):Date | undefined
    {
        const sharedMap:Y.Map<unknown> = node.parent?.sharedObject as Y.Map<unknown>;

        const value:string | undefined = sharedMap?.get(node.name) as string | undefined;

        // log(`%c[${this._className}] GET OBJECT FIELD VALUE: ${node.path.join(' -> ')} = `, 'color: yellow', value);

        return typeof value === 'string' ? new Date(value) : undefined;
    }

    public setValue(node:ObjectFieldNode, value:Date | string | undefined, isShared:boolean):boolean
    {
        log(`%c[${this._className}] SET OBJECT DATE FIELD VALUE: ${node.path.join(' -> ')} =`, 'color: lime', value);

        if( !isShared )
        {
            const sharedMap:Y.Map<unknown> = node.parent?.sharedObject as Y.Map<unknown>;

            if( !(value instanceof Date) && !SyncNodeUtils.isISODateString(value) )
                throw new Error(`Property ${node.name} can be a Date or ISO date string only`);

            const newValue:string | undefined = typeof value === 'string' ? value : value?.toISOString();
            const oldValue:string | undefined = sharedMap.get(node.name) as string | undefined;

            if( newValue !== oldValue )
            {
                sharedMap.set(node.name, newValue);

                return true;
            }
            else
                return false;
        }
        else
            return true;
    }

    public init(node:ObjectFieldNode, value:Date | string | IYjsPreparedValue, isShared:boolean):void
    {
        log(`%c[${this._className}] INIT OBJECT DATE FIELD VALUE: ${node.path.join(' -> ')}, isShared = ${isShared}, value =`, 'color: aqua', value);

        const sharedMap:Y.Map<unknown> = node.parent?.sharedObject as Y.Map<unknown>;

        if( !isShared )
        {
            const newValue:string | undefined = typeof value === 'string'
                ? value
                : value instanceof Date
                    ? value.toISOString()
                    : undefined;

            sharedMap.set(node.name, newValue);
        }

        if( !node.initialized || node.deleted )
        {
            const onObjectDateFieldChange = (mapEvent:Y.YMapEvent<unknown>):void =>
            {
                this._onObjectDateFieldChange(node, mapEvent);
            };

            sharedMap.observe(onObjectDateFieldChange);
            node.listeners.set('valueChanged', onObjectDateFieldChange);
        }
    }

    private _onObjectDateFieldChange(node:ObjectFieldNode, mapEvent:Y.YMapEvent<unknown>):void
    {
        const isLocal:boolean = mapEvent.transaction.local;

        if( !isLocal && !node.initialized )
        {
            log(`%c[${this._className}] ON OBJECT DATE FIELD CHANGE DURING INITIALIZATION: ${node.path.join(' -> ')}, IsLocal = ${isLocal}`, 'background: red; color: yellow', mapEvent, mapEvent.keys);
            return;
        }

        if( !isLocal && node.deleted )
        {
            log(`%c[${this._className}] ON OBJECT DATE FIELD CHANGE ON DELETED NODE: ${node.path.join(' -> ')}, IsLocal = ${isLocal}`, 'background: red; color: yellow', mapEvent, mapEvent.keys);
            return;
        }

        log(`%c[${this._className}] ON OBJECT DATE FIELD CHANGE: ${node.path.join(' -> ')}, IsLocal = ${isLocal}`, 'color: salmon', mapEvent, mapEvent.keys);

        for( const [childName, changedValue] of mapEvent.keys )
        {
            if( childName === node.name )
            {
                const value:Date | undefined = this.getValue(node);
                const newValue:string | undefined = value?.toISOString();

                if( !isLocal && newValue !== changedValue.oldValue )
                    node.atom.reportChanged();
            }
        }
    }

    public destroy(node:ObjectFieldNode, _isShared:boolean):void
    {
        log(`%c[${this._className}] DESTROY OBJECT DATE FIELD: ${node.path.join(' -> ')}`, 'color: orchid');

        const sharedMap:Y.Map<unknown> = node.parent?.sharedObject as Y.Map<unknown>;

        const onObjectDateFieldChange = node.listeners.get('valueChanged');

        if( onObjectDateFieldChange )
            sharedMap.unobserve(onObjectDateFieldChange);

        node.listeners.delete('valueChanged');
    }

    public toJSON(node:ObjectFieldNode):unknown
    {
        return node.getValue();
    }
}
