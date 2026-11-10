# TP AR.js — Reconnaissance d’image NFT

Le scanner reconnaît l’image `nft/assets/IMG_9765.webp` et affiche le modèle `assets/personnage.glb` sur cette image. Il utilise le suivi NFT (Natural Feature Tracking) d’AR.js, sans position GPS.

## Essayer sur téléphone

1. Publier les fichiers sur la branche utilisée par GitHub Pages, en conservant toute l’arborescence.
2. Sur un ordinateur, ouvrir [l’image à scanner](https://thomas1568.github.io/tp-arjs-gps/nft/cible.html), ou l’imprimer.
3. Sur le téléphone, ouvrir [le projet](https://thomas1568.github.io/tp-arjs-gps/) dans Safari ou Chrome. La page principale redirige vers `/nft/`.
4. Toucher **Démarrer le scanner**, autoriser la caméra et attendre les trois indicateurs de chargement.
5. Viser l’image entière avec une bonne lumière, sans reflet. Le personnage apparaît au centre et disparaît quand l’image sort du champ.

Sur iPhone, si la vidéo ne démarre pas, toucher **Activer la vidéo**. Le fichier GLB fait environ 10 Mo : le premier chargement peut prendre quelques secondes. Le lien [camera-test.html](./camera-test.html) permet de vérifier séparément l’autorisation de la caméra.

## Fichiers

- `index.html` : accès au scanner depuis la racine GitHub Pages.
- `nft/index.html` : interface et scène A-Frame.
- `nft/scanner.js` : démarrage, événements caméra/NFT, dimensionnement et centrage du GLB.
- `nft/scanner.css` : présentation mobile ; les dimensions vidéo/canvas sont synchronisées pour éviter les déformations en portrait.
- `nft/cible.html` : image cible à afficher, télécharger ou imprimer.
- `nft/assets/IMG_9765.fset`, `.fset3`, `.iset` : descripteurs de reconnaissance déjà présents.
- `assets/personnage.glb` : modèle 3D déjà présent.

Aucune compilation n’est nécessaire. A-Frame 1.6.0 est chargé depuis son CDN au démarrage. AR.js 3.4.7 est inclus dans `nft/vendor/` avec une correction du démarrage quand la caméra est prête avant le moteur NFT. Le détail de cette correction et la licence sont dans [nft/vendor/README.md](./nft/vendor/README.md). Une connexion Internet reste nécessaire pour A-Frame et les paramètres caméra d’AR.js. La caméra nécessite HTTPS (fourni par GitHub Pages) ou localhost.

Pour une vérification locale : `python -m http.server 8000`, puis ouvrir `http://localhost:8000/` sur cet ordinateur. Sur téléphone, utiliser l’URL HTTPS GitHub Pages.

## Changer l’image ou le modèle

Pour changer l’image, générer les trois nouveaux descripteurs avec [NFT Marker Creator](https://carnaux.github.io/NFT-Marker-Creator/), les placer ensemble dans `nft/assets/`, puis remplacer l’URL de `<a-nft>` dans `nft/index.html` (sans extension). Mettre aussi à jour l’aperçu dans les deux pages HTML. Les métadonnées reçues d’AR.js recentrent automatiquement le modèle sur la cible.

Pour changer le modèle, remplacer `assets/personnage.glb`, ou modifier `gltf-model` dans `nft/index.html`. Le script ramène sa hauteur à 65 % du petit côté de la cible et le centre face à la caméra, devant l’image. L’ancrage utilise une rotation de -90° autour de X pour montrer le personnage de face lorsque l’image est vue de face. Le GLB doit utiliser l’axe Y vers le haut. Ce modèle ne contient pas d’animation.

Les paramètres de stabilisation se nomment `smooth-count`, `smooth-tolerance` et `smooth-threshold` dans la balise `<a-nft>`.

## Crédits et références

- Modèle : [MENS, par kwong.x](https://sketchfab.com/3d-models/mens-a400147bb3cb4bd0b36b8ed245d0b5b5), sous licence [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Le modèle est affiché avec une position et une échelle adaptées à la cible.
- [Documentation AR.js : suivi d’image NFT](https://ar-js-org.github.io/AR.js-Docs/image-tracking/).
- Support du TD : B3MAR56-TD7-AR.js, partie « Marker sous forme d’image » (pages 9 à 11).
