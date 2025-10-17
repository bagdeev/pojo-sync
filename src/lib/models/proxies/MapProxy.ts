import { SyncNodeUtils } from '../../utils/SyncNodeUtils';
import { MapChildNodeType, MapNodeType } from '../adapters/mapTypes';
// import { log } from '../../utils/logger';
import { SyncNodeEventsTargetKey } from '../SyncNodeEventsTarget';

export function getMapProxy<NT>(node:MapNodeType<NT>):Object
{
    class SyncMap
    {
        // @ts-ignore
        private _node:MapNodeType<NT> = node;
    }

    const mapLikeNode:MapLikeValue<NT> = new MapLikeValue(node);

    return new Proxy(
        new SyncMap(),
        {
            get(target:SyncMap, childName:PropertyKey):any
            {
                if( target.hasOwnProperty(childName) )
                    return (target as any)[childName];

                if( childName === SyncNodeEventsTargetKey )
                    return node;

                if( SyncNodeUtils.hasProp((mapLikeNode as any).__proto__, childName) )
                {
                    const child = (mapLikeNode as any)[childName];

                    if( typeof child === 'function' )
                        return child.bind(mapLikeNode);
                    else
                        return child;
                }
                else if( typeof childName !== 'string' )
                    return undefined;

                const childNode:MapChildNodeType | undefined = node.getChild(childName);

                // log(`%c[MapAdapter] CHILD NODE GET: ${node.path.join(' -> ')} => ${childName} =`, 'color: violet', childNode);

                return childNode?.getValue();
            },
            set(_target:unknown, childName:PropertyKey, childValue:any):boolean
            {
                if( typeof childName !== 'string' )
                    return false;

                const childNode:MapChildNodeType | undefined = node.getChild(childName);

                // log(`%c[MapAdapter] CHILD NODE SET: ${node.path.join(' -> ')} => ${childName} =`, 'color: violet', childNode);

                if( childNode )
                    childNode.setValue(childValue, false);
                else
                    node.addChild(childName, childValue, false);

                return true;
            },
            defineProperty(target:SyncMap, childName:PropertyKey, descriptor:PropertyDescriptor):boolean
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

class MapLikeValue<NT, T = any> implements Map<string, T>
{
    public constructor(private node:MapNodeType<NT>)
    {
    }

    public get size():number
    {
        this.node.atom.reportObserved();

        return this.node.children.size;
    }

    public get(childName:string):T | undefined
    {
        const childNode:MapChildNodeType | undefined = this.node.getChild(childName);

        return childNode?.getValue();
    }

    public set(childName:string, childValue:T):this
    {
        const childNode:MapChildNodeType | undefined = this.node.getChild(childName);

        if( childNode )
            childNode.setValue(childValue, false);
        else
            this.node.addChild(childName, childValue, false);

        return this;
    }

    public has(childName:string):boolean
    {
        return this.node.children.has(childName);
    }

    public delete(childName:string):boolean
    {
        if( this.node.children.has(childName) )
        {
            const childNode:MapChildNodeType | undefined = this.node.deleteChild(childName, false);

            childNode?.destroy(false);

            return true;
        }

        return false;
    }

    public clear():void
    {
        for( const childNode of this.node.children.values() )
        {
            childNode.parent?.deleteChild(childNode.name, false);
            childNode.destroy(false);
        }

        this.node.children.clear();
    }

    public [Symbol.iterator]():IterableIterator<[string, T]>
    {
        return new MapEntriesIterator<NT, T>(this.node);
    }

    public forEach(callbackfn:(value:T, key:string, map:Map<string, T>) => void):void
    {
        for( const [childName, childValue] of this )
        {
            callbackfn(childValue, childName, this as any);
        }
    }

    public entries():IterableIterator<[string, T]>
    {
        return new MapEntriesIterator<NT, T>(this.node);
    }

    public keys():IterableIterator<string>
    {
        return this.node.children.keys();
    }

    public values():IterableIterator<T>
    {
        return new MapValuesIterator<NT, T>(this.node);
    }

    public get [Symbol.toStringTag]()
    {
        return 'Map';
    }

    public toJSON():Record<string, unknown>
    {
        return this.node.toJSON() as any;
    }
}

export class MapEntriesIterator<NT, T> implements IterableIterator<[string, T]>
{
    private iterator:IterableIterator<[string, MapChildNodeType]>;

    public constructor(private readonly node:MapNodeType<NT>)
    {
        this.iterator = this.node.children[Symbol.iterator]();
    }

    public [Symbol.iterator]():IterableIterator<[string, T]>
    {
        return this;
    }

    public next():IteratorResult<[string, T]>
    {
        const { done, value } = this.iterator.next();

        if( value )
        {
            const [childName, childNode] = value;

            return {
                done,
                value: [childName, childNode?.getValue()],
            };
        }
        else
            return {
                done,
                value,
            };
    }
}

export class MapValuesIterator<NT, T> implements IterableIterator<T>
{
    private iterator:IterableIterator<MapChildNodeType>;

    public constructor(private readonly node:MapNodeType<NT>)
    {
        this.iterator = this.node.children.values();
    }

    public [Symbol.iterator]():IterableIterator<T>
    {
        return this;
    }

    public next():IteratorResult<T>
    {
        const { done, value } = this.iterator.next();
        const childNode:MapChildNodeType = value;

        return {
            done,
            value: childNode?.getValue(),
        };
    }
}
