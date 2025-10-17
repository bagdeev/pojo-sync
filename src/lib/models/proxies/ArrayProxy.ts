import { bind } from 'bind-decorator';
import { SyncNodeUtils } from '../../utils/SyncNodeUtils';
import { SyncUtils } from '../../utils/SyncUtils';
import { ArrayChildNodeType, ArrayNodeType, IMutateArrayValue } from '../adapters/arrayTypes';
import { ISyncNode } from '../SyncNode';
// import { log } from '../../utils/logger';
import { SyncNodeEventsTargetKey } from '../SyncNodeEventsTarget';
import { SyncNodeType } from '../SyncNodeType';

const ArrayIteratorProto = ([][Symbol.iterator]() as any).__proto__;

if( !(Array.isArray as any)['overridden'] )
{
    const originalIsArray = Array.isArray;

    function isArrayOrArrayLike(obj:any):obj is any[]
    {
        return originalIsArray(obj) || SyncUtils.isSyncArray(obj);
    }

    isArrayOrArrayLike['overridden'] = true;

    Array.isArray = isArrayOrArrayLike;
}

export function getArrayProxy<NT>(node:ArrayNodeType<NT>):Object
{
    class SyncArray
    {
        // @ts-ignore
        private _node:ArrayNodeType<NT> = node;
    }

    const arrayLikeNode:ArrayLikeValue<NT> = new ArrayLikeValue(node);

    return new Proxy(
        new SyncArray(),
        {
            get(target:SyncArray, childName:PropertyKey, receiver:any):any
            {
                if( target.hasOwnProperty(childName) )
                    return (target as any)[childName];

                if( childName === SyncNodeEventsTargetKey )
                    return node;

                const checkedIndex = SyncNodeUtils.getCheckedIndex(childName);

                if( checkedIndex.isNumber )
                {
                    const childNode:ArrayChildNodeType | undefined = node.getChild(checkedIndex.index);

                    // log(`%c[ArrayAdapter] CHILD NODE GET: ${node.path.join(' -> ')} =`, 'color: violet', childNode);

                    return childNode?.getValue();
                }
                else if( SyncNodeUtils.hasProp((arrayLikeNode as any).__proto__, childName) )
                    return (arrayLikeNode as any)[childName];
                else
                    return arrayLikeNode.getBypassedMethod(childName, receiver);
            },
            set(_target:unknown, childName:PropertyKey, childValue:any):boolean
            {
                if( childName === 'length' )
                {
                    arrayLikeNode.length = childValue;
                    return true;
                }

                const checkedIndex = SyncNodeUtils.getCheckedIndex(childName);

                if( !checkedIndex.isNumber )
                    return false;

                if( checkedIndex.index > arrayLikeNode.length )
                    arrayLikeNode.length = checkedIndex.index;

                const childNode:ArrayChildNodeType | undefined = node.getChild(checkedIndex.index);

                // log(`%c[ArrayAdapter] CHILD NODE SET: ${node.path.join(' -> ')} =`, 'color: violet', childNode);

                if( childNode )
                    childNode.setValue(childValue, false);
                else
                    node.addChild(checkedIndex.index, childValue, false);

                return true;
            },
            defineProperty(target:SyncArray, childName:PropertyKey, descriptor:PropertyDescriptor):boolean
            {
                if( !descriptor.enumerable )
                {
                    Object.defineProperty(target, childName, descriptor);

                    return true;
                }

                return false;
            },
        },
    );
}

// const bypassMethods:string[] = [
//     'concat',
//     'flat',
//     'includes',
//     'indexOf',
//     'join',
//     'lastIndexOf',
//     'slice',
//     'toString',
//     'toLocaleString',
//     'every',
//     'filter',
//     'find',
//     'findIndex',
//     'flatMap',
//     'forEach',
//     'map',
//     'some',
//     'reduce',
//     'reduceRight',
// ];

class ArrayLikeValue<NT, T = any>
{
    public constructor(private _node:ArrayNodeType<NT>)
    {
    }

    private _getValues():T[]
    {
        this._node.atom.reportObserved();

        const values = this._node.children.sequence.map((childNodeId:string) =>
        {
            const childNode:ArrayChildNodeType | undefined = this._node.children.children.get(childNodeId);

            childNode?.atom.reportObserved();

            return childNode?.getValue();
        });

        return values;
    }

    public getBypassedMethod(methodName:PropertyKey, receiver:any):(...args:any[]) => any
    {
        const values:T[] = this._getValues();

        const method = Reflect.get(values, methodName, receiver);

        if( typeof method === 'function' && (
            Reflect.get(Array.prototype, method.name) === method ||
            Reflect.get(ArrayIteratorProto, method.name) === method)
        )
            return method.bind(values);

        return method;
    }

    public get length():number
    {
        this._node.atom.reportObserved();

        return this._node.children.sequence.length;
    }

    public set length(value:number)
    {
        if( value >= 0 && value < this._node.children.sequence.length )
            this.splice(value);
        else if( value > this._node.children.sequence.length )
            this.splice(this._node.children.sequence.length, 0, ...new Array(value - this._node.children.sequence.length));
    }

    private _flat<T>(node:ISyncNode<unknown, unknown, unknown>, depth:number = 1):T[]
    {
        node.atom.reportObserved();

        let result:T[] = [];

        if( node.type === SyncNodeType.ARRAY )
        {
            const arrayNode:ArrayNodeType<unknown> = node as ArrayNodeType<unknown>;

            arrayNode.children.sequence.forEach((childNodeId:string) =>
            {
                const childNode:ArrayChildNodeType | undefined = arrayNode.children.children.get(childNodeId);

                if( childNode && childNode.type === SyncNodeType.ARRAY && depth > 0 )
                    result.push(...this._flat<T>(childNode, depth - 1));
                else
                {
                    childNode?.atom.reportObserved();

                    result.push(childNode?.getValue());
                }
            });
        }

        return result;
    }

    public flat<T>(depth?:number):T[]
    {
        return this._flat(this._node, depth);
    }

    public flatMap<U>(callback:(value:T, index:number, array:T[]) => U | ReadonlyArray<U>):U[]
    {
        this._node.atom.reportObserved();

        const values:T[] = this._getValues();

        let result:U[] = [];

        values.forEach((item, index) =>
        {
            const mapped = callback(item, index, this._node.getValue());

            if( Array.isArray(mapped) )
                result.push(...mapped);
            else
                result.push(mapped as U);
        });

        return result;
    }

    @bind
    public splice(index:number, deleteCount?:number, ...newItems:T[]):T[]
    {
        const length:number = this.length;

        if( index === Infinity )
            index = length;

        if( arguments.length === 1 )
            deleteCount = length - index;
        else if( deleteCount === undefined || deleteCount === null )
            deleteCount = 0;
        else
            deleteCount = Math.max(0, Math.min(deleteCount, length - index));

        const deletedValues:T[] = [];

        for( let i = index; i < index + deleteCount; i++ )
        {
            const childNode:ArrayChildNodeType | undefined = this._node.getChild(i);

            deletedValues.push(childNode?.toJSON() as any);
        }

        for( let i = index + deleteCount - 1; i >= index; i-- )
        {
            const childNode:ArrayChildNodeType | undefined = this._node.deleteChild(index, false);

            childNode?.destroy(false);
        }

        let i:number = 0;

        while( i < newItems.length )
        {
            this._node.addChild(index + i, newItems[i], false);

            i++;
        }

        return deletedValues;
    }

    @bind
    public push(...items:T[]):number
    {
        if( !items )
            items = [];

        for( const item of items )
        {
            this._node.addChild(this.length, item, false);
        }

        return this.length;
    }

    @bind
    public pop():T | undefined
    {
        const deletedValues:T[] = this.splice(Math.max(this.length - 1, 0), 1);

        return deletedValues[0];
    }

    @bind
    public shift():T | undefined
    {
        const deletedValues:T[] = this.splice(0, 1);

        return deletedValues[0];
    }

    @bind
    public unshift(...items:T[]):number
    {
        this.splice(0, 0, ...items);

        return this.length;
    }

    @bind
    public toJSON():any[]
    {
        return this._node.toJSON() as any;
    }

    @bind
    public reverse():T[]
    {
        const sequence = this._node.children.sequence.slice().reverse();
        const value:IMutateArrayValue = {
            __shared_array__: true,
            sequence,
        };

        this._node.setValue(value, false);

        this._getValues();

        return this._node.getValue();
    }

    private _getValuesForSort():{ childNodeId:string; value:T }[]
    {
        this._node.atom.reportObserved();

        const values = this._node.children.sequence.map((childNodeId:string) =>
        {
            const childNode:ArrayChildNodeType | undefined = this._node.children.children.get(childNodeId);

            childNode?.atom.reportObserved();

            return { childNodeId, value: childNode?.getValue() };
        });

        return values;
    }

    @bind
    public sort(compareFn?:(a:T, b:T) => number):T[]
    {
        const values = this._getValuesForSort();

        values.sort((a, b) =>
        {
            return (compareFn || defaultCompare)(a.value, b.value);
        });

        const sequence = values.map(value => value.childNodeId);
        const value:IMutateArrayValue = {
            __shared_array__: true,
            sequence,
        };

        this._node.setValue(value, false);

        console.log('values', values);

        return this._node.getValue();
    }

    @bind
    public clear():void
    {
        this.splice(0);
    }
}

function defaultCompare<T>(x:T, y:T):number
{
    if( x === undefined && y === undefined )
        return 0;

    if( x === undefined )
        return 1;

    if( y === undefined )
        return -1;

    const xString = toString(x);
    const yString = toString(y);

    if( xString < yString )
        return -1;

    if( xString > yString )
        return 1;

    return 0;
}

function toString(obj:any):string
{
    if( obj === null )
        return 'null';

    if( typeof obj === 'boolean' || typeof obj === 'number' )
        return obj.toString();

    if( typeof obj === 'string' )
        return obj;

    if( typeof obj === 'symbol' )
        throw new TypeError();

    return obj.toString();
}
