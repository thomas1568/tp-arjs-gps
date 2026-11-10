"use strict";

(() => {
  const element = (id) => document.getElementById(id);
  const state = { active: false, camera: false, nft: false, model: false, found: false, error: "", slow: false, searchingLong: false };
  const ui = {
    home: element("accueil"), start: element("demarrer"), interface: element("interface"),
    title: element("etat-titre"), message: element("etat-message"),
    camera: element("etat-camera"), nft: element("etat-nft"), model: element("etat-modele"),
    resume: element("reprendre"), retry: element("reessayer")
  };
  let scene, character, anchor, video, modelBounds, watchdog, searchTimer;
  // Métadonnées du fichier IMG_9765.iset, mises à jour par AR.js au chargement.
  let markerInfo = { width: 1280, height: 960, dpi: 106 };

  function renderStatus() {
    for (const [key, label] of [["camera", "Caméra"], ["nft", "Image"], ["model", "3D"]]) {
      ui[key].textContent = label + (state[key] ? " : prête" : " : en attente");
      ui[key].classList.toggle("pret", state[key]);
    }
    ui.interface.classList.toggle("erreur", Boolean(state.error));
    ui.interface.classList.toggle("reconnue", state.found && !state.error);
    ui.retry.hidden = !state.error && !state.slow;
    if (state.error) {
      ui.title.textContent = "Le scanner a besoin de ton aide";
      ui.message.textContent = state.error;
    } else if (state.camera && state.nft && state.model) {
      clearTimeout(watchdog);
      ui.retry.hidden = true;
      if (!state.found && !searchTimer) {
        searchTimer = setTimeout(() => { state.searchingLong = true; renderStatus(); }, 10000);
      }
      ui.title.textContent = state.found ? "Image reconnue !"
        : state.searchingLong ? "L’image n’est pas encore reconnue" : "Place la photo dans le cadre";
      ui.message.textContent = state.found
        ? "Le personnage suit l’image. Garde-la dans le cadre."
        : "Rapproche la photo entière : le cercle ET les triangles doivent remplir le cadre. Évite les reflets et attends quelques secondes.";
    } else {
      ui.title.textContent = "Préparation du scanner…";
      ui.message.textContent = state.slow
        ? "Le chargement prend du temps. Vérifie la connexion et l’autorisation de la caméra, puis réessaie si nécessaire."
        : !state.camera
          ? "Autorise la caméra. Si la vidéo reste en pause, touche « Activer la vidéo »."
          : "Chargement de la reconnaissance et du modèle 3D (environ 10 Mo)…";
    }
  }

  function fail(message) {
    state.error = message;
    clearTimeout(watchdog);
    clearTimeout(searchTimer);
    renderStatus();
  }

  function loadScript(url, label) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      const timer = setTimeout(() => reject(new Error("Le chargement de " + label + " a expiré. Vérifie ta connexion, puis réessaie.")), 30000);
      script.src = url;
      script.onload = () => { clearTimeout(timer); resolve(); };
      script.onerror = () => {
        clearTimeout(timer);
        reject(new Error("Impossible de charger " + label + ". Vérifie ta connexion, puis réessaie."));
      };
      document.head.appendChild(script);
    });
  }

  function fitModel() {
    if (!anchor || !modelBounds) return;
    const width = markerInfo.width / markerInfo.dpi * 25.4;
    const height = markerInfo.height / markerInfo.dpi * 25.4;
    // L’origine NFT est un coin de l’image. Le plan de l’image est X/Z,
    // L’ancrage tourne le personnage pour présenter son visage devant l’image.
    anchor.object3D.position.set(width / 2, 0, -height / 2);
    const scale = Math.min(width, height) * 0.65 / modelBounds.height;
    character.object3D.scale.setScalar(scale);
    character.object3D.position.set(
      -modelBounds.centerX * scale,
      -modelBounds.centerY * scale,
      -modelBounds.centerZ * scale
    );
  }

  function updateVideoState() {
    state.camera = Boolean(video && video.videoWidth > 0 && video.readyState >= 2 && !video.paused);
    ui.resume.hidden = !video || !video.paused || Boolean(state.error);
    renderStatus();
  }

  async function playVideo() {
    if (!video) return;
    try {
      await video.play();
    } catch (error) {
      // Sur iPhone, la lecture peut nécessiter un nouveau geste de l’utilisateur.
      ui.resume.hidden = false;
    }
    updateVideoState();
  }

  function attachVideo(cameraVideo) {
    if (!cameraVideo || cameraVideo === video) return;
    video = cameraVideo;
    video.muted = true;
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
    for (const event of ["loadeddata", "playing", "pause", "emptied"]) {
      video.addEventListener(event, updateVideoState);
    }
    playVideo();
  }

  // Enregistrer les événements avant d’insérer la scène, pour ne pas manquer
  // les chargements rapides du GLB, de la caméra ou des descripteurs NFT.
  window.addEventListener("arjs-video-loaded", (event) => {
    attachVideo(event.detail && event.detail.component || element("arjs-video"));
  });
  window.addEventListener("camera-error", () => {
    fail("Impossible d’ouvrir la caméra. Autorise son accès dans les réglages du site et ferme les autres applications qui l’utilisent. Sur téléphone, ouvre le lien directement dans Safari ou Chrome.");
  });
  window.addEventListener("arjs-nft-init-data", (event) => {
    const data = event.detail;
    if (data && [data.width, data.height, data.dpi].every((value) => Number.isFinite(value) && value > 0)) {
      markerInfo = data;
      fitModel();
    }
  });
  window.addEventListener("arjs-nft-loaded", () => {
    state.nft = true;
    renderStatus();
  });

  ui.start.addEventListener("click", async () => {
    if (state.active) return;
    if (!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      element("message-accueil").textContent = "La caméra nécessite le site en HTTPS. Ouvre l’adresse GitHub Pages dans Safari ou Chrome.";
      return;
    }
    state.active = true;
    ui.start.disabled = true;
    ui.home.hidden = true;
    ui.interface.hidden = false;
    document.body.classList.add("scan-actif");
    renderStatus();
    try {
      await loadScript("https://aframe.io/releases/1.6.0/aframe.min.js", "A-Frame");
      await loadScript("./vendor/aframe-ar-nft-3.4.7.js?v=20261110-2", "AR.js");
      if (!window.AFRAME || !AFRAME.primitives.primitives["a-nft"]) {
        throw new Error("La reconnaissance d’image n’a pas pu démarrer. Recharge la page pour réessayer.");
      }
      // Montrer tout le capteur, sans zoom en portrait : la photo peut alors
      // remplir le cadre tout en restant entièrement visible et assez détaillée.
      AFRAME.registerComponent("align-video-overlay", {
        init() {
          this.renderSize = new AFRAME.THREE.Vector2();
          this.projection = new AFRAME.THREE.Matrix4();
          this.projectionKey = "";
          this.previousBeforeRender = this.el.object3D.onBeforeRender;
          this.el.object3D.onBeforeRender = (renderer, world, camera) => {
            if (this.previousBeforeRender) this.previousBeforeRender.call(world, renderer, world, camera);
            // AR.js rétablit sa projection pendant le tick : appliquer celle
            // du recadrage juste avant le rendu pour conserver les proportions.
            if (this.projectionKey) {
              camera.projectionMatrix.copy(this.projection);
              camera.projectionMatrixInverse.copy(this.projection).invert();
            }
          };
        },
        remove() { this.el.object3D.onBeforeRender = this.previousBeforeRender; },
        tick() {
          const cameraVideo = element("arjs-video");
          const renderer = this.el.renderer;
          const canvas = this.el.canvas;
          if (!cameraVideo || !cameraVideo.videoWidth || !renderer || !canvas) return;
          const top = document.querySelector(".etat").getBoundingClientRect().bottom + 12;
          const bottom = document.querySelector(".commandes").getBoundingClientRect().top - 12;
          const availableHeight = Math.max(100, bottom - top);
          const ratio = Math.min((window.innerWidth - 24) / cameraVideo.videoWidth,
            availableHeight / cameraVideo.videoHeight);
          const width = Math.round(cameraVideo.videoWidth * ratio);
          const height = Math.round(cameraVideo.videoHeight * ratio);
          const left = (window.innerWidth - width) / 2;
          const offsetTop = top + (availableHeight - height) / 2;
          const styles = { width: width + "px", height: height + "px",
            marginLeft: left + "px", marginTop: offsetTop + "px" };
          // AR.js réécrit ses styles en cours de rendu. Les variables CSS
          // communes gardent la vidéo et le canvas cadrés de la même façon.
          const cssKeys = { width: "--camera-width", height: "--camera-height",
            marginLeft: "--camera-left", marginTop: "--camera-top" };
          for (const [key, value] of Object.entries(styles)) {
            const name = cssKeys[key];
            if (document.documentElement.style.getPropertyValue(name) !== value) {
              document.documentElement.style.setProperty(name, value);
            }
          }
          renderer.getSize(this.renderSize);
          if (this.renderSize.x !== width || this.renderSize.y !== height) renderer.setSize(width, height, false);
          if (renderer.getPixelRatio() > 2) renderer.setPixelRatio(2);
          const guide = element("viseur");
          guide.style.width = Math.min(width * 0.82, height * 0.82 * 4 / 3) + "px";
          guide.style.left = (left + width / 2) + "px";
          guide.style.top = (offsetTop + height / 2) + "px";

          // Le worker analyse le rectangle 4/3 central du capteur.
          // Reprojeter cette zone dans la vidéo entière, même en portrait.
          const context = this.el.systems.arjs && this.el.systems.arjs._arSession && this.el.systems.arjs._arSession.arContext;
          if (context && context.arController && this.el.camera) {
            const key = cameraVideo.videoWidth + "x" + cameraVideo.videoHeight;
            if (key !== this.projectionKey) {
              const cropWidth = Math.min(cameraVideo.videoWidth, cameraVideo.videoHeight * 4 / 3);
              const cropHeight = cropWidth * 3 / 4;
              const scaleX = cropWidth / cameraVideo.videoWidth;
              const scaleY = cropHeight / cameraVideo.videoHeight;
              this.projection.copy(context.getProjectionMatrix());
              for (const index of [0, 4, 8, 12]) this.projection.elements[index] *= scaleX;
              for (const index of [1, 5, 9, 13]) this.projection.elements[index] *= scaleY;
              this.projectionKey = key;
            }
          }
        }
      });
      scene = element("scene-template").content.firstElementChild.cloneNode(true);
      character = scene.querySelector("#personnage");
      anchor = scene.querySelector("#ancrage");
      const marker = scene.querySelector("#marqueur");
      // Le worker AR.js doit recevoir l’URL complète, y compris /tp-arjs-gps/nft/.
      marker.setAttribute("url", new URL(marker.getAttribute("url"), window.location.href).href);
      scene.addEventListener("renderstart", () => scene.renderer.setClearColor(0x000000, 0));
      scene.addEventListener("render-target-loaded", () => attachVideo(element("arjs-video")));
      scene.addEventListener("webglcontextlost", () => fail("L’affichage 3D a été interrompu. Ferme les autres onglets, puis réessaie."));
      character.addEventListener("model-loaded", () => {
        const mesh = character.getObject3D("mesh");
        // Une copie sans parent permet de mesurer le modèle indépendamment
        // de la pose courante du marqueur et sans modifier ses géométries.
        const bounds = new AFRAME.THREE.Box3().setFromObject(mesh.clone(true));
        const center = bounds.getCenter(new AFRAME.THREE.Vector3());
        const height = bounds.max.y - bounds.min.y;
        if (!Number.isFinite(height) || height <= 0) {
          fail("Les dimensions du modèle 3D ne permettent pas de l’afficher.");
          return;
        }
        modelBounds = { height, centerX: center.x, centerY: center.y, centerZ: center.z };
        fitModel();
        state.model = true;
        renderStatus();
      });
      character.addEventListener("model-error", () => fail("Impossible de charger le personnage 3D. Vérifie que le fichier assets/personnage.glb est bien publié sur GitHub Pages."));
      marker.addEventListener("markerFound", () => {
        state.found = true;
        state.searchingLong = false;
        clearTimeout(searchTimer);
        searchTimer = null;
        renderStatus();
      });
      marker.addEventListener("markerLost", () => { state.found = false; renderStatus(); });
      document.body.appendChild(scene);
      watchdog = setTimeout(() => { state.slow = true; renderStatus(); }, 45000);
    } catch (error) {
      fail(error.message || "Impossible de démarrer le scanner. Recharge la page pour réessayer.");
    }
  });

  ui.resume.addEventListener("click", playVideo);
  ui.retry.addEventListener("click", () => window.location.reload());
  element("retour").addEventListener("click", () => window.location.reload());
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && state.active) playVideo();
  });
  window.addEventListener("pagehide", () => {
    if (video && video.srcObject) video.srcObject.getTracks().forEach((track) => track.stop());
  });
  window.addEventListener("pageshow", (event) => {
    if (event.persisted && state.active) window.location.reload();
  });
})();
