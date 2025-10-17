import { SyncNodeType } from '../../SyncNodeType';
import { YjsObjectFieldAdapter } from './ObjectFieldAdapter';

export class YjsMapFieldAdapter extends YjsObjectFieldAdapter
{
    public override isSupportedValue(parentType:SyncNodeType | undefined,
                                     value:any,
                                     _isShared:boolean):boolean
    {
        return parentType === SyncNodeType.MAP
            && (typeof value === 'string'
                || typeof value === 'number'
                || typeof value === 'boolean'
                || value === undefined
                || value === null);
    }
}
