import { AzureClient, AzureClientProps, IUser } from '@fluidframework/azure-client';
import { InsecureTokenProvider } from '@fluidframework/test-client-utils';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { ConnectionState, ContainerSchema, IFluidContainer, SharedMap, SharedObjectSequence } from 'fluid-framework';
import { v4 } from 'uuid';
import * as Y from 'yjs';
import { ContainerPool } from './ContainerPool';
import {
    AZURE_RELAY_ACCESS_KEY,
    AZURE_RELAY_TENANT_ID,
    AZURE_RELAY_URL,
    getEnvName,
    IS_LOCAL,
    USE_FLUID,
    getYjsServerUrl,
} from './syncConfig';
// import { DevtoolsLogger, initializeDevtools } from '@fluid-experimental/devtools';

// const devtoolsLogger = new DevtoolsLogger();

const containerSchema:ContainerSchema = {
    initialObjects: {
        states: SharedMap,
    },
    dynamicObjectTypes: [
        SharedMap,
        SharedObjectSequence,
    ],
};

export interface IInitializedContainer
{
    containerId:string;
    container:IFluidContainer | Y.Doc | undefined;
    provider:HocuspocusProvider | undefined;
    containerPool:ContainerPool | undefined;
}

export class Container
{
    public static containers:Map<string, IInitializedContainer> = new Map();

    private static _getClient(user:IUser):AzureClient
    {
        const clientProps:AzureClientProps = {
            connection: {
                tenantId: AZURE_RELAY_TENANT_ID,
                tokenProvider: new InsecureTokenProvider(
                    AZURE_RELAY_ACCESS_KEY,
                    user as any,
                ),
                endpoint: AZURE_RELAY_URL,
                type: IS_LOCAL ? 'local' : 'remote',
            },
            // logger: devtoolsLogger,
        };

        return new AzureClient(clientProps);
    }

    public static async init(containerId:string | undefined, user:IUser, token:string | undefined):Promise<IInitializedContainer>
    {
        if( !containerId || !Container.containers.has(containerId) )
        {
            const startTime:number = performance.now();
            console.log(`%cStart init Container ${containerId}, USE_FLUID =`, 'color: maroon', USE_FLUID, getYjsServerUrl());

            if( USE_FLUID )
            {
                const client:AzureClient = Container._getClient(user);

                let container:IFluidContainer | undefined = undefined;

                try
                {
                    const containerData = await client.getContainer(containerId!, containerSchema);

                    container = containerData.container;
                }
                catch( e )
                {
                    console.log(`Get Container ${containerId} failed:`, e);
                    console.log('Creating a new Container');
                }

                if( !container )
                {
                    const containerData = await client.createContainer(containerSchema);

                    containerId = await containerData.container.attach();

                    container = containerData.container;

                    console.log(`New Container id: ${containerId}`);
                }

                const containerPool:ContainerPool = new ContainerPool(container!, 1000);

                await containerPool.init();

                console.log(`%cConnected to Container ${containerId}, duration => ${(performance.now() - startTime).toFixed(0)}msec, connectionState =`, 'color: hotpink', ConnectionState[container.connectionState]);

                if( container && container.connectionState !== ConnectionState.Connected )
                    await new Promise<void>(resolve =>
                    {
                        const onConnectedListener = () =>
                        {
                            if( container )
                            {
                                if( container.connectionState === ConnectionState.Connected )
                                {
                                    console.log(`%cContainer ${containerId} fully loaded, duration => ${(performance.now() - startTime).toFixed(0)}msec, connectionState =`, 'color: hotpink', ConnectionState[container.connectionState]);
                                    container.off('connected', onConnectedListener);

                                    clearTimeout(timeout);
                                    timeout = undefined;

                                    resolve();
                                }
                                else
                                    console.log(`%cContainer ${containerId} connected state`, 'color: hotpink', ConnectionState[container.connectionState]);
                            }
                        };

                        let timeout:any = setTimeout(() =>
                        {
                            if( container )
                                console.log(`%cContainer ${containerId} loaded TIMEOUT, duration => ${(performance.now() - startTime).toFixed(0)}msec, connectionState =`, 'background: hotpink', ConnectionState[container.connectionState]);

                            onConnectedListener();
                        }, 10000);

                        container?.on('connected', onConnectedListener);
                    });
                else
                    console.log(`%cContainer ${containerId} fully loaded, duration => ${(performance.now() - startTime).toFixed(0)}msec, connectionState =`, 'color: hotpink', ConnectionState[container.connectionState]);

                Container.containers.set(
                    containerId!,
                    {
                        containerId: containerId!,
                        container,
                        provider: undefined,
                        containerPool,
                    },
                );
            }
            else
            {
                if( !containerId )
                    containerId = v4();

                const document = new Y.Doc({
                    autoLoad: true,
                });

                const provider = new HocuspocusProvider({
                    url: getYjsServerUrl(),
                    name: containerId,
                    document,
                    token: `${getEnvName()}|${token}`,
                });

                const connectedPromise = new Promise<void>((resolve) =>
                {
                    provider.on('synced', ({ state }:any) =>
                    {
                        console.log('Yjs Provider document synced:', state);

                        if( state === true )
                        {
                            resolve();
                        }
                    });
                });

                await connectedPromise;

                console.log(`%cConnected to Document ${containerId}, duration => ${(performance.now() - startTime).toFixed(0)}msec`, 'color: maroon');

                Container.containers.set(
                    containerId!,
                    {
                        containerId: containerId!,
                        container: document,
                        provider,
                        containerPool: undefined,
                    },
                );
            }
        }

        return Container.containers.get(containerId!) as IInitializedContainer;
    }

    public static async getContainer(containerId:string):Promise<IInitializedContainer>
    {
        return Container.containers.get(containerId) as IInitializedContainer;
    }

    public static dispose(containerId:string):void
    {
        const container:IInitializedContainer | undefined = Container.containers.get(containerId);

        if( container )
        {
            container.provider?.disconnect();
            container.containerPool?.dispose();

            if( typeof (container.container as IFluidContainer).dispose === 'function' )
                (container.container as IFluidContainer).dispose();
        }
    }
}
