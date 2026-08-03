export type ServiceResult<TData, TError extends string = never> =
  | { ok: true; data: TData }
  | {
      ok: false;
      code: TError | "STRIPE_ERROR" | "NOT_FOUND" | "CONFLICT";
      detail?: string;
    };

export function svcOk<TData>(data: TData): ServiceResult<TData, never> {
  return { ok: true, data };
}

export function svcFail<const TError extends string>(
  code: TError & (string extends TError ? never : unknown),
  detail?: string,
): ServiceResult<never, TError> {
  return detail === undefined
    ? { ok: false, code }
    : { ok: false, code, detail };
}
