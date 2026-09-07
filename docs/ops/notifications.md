# Prévenir l'autre bout de la boucle

Deux notifications, et deux seulement :

| Quand | Qui la reçoit | Ce qu'elle dit |
| --- | --- | --- |
| Une mission est déclarée terminée et attend une confirmation | les appareils des **parents** | « <enfant> a terminé une mission » |
| Le parent confirme | l'appareil de l'**enfant** concerné | « tu as reçu des minos » |

Tout le reste — les rappels du soir, les cinq dernières minutes d'une séance —
reste **local** : programmé sur l'appareil, sans serveur, comme avant.

---

## Ce qui manquait, et pourquoi ça se voyait si peu

Mino savait déjà quoi dire, à qui, et quand se taire : `domain/notifications.ts`
porte les textes, les deux publics et les heures calmes, et le magasin appelait
déjà `announce()` aux deux bons moments. Mais tout partait **localement**, sur
l'appareil qui venait d'agir — c'est-à-dire à la seule personne qui était déjà
au courant.

Un enfant terminait une mission à 19 h ; le parent l'apprenait en rouvrant Mino.
Le parent confirmait à 21 h ; l'enfant le découvrait le lendemain matin. Or un
enfant qui attend jusqu'au lendemain cesse de relier l'effort à la récompense,
et c'est la seule chose que ce produit existe pour relier.

---

## Ce qu'il faut faire une fois, côté Apple

Le service de notification d'**Expo** parle à Apple à notre place : c'est lui
qui détient la clé APNs, et c'est pour cela que le code ne contient pas une
ligne de gestion de certificat.

```bash
npx eas-cli@latest credentials --platform ios
```

Choisir le profil, puis **Push Notifications: Manage your Apple Push
Notifications Key** → **Set up a new key**. EAS la crée chez Apple et la garde.

> Une seule clé APNs suffit pour toutes les applications d'un compte, et Apple
> en limite le nombre à deux. Ne pas en créer une par essai.

Puis déployer la fonction :

```bash
supabase functions deploy notify
```

Et appliquer `supabase/notifications.sql` — ou `supabase/tout.sql`, qui le
contient.

---

## Ce que le serveur ne croit jamais

La fonction `notify` lit la famille **dans le jeton d'authentification**, jamais
dans le corps de la requête. Un client qui pourrait nommer la famille qu'il
notifie serait un client capable d'écrire aux enfants des autres.

Elle n'écrit jamais à l'appareil qui l'appelle : celui-ci a déjà affiché la
notification localement, et la recevoir deux fois donne le doublon que tout le
monde reconnaît — celui qui apprend à couper les notifications.

Et elle nettoie les jetons morts. Expo répond `DeviceNotRegistered` pour un
appareil dont Mino a été désinstallé ; le garder reviendrait à envoyer dans le
vide à chaque mission, pour chaque famille, indéfiniment.

### Les jetons, et pourquoi personne ne lit ceux des autres

Un jeton de notification est une **adresse d'appareil** : qui l'obtient peut
écrire à l'appareil d'un enfant, avec le texte de son choix. `push_tokens`
n'autorise donc chacun qu'à lire, écrire et supprimer **le sien**.

> La politique de lecture n'était pas prévue, et elle est nécessaire :
> `insert … on conflict do update` doit lire la ligne en conflit pour savoir
> qu'elle existe. Sans elle, réécrire son propre jeton échoue avec
> « new row violates row-level security policy » — sur une ligne parfaitement
> légitime. Elle s'arrête à `user_id = auth.uid()`.

---

## Deux limites connues

**Les préférences ne sont pas communes.** Les réglages de notification de Mino
sont locaux à chaque appareil : celui qui envoie ne peut pas savoir si l'autre a
demandé le silence. Une notification poussée s'affiche donc même si son
destinataire avait coupé les siennes *dans Mino* — il lui reste les réglages du
système, qui eux font autorité. Les rendre communes demanderait de les ranger
côté serveur.

**Elles partent de l'appareil qui agit**, et non d'un déclencheur de base de
données. Si cet appareil perd le réseau au mauvais moment, la notification ne
part pas. En échange, le chemin est le même que celui de toutes les autres
écritures, au lieu d'un second mécanisme à surveiller. Et ce qu'on perd est le
rappel, jamais le mino : la donnée, elle, est déjà écrite.
