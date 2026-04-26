import { vi } from "vitest";

/**
 * Build a thenable that mimics Mongoose's chainable Query API.
 * `Project.find().sort({})` resolves to `value`; `.select(...)`,
 * `.lean(...)`, `.exec()` are all chainable no-ops.
 */
export function mongoQuery<T>(value: T): Promise<T> & {
  sort: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  lean: ReturnType<typeof vi.fn>;
  exec: ReturnType<typeof vi.fn>;
} {
  // Chainable methods return the same thenable so any number of `.sort()` /
  // `.select()` calls compose without surprises.
  const promise = Promise.resolve(value) as Promise<T> & {
    sort: ReturnType<typeof vi.fn>;
    select: ReturnType<typeof vi.fn>;
    lean: ReturnType<typeof vi.fn>;
    exec: ReturnType<typeof vi.fn>;
  };
  const self = () => promise;
  promise.sort = vi.fn(self);
  promise.select = vi.fn(self);
  promise.lean = vi.fn(self);
  promise.exec = vi.fn(self);
  return promise;
}
