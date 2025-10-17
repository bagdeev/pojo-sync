import { IFluidContainer, SharedMap, SharedObjectSequence } from 'fluid-framework';

export class ContainerPool
{
    private _mapPool:SharedMap[] = [];
    private _sequencePool:SharedObjectSequence<string>[] = [];

    constructor(private container:IFluidContainer,
                private size:number)
    {
    }

    public async init():Promise<void>
    {
        await Promise.all([this.initMaps(), this.initSequences()]);
    }

    public dispose()
    {
        this._mapPool.splice(0);
        this._sequencePool.splice(0);
    }

    public async initMaps():Promise<void>
    {
        while( this._mapPool.length < this.size )
        {
            const sharedMap:SharedMap = await this.container.create(SharedMap);

            this._mapPool.push(sharedMap);
        }
    }

    public async initSequences():Promise<void>
    {
        while( this._mapPool.length < this.size )
        {
            const sharedSequence:SharedObjectSequence<string> = await this.container.create(SharedObjectSequence) as SharedObjectSequence<string>;

            this._sequencePool.push(sharedSequence);
        }
    }

    public getMapFromPool():SharedMap
    {
        const sharedMap:SharedMap | undefined = this._mapPool.shift();

        this.initMaps();

        if( !sharedMap )
            throw new Error(`MAP_POOL_TOO_SMALL (current ContainerPool.size: ${this.size})`);

        return sharedMap;
    }

    public getSequenceFromPool():SharedObjectSequence<string>
    {
        const sharedSequence:SharedObjectSequence<string> | undefined = this._sequencePool.shift();

        this.initSequences();

        if( !sharedSequence )
            throw new Error('SEQUENCE_POOL_TOO_SMALL');

        return sharedSequence;
    }
}
