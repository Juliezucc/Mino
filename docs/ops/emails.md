# Les e-mails que Supabase envoie

Trois messages partent automatiquement, et aucun n'est écrit par l'application :
c'est Supabase qui les compose, à partir de modèles stockés dans le tableau de
bord. **Ils sont en anglais par défaut.**

Un parent français qui reçoit « *Confirm your signup — Follow this link to
confirm your user* » ne clique pas. Il ne se dit pas que c'est une erreur de
configuration : il se dit que c'est du hameçonnage. Le compte reste non
confirmé, et personne ne saura jamais pourquoi cette famille n'est pas revenue.

Ce fichier contient les trois modèles en français, prêts à coller.

---

## Où les coller

**Authentication → Emails → Templates.** Un onglet par modèle. Pour chacun :
remplacer le **Subject heading** et tout le corps HTML, puis **Save**.

Trois modèles seulement nous concernent :

| Onglet Supabase | Quand il part | Écran d'arrivée |
| --- | --- | --- |
| **Confirm signup** | à la création d'un compte parent | l'application |
| **Reset password** | « mot de passe oublié » | `mino://mot-de-passe` |
| **Change email address** | changement d'adresse dans Réglages | `mino://login` |

Les autres onglets — *Magic Link*, *Invite user*, *Reauthentication* — ne sont
jamais déclenchés par Mino. Les laisser tels quels ne présente aucun risque :
un modèle qui ne part jamais ne dérange personne.

---

## Le réglage sans lequel aucun de ces liens n'ouvre l'application

**Authentication → URL Configuration → Redirect URLs.** Il faut y déclarer les
adresses de retour, une par ligne :

```
mino://**
exp+mino://**
http://localhost:8081/**
http://localhost:8082/**
```

Et, le jour venu, l'adresse du site.

**Ce qui se passe quand elles manquent, et pourquoi c'est déroutant.**
L'application demande bien à Supabase de revenir vers `mino://confirme` — c'est
ce que fait `adresseDeRetour()` dans `SupabaseAuthService`. Mais Supabase
**refuse silencieusement** toute adresse de retour absente de cette liste, et
lui substitue l'« URL du site » du projet. Sur un ordinateur, cette URL est
souvent le serveur de développement, et le lien semble marcher. Sur un
téléphone, elle ne mène nulle part : le parent tape sur le lien de son e-mail,
Safari s'ouvre sur une longue adresse `…supabase.co/auth/v1/verify?token=…`,
et **rien ne se passe**. Le compte est pourtant confirmé — c'est le retour qui
manque, pas la confirmation.

Aucun message d'erreur n'est émis, ni côté application, ni dans les journaux
d'authentification. C'est un réglage de tableau de bord, et il ne se devine
depuis aucune ligne de code.

> Le même réglage conditionne le lien de **réinitialisation du mot de passe**,
> qui est autrement plus grave : un parent qui ne peut pas se reconnecter est un
> parent qui écrit au support, ou qui s'en va.

---

## Deux règles qui expliquent la forme de ces modèles

**Aucune image, aucune police distante.** Pas par pauvreté graphique : une image
hébergée ailleurs est un mouchard. Elle dit à qui la sert que ce parent-là a
ouvert ce message-là, à cette heure-là. Le cahier des charges interdit le
pistage marketing ; il serait absurde de le réintroduire par le pied de page
d'un e-mail. Aucune ressource externe signifie aussi aucune image cassée chez
les clients de messagerie qui les bloquent — c'est-à-dire la plupart.

**Tout est en style *inline*.** Les clients de messagerie — Outlook au premier
rang — jettent les feuilles de style. Ce qui n'est pas écrit sur la balise
elle-même n'existe pas.

`{{ .ConfirmationURL }}` est remplacé par Supabase au moment de l'envoi. Ne pas
y toucher, espaces compris.

---

## 1. Confirm signup

**Subject heading :**

```
Confirmez votre adresse — Mino
```

```html
<div style="margin:0;padding:24px 12px;background:#F2F6FF;font-family:'Nunito',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:480px;margin:0 auto;background:#FFFFFF;border-radius:24px;padding:32px 28px;">

    <p style="margin:0 0 4px;font-size:22px;font-weight:800;color:#1A1D2E;">Mino</p>
    <p style="margin:0 0 24px;font-size:14px;color:#5B6079;">Grandir, une mission à la fois.</p>

    <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#1A1D2E;">
      Bienvenue. Il reste une chose à faire pour ouvrir votre espace parent :
      confirmer que cette adresse est bien la vôtre.
    </p>

    <p style="margin:0 0 24px;text-align:center;">
      <a href="{{ .ConfirmationURL }}"
         style="display:inline-block;background:#4EB6FF;color:#FFFFFF;text-decoration:none;font-size:17px;font-weight:800;padding:16px 32px;border-radius:9999px;">
        Confirmer mon adresse
      </a>
    </p>

    <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#5B6079;">
      Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br>
      <span style="color:#0065AC;word-break:break-all;">{{ .ConfirmationURL }}</span>
    </p>

    <p style="margin:0;padding-top:20px;border-top:1px solid #EDF2FE;font-size:13px;line-height:1.6;color:#5B6079;">
      Vous n'avez pas créé de compte Mino ? Ignorez ce message : sans ce clic,
      aucun compte ne sera ouvert à votre adresse.
    </p>

  </div>
</div>
```

---

## 2. Reset password

Ce lien ramène vers `mino://mot-de-passe`, l'écran de l'application où le
parent choisit son nouveau mot de passe. **Il n'ouvre donc rien sur un
ordinateur** — d'où la phrase qui le dit, plutôt qu'un parent devant une page
blanche.

**Subject heading :**

```
Votre nouveau mot de passe Mino
```

```html
<div style="margin:0;padding:24px 12px;background:#F2F6FF;font-family:'Nunito',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:480px;margin:0 auto;background:#FFFFFF;border-radius:24px;padding:32px 28px;">

    <p style="margin:0 0 4px;font-size:22px;font-weight:800;color:#1A1D2E;">Mino</p>
    <p style="margin:0 0 24px;font-size:14px;color:#5B6079;">Grandir, une mission à la fois.</p>

    <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#1A1D2E;">
      Vous avez demandé à changer votre mot de passe. Ce bouton ouvre Mino sur
      l'écran qui vous permet d'en choisir un nouveau.
    </p>

    <p style="margin:0 0 20px;text-align:center;">
      <a href="{{ .ConfirmationURL }}"
         style="display:inline-block;background:#7A7CFF;color:#FFFFFF;text-decoration:none;font-size:17px;font-weight:800;padding:16px 32px;border-radius:9999px;">
        Choisir un nouveau mot de passe
      </a>
    </p>

    <p style="margin:0 0 24px;padding:14px 16px;background:#F7F9FF;border-radius:16px;font-size:14px;line-height:1.6;color:#1A1D2E;">
      Ce lien ouvre l'application Mino : appuyez dessus depuis le téléphone ou
      la tablette où elle est installée. Il expire au bout d'une heure.
    </p>

    <p style="margin:0;padding-top:20px;border-top:1px solid #EDF2FE;font-size:13px;line-height:1.6;color:#5B6079;">
      Vous n'avez rien demandé ? Ignorez ce message. Votre mot de passe actuel
      reste valable, et personne n'a eu accès à votre compte.
    </p>

  </div>
</div>
```

---

## 3. Change email address

Supabase envoie ce message **aux deux adresses** — l'ancienne et la nouvelle —
et exige un clic sur chacune, parce que *Secure email change* est activé. C'est
volontaire : quelqu'un qui prendrait la main sur un compte ouvert ne pourrait
pas en changer l'adresse sans accéder aussi à l'ancienne boîte.

Le modèle doit donc être lisible dans les deux cas, sans savoir lequel des deux
il est. D'où `{{ .Email }}` et `{{ .NewEmail }}`, tous deux affichés.

**Subject heading :**

```
Confirmez le changement d'adresse — Mino
```

```html
<div style="margin:0;padding:24px 12px;background:#F2F6FF;font-family:'Nunito',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:480px;margin:0 auto;background:#FFFFFF;border-radius:24px;padding:32px 28px;">

    <p style="margin:0 0 4px;font-size:22px;font-weight:800;color:#1A1D2E;">Mino</p>
    <p style="margin:0 0 24px;font-size:14px;color:#5B6079;">Grandir, une mission à la fois.</p>

    <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#1A1D2E;">
      Une demande a été faite pour déplacer votre compte Mino de
      <strong style="color:#0065AC;">{{ .Email }}</strong> vers
      <strong style="color:#0065AC;">{{ .NewEmail }}</strong>.
    </p>

    <p style="margin:0 0 20px;font-size:16px;line-height:1.6;color:#1A1D2E;">
      Par sécurité, ce message part aux deux adresses : le changement ne prendra
      effet que lorsque les deux auront confirmé.
    </p>

    <p style="margin:0 0 24px;text-align:center;">
      <a href="{{ .ConfirmationURL }}"
         style="display:inline-block;background:#2BC98A;color:#FFFFFF;text-decoration:none;font-size:17px;font-weight:800;padding:16px 32px;border-radius:9999px;">
        Confirmer le changement
      </a>
    </p>

    <p style="margin:0;padding-top:20px;border-top:1px solid #EDF2FE;font-size:13px;line-height:1.6;color:#5B6079;">
      Vous n'avez rien demandé ? Ne cliquez pas, et écrivez-nous à
      <span style="color:#0065AC;">contact@minoapp.fr</span> : sans les deux
      confirmations, votre adresse ne change pas.
    </p>

  </div>
</div>
```

---

## L'expéditeur

Le service intégré de Supabase est bridé à quelques envois par heure et n'est
pas destiné à la production — c'est écrit dans leur propre documentation. Il
faut un expéditeur à soi, **européen** puisqu'il verra transiter les adresses
de tous les parents : Brevo, Scaleway ou OVH font l'affaire.

**Authentication → Emails → SMTP Settings.**

| Champ | Valeur |
| --- | --- |
| Sender email | `contact@minoapp.fr` |
| Sender name | `Mino` |
| Host / Port | ceux de l'expéditeur, port **587** |
| Username / Password | la **clé SMTP** de l'expéditeur, pas le mot de passe du compte |

### Deux adresses, une seule boîte

Le dépôt n'en utilise que deux, et il n'en faut pas une de plus :

| Adresse | Où elle apparaît |
| --- | --- |
| `contact@minoapp.fr` | mentions légales, CGV, pied des e-mails — et **expéditeur** |
| `privacy@minoapp.fr` | politique de confidentialité, pour les demandes RGPD |

La seconde n'a pas besoin d'être une boîte : **un alias vers la première
suffit**, et c'est gratuit chez tous les hébergeurs. Le RGPD demande un point de
contact identifiable, pas une personne différente.

> L'expéditeur doit être une adresse à laquelle on peut **répondre**. Un parent
> qui répond à « confirmez votre adresse » pour demander de l'aide ne doit pas
> tomber dans le vide — c'est la première chose qu'il fera quand quelque chose
> lui échappera.

Puis **Authentication → Rate Limits** : le plafond d'e-mails par heure est bas
par défaut. Le monter une fois l'expéditeur en place, sans quoi une journée de
plusieurs inscriptions se fait couper au milieu.

### Le domaine doit être vérifié, et c'est ce qui prend du temps

Trois enregistrements DNS à poser sur `minoapp.fr`, chez l'hébergeur :

- **SPF** — dit quels serveurs ont le droit d'écrire en votre nom ;
- **DKIM** — signe chaque message, pour qu'on ne puisse pas l'imiter ;
- **DMARC** — dit quoi faire des messages qui échouent aux deux premiers.

Sans eux, les mails partent quand même — **et arrivent dans les spams.** Un
parent qui ne reçoit pas sa confirmation ne réclame pas : il s'en va.

La propagation prend de quelques minutes à quelques heures. C'est la raison
pour laquelle cette étape se commence tôt et se termine plus tard, pendant
qu'on fait autre chose.

### L'ordre, parce qu'il compte

1. « Confirm email » **désactivé** — sinon plus aucun compte ne peut être créé
   pendant toute la mise en place, y compris pour vos propres essais.
2. Le compte chez l'expéditeur, les trois DNS.
3. Le domaine vérifié : les identifiants SMTP dans Supabase, les trois modèles
   collés, **un e-mail de test qu'on vérifie reçu en boîte de réception** — pas
   « envoyé sans erreur », *reçu*.
4. **Alors** « Confirm email » réactivé.

L'étape 4 doit être franchie **avant la première famille qui n'est pas la
vôtre**. Sans confirmation, n'importe qui peut ouvrir un compte avec l'adresse
d'un autre. Entre vous et vos enfants, c'est sans conséquence. Avec un inconnu,
non.

---

## Ce qui n'est pas encore envoyé, et ce que ça engage

Trois envois sont écrits côté fonction `courrier` et **ne partent jamais** :
rien ne les déclenche. Les planifications de `supabase/planification.sql` ne
couvrent que les purges.

| Envoi | Quand | Ce que son absence coûte |
|---|---|---|
| `fin_essai` | J-3 avant le premier prélèvement | Un parent débité sans rappel. C'est la première cause de demande de remboursement d'un abonnement à essai. |
| `reconduction` | Entre 3 mois et 1 mois avant l'échéance annuelle | **Une obligation légale**, article L. 215-1 du code de la consommation. |
| `bienvenue` | À la création de la famille | Rien de légal, mais c'est le seul moment où un parent lit ce qu'on lui écrit. |

**Sur `reconduction`, la date est connue.** L'obligation ne vise que les
abonnements dont Agence Wheb est vendeur, c'est-à-dire ceux pris sur le site
via Stripe : pour un abonnement souscrit dans une application, Apple et Google
sont vendeurs et s'en chargent. Le premier abonnement annuel Stripe date du
**9 octobre 2026** ; la fenêtre d'information s'ouvre donc en **juillet 2027**.

**Les CGV ne le promettent plus.** L'article 6 annonçait « Nous vous prévenons
par e-mail avant la fin de la période d'essai » alors que rien ne partait —
corrigé le 9 septembre 2026. La disparition de la clause ne fait pas
disparaître l'obligation légale, elle empêche seulement le contrat de mentir en
attendant.

### La tournée existe désormais

`courrier/lot` est la porte de service : elle cherche les familles dont l'essai
finit dans trois jours et celles dont l'échéance annuelle tombe dans un mois, et
leur écrit. La route ordinaire, elle, n'a pas changé — elle exige toujours un
parent connecté et n'écrit qu'à sa propre famille.

**Pourquoi il a fallu une seconde porte.** `familyOfCaller` exige un parent
connecté, et c'est une propriété de sécurité sur la route ordinaire. Mais une
tâche planifiée n'est le parent de personne : elle ne pouvait tout simplement
pas appeler cette fonction. C'est pour cela que ces trois messages n'étaient
envoyés nulle part alors que leur texte était écrit depuis des semaines.

Le garde est un **secret partagé** (`COURRIER_CRON_SECRET`), pas un jeton
d'utilisateur : il n'y a pas d'utilisateur derrière cet appel. La route est
publique par nécessité, comme les webhooks des boutiques.

`supabase/courriers-planifies.sql` pose la tâche, à 7 h UTC. Il faut d'abord :

1. **Les réglages SMTP** sur les fonctions Edge : `SMTP_HOST`, `SMTP_PORT`,
   `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`, et `MAIL_REPLY_TO` si l'adresse de
   réponse diffère. `SMTP_TLS=true` bascule sur le TLS implicite du port 465,
   que certains hébergeurs imposent ; par défaut c'est 587 et STARTTLS.
2. **Le secret**, fabriqué avec `openssl rand -hex 32`, posé dans les secrets
   des fonctions ET dans le SQL de la tâche. Nulle part ailleurs.

**`bienvenue` reste appelé par l'application**, au moment où le compte se crée :
c'est le seul des trois qui ait un parent connecté sous la main.
