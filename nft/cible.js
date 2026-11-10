"use strict";

(() => {
  const key = new URLSearchParams(location.search).get("cible") === "photo" ? "photo" : "mmi";
  const target = window.NFT_TARGETS[key];
  const image = document.getElementById("cible-image");
  image.src = target.image;
  image.alt = target.alt;
  document.getElementById("cible-nom").textContent = target.label;
  const download = document.getElementById("telecharger-cible");
  download.href = target.image;
  download.download = target.download;
  document.getElementById("ouvrir-scanner").href = "./?cible=" + key;
  const select = document.getElementById("choix-cible");
  select.value = key;
  select.addEventListener("change", () => {
    const url = new URL(location.href);
    url.searchParams.set("cible", select.value);
    location.href = url.href;
  });
})();
