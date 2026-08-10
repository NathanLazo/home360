import type { RouterInputs, RouterOutputs } from "~/trpc/react";

type PaymentOutput = RouterOutputs["payment"];

type PaymentInput = RouterInputs["payment"];

/**
 * Every payments type is inferred from the router so the UI can never drift
 * from the server contract. `result` is nullable by the `TrpcResponse`
 * envelope; components only ever receive the unwrapped success payload.
 */
export type BusinessBalances = NonNullable<
  PaymentOutput["getBalances"]["result"]
>;

export type TransactionListResult = NonNullable<
  PaymentOutput["listTransactions"]["result"]
>;

export type TransactionListItem = TransactionListResult["items"][number];

export type PaymentStatusValue = TransactionListItem["status"];

export type PaymentMethodValue = TransactionListItem["method"];

export type ConnectStatus = NonNullable<
  PaymentOutput["getConnectStatus"]["result"]
>;

export type CreatedPaymentLink = NonNullable<
  PaymentOutput["createPaymentLink"]["result"]
>;

export type CreatePaymentLinkInput = PaymentInput["createPaymentLink"];

export type RequestWithdrawalInput = PaymentInput["requestWithdrawal"];
