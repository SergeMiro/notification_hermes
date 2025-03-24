
// ----------------------------- DECLARATION DES VARIABLES --------------------------------
// pour SQL :
$cloud_1 = "192.168.9.236"
$cloud_2 = "192.168.9.237"
$db_client = "HN_GUYOT"
$view_notif = "dbo.NotificationHermes" // le nom de Vue SQL créée

// pour JS :
$compteurAppelsEntrants = 0;
$newCompteurAppelsEntrants = 0;
$customerId = 31;  // CustomerID à changer en fonction du client
$typeCampagne = 1; // 1 - entrantes, 2 - sortantes
let dataCampagnesAgent = [];
$campagnesConnectees = [];
$idsCampagnesAgent = [];
$dataNotif = [];
const maxPopups = 3;
const popups = [];
let popupCounter = 0;

// ----------------------------- FONCTIONS UTILITAIRES ------------------------------------
// Fonction qui vérifie les campagnes associées à l'agent
function checkCampaigns(typeCampagne) {
	if (GetAgentLink().Campaigns && GetAgentLink().Campaigns._data) {
		let campaigns = GetAgentLink().Campaigns._data;
		let filteredCampaigns = campaigns.filter(campaign => campaign.Type === typeCampagne);
		// Crée une nouvelle liste d'objets avec CampaignId, Description et Queue
		dataCampagnesAgent = filteredCampaigns.map(campaign => ({
			CampaignId: campaign.CampaignId,
			Description: campaign.Description,
			Queue: campaign.Queue
		}));
		console.warn("Toutes les campagnes entrantes de l'agent :", dataCampagnesAgent);
	}
	if (dataCampagnesAgent.length === 0) {
		setTimeout(() => checkCampaigns(typeCampagne), 3000);
	}
}

// Fonction qui vérifie les campagnes connectées de l'agent
function checkCampaignsConnected() {
	const queuesData = GetAgentLink().Telephony.Queues._data;
	let previousCount = $campagnesConnectees.length;
	$campagnesConnectees = [];
	const enabledQueues = queuesData.filter(queue => queue.EnabledBy !== 0);
	enabledQueues.forEach(queue => {
		$campagnesConnectees.push({
			Description: queue.Description,
			Queue: queue.QueueId
		});
	});
	let currentCount = $campagnesConnectees.length;
	if (currentCount === 0) {
		$idsCampagnesAgent = [];
		//console.warn('=== BOUCLE-1', previousCount, currentCount);
		setTimeout(() => checkCampaignsConnected(), 3000);
	} else if (currentCount !== previousCount) {
		//console.warn('=== BOUCLE-2', previousCount, currentCount);
		$idsCampagnesAgent = [];
		matchingCampaigns();
		setTimeout(() => checkCampaignsConnected(), 3000);
	} else {
		//console.warn('=== BOUCLE-3', previousCount, currentCount);
		setTimeout(() => checkCampaignsConnected(), 3000);
	}
	return $campagnesConnectees;
}

// Fonction qui compare les files d'attente et retourne les CampaignId groupés par Queue
function matchingCampaigns() {
	$idsCampagnesAgent = [];
	const queueGroups = {};
	dataCampagnesAgent.forEach(all => {
		$campagnesConnectees.forEach(connected => {
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
	$idsCampagnesAgent = Object.values(queueGroups).flat();
	console.warn("Campagne(s) entrante(s) connectée(s) : ", $idsCampagnesAgent);
	if ($idsCampagnesAgent.length === 0) {
		setTimeout(() => matchingCampaigns(), 600);
	}
	return $idsCampagnesAgent;
}

// Fonction qui attends que variable soit remplie
async function waitForVariable() {
	console.table($dataNotif);
	while (typeof $dataNotif === 'undefined' || $dataNotif === '' || (Array.isArray($dataNotif) && $dataNotif.length === 0)) {
		await new Promise(resolve => setTimeout(resolve, 100));
	}
	console.log(`La variable est chargée : \n${$dataNotif}`);
}
// ---------------------------------------------------------------------------------------------------------------------------------

//Fonction pour mettre à jour la position des popups
function updatePopupPositions() {
	const baseBottom = 35;
	const popupHeight = 100;
	const marginAdjustment = -1;
	popups.forEach((popupObj, index) => {
		const bottomPosition = baseBottom + index * (popupHeight + marginAdjustment);
		popupObj.element.style.bottom = `${bottomPosition}px`;
		popupObj.element.style.top = '';
		popupObj.element.style.zIndex = `${1000 + index}`;
	});
}

// Fonction pour afficher un popup personnalisé
function showCustomPopup(telClient, campagne) {
	const existingPopupIndex = popups.findIndex(popupObj => popupObj.telClient === telClient && popupObj.campagne === campagne);
	if (existingPopupIndex !== -1) {
		const existingPopupObj = popups[existingPopupIndex];
		popups.splice(existingPopupIndex, 1);
		popups.push(existingPopupObj);
		updatePopupPositions();
		return;
	}

	if (popups.length >= maxPopups) {
		const oldestPopup = popups.shift();
		window.top.document.body.removeChild(oldestPopup.element);
		oldestPopup.audio.pause();
		oldestPopup.audio.currentTime = 0;
	}

	popupCounter++;

	const popup = window.top.document.createElement('div');
	popup.className = 'custom-popup show';
	popup.innerHTML = `
		<div class="call-animation">
			<img src="http://192.168.9.237/hermes_net_v5/InterfaceDesigner/upload/dAlKTsEK/img/icon-appel-4.png" alt="Icone d'appel">
		</div>
		 <div>
			  <div class="entete-popup">
					<h4>Appel entrant Hèrmes</h4>
					<span class="compteur-popup">${popupCounter}</span>
			  </div>
			  <p>la campagne "${campagne}"</p>
			  <br>
			  <p>Tél. du client: ${telClient}</p>
		 </div>
	`;
	popup.style.position = 'fixed'; // Убедимся, что позиция фиксирована
	popup.style.left = '20px'; // Позиция слева (или другая по вашему усмотрению)
	window.top.document.body.appendChild(popup);
	const audio = new Audio('https://res.cloudinary.com/ddz6v2kfz/video/upload/v1725020210/uemvapi2krtefxyndmfn.mp3');
	audio.volume = 0.7; // valeur 0.7 c'est 70% de son audio, valeur 1 c'est 100% de son audio, etc
	audio.play().catch(error => {
		console.error('Son introuvable, veuillez vérifier le chemin', error);
	});
	popups.push({ element: popup, audio: audio, telClient: telClient, campagne: campagne });
	updatePopupPositions();
}

// Declaration de la fonction pour vider les popups
function removePopups() {
	const allPopups = window.top.document.querySelectorAll('.custom-popup.show');
	allPopups.forEach(popup => {
		popup.remove();
	});
	popups.length = 0;
	if ($compteurAppelsEntrants > 1) {
		console.warn('Nombre de popups si d\'appels entrants plus qu\'un : ', allPopups.length);
		popupCounter -= allPopups.length
	}
}

// Délégation de l'événement de clic sur les popups
window.top.document.addEventListener('click', function (e) {
	if (e.target.closest('.custom-popup.show')) {
		if ($compteurAppelsEntrants === 0) {
			removePopups();
			popupCounter = 0;
		} else {
			console.warn('Appel encore en cours, donc on ne cache pas le popup');
		}
	}
});


// Déclaration de la fonction d'appel SQL
function reqSelectDataCall() {
	window._g.wscript.ExecuteAction("req-notification", "", false);
}

//Déclaration de la fonction qui affiche la notification
window.top["inject_notif"] = () => {
	removePopups(); // Vider les popups
	// Afficher la/les notification(s)
	$dataNotif.reverse().forEach(row => {
		const telClientEntrant = row[5]; // Récuperons le TEL du client
		const nomCampagneEntrante = row[6];  // Récuperons le nom de la CAMPAGNE
		showCustomPopup(telClientEntrant, nomCampagneEntrante);
	});
	$dataNotif = [];
	console.warn('Notification affichée');
}

// Declaration de la fonction qui compte le nombre d'appels entrants
function compteurAppels() {
	const spanPanQueue = parent.document.getElementById('Pan_Queue');
	if (!spanPanQueue) {
		console.log('SPAN avec l\'id "Pan_Queue" n\'est pas trouvé.');
		setTimeout(compteurAppels, 2000);
		return;
	}
	const tdElements = spanPanQueue.getElementsByTagName('td');
	if (tdElements.length === 0) {
		console.log('Pas d\'éléments <td> dans le <span id="Pan_Queue">');
		setTimeout(compteurAppels, 2000);
		return;
	}
	if (tdElements.length >= 3) {
		$compteurAppelsEntrants = parseInt(tdElements[0].querySelector('div').textContent.trim(), 10);

		if (($compteurAppelsEntrants !== $newCompteurAppelsEntrants) && ($compteurAppelsEntrants >= $newCompteurAppelsEntrants)) {
			$newCompteurAppelsEntrants = $compteurAppelsEntrants;
			main();

		} else {
			$newCompteurAppelsEntrants = $compteurAppelsEntrants;
			console.log('Aucun changement détecté');
		}
	} else {
		console.log('Pas d\'éléments <td> suffisants dans le <span id="Pan_Queue">');
	}
	setTimeout(compteurAppels, 200);
}

// Declaration de la fonction principale
async function main() {
	console.warn('DEBUT MAIN');
	reqSelectDataCall();
	console.warn('reqSelectDataCall');
	console.table($dataNotif);
	await waitForVariable();
	window.top.inject_notif();
}

// Appel des fonctions pour récupérer les campagnes et les comparer
checkCampaigns($typeCampagne);
checkCampaignsConnected();
compteurAppels();



//-----------------------------------------------------------------------------------------
//------------------ A DECOMMENTER POUR TESTER LA NOTIFICATION D'APPEL --------------------
//  Bouton "SIMULATION D'APPEL" pour le TEST d'affichage de la notification dans Workspace

// const callButton = window.top.document.getElementById('call');
// if (callButton) {
// 	callButton.addEventListener('click', function () {
// 		console.warn('Bouton "SIMULATION D\'APPEL" cliqué : ');
// 		// Action qui recupere le TEL du client + la CAMPAGNE ENTRANTE dans la base
// 		window._g.wscript.ExecuteAction("req-notification", "", false);
// 		window.top.inject_notif(); // Appeler la fonction qui affiche la notification
// 		console.warn('Popup affiché');
// 	});
// } else {
// 	console.error("Bouton de Test n'a pa été trouvé");
// }

//-----------------------------------------------------------------------------------------
//-----------------------------------------------------------------------------------------