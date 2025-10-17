import { bind } from 'bind-decorator';

export interface ITypedEventListener<T>
{
    (event:T):void;
}

export interface ITypedEventDisposer
{
    ():void;
}

export class TypedEventEmitter<Events>
{
    private _listeners:Map<keyof Events, ITypedEventListener<unknown>[]> = new Map();
    private _listenersOnce:Map<keyof Events, ITypedEventListener<unknown>[]> = new Map();

    @bind
    public on<K extends keyof Events, E extends Events[K]>(eventName:K, listener:ITypedEventListener<E>):ITypedEventDisposer
    {
        let eventListeners:ITypedEventListener<unknown>[] | undefined = this._listeners.get(eventName);

        if( !eventListeners )
        {
            eventListeners = [];

            this._listeners.set(eventName, eventListeners);
        }

        eventListeners.push(listener as any);

        return ():void => this.off(eventName, listener);
    };

    @bind
    public once<K extends keyof Events, E extends Events[K]>(eventName:K, listener:ITypedEventListener<E>):ITypedEventDisposer
    {
        let eventListenersOnce:ITypedEventListener<unknown>[] | undefined = this._listenersOnce.get(eventName);

        if( !eventListenersOnce )
        {
            eventListenersOnce = [];

            this._listenersOnce.set(eventName, eventListenersOnce);
        }

        eventListenersOnce.push(listener as any);

        return ():void => this.off(eventName, listener);
    };

    @bind
    public off<K extends keyof Events, E extends Events[K]>(eventName:K, listener:ITypedEventListener<E>):void
    {
        const eventListeners:ITypedEventListener<E>[] | undefined = this._listeners.get(eventName);

        if( eventListeners )
        {
            const callbackIndex:number = eventListeners.indexOf(listener);

            if( callbackIndex > -1 )
                eventListeners.splice(callbackIndex, 1);
        }
    };

    @bind
    public offAll():void
    {
        this._listeners.forEach((eventListeners) => eventListeners.splice(0));
        this._listenersOnce.forEach((eventListenersOnce) => eventListenersOnce.splice(0));
    }

    @bind
    public emit<K extends keyof Events, E extends Events[K]>(eventName:K, event:E):void
    {
        const eventListeners:ITypedEventListener<E>[] | undefined = this._listeners.get(eventName);
        const eventListenersOnce:ITypedEventListener<E>[] | undefined = this._listenersOnce.get(eventName);

        eventListeners?.forEach((listener:ITypedEventListener<E>) => listener(event));

        if( eventListenersOnce && eventListenersOnce.length > 0 )
        {
            this._listenersOnce.set(eventName, []);

            eventListenersOnce.forEach((listener:ITypedEventListener<E>) => listener(event));
        }
    };
}
