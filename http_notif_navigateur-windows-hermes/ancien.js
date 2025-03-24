
// *** IMPORTANT ***
// le fichier "fimainfo_notifications.css" avec tout le code CSS du projet se trouve dans le dossier suivant : \\192.168.9.237\d\hermes_net_v5\PlateformPublication\Frameset_Includes\styles
// "fimainfo_notifications.css" est modfiable mais ne jamais doit etre deplacé.

// Variables et conditions pour gerer affichage des notifications/clochette
// $campaignType
//

// ----------------------------- DECLARATION DES VARIABLES --------------------------------
// pour SQL :
$db_client = "HN_GUYOT"
$customerId = 31;  // CustomerID à changer en fonction du client
$campaignType = 1; // 1 - entrants, 2 - sortants
$queuesType = "Queues";	// "Queues" - Campagnes entrants | "QueuesOutbound" - sortants

$view_notif = "Fimainfo_NotificationHermes_Clochette";
$cloud_1 = "192.168.9.236"
$cloud_2 = "192.168.9.237"

// pour JS :
$inCallsCounter = 0;
$newInCallsCounter = 0;
$campaignAgent = [];
$listeVues = [];
$campaignsConnected = [];
$idsAgentCampaigns = [];
$dataNotif = [];

const maxPopups = 5;
const popups = [];
let popupCounter = 0;
let callAnimations = '';
let iconCallIn = '';
let iconCallMissed = '';
//let flagCallAnimation = false;

// Массив для новых данных после SQL-запроса
$notifNewLines = [];
// Объект для отслеживания скрытых оповещений и их таймеров
$hiddenNotifications = {}; // { [callId]: timeoutId }
// Объект для отслеживания отображаемых попапов
$displayedPopups = {}; // { [callId]: popupElement }
let popupContainer = null;
let currentCallIds = []; // Текущие ID звонков
// ----------------------------------------------------------------------------------------

// Массив для новых данных после SQL-запроса
$notifNewLines = [];
// Объект для отслеживания скрытых оповещений и их таймеров
$hiddenNotifications = {}; // { [callId]: timeoutId }
// Объект для отслеживания отображаемых попапов
$displayedPopups = {}; // { [callId]: popupElement }


// ------------------ DECLARATION DES FONCTIONS avec REQUETTES SQL ------------------------

// Fonction SELECT liste des Vues SQL du client
async function reqSelectListsVues() {
	// Requete pour recuperer la liste des vues du client
	const reqListeVues = `
	 SELECT 
	 CONCAT(DB_NAME(), '.', SCHEMA_NAME(SCHEMA_ID()), '.', TABLE_NAME) as 'liste_vues'
	 FROM INFORMATION_SCHEMA.VIEWS
	 WHERE TABLE_SCHEMA = 'dbo'
	 ORDER BY TABLE_NAME;
	`;
	try {
	 const result = await reqSelect(`${$db_client}`, reqListeVues);
	 $listeVues = result.map(vues => [
	  vues.liste_vues
	 ]);
	 console.log('Résultats liste vues : ', $listeVues);
	} catch (error) {
	 console.error('Erreur lors de l\'exécution de la requête :', error);
	 $listeVues = [];
	}
  }
  

// Fonction de creation d'une Vue SQL
async function reqInsertVueNotif() {
	try {
		// Проверка наличия имени представления (view) и клиента базы данных
		if (!$view_notif || !$db_client) {
			console.warn("Aucune vue à créer ou client de base de données non spécifié.");
			return;
		}
		// Création de la requête pour créer la vue SQL NotificationHermes
		const reqCreerVueNotif = `
		CREATE VIEW ${$view_notif} AS
		SELECT
			c.ID AS 'Id',
			FORMAT(c.CallLocalTime, 'yyyy-MM-dd HH:mm:ss.fff') AS 'CallLocalTime',
			c.CustomerID,
			ISNULL(t.Description, c.CallType) AS 'Type',
			c.Indice,
			LEFT(
				CASE 
					WHEN c.OutTel = '' THEN c.ANI 
					ELSE c.OutTel 
				END, 
				IIF(
					CHARINDEX('-', CASE WHEN c.OutTel = '' THEN c.ANI ELSE c.OutTel END) > 0, 
					CHARINDEX('-', CASE WHEN c.OutTel = '' THEN c.ANI ELSE c.OutTel END) - 1, 
					0
				)
			) AS 'IdCampagne',
			RIGHT(
				CASE 
					WHEN c.OutTel = '' THEN c.ANI 
					ELSE c.OutTel 
				END, 
				IIF(
					CHARINDEX('-', CASE WHEN c.OutTel = '' THEN c.ANI ELSE c.OutTel END) > 0, 
					LEN(CASE WHEN c.OutTel = '' THEN c.ANI ELSE c.OutTel END) - CHARINDEX('-', CASE WHEN c.OutTel = '' THEN c.ANI ELSE c.OutTel END), 
					0
				)
			) AS 'TelClient',
			cam.Description AS 'NomCampagne'
		FROM
			HN_Ondata.dbo.ODCalls AS c
		LEFT OUTER JOIN
			HN_Ondata.dbo.CallTypes AS t ON c.CallType = t.CallType
		LEFT OUTER JOIN
			[HN_Admin].[dbo].[Campaigns] AS cam ON 
			LEFT(
				CASE 
					WHEN c.OutTel = '' THEN c.ANI 
					ELSE c.OutTel 
				END, 
				IIF(
					CHARINDEX('-', CASE WHEN c.OutTel = '' THEN c.ANI ELSE c.OutTel END) > 0, 
					CHARINDEX('-', CASE WHEN c.OutTel = '' THEN c.ANI ELSE c.OutTel END) - 1, 
					0
				)
			) = cam.DID;
		`;
		await reqInsert($db_client, reqCreerVueNotif);
		console.warn(`Vue SQL : ${$view_notif} a été créée.`);
	} catch (error) {
		console.error(`Erreur de création de la Vue SQL : ${$view_notif}`, error);
	}
}


// Fonctions SELECT appels en cours
async function reqSelectDataCall() {
	const query = `
	SELECT TOP (10) * FROM ${$db_client}.${$view_notif}
	WHERE Type = 'Inbound call'
	AND CustomerID = '${$customerId}' -- CustomerID de l'agent
	AND IdCampagne IN (${$idsAgentCampaigns.map(id => `'${id}'`).join(', ')}) -- IDs des campagnes auxquelles l'agent est connecté
	AND Indice = 0 -- Les appels en cours
	ORDER BY CallLocalTime DESC
	`;
	console.log('Requête :' , query);
    try {
        const result = await reqSelect(`${$db_client}`, query);
        console.log('Requête de récupération des appels en cours exécutée avec succès.');
        $dataNotif = result.map(call => [
            call.Id,            
            call.CallLocalTime,  
            call.CustomerID,          
            call.Type,          
            call.Indice,         
            call.IdCampagne,        
            call.TelClient,       
            call.NomCampagne    
        ]);
        console.log('Résultats : ', $dataNotif);
    } catch (error) {
        console.error('Erreur lors de l\'exécution de la requête :', error);
        $dataNotif = [];
    }
}

// ----------------------------- FONCTIONS UTILITAIRES ------------------------------------
// Fonction pour charger le fichier CSS personnalisé dans DOM de Hermes.net (Workspace) 
function loadCssFileInWorkspace(filename) {
	var link = window.top.document.createElement('link');
	// Ajoutons un paramètre dans l'url pour eviter le cache
	var timestamp = new Date().getTime();
	link.href = 'http://192.168.9.237/hermes_net_v5/PlateformPublication/Frameset_Includes/styles/' + filename + '?v=Sergiy=' + timestamp;
	link.type = 'text/css';
	link.rel = 'stylesheet';
	window.top.document.head.appendChild(link);
}

// Fonction pour valider et creer la vue SQL si elle n'existe pas
async function validateAndCreateView() {
	try {
	  // Vérifier si la vue existe déjà dans la liste des vues
	  await reqSelectListsVues();
	  if ($listeVues.some(view => view[0] === `${$db_client}.dbo.${$view_notif}`)) {
		 console.log(`La Vue ${$view_notif} existe déjà.`);
	  } else {
		 // Si la vue n'existe pas, la créer
		  await reqInsertVueNotif();
		  console.log(`La Vue SQL : ${$view_notif} a bien été créée.`);
	  }
	} catch (error) {
	  console.error('Erreur lors de la vérification et de la création de la vue:', error);
	}
 }
 
// Fonction qui vérifie les campagnes associées à l'agent
async function checkCampaigns(campaignType) {
 if (GetAgentLink().Campaigns && GetAgentLink().Campaigns._data) {
  let campaigns = GetAgentLink().Campaigns._data;
  let filteredCampaigns = campaigns.filter(campaign => campaign.Type === campaignType);
  // Crée une nouvelle liste d'objets avec CampaignId, Description et Queue
  $campaignAgent = filteredCampaigns.map(campaign => ({
   CampaignId: campaign.CampaignId,
   Description: campaign.Description,
   Queue: campaign.Queue
  }));
  console.warn("Toutes les campagnes entrantes de l'agent :", campaignAgent);
 }
 if ($campaignAgent.length === 0) {
  setTimeout(() => checkCampaigns(campaignType), 3000);
 }
}

// Fonction qui vérifie les campagnes connectées de l'agent
async function checkCampaignsConnected(queuesType) {
	const queuesData = GetAgentLink().Telephony[queuesType]._data;
	if (!queuesData) {
		 console.error(`Erreur : ${queuesType} non trouvé dans Telephony.`);
		 return;
	}
	let previousCount = $campaignsConnected.length;
	$campaignsConnected = [];
	const enabledQueues = queuesData.filter(queue => queue.EnabledBy !== 0);
	enabledQueues.forEach(queue => {
		 $campaignsConnected.push({
			  Description: queue.Description,
			  Queue: queue.QueueId
		 });
	});
	let currentCount = $campaignsConnected.length;
	if (currentCount === 0) {
		 $idsAgentCampaigns = [];
		 setTimeout(async () => await checkCampaignsConnected(queuesType), 3000);
	} else if (currentCount !== previousCount) {
		 $idsAgentCampaigns = [];
		 await matchingCampaigns(); 
		 setTimeout(async () => await checkCampaignsConnected(queuesType), 3000);
	} else {
		 setTimeout(async () => await checkCampaignsConnected(queuesType), 3000);
	}
	return $campaignsConnected;
}

// Fonction qui compare les files d'attente et retourne les CampaignId groupés par Queue
async function matchingCampaigns() {
 $idsAgentCampaigns = [];
 const queueGroups = {};
 $campaignAgent.forEach(all => {
  $campaignsConnected.forEach(connected => {
   // Si les Queue correspondent 
   if (all.Queue === connected.Queue) {
    if (!queueGroups[all.Queue]) {
     queueGroups[all.Queue] = [];
    }
    // Ajoute CampaignId uniquement s'il n'est pas déjà présent dans la liste
    if (!queueGroups[all.Queue].includes(all.CampaignId)) {
     queueGroups[all.Queue].push(all.CampaignId);
    }
   }
  });
 });
 // Combine tous les CampaignId dans un seul tableau
 $idsAgentCampaigns = Object.values(queueGroups).flat();
 console.warn("Campagne(s) entrante(s) connectée(s) : ", $idsAgentCampaigns);
 if ($idsAgentCampaigns.length === 0) {
  setTimeout(() => matchingCampaigns(), 600);
 }
 return $idsAgentCampaigns;
}


// Fonction qui attend que la variable soit chargee
async function waitForVariable() {
	console.table($campaignAgent);
	while (typeof $campaignAgent === 'undefined' || $campaignAgent === '' || (Array.isArray($campaignAgent) && $campaignAgent.length === 0)) {
	 await new Promise(resolve => setTimeout(resolve, 100));
	}
  }

// ---------------------------------------------------------------------------------------------------------------------------------


// Injection du code HTML des notifications dans Workspace pour TESTER
function appendNotifHtml() {
	GetAgentFrame().$(".BodyWorkspace").append(`
	 <div class="wrap-notif-appel">
		<div class="container-notif">
		<div id="call-container">
		<span id="call">S.A.</span>
		</div>
		</div>
	</div>
	`);
};


function initializePopupContainer() {
	if (!popupContainer) {
		 popupContainer = window.top.document.createElement('div');
		 popupContainer.className = 'popup-container';
		 window.top.document.body.appendChild(popupContainer);
	}
}


// Fonction pour afficher un popup personnalisé
function showPopup(telClient, campagne) {
	initializePopupContainer();
	popupCounter++;
	const popup = window.top.document.createElement('div');
	popup.className = 'custom-popup show';
	popup.innerHTML = `
	<div class="call-animation">
		<img id="icon-call-in" class="popup-icon"
			src="http://192.168.9.237/hermes_net_v5/InterfaceDesigner/upload/dAlKTsEK/img/icon-appel-4.png"
			alt="Icone d'appel">
	</div>
	<div>
		<div class="entete-popup">
			<h4>Appel entrant Hèrmes</h4>
			<span class="compteur-popup">${popupCounter}</span>
		</div>
		<p class="nom-campagne">campagne : "${campagne}"</p>
		<br>
		<p class="tel-client">Tél. du client: ${telClient}</p>
	</div>
	`;
	popupContainer.appendChild(popup); // Добавляем новый попап в контейнер
	const audio = new Audio('https://github.com/SergeMiro/stock_files/raw/refs/heads/main/notif_appel_court.mp3');
	audio.volume = 0.7;
	audio.play().catch(error => {
		 console.error('Erreur de son', error);
	});
	popups.push({ element: popup, audio: audio, telClient: telClient, campagne: campagne });
}


// Declaration de la fonction pour vider les popups
function removePopups() {
	const allPopups = window.top.document.querySelectorAll('.custom-popup.show');
	allPopups.forEach(popup => {
		popup.remove();
	});
	popups.length = 0;
	if ($inCallsCounter > 1) {
		console.warn('Nombre de popups si d\'appels entrants plus qu\'un : ', allPopups.length);
		popupCounter -= allPopups.length
	}
}

// Délégation de l'événement de clic sur les popups
window.top.document.addEventListener('click', function (e) {
	if (e.target.closest('.custom-popup.show')) {
		if ($inCallsCounter === 0) {
			removePopups();
			popupCounter = 0;
		} else {
			console.warn('Appel encore en cours, donc on ne cache pas le popup');
		}
	}
});

// Déclaration de la fonction d'appel SQL
async function reqSelectDataCall() {
	window._g.wscript.ExecuteAction("req-notification", "", false);
}

//Déclaration de la fonction qui affiche la notification
window.top["inject_notif"] = () => {
	removePopups(); // Vider les popups
	// Afficher la/les notification(s)
	$dataNotif.reverse().forEach(row => {
		const telClientEntrant = row[6]; // Récuperons le TEL du client
		const nomCampagneEntrante = row[7];  // Récuperons le nom de la CAMPAGNE
		showPopup(telClientEntrant, nomCampagneEntrante);
		// callAnimations = window.top.document.querySelectorAll('.call-animation');
		// iconCallIn = window.top.document.querySelector('#icon-call-in');
		// callAnimations.forEach(callAnimation => {
		// 	callAnimation.classList.add('add-call-animation');
		// 	iconCallIn.classList.add('add-popup-icon');
		// 	flagCallAnimation = true;
		// });
	});
	$dataNotif = [];
	console.warn('Notification affichée');
}

// Déclaration de la fonction qui compte les appels entrants
function callsCounter() {
	const spanPanQueue = parent.document.getElementById('Pan_Queue');
	if (!spanPanQueue) {
		console.log('SPAN avec l\'id "Pan_Queue" n\'est pas trouvé.');
		setTimeout(callsCounter, 2000);
		return;
	}
	const tdElements = spanPanQueue.getElementsByTagName('td');
	if (tdElements.length === 0) {
		console.log('Pas d\'éléments <td> dans le <span id="Pan_Queue">');
		setTimeout(callsCounter, 2000);
		return;
	}
	if (tdElements.length >= 3) {
		$inCallsCounter = parseInt(tdElements[0].querySelector('div').textContent.trim(), 10);

		if (($inCallsCounter !== $newInCallsCounter) && ($inCallsCounter >= $newInCallsCounter)) {
			$newInCallsCounter = $inCallsCounter;
			main();
			// } else if ($inCallsCounter == 0 && flagCallAnimation == true) {
			} else if ($inCallsCounter == 0) {
			$newInCallsCounter = $inCallsCounter;
			// callAnimations = window.top.document.querySelectorAll('.call-animation');
			// iconCallMissed = window.top.document.querySelector('#icon-call-missed');
			// console.warn('STOP ANIMATION : ', callAnimations);
			// if (callAnimations && iconCallMissed) {
			// 	callAnimations.forEach(callAnimation => {
			// 		callAnimation.classList.remove('add-call-animation');
			// 		iconCallIn.classList.remove('add-popup-icon');
			// 		iconCallMissed.classList.add('add-popup-icon');
			// 		flagCallAnimation = false;
			// 		console.warn('flagCallAnimation : ', flagCallAnimation, iconCallMissed);
			// 	});
			// }
		} else {
			$newInCallsCounter = $inCallsCounter;
			//console.warn('Aucun changement détecté');
		}
	} else {
		console.log('Pas d\'éléments <td> suffisants dans le <span id="Pan_Queue">');
	}
	setTimeout(callsCounter, 100);
}


// Declaration de la fonction principale
async function main() {
	reqSelectDataCall();
	console.table($dataNotif);
	await waitForVariable();
	window.top.inject_notif();
}

appendNotifHtml();
// Appeler la fonction pour charger le fichier CSS personnalisé dans le DOM de Hermes.net
loadCssFileInWorkspace('fimainfo_notifications.css');
// Appel des fonctions pour récupérer les campagnes et les comparer
checkCampaigns($campaignType);
checkCampaignsConnected($queuesType);
callsCounter();


//-----------------------------------------------------------------------------------------
//------------------ A DECOMMENTER POUR TESTER LA NOTIFICATION D'APPEL --------------------
//  Bouton "SIMULATION D'APPEL" pour le TEST d'affichage de la notification dans Workspace

const callButton = window.top.document.getElementById('call');
if (callButton) {
 callButton.addEventListener('click', function () {
  console.warn('Bouton "SIMULATION D\'APPEL" cliqué : ');
  updateNotifications();
  console.warn('Popup affiché');
 });
} else {
 console.error("Bouton de Test n'a pa été trouvé");
}

