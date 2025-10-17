// import { log } from '../../utils/logger';
import { ObjectChildNodeType, ObjectNodeType } from '../adapters/objectTypes';
import { SyncNodeEventsTargetKey } from '../SyncNodeEventsTarget';

export function getObjectProxy<NT>(node:ObjectNodeType<NT>):Object
{
    class SyncObject
    {
        // @ts-ignore
        private _node:ObjectNodeType<NT> = node;
    }

    return new Proxy(
        new SyncObject(),
        {
            get(target:SyncObject, childName:PropertyKey):any
            {
                if( target.hasOwnProperty(childName) )
                    return (target as any)[childName];

                if( childName === SyncNodeEventsTargetKey )
                    return node;

                if( typeof childName !== 'string' )
                    return undefined;

                const childNode:ObjectChildNodeType | undefined = node.getChild(childName);

                // log(`%c[ObjectAdapter] CHILD NODE GET: ${node.path.join(' -> ')} => ${childName} =`, 'color: violet', childNode);

                return childNode?.getValue();
            },
            set(_target:unknown, childName:PropertyKey, childValue:any):boolean
            {
                if( typeof childName !== 'string' )
                    return false;

                const childNode:ObjectChildNodeType | undefined = node.getChild(childName);

                // log(`%c[ObjectAdapter] CHILD NODE SET: ${node.path.join(' -> ')} => ${childName} =`, 'color: violet', childNode);

                if( childNode )
                    childNode.setValue(childValue, false);
                else
                    node.addChild(childName, childValue, false);

                return true;
            },
            has(_target:unknown, childName:PropertyKey):boolean
            {
                if( typeof childName !== 'string' )
                    return false;

                const childNode:ObjectChildNodeType | undefined = node.getChild(childName);

                // log(`%c[ObjectAdapter] CHILD NODE HAS: ${node.path.join(' -> ')} => ${childName} =`, 'color: violet', childNode);

                return !!childNode;
            },
            deleteProperty(_target:unknown, childName:PropertyKey):boolean
            {
                if( typeof childName !== 'string' )
                    return false;

                const childNode:ObjectChildNodeType | undefined = node.getChild(childName);

                // log(`%c[ObjectAdapter] CHILD NODE DELETE: ${node.path.join(' -> ')} => ${childName} =`, 'color: violet', childNode);

                if( childNode )
                {
                    childNode.parent?.deleteChild(childName, false);
                    childNode.destroy(false);

                    return true;
                }

                return false;
            },
            ownKeys(_target:unknown):ArrayLike<string | symbol>
            {
                // log(`%c[ObjectAdapter] CHILD NODE GET KEYS: ${node.path.join(' -> ')}`, 'color: violet');

                return Array.from(node.children.keys());
            },
            getOwnPropertyDescriptor(_target:unknown, childName:PropertyKey):PropertyDescriptor | undefined
            {
                if( typeof childName !== 'string' )
                    return {
                        enumerable: false,
                        configurable: false,
                    };

                const childNode:ObjectChildNodeType | undefined = node.getChild(childName);

                // log(`%c[ObjectAdapter] CHILD NODE GET DESCRIPTOR: ${node.path.join(' -> ')} => ${childName} =`, 'color: violet', childNode);

                if( childNode )
                {
                    return {
                        enumerable: true,
                        configurable: true,
                    };
                }

                return {
                    enumerable: false,
                    configurable: false,
                };
            },
            defineProperty(target:SyncObject, childName:PropertyKey, descriptor:PropertyDescriptor):boolean
            {
                if( descriptor.enumerable )
                {
                    if( typeof childName !== 'string' )
                        return false;

                    const childNode:ObjectChildNodeType | undefined = node.getChild(childName);

                    // log(`%c[ObjectAdapter] CHILD NODE DEFINE: ${node.path.join(' -> ')} => ${childName} =`, 'color: violet', childNode);

                    if( childNode )
                        childNode.setValue(descriptor.value, false);
                    else
                        node.addChild(childName, descriptor.value, false);
                }
                else
                    Object.defineProperty(target, childName, descriptor);

                return true;
            },
        },
    );
}
