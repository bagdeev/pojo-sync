import { SyncNodeUtils } from '../../../utils/SyncNodeUtils';
import { SyncNodeType } from '../../SyncNodeType';
import { YjsObjectFieldAdapter } from './ObjectFieldAdapter';

export class YjsMapDateFieldAdapter extends YjsObjectFieldAdapter
{
    public override isSupportedValue(parentType:SyncNodeType | undefined,
                                     value:any,
                                     _isShared:boolean):boolean
    {
        return parentType === SyncNodeType.MAP
            && (value instanceof Date
                || SyncNodeUtils.isISODateString(value));
    }
}
