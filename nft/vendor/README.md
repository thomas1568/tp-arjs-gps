# AR.js 3.4.7 — copie locale

Source : [aframe-ar-nft.js, tag 3.4.7](https://github.com/AR-js-org/AR.js/blob/3.4.7/aframe/build/aframe-ar-nft.js).
Licence d’origine : [LICENSE](./LICENSE).

Une première modification remplace l’abonnement au signal `arjs-video-loaded` dans l’initialisation du worker NFT :

- Si la vidéo existe déjà, utiliser directement cet élément.
- Attendre une première image vidéo utilisable (`videoWidth > 0`, `readyState >= 2`).
- Initialiser chaque worker une seule fois, quel que soit l’ordre de chargement de la caméra et du moteur AR.

La version d’origine attend uniquement un événement futur et reste bloquée lorsque la caméra est prête avant l’abonnement du worker (notamment si la permission est déjà accordée).

Une seconde modification remplace les expressions régulières de résolution d’URL du worker par `new URL()`. Cela prend en charge localhost et les adresses IP avec un port. Le scanner transmet une URL absolue des descripteurs pour conserver le sous-dossier GitHub Pages `/tp-arjs-gps/nft/`.

Une troisième modification utilise les dimensions natives de la vidéo (`videoWidth` / `videoHeight`) pour analyser l’image, plutôt que ses dimensions CSS. Le worker extrait le rectangle 4/3 central du capteur, correspondant au cadre de visée, et le traite en 640 × 480 pixels. Ainsi, une vidéo verticale conserve les détails de la photo sans créer un grand canvas rempli de bandes noires. Le composant `align-video-overlay` adapte la projection 3D au recadrage effectué dans le worker, et affiche toute la vidéo entre les commandes.

SHA-256 du fichier d’origine : `6313624c231e65fdeb095e886c5edfe8a454d4e220206ade94fec0164c457d9a`.
SHA-256 du fichier corrigé : `0c00db6fe02a18469aa15e1d3f3724c24d7e0fe6b6d7c1b2f481d2b641c69a37`.

Pour reproduire la modification, le corps du callback `window.addEventListener("arjs-video-loaded", …)` est conservé et appelé par le bloc `function(startNFT)` ajouté dans le fichier. Dans le worker intégré, les deux tests d’URL sont remplacés par `new URL(A.param, C + "/").href` et `new URL(A.marker, C + "/").href`. Dans le callback vidéo, `i` et `o` sont les dimensions du rectangle 4/3 central dans le flux natif, `cropX` et `cropY` son origine, et la destination est fixée à 640 × 480. L’appel de `drawImage()` utilise ce rectangle comme source. Le reste du bundle est inchangé.
