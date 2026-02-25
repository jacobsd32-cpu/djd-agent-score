/**
 * Base error class for all DJD Agent Score SDK errors.
 */
export class AgentScoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentScoreError";
  }
}

/**
 * Thrown when a network request fails (timeout, DNS, connection refused, etc.)
 * or when the server returns an unexpected status code (not 402).
 */
export class NetworkError extends AgentScoreError {
  public readonly statusCode: number | undefined;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = "NetworkError";
    this.statusCode = statusCode;
  }
}

/** A single x402 payment option from the 402 response. */
export interface PaymentAccept {
  scheme: string;
  network: string;
  maxAmountRequired: string;
  resource: string;
  description: string;
  mimeType: string;
  payTo: string;
  maxTimeoutSeconds: number;
  asset: string;
  extra?: Record<string, unknown>;
}

/**
 * Thrown when the API returns HTTP 402 — the endpoint requires x402 payment.
 * Carries the parsed `accepts` array so callers can inspect payment options.
 */
export class PaymentRequiredError extends AgentScoreError {
  public readonly statusCode = 402 as const;
  public readonly accepts: PaymentAccept[];
  public readonly rawBody: unknown;

  constructor(accepts: PaymentAccept[], rawBody: unknown) {
    const amount = accepts[0]?.maxAmountRequired ?? "unknown";
    const asset = accepts[0]?.asset ?? "unknown";
    super(`Payment required: ${amount} ${asset}`);
    this.name = "PaymentRequiredError";
    this.accepts = accepts;
    this.rawBody = rawBody;
  }
}
