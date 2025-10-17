import { MergeTreeDeltaType } from '@fluidframework/merge-tree';
import { ISharedObject } from '@fluidframework/shared-object-base/src/types';
import { IValueChanged, SequenceDeltaEvent, SharedMap, SharedObjectSequence } from 'fluid-framework';
import { v4 } from 'uuid';
import { log } from '../../../utils/logger';
import { IFluidPreparedValue } from '../../PreparedValue';
import { getArrayProxy } from '../../proxies/ArrayProxy';
import { ISyncNode } from '../../SyncNode';
import { ISyncNodeAdapter } from '../../SyncNodeAdapter';
import { SyncNodeType } from '../../SyncNodeType';
import {
    ArrayChildNodeType,
    ArrayNodeType,
    ArrayProxyKey,
    IArrayChildNodes,
    IFluidSharedArrayObjects,
    IMutateArrayValue,
    SharedArrayItemsKey,
    SharedArrayKey,
} from '../arrayTypes';

export class FluidArrayAdapter<NT> implements ISyncNodeAdapter<IArrayChildNodes, NT, number>
{
    protected get _className():string
    {
        return this.constructor.name;
    }

    private _getSharedObjects(node:ArrayNodeType<NT>):IFluidSharedArrayObjects
    {
        const sharedMap:SharedMap = (node.sharedObject) as SharedMap;
        const sharedSequence:SharedObjectSequence<string> = node.data.get(SharedArrayKey);
        const childrenSharedMap:SharedMap = node.data.get(SharedArrayItemsKey);

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
            return value instanceof SharedMap && value.has(SharedArrayKey);
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
            const childNodeId:string = (isShared && (value as IFluidPreparedValue).childNodeId) || v4();

            node.children.sequence.splice(childIndex, 0, childNodeId);
            node.children.children.set(childNodeId, childNode);

            this._updateChildIndexes(node);

            const {
                sharedSequence,
                childrenSharedMap,
            } = this._getSharedObjects(node);

            if( !isShared && childNode.type === SyncNodeType.ARRAY_ITEM )
            {
                childrenSharedMap.set(childNodeId, value);
                sharedSequence.insert(childIndex, [childNodeId]);
            }
            else if( !isShared && childNode.sharedObject )
            {
                log(`%c[${this._className}] SET ARRAY CHILD HANDLE: ${node.path.join(' -> ')} => ${childIndex}`, 'color: gold');

                childrenSharedMap.set(childNodeId, (childNode.sharedObject as ISharedObject).handle);
                sharedSequence.insert(childIndex, [childNodeId]);
            }
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

        this._updateChildIndexes(node);

        if( !isShared )
        {
            if( sharedSequence && childIndex >= 0 && childIndex < sharedSequence.getLength() )
                sharedSequence.remove(childIndex, childIndex + 1);

            if( childrenSharedMap && childrenSharedMap.has(childNodeId) )
                childrenSharedMap.delete(childNodeId);
        }

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

    public setValue(node:ArrayNodeType<NT>, value:unknown[] | IFluidPreparedValue | IMutateArrayValue | undefined, isShared:boolean):boolean
    {
        log(`%c[${this._className}] SET ARRAY VALUE: ${node.path.join(' -> ')}, isShared = ${isShared}, value =`, 'color: lime', value);

        if( this._isMutateValue(value) )
        {
            const { sequence } = value;

            node.children.sequence = sequence;

            const { sharedMap, sharedSequence } = this._getSharedObjects(node);

            const newSharedSequence:SharedObjectSequence<string> = node.container.containerPool!.getSequenceFromPool();

            node.data.set(SharedArrayKey, newSharedSequence);

            newSharedSequence.insert(0, sequence);

            sharedMap.set(SharedArrayKey, newSharedSequence.handle);

            this._updateChildIndexes(node);

            const onArrayChange = node.listeners.get('sequenceDelta');

            if( onArrayChange )
            {
                sharedSequence.off('sequenceDelta', onArrayChange);
                newSharedSequence.on('sequenceDelta', onArrayChange);
            }
        }
        else if( value )
        {
            if( isShared )
            {
                const preparedValue:IFluidPreparedValue = value as IFluidPreparedValue;
                const newSharedSequence:SharedObjectSequence<string> = preparedValue.sharedSequence as SharedObjectSequence<string>;
                const newChildrenSharedMap:SharedMap = preparedValue.childrenSharedMap as SharedMap;

                const entries = (preparedValue.children as Map<number, IFluidPreparedValue> | undefined)?.entries();

                if( entries )
                {
                    const oldLength:number = node.children.sequence.length;
                    const newLength:number = preparedValue.children?.size || 0;
                    const newSequence:string[] = newSharedSequence.getItems(0, newSharedSequence.getLength());

                    if( newLength < oldLength )
                    {
                        for( let childIndex = oldLength - 1; childIndex >= newLength; childIndex-- )
                        {
                            const childNode:ArrayChildNodeType | undefined = node.getChild(childIndex);

                            if( childNode )
                            {
                                childNode.parent?.deleteChild(childNode.name, isShared);
                                childNode.destroy(isShared);
                            }
                        }
                    }

                    const oldSequence = node.children.sequence;

                    node.children.sequence = newSequence;

                    for( let [childIndex, childValue] of entries )
                    {
                        if( childIndex < oldLength )
                        {
                            const childNodeId:string = oldSequence[childIndex];
                            const childNode:ArrayChildNodeType | undefined = node.children.children.get(childNodeId);

                            node.children.children.delete(childNodeId);

                            if( childValue.childNodeId && childNode )
                                node.children.children.set(childValue.childNodeId, childNode);

                            if( childNode )
                                childNode.setValue(childValue, isShared);
                        }
                        else
                            node.addChild(childIndex, childValue, isShared);
                    }
                }

                const {
                    sharedMap,
                    sharedSequence,
                    childrenSharedMap,
                } = this._getSharedObjects(node);

                const newSharedMap:SharedMap = preparedValue.value as SharedMap;

                node.sharedObject = newSharedMap;
                node.data.set(SharedArrayKey, preparedValue.sharedSequence);
                node.data.set(SharedArrayItemsKey, preparedValue.childrenSharedMap);

                (newSharedMap as any).setMaxListeners(0);
                (preparedValue.sharedSequence as any).setMaxListeners(0);
                (preparedValue.childrenSharedMap as any).setMaxListeners(0);

                const onRootObjectChange = node.listeners.get('rootValueChanged');
                const onArrayChange = node.listeners.get('sequenceDelta');
                const onArrayItemsChange = node.listeners.get('valueChanged');

                if( onRootObjectChange )
                {
                    sharedMap.off('valueChanged', onRootObjectChange);
                    newSharedMap.on('valueChanged', onRootObjectChange);
                }

                if( onArrayChange )
                {
                    sharedSequence.off('sequenceDelta', onArrayChange);
                    newSharedSequence.on('sequenceDelta', onArrayChange);
                }

                if( onArrayItemsChange )
                {
                    childrenSharedMap.off('valueChanged', onArrayItemsChange);
                    newChildrenSharedMap.on('valueChanged', onArrayItemsChange);
                }
            }
            else
            {
                const entries = (value as unknown[]).entries();

                if( entries )
                {
                    const oldLength:number = node.children.sequence.length;
                    const newLength:number = (value as unknown[]).length;

                    if( newLength < oldLength )
                    {
                        for( let childIndex = oldLength - 1; childIndex >= newLength; childIndex-- )
                        {
                            const childNode:ArrayChildNodeType | undefined = node.getChild(childIndex);

                            if( childNode )
                            {
                                childNode.parent?.deleteChild(childNode.name, isShared);
                                childNode.destroy(isShared);
                            }
                        }
                    }

                    for( let [childIndex, childValue] of entries )
                    {
                        if( childIndex < oldLength )
                        {
                            const childNodeId:string = node.children.sequence[childIndex];
                            const childNode:ArrayChildNodeType | undefined = node.children.children.get(childNodeId);

                            if( childNode )
                                childNode.setValue(childValue, isShared);
                        }
                        else
                            node.addChild(childIndex, childValue, isShared);
                    }
                }
            }

            this._updateChildIndexes(node);
        }
        else
        {
            node.parent?.deleteChild(node.name, isShared);
            node.destroy(isShared);
        }

        return true;
    }

    public init(node:ArrayNodeType<NT>, value:unknown[] | IFluidPreparedValue, isShared:boolean):void
    {
        log(`%c[${this._className}] INIT ARRAY VALUE: ${node.path.join(' -> ')}, isShared = ${isShared}, value =`, 'color: aqua', value);

        const preparedValue:IFluidPreparedValue = value as IFluidPreparedValue;

        const sharedMap:SharedMap = isShared
            ? preparedValue.value as SharedMap
            : node.container.containerPool!.getMapFromPool();
        const sharedSequence:SharedObjectSequence<string> = isShared
            ? preparedValue.sharedSequence as SharedObjectSequence<string>
            : node.container.containerPool!.getSequenceFromPool();
        const childrenSharedMap:SharedMap = isShared
            ? preparedValue.childrenSharedMap as SharedMap
            : node.container.containerPool!.getMapFromPool();

        if( !isShared )
        {
            sharedMap.set(SharedArrayKey, sharedSequence.handle);
            sharedMap.set(SharedArrayItemsKey, childrenSharedMap.handle);
        }

        node.sharedObject = sharedMap;
        node.data.set(SharedArrayKey, sharedSequence);
        node.data.set(SharedArrayItemsKey, childrenSharedMap);

        (sharedMap as any).setMaxListeners(0);
        (sharedSequence as any).setMaxListeners(0);
        (childrenSharedMap as any).setMaxListeners(0);

        if( !node.initialized || node.deleted )
        {
            const onRootObjectChange = (valueChanged:IValueChanged, isLocal:boolean):void =>
            {
                this._onRootObjectChange(node, valueChanged, isLocal);
            };

            const onArrayChange = (event:SequenceDeltaEvent):void =>
            {
                this._onArrayChange(node, event);
            };

            const onArrayItemsChange = (valueChanged:IValueChanged, isLocal:boolean):void =>
            {
                this._onArrayItemsChange(node, valueChanged, isLocal);
            };

            sharedMap.on('valueChanged', onRootObjectChange);
            sharedSequence.on('sequenceDelta', onArrayChange);
            childrenSharedMap.on('valueChanged', onArrayItemsChange);

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
    }

    private async _onRootObjectChange(node:ArrayNodeType<NT>, valueChanged:IValueChanged, isLocal:boolean):Promise<void>
    {
        if( !isLocal && !node.initialized )
        {
            console.log(`%c[${this._className}] ON SHARED ARRAY CHANGE ROOT DURING INITIALIZATION: ${node.path.join(' -> ')}, IsLocal = ${isLocal}`, 'background: red; color: yellow', valueChanged, valueChanged.key);
            return;
        }

        if( !isLocal && node.deleted )
        {
            console.log(`%c[${this._className}] ON SHARED ARRAY CHANGE ON DELETED NODE: ${node.path.join(' -> ')}, IsLocal = ${isLocal}`, 'background: red; color: yellow', valueChanged, valueChanged.key);
            return;
        }

        log(`%c[${this._className}] ON SHARED ARRAY ROOT CHANGE: ${node.path.join(' -> ')}, IsLocal = ${isLocal}`, 'color: salmon', valueChanged);

        if( !isLocal && valueChanged.key === SharedArrayKey )
        {
            const { sharedMap } = this._getSharedObjects(node);

            const oldSharedSequence:SharedObjectSequence<string> = node.data.get(SharedArrayKey);

            const onArrayChange = node.listeners.get('sequenceDelta');

            if( onArrayChange )
                oldSharedSequence.off('sequenceDelta', onArrayChange);

            const sharedSequence:SharedObjectSequence<string> = await sharedMap.get(SharedArrayKey)
                .get() as SharedObjectSequence<string>;

            if( !isLocal && !node.initialized )
            {
                console.log(`%c[${this._className}] ON SHARED ARRAY CHANGE ROOT DURING INITIALIZATION: ${node.path.join(' -> ')}, IsLocal = ${isLocal}`, 'background: red; color: yellow', valueChanged, valueChanged.key);
                return;
            }

            if( !isLocal && node.deleted )
            {
                console.log(`%c[${this._className}] ON SHARED ARRAY CHANGE ON DELETED NODE: ${node.path.join(' -> ')}, IsLocal = ${isLocal}`, 'background: red; color: yellow', valueChanged, valueChanged.key);
                return;
            }

            node.children.sequence = sharedSequence.getItems(0, sharedSequence.getLength());
            node.data.set(SharedArrayKey, sharedSequence);

            this._updateChildIndexes(node);

            const onNewArrayChange = (event:SequenceDeltaEvent):void =>
            {
                this._onArrayChange(node, event);
            };

            sharedSequence.on('sequenceDelta', onNewArrayChange);
            node.listeners.set('sequenceDelta', onNewArrayChange);

            node.atom.reportChanged();
        }
    }

    private async _onArrayChange(node:ArrayNodeType<NT>, event:SequenceDeltaEvent):Promise<void>
    {
        const { deltaOperation, ranges, isLocal } = event;

        if( !isLocal && !node.initialized )
        {
            console.log(`%c[${this._className}] ON SHARED ARRAY CHANGE DURING INITIALIZATION: ${node.path.join(' -> ')}, IsLocal = ${isLocal}`, 'background: red; color: yellow', deltaOperation, ranges);
            return;
        }

        if( !isLocal && node.deleted )
        {
            console.log(`%c[${this._className}] ON SHARED ARRAY CHANGE ON DELETED NODE: ${node.path.join(' -> ')}, IsLocal = ${isLocal}`, 'background: red; color: yellow', deltaOperation, ranges);
            return;
        }

        log(`%c[${this._className}] ON SHARED ARRAY CHANGE: ${node.path.join(' -> ')}, IsLocal = ${isLocal}`, 'color: salmon', deltaOperation, ranges);

        if( !isLocal )
        {
            for( const { position/*, segment: { index }*/ } of ranges )
            {
                if( deltaOperation === MergeTreeDeltaType.REMOVE )
                {
                    const childNode:ISyncNode<unknown, number, unknown> | undefined = node.getChild(position);

                    if( childNode )
                    {
                        childNode.parent?.deleteChild(childNode.name, true);
                        childNode.destroy(true);
                    }
                }
                else if( deltaOperation === MergeTreeDeltaType.INSERT )
                {
                    const {
                        sharedSequence,
                        childrenSharedMap,
                    } = this._getSharedObjects(node);

                    const [childNodeId] = sharedSequence.getItems(position);

                    const childValue = childrenSharedMap.get(childNodeId);

                    const preparedValue:IFluidPreparedValue | undefined = await node.prepareSharedValue(node.type, childValue) as IFluidPreparedValue | undefined;

                    if( !isLocal && !node.initialized )
                    {
                        console.log(`%c[${this._className}] ON SHARED ARRAY CHANGE DURING INITIALIZATION: ${node.path.join(' -> ')}, IsLocal = ${isLocal}`, 'background: red; color: yellow', deltaOperation, ranges);
                        return;
                    }

                    if( !isLocal && node.deleted )
                    {
                        console.log(`%c[${this._className}] ON SHARED ARRAY CHANGE ON DELETED NODE: ${node.path.join(' -> ')}, IsLocal = ${isLocal}`, 'background: red; color: yellow', deltaOperation, ranges);
                        return;
                    }

                    if( preparedValue )
                    {
                        preparedValue.childNodeId = childNodeId;

                        node.addChild(position, preparedValue, true);
                    }
                }
            }
        }
    }

    private async _onArrayItemsChange(node:ArrayNodeType<NT>, valueChanged:IValueChanged, isLocal:boolean):Promise<void>
    {
        log(`%c[${this._className}] ON SHARED ARRAY ITEMS CHANGE: ${node.path.join(' -> ')}, IsLocal = ${isLocal}`, 'color: yellow', valueChanged);
    }

    public destroy(node:ArrayNodeType<NT>, isShared:boolean):void
    {
        log(`%c[${this._className}] DESTROY ARRAY: ${node.path.join(' -> ')}`, 'color: orchid');

        const childNodes = Array.from(node.children.children.values()).reverse();

        for( const childNode of childNodes )
        {
            childNode.destroy(isShared);
        }

        node.children.sequence = [];
        node.children.children.clear();

        const {
            sharedSequence,
            childrenSharedMap,
        } = this._getSharedObjects(node);

        const onArrayChange = node.listeners.get('sequenceDelta');
        const onArrayItemsChange = node.listeners.get('valueChanged');

        if( onArrayChange )
            sharedSequence.off('sequenceDelta', onArrayChange);

        if( onArrayItemsChange )
            childrenSharedMap.off('valueChanged', onArrayItemsChange);

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
