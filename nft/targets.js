"use strict";

// Une seule cible est chargée à la fois : l’aperçu, la page à imprimer et les
// descripteurs NFT utilisent cette même configuration.
window.NFT_TARGETS = Object.freeze({
  mmi: Object.freeze({
    label: "Image MMI avec le logo", image: "./assets/MMI-cible.png",
    descriptors: "./assets/MMI-cible", download: "MMI-cible.png",
    alt: "Cible MMI : lettres MMI crème et violettes au centre du cercle turquoise, avec des triangles colorés.",
    guidance: "Rapproche l’image entière : le logo MMI et les triangles doivent tenir dans le cadre. Garde la photo nette et évite les reflets."
  }),
  photo: Object.freeze({
    label: "Ancienne photo sans logo", image: "./assets/IMG_9765.webp",
    descriptors: "./assets/IMG_9765", download: "IMG_9765.webp",
    alt: "Ancienne cible : cercle turquoise sur un mur clair, entouré de triangles colorés, sans texte.",
    guidance: "Rapproche la photo entière : le cercle et les triangles doivent remplir le cadre. Cette photo nécessite une image très nette."
  })
});
