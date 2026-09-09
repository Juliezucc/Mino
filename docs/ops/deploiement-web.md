# Le déploiement web, et le dossier `public/`

Tout ce qui est ici est recopié tel quel à la racine de l'export web, à chaque
`npx expo export -p web`. C'est le seul endroit d'où un fichier statique
ressort d'un build sans avoir été fabriqué par le bundler.

**Le défaut que ce dossier répare.** `app.minoapp.fr` a été mis en ligne avec un
`.htaccess` et un `robots.txt` déposés à la main sur le serveur. Ils ont
survécu au premier déploiement parce qu'il s'est fait en `rsync` sans
`--delete` — autrement dit par chance. Un déploiement qui remplace le dossier
les effacerait sans un mot, et le sous-domaine s'ouvrirait aux moteurs de
recherche pendant que la redirection page unique cesserait de fonctionner. Rien
n'échouerait visiblement : le site répondrait, simplement plus de la même
façon.

Ce qui compte pour un serveur ne peut pas dépendre de ce qu'un déploiement veut
bien laisser en place.

## Ce qui doit s'y trouver

| Fichier | Rôle |
|---|---|
| `robots.txt` | **autorise** l'exploration, et c'est exprès : l'interdiction d'indexer est un en-tête servi par `.htaccess`, qu'un robot empêché de charger la page ne lirait jamais |
| `.htaccess` | la redirection page unique vers `index.html`, sans laquelle toute adresse autre que `/` rend une erreur 404 d'Apache avant même qu'expo-router ne soit chargé — **et** l'en-tête `X-Robots-Tag: noindex`, la seule chose qui tienne réellement le sous-domaine hors des moteurs. C'est cette ligne-là qu'on retire au lancement. |

Le `.htaccess` en place sur le serveur fonctionne ; il n'est simplement versionné
nulle part. Le déposer ici le met à l'abri du prochain déploiement, et le rend
relisible par quelqu'un d'autre que celui qui l'a écrit.

> Les fichiers commençant par un point sont facilement ignorés par les outils de
> copie. Après le premier export qui inclura `.htaccess`, vérifier qu'il est
> bien arrivé dans `dist/` avant de publier — une fois, et on n'y pense plus.

## Ce dossier est publié en entier

Tout ce qu'on y dépose se retrouve à la racine du site, lisible par n'importe
qui. Ce document a d'ailleurs commencé sa vie dans `public/README.md`, avant
qu'un export ne le fasse apparaître à côté de `robots.txt` — il aurait été
servi sur `app.minoapp.fr/README.md`.

La règle : dans `public/`, uniquement ce qu'un visiteur a le droit de lire.
L'explication, elle, vit ici.

---

## Fabriquer l'export, et vérifier qu'il n'est pas creux

```
npx expo export -p web --output-dir dist --clear
grep -c "bpnmmkignvpysbkcfpzz" dist/_expo/static/js/web/*.js
ls -la dist/.htaccess dist/robots.txt
```

**`--clear` n'est pas une précaution, c'est une nécessité.** Les trois variables
`EXPO_PUBLIC_*` sont inscrites **en dur dans le code au moment de la
transformation**, pas lues à l'exécution. Metro garde les modules transformés en
cache : tant qu'il resservira ceux d'avant, les variables resteront vides quoi
que contienne `.env`. Le 9 septembre 2026, quatre exports successifs ont produit
exactement le même paquet — même nom de fichier — pendant qu'on cherchait
l'erreur ailleurs. Le premier assemblage prend une dizaine de secondes, les
suivants moins d'une demi-seconde : **une durée d'une demi-seconde est le signe
qu'il ne s'est rien reconstruit.**

**Les deux vérifications, et pourquoi elles existent.**

Le `grep` cherche la référence du projet Supabase à l'intérieur du paquet. Sans
elle, l'application bascule sur son dépôt local : elle s'affiche parfaitement,
ne parle à aucun serveur, n'encaisse rien et n'envoie aucun e-mail — **sans
qu'aucune erreur n'apparaisse nulle part**. C'est le seul défaut de ce
déploiement qui soit entièrement silencieux, et il se détecte en une commande.

Le `ls` vérifie que `.htaccess` et `robots.txt` sont bien sortis de `public/`.
Ils ne figurent pas dans la liste « Files » qu'affiche Expo, ce qui ne veut pas
dire qu'ils manquent — mais les fichiers commençant par un point sont
couramment ignorés par les clients FTP, donc il faut les voir des deux côtés.

**Et `.env` n'est pas versionné.** Il vit sur la machine qui exporte. Une
machine neuve exporte donc un paquet creux du premier coup, et le `grep`
ci-dessus est ce qui l'attrape.
