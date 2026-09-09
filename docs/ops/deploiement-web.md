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
| `robots.txt` | interdit l'indexation tant que les applications ne sont pas sur les boutiques — **à lever au lancement**, voir le fichier lui-même |
| `.htaccess` | *à ajouter par la session du site* : la redirection page unique vers `index.html`, sans laquelle toute adresse autre que `/` rend une erreur 404 d'Apache avant même qu'expo-router ne soit chargé |

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
