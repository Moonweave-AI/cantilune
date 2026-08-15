/**
 * Read-only Map whose mutable backing collection is held in an ECMAScript
 * private slot. Freezing a native Map is not sufficient: `set`, `delete`, and
 * `clear` continue to mutate its internal slots after `Object.freeze(map)`.
 */
class DetachedReadonlyMap<Key, Value> implements ReadonlyMap<Key, Value> {
  readonly #entries: Map<Key, Value>;

  constructor(entries: Iterable<readonly [Key, Value]>) {
    this.#entries = new Map(entries);
    Object.freeze(this);
  }

  get size(): number {
    return this.#entries.size;
  }

  get(key: Key): Value | undefined {
    return this.#entries.get(key);
  }

  has(key: Key): boolean {
    return this.#entries.has(key);
  }

  entries(): MapIterator<[Key, Value]> {
    return this.#entries.entries();
  }

  keys(): MapIterator<Key> {
    return this.#entries.keys();
  }

  values(): MapIterator<Value> {
    return this.#entries.values();
  }

  forEach(
    callbackfn: (value: Value, key: Key, map: ReadonlyMap<Key, Value>) => void,
    thisArg?: unknown,
  ): void {
    for (const [key, value] of this.#entries) {
      callbackfn.call(thisArg, value, key, this);
    }
  }

  [Symbol.iterator](): MapIterator<[Key, Value]> {
    return this.#entries[Symbol.iterator]();
  }
}

Object.freeze(DetachedReadonlyMap.prototype);

/** Read-only Set with the same no-backing-leak guarantee as DetachedReadonlyMap. */
class DetachedReadonlySet<Value> implements ReadonlySet<Value> {
  readonly #values: Set<Value>;

  constructor(values: Iterable<Value>) {
    this.#values = new Set(values);
    Object.freeze(this);
  }

  get size(): number {
    return this.#values.size;
  }

  has(value: Value): boolean {
    return this.#values.has(value);
  }

  entries(): SetIterator<[Value, Value]> {
    return this.#values.entries();
  }

  keys(): SetIterator<Value> {
    return this.#values.keys();
  }

  values(): SetIterator<Value> {
    return this.#values.values();
  }

  forEach(
    callbackfn: (value: Value, value2: Value, set: ReadonlySet<Value>) => void,
    thisArg?: unknown,
  ): void {
    for (const value of this.#values) {
      callbackfn.call(thisArg, value, value, this);
    }
  }

  [Symbol.iterator](): SetIterator<Value> {
    return this.#values[Symbol.iterator]();
  }
}

Object.freeze(DetachedReadonlySet.prototype);

/**
 * Detach a Map and optionally materialize every value at an authority boundary.
 * The returned object deliberately has no `set`, `delete`, or `clear` member.
 */
export function cloneReadonlyMap<Key, Value>(
  source: ReadonlyMap<Key, Value>,
  cloneValue: (value: Value, key: Key) => Value = (value) => value,
): ReadonlyMap<Key, Value> {
  return new DetachedReadonlyMap(
    [...source].map(([key, value]) => [key, cloneValue(value, key)] as const),
  );
}

/** Detach a Set behind a non-mutable collection view. */
export function cloneReadonlySet<Value>(
  source: ReadonlySet<Value>,
  cloneValue: (value: Value) => Value = (value) => value,
): ReadonlySet<Value> {
  return new DetachedReadonlySet([...source].map(cloneValue));
}

/** Detach, materialize, and freeze an array. */
export function cloneReadonlyArray<Value>(
  source: readonly Value[],
  cloneValue: (value: Value, index: number) => Value = (value) => value,
): readonly Value[] {
  return Object.freeze(source.map(cloneValue));
}

/** Copy and freeze a plain data object's own enumerable fields one level deep. */
export function clonePlainObject<Value extends object>(value: Value): Value {
  return Object.freeze({ ...value });
}
