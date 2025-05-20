// ----------------------------- DÉCLARATION DES VARIABLES --------------------------------
// A changer si cloud-4 => https
let protocol = "http";
let cloud = null;
$db_dev = "HN_FIMAINFO";
let db_client = null;

// ----------------------------------------------------------------------------------------
let agentInfo = {};

$agentData = {};
let customerId = null;
let agentCode = null;
let agentOid = null;

// Variables pour le compteur
let nextUpdateTime = null;
let updateCountdownInterval = null;
const UPDATE_INTERVAL_MS = 70000; // 1.2 min

// Variables pour stocker les données des appels perdus
$lostCallsData = [];
$frCallsCount = 0;
$nlCallsCount = 0;

// =============================================================================================
// =============================================================================================
/* Pour deployer la clochette chez Nouveau Client, il faut SEULEMENT rajouter une ligne comme :
 => db_client = "HN_EXEMPLE"; 
 dans la condition de Cloud concerné de la fonction recupDb(customerId) */
// =============================================================================================
// Fonction qui switch les noms de DB en fonctionne de CustomerId et Cloud
async function recupDb(customerId) {
 // Convertir customerId en string pour assurer la comparaison correcte dans le switch
 customerId = String(customerId);
 console.warn('CustomerId converti en string:', customerId, 'type:', typeof customerId);

 if (cloud == "192.168.9.236") {

  switch (customerId) {
   case "12":
    db_client = "HN_BERNARD";
    break;
   case "13":
    db_client = "HN_BERNIER";
    break;
   case "4":
    db_client = "HN_CHOPARD";
    break;
   case "9":
    db_client = "HN_CRC";
    break;
  }
 }

 else if (cloud == "192.168.9.237") {
  switch (customerId) {
   case "7":
    db_client = "HN_JMJ";
    break;
   case "14":
    db_client = "HN_CCF_BORDEAUX";
    break;
   case "31":
    db_client = "HN_GUYOT";
    break;
  }
 }

 else if (cloud == "c4-web.fimainfo.fr") {
  switch (customerId) {
   case "14":
    db_client = "HN_CCF_BORDEAUX";
    break;
   case "31":
    db_client = "HN_GUYOT";
    break;
  }
 }

 else if (cloud == "steweb01.ibermaticacloud.com") {
  console.warn('+++++++++++++++++++++++++++++++++++++++++++++++++++++++');

  switch (customerId) {
   case "9":
    db_client = "HN_CCF_BELGIQUE";
    break;
   case "11":
    db_client = "HN_CCF_MADRID";
    break;
  }
 }

 console.warn('++==============================================++++');

 console.table({
  "CustomerId": customerId,
  "Cloud": cloud,
  "Database client": db_client
 }

 );
 return db_client;
}

// =============================================================================================
// =============================================================================================

// ----------------------------- REQUÊTES SQL DE LA CLOCHETTE -----------------------------------

async function reqSelectAgentData() {
 let selectDataAgent = ``;

 if (agentInfo?.agentCode && agentInfo?.agentOid) {
  selectDataAgent = ` SELECT * FROM [HN_FIMAINFO].[dbo].[AgentIdentData] WHERE AgentOid='${agentInfo.agentOid}'

      AND AgentCode=$ {
         agentInfo.agentCode
      }

      `;
  console.warn('selectDataAgent :', selectDataAgent);
 }

 try {
  const result = await reqSelect(db_client, selectDataAgent);

  if (result && typeof result === 'object' && Object.keys(result).length > 0) {
   $agentData = result;
   console.warn('agentData :', $agentData);
  }

  else {
   console.warn('Le résultat de la requête est vide ou incorrect');
  }
 }

 catch (error) {
  console.error("Erreur lors de l'exécution de la requête :", error);

  $agentData = {}

   ;
 }
}

// Fonction qui récupère les données des appels perdus
async function reqSelectLostCalls() {
 const selectLostCalls = ` SELECT * FROM [HN_FIMAINFO].[dbo].[LostCallsPending_clochette] `;
 console.warn('reqSelectLostCalls', selectLostCalls);

 try {
  const result = await reqSelect(db_client, selectLostCalls);
  $lostCallsData = result;

  // Compter les appels par pays
  $frCallsCount = 0;
  $nlCallsCount = 0;

  if (Array.isArray($lostCallsData)) {
   $lostCallsData.forEach(row => {
    if (row.Country === 'FR') {
     $frCallsCount++;
    }

    else if (row.Country === 'NL') {
     $nlCallsCount++;
    }
   }

   );
  }

  console.log("Données d'appels perdus mises à jour:", {
   total: $lostCallsData.length,
   FR: $frCallsCount,
   NL: $nlCallsCount
  }

  );

  return $lostCallsData;
 }

 catch (error) {
  console.error("Erreur lors de la récupération des appels perdus:", error);
  $lostCallsData = [];
  $frCallsCount = 0;
  $nlCallsCount = 0;
  return [];
 }
}

// ----------------------------- FONCTIONS UTILITAIRES ------------------------------------ 

// Fonction qui check URL pour cibler le CLOUD est le mettre dans la variable
function checkURL() {
 const url = window.location.hostname;
 let cloud = url;
 console.log('cloud:', cloud);
 return cloud;
}

// Fonction qui extrait les données de AgentLink
async function findAgentData() {
 try {
  const result = await GetAgentLink();
  agentCode = result.AgentCode;
  agentOid = result.AgentOid;
  customerId = result.CustomerId;

  if (!agentCode || !agentOid || !customerId) {
   console.error("Erreur: agentCode, agentOid ou customerId sont manquants dans le résultat de GetAgentLink().");

   return {
    agentCode: null, agentOid: null, customerId: null
   };
  }
  console.warn("Extrait de AgentLink:", {
   agentCode, agentOid, customerId
  });
  return {
   agentCode,
   agentOid,
   customerId
  };
 }

 catch (error) {
  console.error("Erreur lors de l'appel de GetAgentLink :", error);
  return {
   agentCode: null, agentOid: null, customerId: null
  };
 }
}

// Fonction pour charger le fichier CSS personnalisé dans DOM de Hermes.net (Workspace)
function loadCssFileInWorkspace(filename) {
 var link = window.top.document.createElement('link');
 var timestamp = new Date().getTime();

 link.href = `${protocol}://${cloud}/hermes_net_v5/PlateformPublication/Frameset_Includes/styles/${filename}?v=${timestamp}`;
 console.warn("CSS File URL:", link.href);
 link.type = 'text/css';
 link.rel = 'stylesheet';
 link.setAttribute('cache-control', 'no-cache, no-store, must-revalidate');
 link.setAttribute('pragma', 'no-cache');
 link.setAttribute('expires', '0');
 window.top.document.head.appendChild(link);
}

// Injection du code HTML de la clochette dans Workspace
function appendClochetteInHtml() {
 GetAgentFrame().$(".BodyWorkspace").append(` <div class="wrap-notification"> <div class="toggle-button"> <img class="i-flash-right"></img> </div> <div id="notification-detail-slide"> <div id="slide-container"> </div> <div id="detail-button"class="detail-button"title="Voir les détails"> <img src="https://images.centrerelationsclients.com/Clochette/icon_details.png"alt="details"> </div> <div id="detail-table-container"class="detail-table-container"style="display:none;"> <table id="detail-table"class="detail-table"> <thead> <tr> <th>Pays</th> <th>Indice</th> <th>Téléphone</th> <th>Date et heure</th> </tr> </thead> <tbody> </tbody> </table> </div> </div> <div class="container-notification"> <div id="notification_id"class="notification"> </div> <div id="notification_id_relances"class="notification-relances"> </div> </div> </div> `);
}

// Fonction pour configurer le bouton toggle
function configureToggleButton() {
 const toggleButton = window.top.document.querySelector('.toggle-button');
 const notificationDetail = window.top.document.getElementById('notification-detail-slide');
 const icon = toggleButton.querySelector('img');

 if (toggleButton && notificationDetail && icon) {
  toggleButton.addEventListener('click', function () {
   if (notificationDetail.style.right === "0px" || notificationDetail.style.right === "") {
    notificationDetail.style.transition = "right 0.5s";
    notificationDetail.style.right = "-540px";
    icon.classList.remove("i-flash-right");
    icon.classList.add("i-flash-left");
    isPopupPinned = false;
   }

   else {
    notificationDetail.style.transition = "right 0.5s";
    notificationDetail.style.right = "0px";
    icon.classList.remove("i-flash-left");
    icon.classList.add("i-flash-right");
    isPopupPinned = true;
   }
  }

  );
 }

 else {
  console.log("L'élément toggle button n'a pas été trouvé");
 }
}

// Fonction inject_data mise à jour pour afficher les données d'appels perdus
window.top["inject_data"] = () => {
 // Mise à jour des éléments de notification principaux
 const el = window.top.document.querySelector('.notification');
 const elRelances = window.top.document.querySelector('.notification-relances');

 // Affichage des compteurs FR et NL
 el.setAttribute('data-count', `FR: ${$frCallsCount}`);
 el.classList.remove('notify');
 el.offsetWidth = el.offsetWidth;
 el.classList.add('notify');
 el.classList.add('show-count');

 elRelances.setAttribute('data-count', `NL: ${$nlCallsCount}`);
 elRelances.classList.remove('notify');
 elRelances.offsetWidth = elRelances.offsetWidth;
 elRelances.classList.add('notify');
 elRelances.classList.add('show-count');

 // Mise à jour du contenu du slide
 const notificationDetail = window.top.document.getElementById("slide-container");

 if (notificationDetail) {
  notificationDetail.innerHTML = '';

  // Créer deux cellules pour FR et NL
  let slideContent = "<div id='notification-all-cells'>";

  // Cellule pour FR
  slideContent += ` <div class="notification-cell" style="cursor: pointer; position: relative;"><div class="tooltip" style="display: inline-block;"><div class="icon-custom"><span>Lost Calls: FR</span></div><span class="tooltiptext">Appels perdus pour la France</span></div><span class="icon-valeur">${$frCallsCount}</span></div>`;

  // Cellule pour NL
  slideContent += ` <div class="notification-cell" style="cursor: pointer; position: relative;"><div class="tooltip" style="display: inline-block;"><div class="icon-custom"><span>Lost Calls: NL</span></div><span class="tooltiptext">Appels perdus pour les Pays-Bas</span></div><span class="icon-valeur">${$nlCallsCount}</span></div>`;

  slideContent += "</div>";
  notificationDetail.innerHTML = slideContent;
 }

 // Mise à jour de la table de détails
 updateDetailTable();
}

 ;

// Fonction pour formater la date au format dd/mm/yyyy à HHhMM
function formatDate(dateString) {
 const date = new Date(dateString);
 if (isNaN(date.getTime())) return "Date invalide";

 const day = String(date.getDate()).padStart(2, '0');
 const month = String(date.getMonth() + 1).padStart(2, '0');
 const year = date.getFullYear();
 const hours = String(date.getHours()).padStart(2, '0');
 const minutes = String(date.getMinutes()).padStart(2, '0');

 return `${day}/${month}/${year} à ${hours}h${minutes}`;
}

// Fonction pour mettre à jour la table de détails
function updateDetailTable() {
 const tableBody = window.top.document.querySelector('.detail-table tbody');
 if (!tableBody) return;

 tableBody.innerHTML = '';

 if (Array.isArray($lostCallsData) && $lostCallsData.length > 0) {
  $lostCallsData.forEach(call => {
   const row = document.createElement('tr');

   row.innerHTML = ` <td>${call.Country || ''}</td> <td>${call.Indice || ''}</td> <td>${call.PhoneCalling || ''}</td> <td>${formatDate(call.LostCallTime || '')}</td> `;
   tableBody.appendChild(row);
  }

  );
 }

 else {
  // Si pas de données, afficher une ligne vide
  tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Aucune donnée disponible</td></tr>';
 }
}

// Fonction pour basculer l'affichage des détails
function toggleDetailView() {
 const detailSlide = window.top.document.getElementById('notification-detail-slide');
 const detailTable = window.top.document.getElementById('detail-table-container');

 if (detailSlide.classList.contains('expanded')) {
  // Réduire
  detailSlide.classList.remove('expanded');
  detailTable.style.display = 'none';
 }

 else {
  // Agrandir
  detailSlide.classList.add('expanded');
  detailTable.style.display = 'block';
  updateDetailTable();
 }
}

// ----------------------------------------------------------------------------------------------------------------------------------------
// ----------------------------------------------------------------------------------------------------------------------------------------

const notificationElement = window.top.document.getElementById('notification_id');
const notificationRelances = window.top.document.getElementById('notification_id_relances');
let isPopupPinned = false;

// Fonction pour changer le background de la notification
function setNotificationBackground(active) {
 if (notificationElement) {
  notificationElement.style.backgroundImage = active ? "linear-gradient(#a72f75, #e9d6c0)" : "linear-gradient(#432a63, #b1824b)";
  notificationElement.style.transition = "background-image 0.5s ease-in-out";
 }

 if (notificationRelances) {
  notificationRelances.style.backgroundImage = active ? "linear-gradient(#a72f75, #e9d6c0)" : "linear-gradient(#432a63, #b1824b)";
  notificationRelances.style.transition = "background-image 0.5s ease-in-out";
 }
}

// Fonctions pour afficher/cacher le slide
function toggleSlide(event) {
 event.stopPropagation();
 const notificationDetail = window.top.document.getElementById('notification-detail-slide');

 if (notificationDetail) {
  isPopupPinned = !isPopupPinned;

  if (isPopupPinned) {
   notificationDetail.style.right = "0px";
   setNotificationBackground(true);
  }

  else {
   notificationDetail.style.right = "-540px";
   setNotificationBackground(false);
  }
 }
}

function showSlide() {
 if (!isPopupPinned) {
  const notificationDetail = window.top.document.getElementById('notification-detail-slide');

  if (notificationDetail) {
   notificationDetail.style.right = "0px";
   setNotificationBackground(true);
  }
 }
}

function hideSlide() {
 if (!isPopupPinned) {
  const notificationDetail = window.top.document.getElementById('notification-detail-slide');

  if (notificationDetail) {
   notificationDetail.style.right = "-540px";
   setNotificationBackground(false);
  }
 }
}

if (notificationElement && notificationRelances) {
 // Affichage ou fixation au clic
 notificationElement.addEventListener("click", toggleSlide);
 notificationRelances.addEventListener("click", toggleSlide);

 // Listener ESCAPE ESC
 GetAgentFrame().document.addEventListener("keydown", function (e) {
  if ((e.key === "Escape" || e.code === "Escape" || e.keyCode === 27) && isPopupPinned) {
   isPopupPinned = false;
   hideSlide();
  }
 }

 );
}

// Fonction pour formater le temps restant pour le prochain rafraîchissement
function formatTimeRemaining(milliseconds) {
 const totalSeconds = Math.ceil(milliseconds / 1000);
 const minutes = Math.floor(totalSeconds / 60);
 const seconds = totalSeconds % 60;

 return `$ {
      minutes
   }

   :$ {
      seconds < 10 ? '0'+seconds: seconds
   }

   `;
}

// Fonction pour mettre à jour le compteur
function updateCountdown() {
 if (!nextUpdateTime) return;
 const now = new Date();
 const timeRemaining = nextUpdateTime - now;

 if (timeRemaining <= 0) {
  return;
 }

 // Le code de mise à jour visuelle du compteur a été supprimé car l'élément n'existe plus
}

// Fonction pour démarrer le compteur
function startCountdownTimer() {
 if (updateCountdownInterval) {
  clearInterval(updateCountdownInterval);
 }

 nextUpdateTime = new Date(new Date().getTime() + UPDATE_INTERVAL_MS);
 updateCountdownInterval = setInterval(updateCountdown, 1000);
}

// Fonction de préparation des données et de l'interface
async function dataAndUi() {
 await reqSelectLostCalls();
 window.top.inject_data();

 // Redémarrer le minuteur
 startCountdownTimer();
}

// Fonction pour initialiser l'interface et charger les données
async function initializeUI() {
 // Récupération de l'IP du Cloud
 cloud = checkURL();

 // Chargement du CSS personnalisé
 loadCssFileInWorkspace('fimainfo_notifications.css');

 // Injection du HTML de la clochette
 appendClochetteInHtml();

 // Configuration des événements après un court délai
 setTimeout(() => {
  // Configurer l'événement de clic pour le bouton détails
  const detailButton = window.top.document.getElementById('detail-button');

  if (detailButton) {
   detailButton.addEventListener('click', function (e) {
    e.stopPropagation();
    toggleDetailView();
   }

   );
  }

  // Fermer la vue détaillée quand on clique ailleurs
  window.top.document.addEventListener('click', function (e) {
   const detailSlide = window.top.document.getElementById('notification-detail-slide');
   const detailButton = window.top.document.getElementById('detail-button');
   const detailTable = window.top.document.getElementById('detail-table-container');

   if (detailSlide && detailSlide.classList.contains('expanded')) {
    if (!detailSlide.contains(e.target) || (detailSlide.contains(e.target) && !detailTable.contains(e.target) && e.target !== detailButton)) {
     detailSlide.classList.remove('expanded');
     detailTable.style.display = 'none';
    }
   }
  }

  );

  // Configurer le bouton toggle
  configureToggleButton();
 }

  , 1000);
}

// Fonction de préparation
async function prepare() {
 agentInfo = await findAgentData();
 await recupDb(customerId);
 await reqSelectAgentData();
}

// Fonction principale
async function main() {
 await initializeUI();
 await prepare();
 await dataAndUi();

 // Mise à jour toutes les 90 secondes
 setInterval(async () => {
  await dataAndUi();
 }

  , UPDATE_INTERVAL_MS);
}

main();