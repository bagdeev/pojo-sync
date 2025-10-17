import { SyncNodeType } from '../../SyncNodeType';
import { FluidObjectFieldAdapter } from './ObjectFieldAdapter';

export class FluidMapFieldAdapter extends FluidObjectFieldAdapter
{
    public override isSupportedValue(parentType:SyncNodeType | undefined,
                                     value:any,
                                     _isShared:boolean):boolean
    {
        return parentType === SyncNodeType.MAP
            && (typeof value === 'string'
                || typeof value === 'number'
                || typeof value === 'boolean');
    }
}
