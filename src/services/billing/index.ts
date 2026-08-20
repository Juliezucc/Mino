import { getAccessToken } from '@/data/supabaseRepository';

import { BillingService } from './BillingService';
import { LocalBillingService } from './LocalBillingService';
import { StripeWebBillingService } from './StripeWebBillingService';

export * from './BillingService';
export { LocalBillingService, StripeWebBillingService };

const API_URL = process.env.EXPO_PUBLIC_BILLING_API_URL;

let instance: BillingService | null = null;

/**
 * Single entry point used by the app. With no billing API configured we fall
 * back to the local stand-in, so the app runs — and says so — without a
 * payment backend.
 */
export function getBillingService(): BillingService {
  if (!instance) {
    instance = API_URL
      ? new StripeWebBillingService(API_URL, getAccessToken)
      : new LocalBillingService();
  }
  return instance;
}

/** Test hook. */
export function setBillingService(service: BillingService | null) {
  instance = service;
}
