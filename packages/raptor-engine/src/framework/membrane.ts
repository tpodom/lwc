import assert from "./assert";
import { ArrayMap, isArray } from "./language";

/*eslint-disable*/
export type ReplicableFunction = (...args: Array<any>) => any;
export type Replicable = Object | ReplicableFunction;

export type ReplicaFunction = (...args: Array<any>) => Replica | String | Number | Boolean | null | undefined;
export type Replica = Object | ReplicaFunction;

export interface MembraneHandler {
    get(target: Replicable, key: string | Symbol): any;
    set(target: Replicable, key: string | Symbol, newValue: any): boolean;
    deleteProperty(target: Replicable, key: string | Symbol): boolean;
    apply(targetFn: ReplicableFunction, thisArg: any, argumentsList: Array<any>): any;
    construct(targetFn: ReplicableFunction, argumentsList: Array<any>, newTarget: any): any;
}
/*eslint-enable*/

const TargetSlot = Symbol();

function isReplicable(value: any): boolean {
    const type = typeof value;
    return value && (type === 'object' || type === 'function');
}

export function getReplica(membrane: Membrane, value: Replicable | any): Replica | any {
    if (value === null || !isReplicable(value)) {
        return value;
    }
    assert.isTrue(membrane instanceof Membrane, `getReplica() first argument must be a membrane.`);
    let { cells, cache } = membrane;
    if (cache.has(value)) {
        return value;
    }
    const r = cells.get(value);
    if (r) {
        return r;
    }
    const replica: Replica = new Proxy(value, (membrane as ProxyHandler<Replicable>)); // eslint-disable-line no-undef
    cells.set(value, replica);
    cache.add(replica);
    return replica;
}

export class Membrane {
    handler: MembraneHandler; // eslint-disable-line no-undef
    cells: WeakMap<Replicable, Replica>; // eslint-disable-line no-undef
    cache: WeakSet<Replica>; // eslint-disable-line no-undef
    constructor(handler: MembraneHandler) {
        this.handler = handler;
        this.cells = new WeakMap();
        this.cache = new WeakSet();
    }
    get(target: Replicable, key: string | Symbol): any {
        if (key === TargetSlot) {
            return target;
        }
        const value = this.handler.get(target, key);
        return getReplica(this, value);
    }
    set(target: Replicable, key: string | Symbol, newValue: any): boolean {
        return this.handler.set(target, key, newValue);
    }
    deleteProperty(target: Replicable, key: string | Symbol): boolean {
        if (key === TargetSlot) {
            return false;
        }
        return this.handler.deleteProperty(target, key);
    }
    apply(target: ReplicableFunction, thisArg: any, argumentsList: Array<any>): any {
        thisArg = unwrap(thisArg);
        argumentsList = unwrap(argumentsList);
        if (isArray(argumentsList)) {
            argumentsList = ArrayMap.call(argumentsList, unwrap);
        }
        const value = this.handler.apply(target, thisArg, argumentsList);
        return getReplica(this, value);
    }
    construct(target: ReplicableFunction, argumentsList: Array<any>, newTarget: any): any {
        argumentsList = unwrap(argumentsList);
        if (isArray(argumentsList)) {
            argumentsList = ArrayMap.call(argumentsList, unwrap);
        }
        const value = this.handler.construct(target, argumentsList, newTarget);
        return getReplica(this, value);
    }
}

export function unwrap(replicaOrAny: Replica | any): Replicable | any {
    return (replicaOrAny && replicaOrAny[TargetSlot]) || replicaOrAny;
}
