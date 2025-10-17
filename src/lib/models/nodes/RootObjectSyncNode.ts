import { SharedMap } from 'fluid-framework';
import { override } from 'mobx';
import * as Y from 'yjs';
import { IInitializedContainer } from '../Container';
import { IPreparedValue } from '../PreparedValue';
import { ISyncNode } from '../SyncNode';
import { RegularSyncNode } from './RegularSyncNode';

export class RootObjectSyncNode extends RegularSyncNode<Map<string, ISyncNode<unknown, string, unknown>>, string, string>
{
    public root!:SharedMap | Y.Map<unknown>;

    @override
    public override destroy(isShared:boolean):void
    {
        super.destroy(isShared);

        this.root.delete(this.name);
    }

    public static createRoot(container:IInitializedContainer,
                             root:SharedMap | Y.Map<unknown>,
                             name:string,
                             value:unknown | IPreparedValue<unknown, unknown> | undefined,
                             isShared:boolean):RootObjectSyncNode | undefined
    {
        const node:RootObjectSyncNode | undefined = RegularSyncNode.create(
            container,
            undefined,
            name,
            value,
            isShared,
        ) as RootObjectSyncNode;

        if( node )
        {
            node.root = root;

            if( !isShared )
                root.set(name, node.sharedObject);
        }

        return node;
    }
}
