import { ISharedObject } from '@fluidframework/shared-object-base/src/types';
import { IValueChanged, SharedMap } from 'fluid-framework';
import { log } from '../../../utils/logger';
import { IFluidPreparedValue } from '../../PreparedValue';
import { getMapProxy } from '../../proxies/MapProxy';
import { ISyncNodeAdapter } from '../../SyncNodeAdapter';
import { SyncNodeType } from '../../SyncNodeType';
import { MapChildNodeType, MapNodeType, MapProxyKey, SharedMapKey } from '../mapTypes';

export class FluidMapAdapter<NT> implements ISyncNodeAdapter<Map<string, MapChildNodeType>, NT, string>
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
            return value instanceof SharedMap && value.has(SharedMapKey);
        else
            return value != null && value instanceof Map;
    }

    public getChildrenContainer():Map<string, MapChildNodeType>
    {
        return new Map();
    }

    public getChild(node:MapNodeType<NT>, childName:string):MapChildNodeType | undefined
    {
        // log(`%c[${this._className}] GET MAP CHILD: ${node.path.join(' -> ')} => ${childName}`, 'color: darkseagreen');

        const childNode:MapChildNodeType | undefined = node.children.get(childName);

        if( childNode )
            return childNode;
        else
            return undefined;
    }

    public addChild(node:MapNodeType<NT>, childNode:MapChildNodeType | undefined, childName:string, _value:any, isShared:boolean):MapChildNodeType | undefined
    {
        log(`%c[${this._className}] ADD MAP CHILD: ${node.path.join(' -> ')} => ${childName}`, 'color: steelblue');

        if( childNode )
        {
            node.children.set(childName, childNode);

            if( !isShared && childNode.sharedObject )
            {
                log(`%c[${this._className}] SET MAP CHILD HANDLE: ${node.path.join(' -> ')} => ${childName}`, 'color: gold');

                const sharedMap:SharedMap = node.sharedObject as SharedMap;

                sharedMap.set(childName, (childNode.sharedObject as ISharedObject).handle);
            }
        }

        return childNode;
    }

    public deleteChild(node:MapNodeType<NT>, childName:string, isShared:boolean):MapChildNodeType | undefined
    {
        log(`%c[${this._className}] DELETE MAP CHILD: ${node.path.join(' -> ')} => ${childName}`, 'color: indianred');

        const childNode:MapChildNodeType | undefined = node.getChild(childName);

        const sharedMap:SharedMap = node.sharedObject as SharedMap;

        node.children.delete(childName);

        if( !isShared && sharedMap && sharedMap.has(childName) )
            sharedMap.delete(childName);

        return childNode;
    }

    public getValue(node:MapNodeType<NT>):Object | undefined
    {
        if( !node.data.has(MapProxyKey) )
            node.data.set(MapProxyKey, getMapProxy(node));

        // log(`%c[${this._className}] GET MAP VALUE: ${node.path.join(' -> ')} =>`, 'color: yellow', node.data.get(MapProxyKey));

        return node.data.get(MapProxyKey);
    }

    public setValue(node:MapNodeType<NT>, value:Map<string, unknown> | IFluidPreparedValue | undefined, isShared:boolean):boolean
    {
        log(`%c[${this._className}] SET MAP VALUE: ${node.path.join(' -> ')}, isShared = ${isShared}, value =`, 'color: lime', value);

        if( value )
        {
            if( isShared )
            {
                const sharedMap:SharedMap = (value as IFluidPreparedValue).value as SharedMap;

                const onMapChange = node.listeners.get('valueChanged');

                if( onMapChange )
                {
                    (node.sharedObject as SharedMap).off('valueChanged', onMapChange);
                    sharedMap.on('valueChanged', onMapChange);
                }

                node.sharedObject = sharedMap;
                (sharedMap as any).setMaxListeners(0);
            }

            const entries = isShared
                ? (value as IFluidPreparedValue).children?.entries()
                : (value as Map<string, unknown>).entries();

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
                    const childNode:MapChildNodeType | undefined = node.getChild(childName as string);

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

    public init(node:MapNodeType<NT>, value:Map<string, unknown> | IFluidPreparedValue, isShared:boolean):void
    {
        log(`%c[${this._className}] INIT MAP VALUE: ${node.path.join(' -> ')}, isShared = ${isShared}, value =`, 'color: aqua', value);

        const sharedMap:SharedMap = isShared
            ? (value as IFluidPreparedValue).value as SharedMap
            : node.container.containerPool!.getMapFromPool();

        if( !sharedMap.has(SharedMapKey) )
            sharedMap.set(SharedMapKey, true);

        node.sharedObject = sharedMap;
        (sharedMap as any).setMaxListeners(0);

        if( !node.initialized || node.deleted )
        {
            const onMapChange = (valueChanged:IValueChanged, isLocal:boolean):void =>
            {
                this._onMapChange(node, valueChanged, isLocal);
            };

            sharedMap.on('valueChanged', onMapChange);
            node.listeners.set('valueChanged', onMapChange);
        }

        const children = isShared
            ? (value as IFluidPreparedValue).children?.entries()
            : (value as Map<string, unknown>).entries();

        if( children )
            for( let [childName, childValue] of children )
            {
                if( childName !== SharedMapKey )
                    node.addChild(childName as string, childValue, isShared);
            }
    }

    private async _onMapChange(node:MapNodeType<NT>, valueChanged:IValueChanged, isLocal:boolean):Promise<void>
    {
        if( !isLocal && !node.initialized )
        {
            console.log(`%c[${this._className}] ON SHARED MAP CHANGE DURING INITIALIZATION: ${node.path.join(' -> ')}, IsLocal = ${isLocal}`, 'background: red; color: yellow', valueChanged, valueChanged.key);
            return;
        }

        if( !isLocal && node.deleted )
        {
            console.log(`%c[${this._className}] ON SHARED MAP CHANGE ON DELETED NODE: ${node.path.join(' -> ')}, IsLocal = ${isLocal}`, 'background: red; color: yellow', valueChanged, valueChanged.key);
            return;
        }

        log(`%c[${this._className}] ON SHARED MAP CHANGE: ${node.path.join(' -> ')}, IsLocal = ${isLocal}`, 'color: salmon', valueChanged, valueChanged.key);

        if( !isLocal )
        {
            const sharedMap:SharedMap = node.sharedObject as SharedMap;
            const childName:string = valueChanged.key;
            let childNode:MapChildNodeType | undefined = node.getChild(childName);

            if( childName !== SharedMapKey )
            {
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
                        console.log(`%c[${this._className}] ON SHARED MAP CHANGE DURING INITIALIZATION: ${node.path.join(' -> ')}, IsLocal = ${isLocal}`, 'background: red; color: yellow', valueChanged, valueChanged.key);
                        return;
                    }

                    if( !isLocal && node.deleted )
                    {
                        console.log(`%c[${this._className}] ON SHARED MAP CHANGE ON DELETED NODE: ${node.path.join(' -> ')}, IsLocal = ${isLocal}`, 'background: red; color: yellow', valueChanged, valueChanged.key);
                        return;
                    }

                    if( childNode )
                        childNode.setValue(childValue, true);
                    else
                        node.addChild(childName, childValue, true);
                }
            }
        }
    }

    public destroy(node:MapNodeType<NT>, isShared:boolean):void
    {
        log(`%c[${this._className}] DESTROY MAP: ${node.path.join(' -> ')}`, 'color: orchid');

        for( const childNode of node.children.values() )
        {
            childNode.destroy(isShared);
        }

        node.children.clear();

        const sharedMap:SharedMap = node.sharedObject as SharedMap;

        const onMapChange = node.listeners.get('valueChanged');

        if( onMapChange )
            sharedMap.off('valueChanged', onMapChange);

        node.listeners.delete('valueChanged');
    }

    public toJSON(node:MapNodeType<NT>):Map<string, unknown>
    {
        const value:Map<string, unknown> = new Map();

        node.children.forEach((childNode, childName) =>
        {
            value.set(childName, childNode?.toJSON());
        });

        return value;
    }
}
