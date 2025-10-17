import { USE_FLUID } from '../syncConfig';
import { SyncNodeAdapters } from '../SyncNodeAdapter';
import { SyncNodeType } from '../SyncNodeType';
import { FluidArrayAdapter } from './fluid/ArrayAdapter';
import { FluidArrayItemAdapter } from './fluid/ArrayItemAdapter';
import { FluidMapAdapter } from './fluid/MapAdapter';
import { FluidMapFieldAdapter } from './fluid/MapFieldAdapter';
import { FluidObjectAdapter } from './fluid/ObjectAdapter';
import { FluidObjectFieldAdapter } from './fluid/ObjectFieldAdapter';
import { YjsArrayAdapter } from './Yjs/ArrayAdapter';
import { YjsArrayDateItemAdapter } from './Yjs/ArrayDateItemAdapter';
import { YjsArrayItemAdapter } from './Yjs/ArrayItemAdapter';
import { YjsMapAdapter } from './Yjs/MapAdapter';
import { YjsMapDateFieldAdapter } from './Yjs/MapDateFieldAdapter';
import { YjsMapFieldAdapter } from './Yjs/MapFieldAdapter';
import { YjsObjectAdapter } from './Yjs/ObjectAdapter';
import { YjsObjectDateFieldAdapter } from './Yjs/ObjectDateFieldAdapter';
import { YjsObjectFieldAdapter } from './Yjs/ObjectFieldAdapter';

export const syncNodeAdapters:SyncNodeAdapters = USE_FLUID
    ? {
        [SyncNodeType.ARRAY_DATE_ITEM]: new FluidArrayItemAdapter(), // TODO: Need to implement if for FLUID
        [SyncNodeType.ARRAY_ITEM]: new FluidArrayItemAdapter(),
        [SyncNodeType.ARRAY]: new FluidArrayAdapter(),
        [SyncNodeType.MAP_DATE_FIELD]: new FluidMapFieldAdapter(), // TODO: Need to implement if for FLUID
        [SyncNodeType.MAP_FIELD]: new FluidMapFieldAdapter(),
        [SyncNodeType.MAP]: new FluidMapAdapter(),
        [SyncNodeType.OBJECT_DATE_FIELD]: new FluidObjectFieldAdapter(), // TODO: Need to implement if for FLUID
        [SyncNodeType.OBJECT_FIELD]: new FluidObjectFieldAdapter(),
        [SyncNodeType.OBJECT]: new FluidObjectAdapter(),
    }
    : {
        [SyncNodeType.ARRAY_DATE_ITEM]: new YjsArrayDateItemAdapter(),
        [SyncNodeType.ARRAY_ITEM]: new YjsArrayItemAdapter(),
        [SyncNodeType.ARRAY]: new YjsArrayAdapter(),
        [SyncNodeType.MAP_DATE_FIELD]: new YjsMapDateFieldAdapter(),
        [SyncNodeType.MAP_FIELD]: new YjsMapFieldAdapter(),
        [SyncNodeType.MAP]: new YjsMapAdapter(),
        [SyncNodeType.OBJECT_DATE_FIELD]: new YjsObjectDateFieldAdapter(),
        [SyncNodeType.OBJECT_FIELD]: new YjsObjectFieldAdapter(),
        [SyncNodeType.OBJECT]: new YjsObjectAdapter(),
    };
