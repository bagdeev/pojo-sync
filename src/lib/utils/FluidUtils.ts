import { IFluidHandle } from '@fluidframework/core-interfaces';

export class FluidUtils
{
    public static isSharedObjectHandle(value:any):value is IFluidHandle
    {
        return !!value && !!value.absolutePath && !!value.isAttached;
    }
}
