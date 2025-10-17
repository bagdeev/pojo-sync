import { v4 } from 'uuid';
import * as Y from 'yjs';
import { log } from '../../../utils/logger';
import { SyncUtils } from '../../../utils/SyncUtils';
import { IYjsPreparedValue } from '../../PreparedValue';
import { getArrayProxy } from '../../proxies/ArrayProxy';
import { ISyncNode } from '../../SyncNode';
import { ISyncNodeAdapter } from '../../SyncNodeAdapter';
import { SyncNodeType } from '../../SyncNodeType';
import {
    ArrayChildNodeType,
    ArrayNodeType,
    ArrayProxyKey,
    IArrayChildNodes,
    IMutateArrayValue,
    IYjsSharedArrayObjects,
    SharedArrayItemsKey,
    SharedArrayKey,
} from '../arrayTypes';

export class YjsArrayAdapter<NT> implements ISyncNodeAdapter<IArrayChildNodes, NT, number>
{
    protected get _className():string
    {
        return this.constructor.name;
    }

    private _getSharedObjects(node:ArrayNodeType<NT>):IYjsSharedArrayObjects
    {
        const sharedMap:Y.Map<unknown> = (node.sharedObject) as Y.Map<unknown>;
        const sharedSequence:Y.Array<string> = node.data.get(SharedArrayKey);
        const childrenSharedMap:Y.Map<unknown> = node.data.get(SharedArrayItemsKey);

        return {
            sharedMap,
            sharedSequence,
            childrenSharedMap,
        };
    }

    private _updateChildIndexes(node:ArrayNodeType<NT>):void
    {
        Array.from(node.children.sequence.values()).forEach((childNodeId, index) =>
        {
            const childNode:ArrayChildNodeType | undefined = node.children.children.get(childNodeId);

            if( childNode )
                childNode.name = index;
        });
    }

    public isSupportedValue(_parentType:SyncNodeType | undefined,
                            value:any,
                            isShared:boolean):boolean
    {
        if( this._isMutateValue(value) )
            return true;
        else if( isShared )
            return value instanceof Y.Map && value.has(SharedArrayKey);
        else
            return Array.isArray(value);
    }

    public getChildrenContainer():IArrayChildNodes
    {
        return {
            sequence: [],
            children: new Map(),
        };
    }

    public getChild(node:ArrayNodeType<NT>, childIndex:number):ArrayChildNodeType | undefined
    {
        // log(`%c[${this._className}] GET ARRAY CHILD: ${node.path.join(' -> ')} => ${childIndex}`, 'color: darkseagreen');

        const childNodeId:string = node.children.sequence[childIndex];
        const childNode:ArrayChildNodeType | undefined = node.children.children.get(childNodeId);

        if( childNode )
            return childNode;
        else
            return undefined;
    }

    public addChild(node:ArrayNodeType<NT>, childNode:ArrayChildNodeType | undefined, childIndex:number, value:any, isShared:boolean):ArrayChildNodeType | undefined
    {
        log(`%c[${this._className}] ADD ARRAY CHILD: ${node.path.join(' -> ')} => ${childIndex}`, 'color: steelblue');

        if( childNode )
        {
            const childNodeId:string = (isShared && (value as IYjsPreparedValue).childNodeId) || v4();

            node.children.sequence.splice(childIndex, 0, childNodeId);
            node.children.children.set(childNodeId, childNode);

            (node.container.container as Y.Doc).transact(() =>
            {
                this._updateChildIndexes(node);

                const {
                    sharedSequence,
                    childrenSharedMap,
                } = this._getSharedObjects(node);

                if( !isShared
                    && (childNode.type === SyncNodeType.ARRAY_DATE_ITEM
                        || childNode.type === SyncNodeType.ARRAY_ITEM) )
                {
                    childrenSharedMap.set(childNodeId, value);
                    sharedSequence.insert(childIndex, [childNodeId]);
                }
                else if( !isShared && childNode.sharedObject )
                {
                    log(`%c[${this._className}] SET ARRAY CHILD HANDLE: ${node.path.join(' -> ')} => ${childIndex}`, 'color: gold');

                    childrenSharedMap.set(childNodeId, childNode.sharedObject);
                    sharedSequence.insert(childIndex, [childNodeId]);
                }
            });
        }

        return childNode;
    }

    public deleteChild(node:ArrayNodeType<NT>, childIndex:number, isShared:boolean):ArrayChildNodeType | undefined
    {
        log(`%c[${this._className}] DELETE ARRAY CHILD: ${node.path.join(' -> ')} => ${childIndex}`, 'color: indianred');

        const {
            sharedSequence,
            childrenSharedMap,
        } = this._getSharedObjects(node);

        if( childIndex < 0 || childIndex >= node.children.sequence.length )
            throw new Error('Index out of bounds');

        const childNode:ArrayChildNodeType | undefined = node.getChild(childIndex);

        const [childNodeId] = node.children.sequence.splice(childIndex, 1);

        node.children.children.delete(childNodeId);

        (node.container.container as Y.Doc).transact(() =>
        {
            this._updateChildIndexes(node);

            if( !isShared )
            {
                if( sharedSequence && childIndex >= 0 && childIndex < sharedSequence.length )
                    sharedSequence.delete(childIndex);

                if( childrenSharedMap && childrenSharedMap.has(childNodeId) )
                    childrenSharedMap.delete(childNodeId);
            }
        });

        return childNode;
    }

    public getValue(node:ArrayNodeType<NT>):unknown[] | undefined
    {
        if( !node.data.has(ArrayProxyKey) )
            node.data.set(ArrayProxyKey, getArrayProxy(node));

        // log(`%c[${this._className}] GET ARRAY VALUE: ${node.path.join(' -> ')} =>`, 'color: yellow', node.data.get(ArrayProxyKey));

        return node.data.get(ArrayProxyKey);
    }

    private _isMutateValue(value:any):value is IMutateArrayValue
    {
        return !!value && value[SharedArrayKey] === true;
    }

    public setValue(node:ArrayNodeType<NT>, value:unknown[] | IYjsPreparedValue | IMutateArrayValue | undefined, isShared:boolean):boolean
    {
        log(`%c[${this._className}] SET ARRAY VALUE: ${node.path.join(' -> ')}, isShared = ${isShared}, value =`, 'color: lime', value);

        if( this._isMutateValue(value) )
        {
            const { sequence } = value;

            node.children.sequence = sequence;

            const { sharedMap, sharedSequence } = this._getSharedObjects(node);

            const newSharedSequence:Y.Array<string> = new Y.Array<string>();

            node.data.set(SharedArrayKey, newSharedSequence);

            (node.container.container as Y.Doc).transact(() =>
            {
                newSharedSequence.insert(0, sequence);

                sharedMap.set(SharedArrayKey, newSharedSequence);

                this._updateChildIndexes(node);
            });

            const onArrayChange = node.listeners.get('sequenceDelta');

            if( onArrayChange )
            {
                sharedSequence.unobserve(onArrayChange);
                newSharedSequence.observe(onArrayChange);
            }
        }
        else
        {
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
        }
        // else if( value )
        // {
        //     (node.container.container as Y.Doc).transact(() =>
        //     {
        //         if( isShared )
        //         {
        //             const preparedValue:IYjsPreparedValue = value as IYjsPreparedValue;
        //             const newSharedSequence:Y.Array<string> = preparedValue.sharedSequence as Y.Array<string>;
        //             const newChildrenSharedMap:Y.Map<unknown> = preparedValue.childrenSharedMap as Y.Map<unknown>;
        //
        //             const entries = (preparedValue.children as Map<number, IYjsPreparedValue> | undefined)?.entries();
        //
        //             if( entries )
        //             {
        //                 const oldLength:number = node.children.sequence.length;
        //                 const newLength:number = preparedValue.children?.size || 0;
        //                 const newSequence:string[] = newSharedSequence.toJSON();
        //
        //                 if( newLength < oldLength )
        //                 {
        //                     for( let childIndex = oldLength - 1; childIndex >= newLength; childIndex-- )
        //                     {
        //                         const childNode:ArrayChildNodeType | undefined = node.getChild(childIndex);
        //
        //                         if( childNode )
        //                         {
        //                             childNode.parent?.deleteChild(childNode.name, isShared);
        //                             childNode.destroy(isShared);
        //                         }
        //                     }
        //                 }
        //
        //                 const oldSequence = node.children.sequence;
        //
        //                 node.children.sequence = newSequence;
        //
        //                 for( let [childIndex, childValue] of entries )
        //                 {
        //                     if( childIndex < oldLength )
        //                     {
        //                         const childNodeId:string = oldSequence[childIndex];
        //                         const childNode:ArrayChildNodeType | undefined = node.children.children.get(childNodeId);
        //
        //                         node.children.children.delete(childNodeId);
        //
        //                         if( childValue.childNodeId && childNode )
        //                             node.children.children.set(childValue.childNodeId, childNode);
        //
        //                         if( childNode )
        //                             childNode.setValue(childValue, isShared);
        //                     }
        //                     else
        //                         node.addChild(childIndex, childValue, isShared);
        //                 }
        //             }
        //
        //             const {
        //                 sharedMap,
        //                 sharedSequence,
        //                 childrenSharedMap,
        //             } = this._getSharedObjects(node);
        //
        //             const newSharedMap:Y.Map<unknown> = preparedValue.value as Y.Map<unknown>;
        //
        //             node.sharedObject = newSharedMap as Y.AbstractType<unknown>;
        //             node.data.set(SharedArrayKey, preparedValue.sharedSequence);
        //             node.data.set(SharedArrayItemsKey, preparedValue.childrenSharedMap);
        //
        //             const onRootObjectChange = node.listeners.get('rootValueChanged');
        //             const onArrayChange = node.listeners.get('sequenceDelta');
        //             const onArrayItemsChange = node.listeners.get('valueChanged');
        //
        //             if( onRootObjectChange )
        //             {
        //                 sharedMap.unobserve(onRootObjectChange);
        //                 newSharedMap.observe(onRootObjectChange);
        //             }
        //
        //             if( onArrayChange )
        //             {
        //                 sharedSequence.unobserve(onArrayChange);
        //                 newSharedSequence.observe(onArrayChange);
        //             }
        //
        //             if( onArrayItemsChange )
        //             {
        //                 childrenSharedMap.unobserve(onArrayItemsChange);
        //                 newChildrenSharedMap.observe(onArrayItemsChange);
        //             }
        //         }
        //         else
        //         {
        //             const entries = (value as unknown[]).entries();
        //
        //             if( entries )
        //             {
        //                 const oldLength:number = node.children.sequence.length;
        //                 const newLength:number = (value as unknown[]).length;
        //
        //                 if( newLength < oldLength )
        //                 {
        //                     for( let childIndex = oldLength - 1; childIndex >= newLength; childIndex-- )
        //                     {
        //                         const childNode:ArrayChildNodeType | undefined = node.getChild(childIndex);
        //
        //                         if( childNode )
        //                         {
        //                             childNode.parent?.deleteChild(childNode.name, isShared);
        //                             childNode.destroy(isShared);
        //                         }
        //                     }
        //                 }
        //
        //                 for( let [childIndex, childValue] of entries )
        //                 {
        //                     if( childIndex < oldLength )
        //                     {
        //                         const childNodeId:string = node.children.sequence[childIndex];
        //                         const childNode:ArrayChildNodeType | undefined = node.children.children.get(childNodeId);
        //
        //                         if( childNode )
        //                             childNode.setValue(childValue, isShared);
        //                     }
        //                     else
        //                         node.addChild(childIndex, childValue, isShared);
        //                 }
        //             }
        //         }
        //
        //         this._updateChildIndexes(node);
        //     });
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

    public init(node:ArrayNodeType<NT>, value:unknown[] | IYjsPreparedValue, isShared:boolean):void
    {
        log(`%c[${this._className}] INIT ARRAY VALUE: ${node.path.join(' -> ')}, isShared = ${isShared}, value =`, 'color: aqua', value);

        const preparedValue:IYjsPreparedValue = value as IYjsPreparedValue;

        const sharedMap:Y.Map<unknown> = isShared
            ? preparedValue.value as Y.Map<unknown>
            : new Y.Map<unknown>();
        const sharedSequence:Y.Array<string> = isShared
            ? preparedValue.sharedSequence as Y.Array<string>
            : new Y.Array<string>();
        const childrenSharedMap:Y.Map<unknown> = isShared
            ? preparedValue.childrenSharedMap as Y.Map<unknown>
            : new Y.Map<unknown>();

        (node.container.container as Y.Doc).transact(() =>
        {
            if( !isShared )
            {
                sharedMap.set(SharedArrayKey, sharedSequence);
                sharedMap.set(SharedArrayItemsKey, childrenSharedMap);
            }

            node.sharedObject = sharedMap as Y.AbstractType<unknown>;
            node.data.set(SharedArrayKey, sharedSequence);
            node.data.set(SharedArrayItemsKey, childrenSharedMap);

            if( !node.initialized || node.deleted )
            {
                const onRootObjectChange = (mapEvent:Y.YMapEvent<unknown>):void =>
                {
                    this._onRootObjectChange(node, mapEvent);
                };

                const onArrayChange = (arrayEvent:Y.YArrayEvent<string>):void =>
                {
                    this._onArrayChange(node, arrayEvent);
                };

                const onArrayItemsChange = (mapEvent:Y.YMapEvent<unknown>):void =>
                {
                    this._onArrayItemsChange(node, mapEvent);
                };

                sharedMap.observe(onRootObjectChange);
                sharedSequence.observe(onArrayChange);
                childrenSharedMap.observe(onArrayItemsChange);

                node.listeners.set('rootValueChanged', onRootObjectChange);
                node.listeners.set('sequenceDelta', onArrayChange);
                node.listeners.set('valueChanged', onArrayItemsChange);
            }

            const children = isShared
                ? preparedValue.children
                : value as unknown[];

            if( children )
                for( const [childIndex, childValue] of children.entries() )
                {
                    node.addChild(childIndex as number, childValue, isShared);
                }
        });
    }

    private _onRootObjectChange(node:ArrayNodeType<NT>, mapEvent:Y.YMapEvent<unknown>):void
    {
        const isLocal:boolean = mapEvent.transaction.local;

        if( !isLocal && !node.initialized )
        {
            console.log(`%c[${this._className}] ON SHARED ARRAY CHANGE ROOT DURING INITIALIZATION: ${node.path.join(' -> ')}, IsLocal = ${isLocal}`, 'background: red; color: yellow', mapEvent, mapEvent.keys);
            return;
        }

        if( !isLocal && node.deleted )
        {
            console.log(`%c[${this._className}] ON SHARED ARRAY CHANGE ON DELETED NODE: ${node.path.join(' -> ')}, IsLocal = ${isLocal}`, 'background: red; color: yellow', mapEvent, mapEvent.keys);
            return;
        }

        log(`%c[${this._className}] ON SHARED ARRAY ROOT CHANGE: ${node.path.join(' -> ')}, IsLocal = ${isLocal}`, 'color: salmon', mapEvent);

        (node.container.container as Y.Doc).transact(() =>
        {
            for( const [key, changedValue] of mapEvent.keys )
            {
                if( !isLocal && key === SharedArrayKey )
                {
                    const { sharedMap } = this._getSharedObjects(node);

                    const oldSharedSequence:Y.Array<string> = node.data.get(SharedArrayKey);

                    const onArrayChange = node.listeners.get('sequenceDelta');

                    if( onArrayChange )
                        oldSharedSequence.unobserve(onArrayChange);

                    const sharedSequence:Y.Array<string> = sharedMap.get(SharedArrayKey) as Y.Array<string>;

                    if( !isLocal && !node.initialized )
                    {
                        console.log(`%c[${this._className}] ON SHARED ARRAY CHANGE ROOT DURING INITIALIZATION: ${node.path.join(' -> ')}, IsLocal = ${isLocal}`, 'background: red; color: yellow', mapEvent, mapEvent.keys);
                        return;
                    }

                    if( !isLocal && node.deleted )
                    {
                        console.log(`%c[${this._className}] ON SHARED ARRAY CHANGE ON DELETED NODE: ${node.path.join(' -> ')}, IsLocal = ${isLocal}`, 'background: red; color: yellow', mapEvent, mapEvent.keys);
                        return;
                    }

                    node.children.sequence = sharedSequence.toJSON();
                    node.data.set(SharedArrayKey, sharedSequence);

                    this._updateChildIndexes(node);

                    const onNewArrayChange = (arrayEvent:Y.YArrayEvent<string>):void =>
                    {
                        this._onArrayChange(node, arrayEvent);
                    };

                    sharedSequence.observe(onNewArrayChange);
                    node.listeners.set('sequenceDelta', onNewArrayChange);

                    node.atom.reportChanged();
                }
            }
        });
    }

    private _onArrayChange(node:ArrayNodeType<NT>, arrayEvent:Y.YArrayEvent<string>):void
    {
        const isLocal:boolean = arrayEvent.transaction.local;

        if( !isLocal && !node.initialized )
        {
            console.log(`%c[${this._className}] ON SHARED ARRAY CHANGE DURING INITIALIZATION: ${node.path.join(' -> ')}, IsLocal = ${isLocal}`, 'background: red; color: yellow', arrayEvent);
            return;
        }

        if( !isLocal && node.deleted )
        {
            console.log(`%c[${this._className}] ON SHARED ARRAY CHANGE ON DELETED NODE: ${node.path.join(' -> ')}, IsLocal = ${isLocal}`, 'background: red; color: yellow', arrayEvent);
            return;
        }

        log(`%c[${this._className}] ON SHARED ARRAY CHANGE: ${node.path.join(' -> ')}, IsLocal = ${isLocal}`, 'color: salmon', arrayEvent);

        if( !isLocal )
        {
            (node.container.container as Y.Doc).transact(() =>
            {
                const changedIndex = arrayEvent.delta.find(
                    (delta) => delta.retain != undefined,
                );
                const [changedValue] = arrayEvent.delta.filter(
                    (delta) => delta.retain == undefined,
                );
                const position:number = changedIndex?.retain || 0;

                if( changedValue.delete != undefined )
                {
                    const childNode:ISyncNode<unknown, number, unknown> | undefined = node.getChild(position);

                    if( childNode )
                    {
                        childNode.parent?.deleteChild(childNode.name, true);
                        childNode.destroy(true);
                    }
                }
                else if( changedValue.insert != undefined )
                {
                    const {
                        sharedSequence,
                        childrenSharedMap,
                    } = this._getSharedObjects(node);

                    const childNodeId:string = sharedSequence.get(position);

                    const childValue = childrenSharedMap.get(childNodeId);

                    const preparedValue:IYjsPreparedValue | undefined = node.prepareSharedValue(node.type, childValue) as IYjsPreparedValue | undefined;

                    if( !isLocal && !node.initialized )
                    {
                        console.log(`%c[${this._className}] ON SHARED ARRAY CHANGE DURING INITIALIZATION: ${node.path.join(' -> ')}, IsLocal = ${isLocal}`, 'background: red; color: yellow', arrayEvent);
                        return;
                    }

                    if( !isLocal && node.deleted )
                    {
                        console.log(`%c[${this._className}] ON SHARED ARRAY CHANGE ON DELETED NODE: ${node.path.join(' -> ')}, IsLocal = ${isLocal}`, 'background: red; color: yellow', arrayEvent);
                        return;
                    }

                    if( preparedValue )
                    {
                        preparedValue.childNodeId = childNodeId;

                        node.addChild(position, preparedValue, true);
                    }
                }
            });
        }
    }

    private _onArrayItemsChange(node:ArrayNodeType<NT>, mapEvent:Y.YMapEvent<unknown>):void
    {
        const isLocal:boolean = mapEvent.transaction.local;

        log(`%c[${this._className}] ON SHARED ARRAY ITEMS CHANGE: ${node.path.join(' -> ')}, IsLocal = ${isLocal}`, 'color: yellow', mapEvent);
    }

    public destroy(node:ArrayNodeType<NT>, isShared:boolean):void
    {
        log(`%c[${this._className}] DESTROY ARRAY: ${node.path.join(' -> ')}`, 'color: orchid');

        const childNodes = Array.from(node.children.children.values()).reverse();

        (node.container.container as Y.Doc).transact(() =>
        {
            for( const childNode of childNodes )
            {
                childNode.destroy(isShared);
            }
        });

        node.children.sequence = [];
        node.children.children.clear();

        const {
            sharedSequence,
            childrenSharedMap,
        } = this._getSharedObjects(node);

        const onArrayChange = node.listeners.get('sequenceDelta');
        const onArrayItemsChange = node.listeners.get('valueChanged');

        if( onArrayChange )
            sharedSequence.unobserve(onArrayChange);

        if( onArrayItemsChange )
            childrenSharedMap.unobserve(onArrayItemsChange);

        node.listeners.delete('sequenceDelta');
        node.listeners.delete('valueChanged');
    }

    public toJSON(node:ArrayNodeType<NT>):unknown[]
    {
        return node.children.sequence.map((childNodeId) =>
        {
            const childNode:ArrayChildNodeType | undefined = node.children.children.get(childNodeId);

            return childNode?.toJSON();
        });
    }
}
