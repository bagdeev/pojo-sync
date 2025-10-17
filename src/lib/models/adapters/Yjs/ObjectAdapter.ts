import * as Y from 'yjs';
import { log } from '../../../utils/logger';
import { SyncUtils } from '../../../utils/SyncUtils';
import { IYjsPreparedValue } from '../../PreparedValue';
import { getObjectProxy } from '../../proxies/ObjectProxy';
import { ISyncNodeAdapter } from '../../SyncNodeAdapter';
import { SyncNodeType } from '../../SyncNodeType';
import { ObjectChildNodeType, ObjectNodeType, ObjectProxyKey } from '../objectTypes';

export class YjsObjectAdapter<NT> implements ISyncNodeAdapter<Map<string, ObjectChildNodeType>, NT, string>
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
            return value instanceof Y.Map;
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

                const sharedMap:Y.Map<unknown> = node.sharedObject as Y.Map<unknown>;

                sharedMap.set(childName, childNode.sharedObject);
            }
        }

        return childNode;
    }

    public deleteChild(node:ObjectNodeType<NT>, childName:string, isShared:boolean):ObjectChildNodeType | undefined
    {
        log(`%c[${this._className}] DELETE OBJECT CHILD: ${node.path.join(' -> ')} => ${childName}`, 'color: indianred');

        const childNode:ObjectChildNodeType | undefined = node.getChild(childName);

        const sharedMap:Y.Map<unknown> = node.sharedObject as Y.Map<unknown>;

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

    public setValue(node:ObjectNodeType<NT>, value:Object | IYjsPreparedValue | undefined, isShared:boolean):boolean
    {
        log(`%c[${this._className}] SET OBJECT VALUE: ${node.path.join(' -> ')}, isShared = ${isShared}, value =`, 'color: lime', value);

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
        //         const onObjectChange = node.listeners.get('valueChanged');
        //
        //         if( onObjectChange )
        //         {
        //             (node.sharedObject as Y.Map<unknown>).observe(onObjectChange);
        //             sharedMap.unobserve(onObjectChange);
        //         }
        //
        //         node.sharedObject = sharedMap as Y.AbstractType<unknown>;
        //     }
        //
        //     const entries = isShared
        //         ? (value as IYjsPreparedValue).children?.entries()
        //         : Object.entries(value);
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
        //                 const childNode:ObjectChildNodeType | undefined = node.getChild(childName as string);
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

    public init(node:ObjectNodeType<NT>, value:Object | IYjsPreparedValue, isShared:boolean):void
    {
        log(`%c[${this._className}] INIT OBJECT VALUE: ${node.path.join(' -> ')}, isShared = ${isShared}, value =`, 'color: aqua', value);

        const sharedMap:Y.Map<unknown> = isShared
            ? (value as IYjsPreparedValue).value as Y.Map<unknown>
            : new Y.Map<unknown>();

        node.sharedObject = sharedMap as Y.AbstractType<unknown>;

        if( !node.initialized || node.deleted )
        {
            const onObjectChange = (mapEvent:Y.YMapEvent<unknown>, transaction:Y.Transaction):void =>
            {
                this._onObjectChange(node, mapEvent);
            };

            sharedMap.observe(onObjectChange);
            node.listeners.set('valueChanged', onObjectChange);
        }

        const children = isShared
            ? (value as IYjsPreparedValue).children?.entries()
            : Object.entries(value);

        if( children )
            (node.container.container as Y.Doc).transact(() =>
            {
                for( let [childName, childValue] of children )
                {
                    node.addChild(childName as string, childValue, isShared);
                }
            });
    }

    private _onObjectChange(node:ObjectNodeType<NT>, mapEvent:Y.YMapEvent<unknown>):void
    {
        const isLocal:boolean = mapEvent.transaction.local;

        if( !isLocal && !node.initialized )
        {
            console.log(`%c[${this._className}] ON SHARED OBJECT CHANGE DURING INITIALIZATION: ${node.path.join(' -> ')}, IsLocal = ${isLocal}`, 'background: red; color: yellow', mapEvent, mapEvent.keys);
            return;
        }

        if( !isLocal && node.deleted )
        {
            console.log(`%c[${this._className}] ON SHARED OBJECT CHANGE ON DELETED NODE: ${node.path.join(' -> ')}, IsLocal = ${isLocal}`, 'background: red; color: yellow', mapEvent, mapEvent.keys);
            return;
        }

        log(`%c[${this._className}] ON SHARED OBJECT CHANGE: ${node.path.join(' -> ')}, IsLocal = ${isLocal}`, 'color: salmon', mapEvent, mapEvent.keys);

        if( !isLocal )
        {
            const sharedMap:Y.Map<unknown> = node.sharedObject as Y.Map<unknown>;

            (node.container.container as Y.Doc).transact(() =>
            {
                for( const [childName, changedValue] of mapEvent.keys )
                {
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
                        const childValue = node.prepareSharedValue(node.type, sharedMap.get(childName)) as IYjsPreparedValue | undefined;

                        if( !isLocal && !node.initialized )
                        {
                            console.log(`%c[${this._className}] ON SHARED OBJECT CHANGE DURING INITIALIZATION: ${node.path.join(' -> ')}, IsLocal = ${isLocal}`, 'background: red; color: yellow', mapEvent, mapEvent.keys);
                            return;
                        }

                        if( !isLocal && node.deleted )
                        {
                            console.log(`%c[${this._className}] ON SHARED OBJECT CHANGE ON DELETED NODE: ${node.path.join(' -> ')}, IsLocal = ${isLocal}`, 'background: red; color: yellow', mapEvent, mapEvent.keys);
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
            });
        }
    }

    public destroy(node:ObjectNodeType<NT>, isShared:boolean):void
    {
        log(`%c[${this._className}] DESTROY OBJECT: ${node.path.join(' -> ')}`, 'color: orchid');

        (node.container.container as Y.Doc).transact(() =>
        {
            for( const childNode of node.children.values() )
            {
                childNode.destroy(isShared);
            }
        });

        node.children.clear();

        const sharedMap:Y.Map<unknown> = node.sharedObject as Y.Map<unknown>;

        const onObjectChange = node.listeners.get('valueChanged');

        if( onObjectChange )
            sharedMap.unobserve(onObjectChange);

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
