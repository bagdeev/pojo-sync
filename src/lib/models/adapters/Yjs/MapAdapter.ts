import * as Y from 'yjs';
import { log } from '../../../utils/logger';
import { SyncUtils } from '../../../utils/SyncUtils';
import { IYjsPreparedValue } from '../../PreparedValue';
import { getMapProxy } from '../../proxies/MapProxy';
import { ISyncNodeAdapter } from '../../SyncNodeAdapter';
import { SyncNodeType } from '../../SyncNodeType';
import { MapChildNodeType, MapNodeType, MapProxyKey, SharedMapKey } from '../mapTypes';

export class YjsMapAdapter<NT> implements ISyncNodeAdapter<Map<string, MapChildNodeType>, NT, string>
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
            return value instanceof Y.Map && value.has(SharedMapKey);
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

                const sharedMap:Y.Map<unknown> = node.sharedObject as Y.Map<unknown>;

                sharedMap.set(childName, childNode.sharedObject);
            }
        }

        return childNode;
    }

    public deleteChild(node:MapNodeType<NT>, childName:string, isShared:boolean):MapChildNodeType | undefined
    {
        log(`%c[${this._className}] DELETE MAP CHILD: ${node.path.join(' -> ')} => ${childName}`, 'color: indianred');

        const childNode:MapChildNodeType | undefined = node.getChild(childName);

        const sharedMap:Y.Map<unknown> = node.sharedObject as Y.Map<unknown>;

        node.children.delete(childName);

        if( !isShared && sharedMap && sharedMap.has(childName) )
            sharedMap.delete(childName);

        return childNode;
    }

    public getValue(node:MapNodeType<NT>):Map<string, unknown> | undefined
    {
        if( !node.data.has(MapProxyKey) )
            node.data.set(MapProxyKey, getMapProxy(node));

        // log(`%c[${this._className}] GET MAP VALUE: ${node.path.join(' -> ')} =>`, 'color: yellow', node.data.get(MapProxyKey));

        return node.data.get(MapProxyKey);
    }

    public setValue(node:MapNodeType<NT>, value:Map<string, unknown> | IYjsPreparedValue | undefined, isShared:boolean):boolean
    {
        log(`%c[${this._className}] SET MAP VALUE: ${node.path.join(' -> ')}, isShared = ${isShared}, value =`, 'color: lime', value);

        (node.container.container as Y.Doc).transact(() =>
        {
            const parent = node.parent;
            const name = node.name;

            if( !isShared )
                value = SyncUtils.cloneDeepValue(value);

            parent?.deleteChild(name, isShared);

            node.destroy(isShared);

            parent?.addChild(name, value, isShared);
        });

        // if( value )
        // {
        //     if( isShared )
        //     {
        //         const sharedMap:Y.Map<unknown> = (value as IYjsPreparedValue).value as Y.Map<unknown>;
        //
        //         const onMapChange = node.listeners.get('valueChanged');
        //
        //         if( onMapChange )
        //         {
        //             (node.sharedObject as Y.Map<unknown>).unobserve(onMapChange);
        //             sharedMap.observe(onMapChange);
        //         }
        //
        //         node.sharedObject = sharedMap as Y.AbstractType<unknown>;
        //     }
        //
        //     const entries = isShared
        //         ? (value as IYjsPreparedValue).children?.entries()
        //         : (value as Map<string, unknown>).entries();
        //
        //     if( entries )
        //     {
        //         (node.container.container as Y.Doc).transact(() =>
        //         {
        //             node.children.forEach((_childNode, childName) =>
        //             {
        //                 let found = false;
        //
        //                 for( let [newChildName] of entries )
        //                 {
        //                     if( childName === newChildName )
        //                         found = true;
        //                 }
        //
        //                 if( !found )
        //                 {
        //                     const childNode = node.deleteChild(childName, isShared);
        //
        //                     if( childNode )
        //                         childNode.destroy(isShared);
        //                 }
        //             });
        //
        //             for( let [childName, childValue] of entries )
        //             {
        //                 const childNode:MapChildNodeType | undefined = node.getChild(childName as string);
        //
        //                 if( childNode )
        //                     childNode.setValue(childValue, isShared);
        //                 else
        //                     node.addChild(childName as string, childValue, isShared);
        //             }
        //         });
        //     }
        // }
        // else
        // {
        //     (node.container.container as Y.Doc).transact(() =>
        //     {
        //         node.parent?.deleteChild(node.name, isShared);
        //         node.destroy(isShared);
        //     });
        // }

        return true;
    }

    public init(node:MapNodeType<NT>, value:Map<string, unknown> | IYjsPreparedValue, isShared:boolean):void
    {
        log(`%c[${this._className}] INIT MAP VALUE: ${node.path.join(' -> ')}, isShared = ${isShared}, value =`, 'color: aqua', value);

        const sharedMap:Y.Map<unknown> = isShared
            ? (value as IYjsPreparedValue).value as Y.Map<unknown>
            : new Y.Map<unknown>();

        if( !sharedMap.has(SharedMapKey) )
            sharedMap.set(SharedMapKey, true);

        node.sharedObject = sharedMap as Y.AbstractType<unknown>;

        if( !node.initialized || node.deleted )
        {
            const onMapChange = (mapEvent:Y.YMapEvent<unknown>, transaction:Y.Transaction):void =>
            {
                this._onMapChange(node, mapEvent);
            };

            sharedMap.observe(onMapChange);
            node.listeners.set('valueChanged', onMapChange);
        }

        const children = isShared
            ? (value as IYjsPreparedValue).children?.entries()
            : (value as Map<string, unknown>).entries();

        if( children )
            (node.container.container as Y.Doc).transact(() =>
            {
                for( let [childName, childValue] of children )
                {
                    if( childName !== SharedMapKey )
                        node.addChild(childName as string, childValue, isShared);
                }
            });
    }

    private async _onMapChange(node:MapNodeType<NT>, mapEvent:Y.YMapEvent<unknown>):Promise<void>
    {
        const isLocal:boolean = mapEvent.transaction.local;

        if( !isLocal && !node.initialized )
        {
            console.log(`%c[${this._className}] ON SHARED MAP CHANGE DURING INITIALIZATION: ${node.path.join(' -> ')}, IsLocal = ${isLocal}`, 'background: red; color: yellow', mapEvent, mapEvent.keys);
            return;
        }

        if( !isLocal && node.deleted )
        {
            console.log(`%c[${this._className}] ON SHARED MAP CHANGE ON DELETED NODE: ${node.path.join(' -> ')}, IsLocal = ${isLocal}`, 'background: red; color: yellow', mapEvent, mapEvent.keys);
            return;
        }

        log(`%c[${this._className}] ON SHARED MAP CHANGE: ${node.path.join(' -> ')}, IsLocal = ${isLocal}`, 'color: salmon', mapEvent, mapEvent.keys);

        if( !isLocal )
        {
            const sharedMap:Y.Map<unknown> = node.sharedObject as Y.Map<unknown>;

            (node.container.container as Y.Doc).transact(() =>
            {
                for( const [childName, changedValue] of mapEvent.keys )
                {
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
                            const childValue = node.prepareSharedValue(node.type, sharedMap.get(childName)) as IYjsPreparedValue | undefined;

                            if( !isLocal && !node.initialized )
                            {
                                console.log(`%c[${this._className}] ON SHARED MAP CHANGE DURING INITIALIZATION: ${node.path.join(' -> ')}, IsLocal = ${isLocal}`, 'background: red; color: yellow', mapEvent, childName);
                                return;
                            }

                            if( !isLocal && node.deleted )
                            {
                                console.log(`%c[${this._className}] ON SHARED MAP CHANGE ON DELETED NODE: ${node.path.join(' -> ')}, IsLocal = ${isLocal}`, 'background: red; color: yellow', mapEvent, childName);
                                return;
                            }

                            if( childNode )
                                childNode.setValue(childValue, true);
                            else
                                node.addChild(childName, childValue, true);
                        }
                    }
                }
            });
        }
    }

    public destroy(node:MapNodeType<NT>, isShared:boolean):void
    {
        log(`%c[${this._className}] DESTROY MAP: ${node.path.join(' -> ')}`, 'color: orchid');

        (node.container.container as Y.Doc).transact(() =>
        {
            for( const childNode of node.children.values() )
            {
                childNode.destroy(isShared);
            }
        });

        node.children.clear();

        const sharedMap:Y.Map<unknown> = node.sharedObject as Y.Map<unknown>;

        const onMapChange = node.listeners.get('valueChanged');

        if( onMapChange )
            sharedMap.unobserve(onMapChange);

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
