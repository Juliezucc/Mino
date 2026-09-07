import { Platform } from 'react-native';

import { Subscription } from '@/domain/billing';
import { ID } from '@/domain/types';
import { getAccessToken, getSupabaseClient } from '@/data/supabaseRepository';

import { BillingService } from './BillingService';
import { ExpoIapStore, PRODUITS, boutiqueDuTelephone } from './ExpoIapStore';
import { LocalBillingService } from './LocalBillingService';
import { StoreBillingService } from './StoreBillingService';
import { StripeWebBillingService } from './StripeWebBillingService';
import { getNativeStore } from './native';

export * from './BillingService';
export * from './native';
export { ExpoIapStore, LocalBillingService, PRODUITS, StoreBillingService, StripeWebBillingService };

const API_URL = process.env.EXPO_PUBLIC_BILLING_API_URL;

let instance: BillingService | null = null;

/**
 * Quel rail, et pourquoi celui-là.
 *
 * Dans l'application sur iOS ou Android : la boutique. Ce n'est pas une
 * préférence, c'est la règle d'Apple et de Google — tout paiement qui débloque
 * une fonctionnalité numérique dans l'app doit passer par leur système. Les
 * dispositifs européens de paiement externe existent, mais imposent leurs
 * propres conditions et une commission malgré tout.
 *
 * Sur le web : Stripe. Moins cher, sans intermédiaire, et c'est là que
 * convertissent les visiteurs venus d'un article ou d'un lien de parrainage.
 *
 * Et sans rien de configuré : la doublure locale, pour que l'application
 * tourne et le dise franchement.
 *
 * Un seul abonnement dans les deux cas, parce que la vérité est côté serveur.
 */
export function getBillingService(): BillingService {
  if (!instance) {
    const api = API_URL ? new StripeWebBillingService(API_URL, getAccessToken) : null;
    const onDevice = Platform.OS === 'ios' || Platform.OS === 'android';
    // Celle qu'on aurait posée à la main d'abord — c'est ce qui permet aux
    // essais de substituer une fausse boutique — puis celle de l'appareil.
    const store = getNativeStore() ?? boutiqueDuTelephone();

    instance =
      onDevice && store && api
        ? new StoreBillingService(api, store, confirmPurchase, storeAccountToken)
        : (api ?? new LocalBillingService());
  }
  return instance;
}

/** Test hook. */
export function setBillingService(service: BillingService | null) {
  instance = service;
}

/**
 * Remet la preuve d'achat au serveur, qui la fait vérifier par Apple ou Google.
 *
 * Ce que renvoie cet appel n'a rien d'autoritaire : c'est une avance sur la
 * notification serveur à serveur, qui arrivera de toute façon et qui, elle,
 * fait foi. Passer par le serveur tout de suite évite simplement au parent
 * d'attendre quelques secondes devant un écran qui dit encore « essai ».
 */
async function confirmPurchase(input: {
  familyId: ID;
  platform: 'apple' | 'google';
  token: string;
  productId: string;
}): Promise<Subscription | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  const { data, error } = await client.functions.invoke('store-purchase', { body: input });
  if (error) return null;
  return (data as { subscription?: Subscription })?.subscription ?? null;
}

/**
 * Le jeton qui relie un achat à une famille.
 *
 * Apple veut un UUID, Google une chaîne opaque, et nos identifiants de famille
 * ne sont ni l'un ni l'autre — d'où un jeton attribué par la base. Sans lui,
 * la notification qui annonce un renouvellement ou une résiliation arrive sans
 * dire de quelle famille elle parle, et il n'y a aucun rattrapage possible.
 */
async function storeAccountToken(familyId: ID): Promise<string> {
  const client = getSupabaseClient();
  if (!client) return familyId;

  const { data } = await client.rpc('store_account_token');
  return typeof data === 'string' ? data : familyId;
}
