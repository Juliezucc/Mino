import { Redirect } from 'expo-router';
import React from 'react';

/**
 * `/abonnement` — l'adresse que Stripe connaît.
 *
 * Les fonctions serveur composent trois URL de retour à partir d'`APP_URL` :
 * `/abonnement/merci` après un paiement réussi, `/abonnement` après un
 * abandon, et `/abonnement` encore à la sortie du portail client. Ces chemins
 * sont écrits dans `billing/index.ts` et voyagent jusque dans les sessions
 * Stripe déjà créées — on ne peut donc pas les renommer après coup.
 *
 * L'écran d'abonnement de l'application, lui, vit à `/parent/abonnement`,
 * derrière le code parent. Sans cette route, un parent qui referme la feuille
 * de paiement retombait sur l'écran de route inconnue d'expo-router, avec un
 * message technique en anglais — pour avoir simplement changé d'avis.
 *
 * Une redirection, donc, plutôt qu'un second écran d'abonnement qu'il faudrait
 * tenir d'accord avec le premier.
 */
export default function AbonnementRetour() {
  return <Redirect href="/parent/abonnement" />;
}
