import { ISharedObject } from '@fluidframework/shared-object-base/src/types';
import { IFluidContainer, SharedMap } from 'fluid-framework';
import { action, createAtom, IAtom } from 'mobx';
import * as Y from 'yjs';
import { SyncNodeUtils } from '../utils/SyncNodeUtils';
import { syncNodeAdapters } from './adapters/adapters';
import { Container, type IInitializedContainer } from './Container';
import { RootObjectSyncNode } from './nodes/RootObjectSyncNode';
import { IPreparedValue } from './PreparedValue';
import { USE_FLUID } from './syncConfig';
import { ISyncMetadata, SyncMetedataKey } from './SyncMetedata';
import { SyncNodeType } from './SyncNodeType';

export class BaseSyncState
{
    protected _initialized:boolean = false;
    protected _initializedAtom:IAtom;

    protected _containerId!:string;
    protected _container!:IFluidContainer | Y.Doc;

    protected _syncPath!:string;
    protected _syncNode!:RootObjectSyncNode;

    public constructor()
    {
        this._initializedAtom = createAtom(
            'sync_state_initialized',
        );
    }

    public destroy()
    {
        this._syncNode.destroy(false);
    }

    public get initialized():boolean
    {
        this._initializedAtom?.reportObserved();

        return this._initialized;
    }

    public get containerId():string | undefined
    {
        return this._containerId;
    }

    public get container():IFluidContainer | Y.Doc | undefined
    {
        return this._container;
    }

    public get states():SharedMap | Y.Map<unknown> | undefined
    {
        if( !this._container )
            return undefined;

        if( USE_FLUID )
            return (this._container as IFluidContainer).initialObjects.states as SharedMap;
        else
            return (this._container as Y.Doc).getMap('states');
    }

    public get syncNode():RootObjectSyncNode
    {
        return this._syncNode;
    }

    public async initSync(containerId:string | undefined):Promise<void>
    {
        const startTime:number = performance.now();
        console.log(`%cStart init SyncState ${this._syncPath}`, 'color: hotpink');

        const containerData = await Container.getContainer(containerId || '');

        this._containerId = containerData.containerId;
        this._container = containerData.container as any;

        try
        {
            await this._initState(containerData);
        }
        catch( error )
        {
            console.log(`%cInit SyncState ${this._syncPath} ERROR, retrying...`, 'color: red');

            throw new Error(`SyncState initialization failure: ${error}`);
        }

        console.log(`%cFinish init SyncState ${this._syncPath}, duration => ${(performance.now() - startTime).toFixed(0)}msec`, 'color: hotpink');
    }

    private async _initState(documentData:IInitializedContainer):Promise<void>
    {
        if( this.states )
        {
            const syncMetadata:Array<ISyncMetadata> = Reflect.getMetadata(SyncMetedataKey, this);
            const syncState:ISharedObject | Y.AbstractType<unknown> | undefined = this.states.get(this._syncPath) as any;
            let preparedValue:IPreparedValue<unknown, unknown> | undefined;

            if( syncState )
            {
                preparedValue = USE_FLUID
                    ? await SyncNodeUtils.prepareFluidSharedValue(
                        syncNodeAdapters,
                        SyncNodeType.OBJECT,
                        syncState,
                    )
                    : SyncNodeUtils.prepareYjsSharedValue(
                        syncNodeAdapters,
                        SyncNodeType.OBJECT,
                        syncState,
                    );

                if( preparedValue && syncMetadata )
                {
                    const syncedValues = Array.from(preparedValue.children?.entries() || []);

                    syncedValues.forEach(([childName, childValue]) =>
                    {
                        const syncItemMetadata:ISyncMetadata | undefined = syncMetadata.find(
                            (item) => item.propertyKey === childName,
                        );

                        if( !syncItemMetadata || syncItemMetadata.type !== childValue?.type )
                        {
                            preparedValue?.children?.delete(childName);
                            (preparedValue?.value as Y.Map<unknown>)?.delete(childName as string);
                        }
                    });
                }
            }

            this._initRoot(
                syncMetadata,
                documentData,
                preparedValue || {},
                !!preparedValue,
            );

            this._initialized = true;

            await this.onInit();

            this._initializedAtom.reportChanged();
        }
        else
        {
            console.error('SyncState initialization error');
        }
    }

    @action
    private _initRoot(syncMetadata:Array<ISyncMetadata>,
                      containerData:IInitializedContainer,
                      initialValue:IPreparedValue<unknown, unknown> | Object,
                      isShared:boolean):void
    {
        if( this.states )
        {
            this._syncNode = RootObjectSyncNode.createRoot(
                containerData,
                this.states,
                this._syncPath,
                initialValue,
                isShared,
            ) as RootObjectSyncNode;

            if( syncMetadata )
            {
                for( const { propertyKey, type } of syncMetadata )
                {
                    const childNode = this._syncNode.getChild(propertyKey as string);

                    if( !childNode )
                    {
                        this._syncNode.addChild(
                            propertyKey as string,
                            type === SyncNodeType.OBJECT
                                ? {}
                                : type === SyncNodeType.MAP
                                    ? new Map()
                                    : type === SyncNodeType.ARRAY
                                        ? []
                                        : undefined,
                            false,
                        );
                    }
                }
            }
        }
    }

    protected async onInit():Promise<void>
    {
        // NOTE: use this hook to initialize default state
    }

    public isChangesSynced():boolean
    {
        if( USE_FLUID )
        {
            console.log('%cisChangesSynced:', 'background: salmon', (this.container as IFluidContainer)?.isDirty || false);
            return !(this.container as IFluidContainer)?.isDirty;
        }
        else
        {
            console.log('%cisChangesSynced:', 'background: salmon', (this.container as Y.Doc)?.isSynced || false);
            return !(this.container as Y.Doc)?.isSynced;
        }
    }

    public toJSON():any
    {
        return {
            containerId: this._containerId,
            syncPath: this._syncPath,
            initialized: this._initialized,
            nodes: this._syncNode?.toJSON(),
        };
    }
}
