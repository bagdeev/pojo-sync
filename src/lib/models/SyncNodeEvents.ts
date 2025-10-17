export type EventName = keyof ISyncNodeEvents;

export interface ISyncNodeEvent<N extends EventName>
{
    eventName:N;
    target:any;
    path:(string | number)[],
    key:string | number | undefined;
    value:unknown;
    isLocal:boolean;
}

export interface IAddedEvent extends ISyncNodeEvent<'add'>
{
}

export interface IChangedEvent extends ISyncNodeEvent<'change'>
{
}

export interface IRemovedEvent extends ISyncNodeEvent<'remove'>
{
}

export interface IDestroyedEvent extends ISyncNodeEvent<'destroy'>
{
}

export interface ISyncNodeEvents
{
    add:IAddedEvent;
    change:IChangedEvent;
    remove:IRemovedEvent;
    destroy:IDestroyedEvent;
}
