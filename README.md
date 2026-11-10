# TP AR.js — Reconnaissance d’image NFT

Le scanner reconnaît l’image `nft/assets/IMG_9765.webp` et joue l’animation `assets/MMI-anime.gif`, fournie pour le projet, sur cette image. Il utilise le suivi NFT (Natural Feature Tracking) d’AR.js, sans position GPS.

## Essayer sur téléphone

1. Publier les fichiers sur la branche utilisée par GitHub Pages, en conservant toute l’arborescence.
2. Sur un ordinateur, ouvrir [l’image à scanner](https://thomas1568.github.io/tp-arjs-gps/nft/cible.html), ou l’imprimer.
3. Sur le téléphone, ouvrir [le projet](https://thomas1568.github.io/tp-arjs-gps/) dans Safari ou Chrome. La page principale redirige vers `/nft/`.
4. Toucher **Démarrer le scanner**, autoriser la caméra et attendre les trois indicateurs de chargement.
5. La vidéo montre désormais tout le capteur, sans zoom qui recadre la photo en portrait. Rapprocher la photo entière pour remplir le cadre, cercle et triangles compris, avec une bonne lumière et sans reflet. Le GIF couvre la photo et joue en boucle. Il est masqué et mis en pause lorsque la photo sort du champ ; il redémarre à la prochaine reconnaissance.

Sur iPhone, si la vidéo ne démarre pas, toucher **Activer la vidéo**. Si Safari bloque la lecture, toucher **Activer l’animation** après reconnaissance de la photo. Le lien [camera-test.html](./camera-test.html) permet de vérifier séparément l’autorisation de la caméra.

## Fichiers

- `index.html` : accès au scanner depuis la racine GitHub Pages.
- `nft/index.html` : interface et scène A-Frame.
- `nft/scanner.js` : démarrage, événements caméra/NFT, positionnement et lecture de l’animation.
- `nft/scanner.css` : présentation mobile ; la vidéo entière reste visible entre les commandes ; les dimensions vidéo/canvas sont synchronisées pour éviter les déformations en portrait.
- `nft/cible.html` : image cible à afficher, télécharger ou imprimer.
- `nft/assets/IMG_9765.fset`, `.fset3`, `.iset` : descripteurs de reconnaissance déjà présents.
- `assets/MMI-anime.gif` : GIF original fourni (60 images, 3 secondes, 1280 × 960).
- `assets/MMI-anime.mp4` : version H.264 silencieuse utilisée comme texture animée sur le téléphone.
- `assets/personnage.glb` : ancien modèle conservé dans le dépôt, qui n’est plus chargé par le scanner.

Aucune compilation n’est nécessaire. A-Frame 1.6.0 est chargé depuis son CDN au démarrage. AR.js 3.4.7 est inclus dans `nft/vendor/` avec une correction du démarrage quand la caméra est prête avant le moteur NFT. Le détail de cette correction et la licence sont dans [nft/vendor/README.md](./nft/vendor/README.md). Une connexion Internet reste nécessaire pour A-Frame et les paramètres caméra d’AR.js. La caméra nécessite HTTPS (fourni par GitHub Pages) ou localhost.

Pour une vérification locale : `python -m http.server 8000`, puis ouvrir `http://localhost:8000/` sur cet ordinateur. Sur téléphone, utiliser l’URL HTTPS GitHub Pages.

## Changer l’image ou l’animation

Pour changer l’image, générer les trois nouveaux descripteurs avec [NFT Marker Creator](https://carnaux.github.io/NFT-Marker-Creator/), les placer ensemble dans `nft/assets/`, puis remplacer l’URL de `<a-nft>` dans `nft/index.html` (sans extension). Mettre aussi à jour l’aperçu dans les deux pages HTML. Les métadonnées reçues d’AR.js recentrent automatiquement le modèle sur la cible.

Pour changer l’animation, remplacer `assets/MMI-anime.gif` puis convertir une boucle en H.264 silencieux :

```sh
ffmpeg -y -ignore_loop 1 -i assets/MMI-anime.gif -an -c:v libx264 -profile:v baseline -level:v 3.1 -pix_fmt yuv420p -crf 18 -movflags +faststart assets/MMI-anime.mp4
```

Le scanner lit le MP4 avec `<a-video>` pour actualiser la texture en continu. Le GIF original reste disponible depuis l’accueil. La vidéo est muette, en boucle et `playsinline` ; sa lecture est amorcée par le bouton de démarrage. L’animation est centrée sur la cible et ses proportions sont conservées.


La reconnaissance analyse la zone centrale 4/3 en 640 × 480 pixels, que la caméra fournisse un flux paysage ou portrait. Cette zone correspond au cadre de visée. La projection de l’animation prend en compte ce recadrage. Après dix secondes sans reconnaissance, l’interface donne une indication explicite ; la recherche continue.

Les paramètres de stabilisation se nomment `smooth-count`, `smooth-tolerance` et `smooth-threshold` dans la balise `<a-nft>`.

## Crédits et références

- Ancien modèle conservé : [MENS, par kwong.x](https://sketchfab.com/3d-models/mens-a400147bb3cb4bd0b36b8ed245d0b5b5), sous licence [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Le modèle n’est plus affiché dans le scanner.
- [Documentation AR.js : suivi d’image NFT](https://ar-js-org.github.io/AR.js-Docs/image-tracking/).
- Support du TD : B3MAR56-TD7-AR.js, partie « Marker sous forme d’image » (pages 9 à 11).

## Vérification sur téléphone

Si la photo n’est pas reconnue, ouvrir **Vérifier l’image analysée** dans le scanner. Cet aperçu vient du buffer effectivement envoyé au moteur NFT. La photo complète doit y apparaître, avec une image qui s’actualise. **Copier le diagnostic** fournit la version, les dimensions du flux et du recadrage, le compteur d’images et l’éventuelle erreur. Si la copie n’est pas disponible, le texte est affiché pour une copie manuelle.

Le recadrage est recalculé pour chaque image afin de suivre les changements de résolution du flux vidéo après son démarrage. Voir [l’événement resize de HTMLVideoElement](https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/resize_event).

La régression peut être testée avec Node.js et Chrome : `node tests/nft-browser.mjs`. Le mode par défaut démarre une caméra simulée en 320 × 240, attend le chargement NFT puis change le flux en 960 × 1280 avant de présenter la photo. Le test vérifie la reconnaissance, le buffer réellement analysé, les proportions de l’animation, la progression de la vidéo, la mise à jour de sa texture, la pause à la perte de la cible et les erreurs caméra/média. `CHROME_PATH` permet de préciser le chemin du navigateur ; `node tests/nft-browser.mjs portrait` ou `node tests/nft-browser.mjs landscape` sélectionne un flux fixe.
