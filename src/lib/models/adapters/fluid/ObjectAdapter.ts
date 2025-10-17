import { ISharedObject } from '@fluidframework/shared-object-base/src/types';
import { IValueChanged, SharedMap } from 'fluid-framework';
import { log } from '../../../utils/logger';
import { IFluidPreparedValue } from '../../PreparedValue';
import { getObjectProxy } from '../../proxies/ObjectProxy';
import { ISyncNodeAdapter } from '../../SyncNodeAdapter';
import { SyncNodeType } from '../../SyncNodeType';
import { ObjectChildNodeType, ObjectNodeType, ObjectProxyKey } from '../objectTypes';

export class FluidObjectAdapter<NT> implements ISyncNodeAdapter<Map<string, ObjectChildNodeType>, NT, string>
{
    protected get _className():string
    {
        return this.constructor.name;
    }

    public isSupportedValue(_parentType:SyncNodeType | undefined,
                            value:any,
                            isShared:boolean):boolean
    {
        if( isShared )
            return value instanceof SharedMap;
        else
            return value != null && typeof value === 'object';
    }

    public getChildrenContainer():Map<string, ObjectChildNodeType>
    {
        return new Map();
    }

    public getChild(node:ObjectNodeType<NT>, childName:string):ObjectChildNodeType | undefined
    {
        // log(`%c[${this._className}] GET OBJECT CHILD: ${node.path.join(' -> ')} => ${childName}`, 'color: darkseagreen');

        const childNode:ObjectChildNodeType | undefined = node.children.get(childName);

        if( childNode )
            return childNode;
        else
            return undefined;
    }

    public addChild(node:ObjectNodeType<NT>, childNode:ObjectChildNodeType | undefined, childName:string, _value:any, isShared:boolean):ObjectChildNodeType | undefined
    {
        log(`%c[${this._className}] ADD OBJECT CHILD: ${node.path.join(' -> ')} => ${childName}`, 'color: steelblue');

        if( childNode )
        {
            node.children.set(childName, childNode);

            if( !isShared && childNode.sharedObject )
            {
                log(`%c[${this._className}] SET OBJECT CHILD HANDLE: ${node.path.join(' -> ')} => ${childName}`, 'color: gold');

                const sharedMap:SharedMap = node.sharedObject as SharedMap;

                sharedMap.set(childName, (childNode.sharedObject as ISharedObject).handle);
            }
        }

        return childNode;
    }

    public deleteChild(node:ObjectNodeType<NT>, childName:string, isShared:boolean):ObjectChildNodeType | undefined
    {
        log(`%c[${this._className}] DELETE OBJECT CHILD: ${node.path.join(' -> ')} => ${childName}`, 'color: indianred');

        const childNode:ObjectChildNodeType | undefined = node.getChild(childName);

        const sharedMap:SharedMap = node.sharedObject as SharedMap;

        node.children.delete(childName);

        if( !isShared && sharedMap && sharedMap.has(childName) )
            sharedMap.delete(childName);

        return childNode;
    }

    public getValue(node:ObjectNodeType<NT>):Object | undefined
    {
        if( !node.data.has(ObjectProxyKey) )
            node.data.set(ObjectProxyKey, getObjectProxy(node));

        // log(`%c[${this._className}] GET OBJECT VALUE: ${node.path.join(' -> ')} =>`, 'color: yellow', node.data.get(ObjectProxyKey));

        return node.data.get(ObjectProxyKey);
    }

    public setValue(node:ObjectNodeType<NT>, value:Object | IFluidPreparedValue | undefined, isShared:boolean):boolean
    {
        log(`%c[${this._className}] SET OBJECT VALUE: ${node.path.join(' -> ')}, isShared = ${isShared}, value =`, 'color: lime', value);

        if( value )
        {
            if( isShared )
            {
                const sharedMap:SharedMap = (value as IFluidPreparedValue).value as SharedMap;

                const onObjectChange = node.listeners.get('valueChanged');

                if( onObjectChange )
                {
                    (node.sharedObject as SharedMap).off('valueChanged', onObjectChange);
                    sharedMap.on('valueChanged', onObjectChange);
                }

                node.sharedObject = sharedMap;
                (sharedMap as any).setMaxListeners(0);
            }

            const entries = isShared
                ? (value as IFluidPreparedValue).children?.entries()
                : Object.entries(value);

            if( entries )
            {
                node.children.forEach((_childNode, childName) =>
                {
                    let found = false;

                    for( let [newChildName] of entries )
                    {
                        if( childName === newChildName )
                            found = true;
                    }

                    if( !found )
                    {
                        const childNode = node.deleteChild(childName, isShared);

                        if( childNode )
                            childNode.destroy(isShared);
                    }
                });

                for( let [childName, childValue] of entries )
                {
                    const childNode:ObjectChildNodeType | undefined = node.getChild(childName as string);

                    if( childNode )
                        childNode.setValue(childValue, isShared);
                    else
                        node.addChild(childName as string, childValue, isShared);
                }
            }
        }
        else
        {
            node.parent?.deleteChild(node.name, isShared);
            node.destroy(isShared);
        }

        return true;
    }

    public init(node:ObjectNodeType<NT>, value:Object | IFluidPreparedValue, isShared:boolean):void
    {
        log(`%c[${this._className}] INIT OBJECT VALUE: ${node.path.join(' -> ')}, isShared = ${isShared}, value =`, 'color: aqua', value);

        const sharedMap:SharedMap = isShared
            ? (value as IFluidPreparedValue).value as SharedMap
            : node.container.containerPool!.getMapFromPool();

        node.sharedObject = sharedMap;
        (sharedMap as any).setMaxListeners(0);

        if( !node.initialized || node.deleted )
        {
            const onObjectChange = (valueChanged:IValueChanged, isLocal:boolean):void =>
            {
                this._onObjectChange(node, valueChanged, isLocal);
            };

            sharedMap.on('valueChanged', onObjectChange);
            node.listeners.set('valueChanged', onObjectChange);
        }

        const children = isShared
            ? (value as IFluidPreparedValue).children?.entries()
            : Object.entries(value);

        if( children )
            for( let [childName, childValue] of children )
            {
                node.addChild(childName as string, childValue, isShared);
            }
    }

    private async _onObjectChange(node:ObjectNodeType<NT>, valueChanged:IValueChanged, isLocal:boolean):Promise<void>
    {
        if( !isLocal && !node.initialized )
        {
            console.log(`%c[${this._className}] ON SHARED OBJECT CHANGE DURING INITIALIZATION: ${node.path.join(' -> ')}, IsLocal = ${isLocal}`, 'background: red; color: yellow', valueChanged, valueChanged.key);
            return;
        }

        if( !isLocal && node.deleted )
        {
            console.log(`%c[${this._className}] ON SHARED OBJECT CHANGE ON DELETED NODE: ${node.path.join(' -> ')}, IsLocal = ${isLocal}`, 'background: red; color: yellow', valueChanged, valueChanged.key);
            return;
        }

        log(`%c[${this._className}] ON SHARED OBJECT CHANGE: ${node.path.join(' -> ')}, IsLocal = ${isLocal}`, 'color: salmon', valueChanged, valueChanged.key);

        if( !isLocal )
        {
            const sharedMap:SharedMap = node.sharedObject as SharedMap;
            const childName:string = valueChanged.key;
            const childNode:ObjectChildNodeType | undefined = node.getChild(childName);

            if( !sharedMap.has(childName) )
            {
                if( childNode )
                {
                    childNode.parent?.deleteChild(childNode.name, true);
                    childNode.destroy(true);
                }
            }
            else
            {
                const childValue = await node.prepareSharedValue(node.type, sharedMap.get(childName));

                if( !isLocal && !node.initialized )
                {
                    console.log(`%c[${this._className}] ON SHARED OBJECT CHANGE DURING INITIALIZATION: ${node.path.join(' -> ')}, IsLocal = ${isLocal}`, 'background: red; color: yellow', valueChanged, valueChanged.key);
                    return;
                }

                if( !isLocal && node.deleted )
                {
                    console.log(`%c[${this._className}] ON SHARED OBJECT CHANGE ON DELETED NODE: ${node.path.join(' -> ')}, IsLocal = ${isLocal}`, 'background: red; color: yellow', valueChanged, valueChanged.key);
                    return;
                }

                if( childNode && childNode.type === childValue?.type )
                    childNode.setValue(childValue, true);
                else
                {
                    if( childNode )
                    {
                        childNode.parent?.deleteChild(childNode.name, true);
                        childNode.destroy(true);
                    }

                    node.addChild(childName, childValue, true);
                }
            }
        }
    }

    public destroy(node:ObjectNodeType<NT>, isShared:boolean):void
    {
        log(`%c[${this._className}] DESTROY OBJECT: ${node.path.join(' -> ')}`, 'color: orchid');

        for( const childNode of node.children.values() )
        {
            childNode.destroy(isShared);
        }

        node.children.clear();

        const sharedMap:SharedMap = node.sharedObject as SharedMap;

        const onObjectChange = node.listeners.get('valueChanged');

        if( onObjectChange )
            sharedMap.off('valueChanged', onObjectChange);

        node.listeners.delete('valueChanged');
    }

    public toJSON(node:ObjectNodeType<NT>):Record<string, unknown>
    {
        const value:Record<string, unknown> = {};

        node.children.forEach((childNode, childName) =>
        {
            value[childName] = childNode?.toJSON();
        });

        return value;
    }
}
