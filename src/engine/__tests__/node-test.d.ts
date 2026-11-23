declare module 'node:test' {
  export interface TestContext {
    readonly name: string;
    test(name: string, fn: (t: TestContext) => void | Promise<void>): Promise<void>;
  }

  export function describe(
    name: string,
    fn: () => void | Promise<void>
  ): Promise<void>;

  export function it(
    name: string,
    fn: (t: TestContext) => void | Promise<void>
  ): Promise<void>;

  export function test(
    name: string,
    fn: (t: TestContext) => void | Promise<void>
  ): Promise<void>;
}

declare module 'node:assert/strict' {
  export function ok(value: unknown, message?: string | Error): asserts value;
  export function equal<T>(actual: unknown, expected: T, message?: string | Error): asserts actual is T;
  export function notEqual(actual: unknown, expected: unknown, message?: string | Error): void;
  export function deepEqual<T>(actual: unknown, expected: T, message?: string | Error): asserts actual is T;
  export function notDeepEqual(actual: unknown, expected: unknown, message?: string | Error): void;
  export function match(string: string, regexp: RegExp, message?: string | Error): void;
  export function throws(fn: () => unknown, message?: string | Error): void;
  const strictAssert: {
    ok: typeof ok;
    equal: typeof equal;
    notEqual: typeof notEqual;
    deepEqual: typeof deepEqual;
    notDeepEqual: typeof notDeepEqual;
    match: typeof match;
    throws: typeof throws;
  };
  export default strictAssert;
}
