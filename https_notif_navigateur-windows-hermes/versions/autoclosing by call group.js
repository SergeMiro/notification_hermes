// *** IMPORTANT ***
// le fichier "fimainfo_notifications.css" avec tout le code CSS du projet se trouve dans le dossier suivant : \\192.168.9.237\d\hermes_net_v5\PlateformPublication\Frameset_Includes\styles
// "fimainfo_notifications.css" est modfiable mais ne jamais doit etre deplacé.


// Максимальное время жизни уведомления (10 секунд)
const maxNotificationLifetime = 10 * 1000;


// Ajout d'un gestionnaire d'événements de messages pour la fenêtre principale pour la focalisation
if (window === window.top) {
	window.top.addEventListener('message', function (event) {
		if (event.data === 'FOCUS_WINDOW') {
			try {
				// Essai de focaliser et d'agrandir la fenêtre
				window.top.focus();

				// Agrandir la fenêtre si elle est minimisée
				if (window.top.outerWidth <= 1 || window.top.outerHeight <= 1) {
					window.top.resizeTo(1024, 768); // Taille par défaut raisonnable
				}

				// Méthode plus agressive pour activer la fenêtre sous Windows
				try {
					// Clignotement du titre de la fenêtre
					const originalTitle = document.title;
					const alertTitle = "⚠ NOUVEL APPEL ⚠";
					let titleInterval = setInterval(() => {
						document.title = document.title === originalTitle ? alertTitle : originalTitle;
					}, 500);

					// Arrêt du clignotement après 3 secondes
					setTimeout(() => {
						clearInterval(titleInterval);
						document.title = originalTitle;
					}, 3000);

					// Ouverture d'une fenêtre temporaire
					const tempWindow = window.open('about:blank', '_blank', 'width=1,height=1');
					if (tempWindow) setTimeout(() => tempWindow.close(), 500);

					// Tentative d'appel focus plusieurs fois
					let focusAttempts = 0;
					const focusInterval = setInterval(() => {
						window.top.focus();
						focusAttempts++;
						if (focusAttempts >= 10) {
							clearInterval(focusInterval);
						}
					}, 100);
				} catch (e) {
					console.error("Erreur lors de la focalisation agressive:", e);
				}

			} catch (error) {
				console.error('Erreur lors de la tentative d\'activation de la fenêtre via postMessage:', error);
			}
		}
	}, false);
}

// ----------------------------- DECLARATION DES VARIABLES --------------------------------
// pour SQL :
$db_client = "HN_GUYOT"
$customerId = 31;  // CustomerID à changer en fonction du client
$campaignType = 1; // 1 - entrants, 2 - sortants
$queuesType = "Queues";	// "Queues" - Campagnes entrants | "QueuesOutbound" - sortants

// Paramètre de gestion automatique de fermeture des notifications
// true - les notifications seront fermées automatiquement lorsque la conversation est terminée
// false - les notifications seront fermées uniquement lors d'un clic sur elles
$autoCloseNotifications = true; // Активирован режим автоматического закрытия

$view_notif = "Fimainfo_NotificationHermes_Clochette";
$cloud_1 = "192.168.9.236"
$cloud_2 = "192.168.9.237"
$cloud_4 = "c4-web.fimainfo.fr"

// pour JS :
$inCallsCounter = 0;
$newInCallsCounter = 0;
$campaignAgent = [];
$listeVues = [];
$campaignsConnected = [];
$idsAgentCampaigns = [];
$dataNotifEntrante = [];
$inCallsAnswered = [];
$callHistoryKey = 'fimainfo_call_history'; // clé pour localStorage

$processedCallIds = []; // Tableau pour stocker les ID des appels qui ont déjà été traités
$currentCallData = [];
$previousCallData = [];

const maxPopups = 5;
const popups = [];
let popupCounter = 0;
let callAnimations = '';
let iconCallIn = '';
let iconCallMissed = '';
let popupContainer = null;
let callHistoryModal = null; // pour la fenêtre modale de l'historique des appels
//let flagCallAnimation = false;

$notifNewLines = [];
$hiddenNotifications = {}; // { [callId]: timeoutId }
$displayedNotifications = {}; // { [callId]: popupElement }
$missedNotifications = []; // Массив для хранения информации о звонках, уведомления о которых не были показаны
$missedNotificationsCount = 0; // Счетчик пропущенных уведомлений
let currentCallIds = []; // ID актуальных звонков
let previousCallIds = []; // Variable globale для stocker les identifiants précédents

// ------------------ DECLARATION DES FONCTIONS avec REQUETTES SQL ------------------------

// Fonction SELECT liste des Vues SQL du client
async function reqSelectListsVues() {
	// Requete pour recuperer la liste des vues du client
	const query = `
	 SELECT 
	 CONCAT(DB_NAME(), '.', SCHEMA_NAME(SCHEMA_ID()), '.', TABLE_NAME) as 'liste_vues'
	 FROM INFORMATION_SCHEMA.VIEWS
	 WHERE TABLE_SCHEMA = 'dbo'
	 ORDER BY TABLE_NAME;
	`;
	try {
		const result = await reqSelect(`${$db_client}`, query);
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
		const query = `
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
			cam.Description AS 'NomCampagne',
			c.FirstAgent AS 'Agent',
			CAST('0' AS NVARCHAR(1)) AS 'InCallAnswered'
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
		await reqInsert($db_client, query);
	} catch (error) {
		console.error(`Erreur de création de la Vue SQL : ${$view_notif}`, error);
	}
}


// Fonctions SELECT appels en cours
async function reqSelectDataCall() {
	const query = `
	SELECT TOP (10) * FROM ${$db_client}.dbo.${$view_notif}
	WHERE Type = 'Inbound call'
	AND CustomerID = '${$customerId}'
	AND IdCampagne IN (${$idsAgentCampaigns.map(id => `'${id}'`).join(', ')}) 
	AND Indice = 0 
	ORDER BY CallLocalTime DESC
	`;
	console.log('Requête :', query);
	try {
		const result = await reqSelect(`${$db_client}`, query);
		console.log('Résultats de la requête : ', result);

		// Verifion si result est un array, sinon on le transforme en array
		const resultArray = Array.isArray(result) ? result : [result];

		// Перед обновлением данных сохраняем текущие данные как предыдущие
		$previousCallData = [...$currentCallData];

		// Обновляем текущие данные
		$currentCallData = resultArray.map(call => ({
			Id: call.Id,
			CallLocalTime: call.CallLocalTime,
			CustomerID: call.CustomerID,
			Type: call.Type,
			Indice: call.Indice,
			IdCampagne: call.IdCampagne,
			TelClient: call.TelClient,
			NomCampagne: call.NomCampagne
		}));

		// Формируем массив для отображения, исключая звонки, которые уже были обработаны
		$dataNotifEntrante = $currentCallData
			.filter(call => !$processedCallIds.includes(call.Id))
			.map(call => [
				call.Id,
				call.CallLocalTime,
				call.CustomerID,
				call.Type,
				call.Indice,
				call.IdCampagne,
				call.TelClient,
				call.NomCampagne
			]);

		console.log('Отфильтрованные данные для отображения:', $dataNotifEntrante);
		console.log('Ранее обработанные звонки:', $processedCallIds);
	} catch (error) {
		console.error('Erreur lors de l\'exécution de la requête :', error);
		$dataNotifEntrante = [];
	}
}


// async function reqUpdateAnsweredCallFlag() {
// 	try {
// 		const query = `
// 		UPDATE ${$db_client}.dbo.${$view_notif} 
// 		SET InCallAnswered = '1'
// 		WHERE IdCampagne = '${$inCallsAnswered[0].CampaignId}'
// 		AND TelClient = '${$inCallsAnswered[0].ContactNumber}';
// 		`;
// 		if (!$view_notif || !$db_client) {
// 			console.warn("");
// 			return;
// 		}

// 		await reqUpdate($db_client, query);
// 	} catch (error) {
// 		console.error(`Erreur d'Updade de Flag de l'appel entrant : ${$inCallsAnswered[0].ContactNumber}`, error);
// 	}
// }


// ----------------------------- FONCTIONS UTILITAIRES ------------------------------------
// Fonction pour valider et creer la vue SQL si elle n'existe pas
async function validateAndCreateView() {
	try {
		// Vérifier si la vue existe déjà dans la liste des vues
		await reqSelectListsVues();
		if ($listeVues.some(view => view[0] === `${$db_client}.dbo.${$view_notif}`)) {
			console.warn(`La Vue ${$view_notif} existe déjà.`);
		} else {
			// Si la vue n'existe pas, la créer
			await reqInsertVueNotif();
			console.warn(`La Vue SQL : ${$view_notif} a bien été créée.`);
		}
	} catch (error) {
		console.error('Erreur lors de la vérification et de la création de la vue:', error);
	}
}

// Fonction pour charger le fichier CSS personnalisé dans DOM de Hermes.net (Workspace) 
function loadCssFileInWorkspace(filename) {
	var link = window.top.document.createElement('link');
	var timestamp = new Date().getTime();
	link.href = `https://${$cloud_4}/hermes_net_v5/PlateformPublication/Frameset_Includes/styles/${filename}?v=${timestamp}`;
	console.warn("CSS File URL:", link.href);
	link.type = 'text/css';
	link.rel = 'stylesheet';
	link.setAttribute('cache-control', 'no-cache, no-store, must-revalidate');
	link.setAttribute('pragma', 'no-cache');
	link.setAttribute('expires', '0');
	window.top.document.head.appendChild(link);
}


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
function checkCampaignsConnected(queuesType) {
	const queuesData = GetAgentLink().Telephony[queuesType]._data;
	let previousCount = $campagnesConnectees?.length || 0;
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
		$idsAgentCampaigns = [];
		console.warn('=== BOUCLE-1', previousCount, currentCount);
		setTimeout(() => checkCampaignsConnected(queuesType), 3000);
	} else if (currentCount !== previousCount) {
		console.warn('=== BOUCLE-2', previousCount, currentCount);
		$idsAgentCampaigns = [];
		matchingCampaigns();
		setTimeout(() => checkCampaignsConnected(queuesType), 3000);
	} else {
		console.warn('=== BOUCLE-3', previousCount, currentCount);
		setTimeout(() => checkCampaignsConnected(queuesType), 3000);
	}
	return $campagnesConnectees;
}


// Fonction qui compare les files d'attente et retourne les CampaignId groupés par Queue
function matchingCampaigns() {
	$idsAgentCampaigns = [];
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
	$idsAgentCampaigns = Object.values(queueGroups).flat();
	console.warn("Campagne(s) entrante(s) connectée(s) : ", $idsAgentCampaigns);
	if ($idsAgentCampaigns.length === 0) {
		setTimeout(() => matchingCampaigns(), 600);
	}
	return $idsAgentCampaigns;
}

// Fonction qui attends que variable soit remplie
// async function waitForDataNotif() {
// 	console.table('waitForDataNotif', $dataNotifEntrante);
// 	while (typeof $dataNotifEntrante === 'undefined' || $dataNotifEntrante === '' || (Array.isArray($dataNotifEntrante) && $dataNotifEntrante.length === 0)) {
// 		await new Promise(resolve => setTimeout(resolve, 100));
// 	}
// 	console.log(`La variable est chargée : \n${$dataNotifEntrante}`);
// }
// ---------------------------------------------------------------------------------------------------------------------------------

// Injection du code HTML des notifications dans Workspace pour TESTER
function appendNotifHtml() {
	GetAgentFrame().$(".BodyWorkspace").append(`
		<div class="wrap-notif-appel">
			<div class="container-notif">
				<div id="call-container" class="draggable">
					<button id="call" class="history-button">
						<svg class="history-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M12 8v4l3 3"></path>
							<path d="M3.05 11a9 9 0 1 1 .5 4"></path>
							<path d="M2 2v5h5"></path>
						</svg>
						<span class="button-text">Historique A.E.</span>
					</button>
				</div>
			</div>
		</div>
	`);

	// Добавляем функционал перетаскивания
	initDraggable();
}

// Функция для инициализации перетаскивания
function initDraggable() {
	const container = window.top.document.getElementById('call-container');
	let isDragging = false;
	let currentY;
	let initialY;
	let startMouseY = 0; // Сохраняем начальную позицию мыши
	let yOffset = 0;
	let dragStartTime = 0;
	let hasMoved = false;
	let wasRealDrag = false; // Флаг, указывающий что это было именно перетаскивание, а не клик
	let lastY = 0;
	let animationFrameId = null;
	let totalDragDistance = 0; // Общее расстояние перетаскивания
	let lastMoveTime = 0; // Время последнего движения мыши

	const dragStart = (e) => {
		if (e.type === "touchstart") {
			initialY = e.touches[0].clientY - yOffset;
			lastY = e.touches[0].clientY;
			startMouseY = e.touches[0].clientY;
		} else {
			initialY = e.clientY - yOffset;
			lastY = e.clientY;
			startMouseY = e.clientY;
		}

		if (e.target.closest('.history-button')) {
			isDragging = true;
			dragStartTime = Date.now();
			lastMoveTime = dragStartTime;
			hasMoved = false;
			wasRealDrag = false;
			totalDragDistance = 0; // Сбрасываем общее расстояние
			container.classList.add('dragging');

			// Отменяем предыдущую анимацию, если она есть
			if (animationFrameId) {
				cancelAnimationFrame(animationFrameId);
			}
		}
	};

	const dragEnd = (e) => {
		if (!isDragging) return;

		const dragDuration = Date.now() - dragStartTime;
		const timeSinceLastMove = Date.now() - lastMoveTime;

		// Определяем конечную позицию мыши
		const endMouseY = e.type === "touchend" ?
			(e.changedTouches[0] ? e.changedTouches[0].clientY : startMouseY) :
			(e.clientY || startMouseY);

		// Расстояние между начальной и конечной позицией
		const totalDistance = Math.abs(endMouseY - startMouseY);

		initialY = currentY;
		isDragging = false;
		container.classList.remove('dragging');

		// Сохраняем позицию в localStorage
		localStorage.setItem('historyButtonPosition', container.style.top);

		// Открываем модальное окно ТОЛЬКО если:
		// 1. НЕ было значительного перетаскивания (wasRealDrag = false)
		// 2. Общее расстояние перемещения меньше порога
		// 3. Время между нажатием и отпусканием меньше 300 мс (короткий клик)
		// 4. Не было длительного ожидания между последним движением и отпусканием
		if (!wasRealDrag &&
			totalDistance < 5 &&
			totalDragDistance < 8 &&
			dragDuration < 300 &&
			timeSinceLastMove < 200) {
			showCallHistoryModal();
		}
	};

	const drag = (e) => {
		if (!isDragging) return;

		e.preventDefault();

		const currentMouseY = e.type === "touchmove" ? e.touches[0].clientY : e.clientY;
		const currentTime = Date.now();

		// Вычисляем разницу между текущей и предыдущей позицией мыши
		const deltaY = currentMouseY - lastY;
		lastY = currentMouseY;

		// Обновляем время последнего движения
		lastMoveTime = currentTime;

		// Накапливаем общее расстояние перетаскивания (по модулю)
		totalDragDistance += Math.abs(deltaY);

		// Обновляем позицию с учетом дельты
		currentY = currentY + deltaY;
		yOffset = currentY;

		// Если было какое-либо значительное движение, отмечаем это
		if (Math.abs(deltaY) > 2 || totalDragDistance > 5) {
			hasMoved = true;
		}

		// Если общее расстояние перетаскивания превысило порог, считаем это реальным перетаскиванием
		if (totalDragDistance > 15 || Math.abs(currentMouseY - startMouseY) > 10) {
			wasRealDrag = true;
		}

		// Получаем высоту видимой области окна
		const windowHeight = window.top.innerHeight || window.innerHeight;

		// Ограничения для верхней и нижней границы
		const topMargin = 50; // верхняя граница опущена на 50px от верха экрана
		const footerHeight = 50; // базовая высота футера
		const bottomMargin = 30; // дополнительный отступ от футера

		// Устанавливаем минимальное и максимальное значение Y
		const minY = topMargin; // минимальная позиция (верхняя граница)
		const maxY = windowHeight - container.offsetHeight - (footerHeight + bottomMargin); // максимальная позиция (нижняя граница)

		// Ограничиваем движение по вертикали в пределах указанных границ
		const boundedY = Math.min(Math.max(minY, currentY), maxY);

		// Используем requestAnimationFrame для плавного обновления позиции
		if (animationFrameId) {
			cancelAnimationFrame(animationFrameId);
		}

		animationFrameId = requestAnimationFrame(() => {
			container.style.top = `${boundedY}px`;
			container.style.bottom = 'auto';
		});
	};

	// Загружаем сохраненную позицию
	const savedPosition = localStorage.getItem('historyButtonPosition');
	if (savedPosition) {
		container.style.top = savedPosition;
		container.style.bottom = 'auto';
		// Устанавливаем начальное значение currentY
		currentY = parseInt(savedPosition) || 0;
		yOffset = currentY;
	}

	// Добавляем обработчики событий
	container.addEventListener('mousedown', dragStart);
	container.addEventListener('touchstart', dragStart, { passive: false });

	window.top.document.addEventListener('mousemove', drag);
	window.top.document.addEventListener('touchmove', drag, { passive: false });

	window.top.document.addEventListener('mouseup', dragEnd);
	window.top.document.addEventListener('touchend', dragEnd);
}

// Fonction pour sauvegarder les informations d'un appel dans localStorage
function saveCallToHistory(callId, telClient, campagne) {
	// Récupérer l'historique actuel des appels depuis localStorage
	let callHistory = [];
	const storedHistory = localStorage.getItem($callHistoryKey);

	if (storedHistory) {
		try {
			callHistory = JSON.parse(storedHistory);
		} catch (e) {
			console.error('Erreur lors de la lecture de l\'historique des appels depuis localStorage:', e);
			callHistory = [];
		}
	}

	// Ajouter un nouvel appel à l'historique
	const callInfo = {
		id: callId,
		telClient: telClient,
		campagne: campagne,
		timestamp: Date.now(), // temps actuel en millisecondes
		date: new Date().toISOString() // format de date ISO pour faciliter le filtrage
	};

	// Vérifier si un appel avec cet ID existe déjà
	const existingCallIndex = callHistory.findIndex(call => call.id === callId);
	if (existingCallIndex === -1) {
		callHistory.push(callInfo);
	}

	// Supprimer les enregistrements datant de plus d'un mois (30 jours)
	const oneMonthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
	callHistory = callHistory.filter(call => call.timestamp >= oneMonthAgo);

	// Sauvegarder l'historique mis à jour dans localStorage
	try {
		localStorage.setItem($callHistoryKey, JSON.stringify(callHistory));
		console.log(`Appel sauvegardé dans l'historique. Total: ${callHistory.length} appels. Les appels antérieurs à 30 jours ont été supprimés.`);
	} catch (e) {
		console.error('Erreur lors de l\'enregistrement de l\'historique des appels dans localStorage:', e);
	}
}

// Fonction pour obtenir l'historique des appels depuis localStorage avec filtrage par période
function getCallHistory(period = 'day') {
	let callHistory = [];
	const storedHistory = localStorage.getItem($callHistoryKey);

	if (storedHistory) {
		try {
			callHistory = JSON.parse(storedHistory);
		} catch (e) {
			console.error('Erreur lors de la lecture de l\'historique des appels depuis localStorage:', e);
			return [];
		}
	}

	// Filtrage par période
	const now = Date.now();
	let filterTime;

	switch (period) {
		case 'day':
			filterTime = now - 24 * 60 * 60 * 1000; // dernières 24 heures
			break;
		case 'week':
			filterTime = now - 7 * 24 * 60 * 60 * 1000; // derniers 7 jours
			break;
		case 'month':
			filterTime = now - 30 * 24 * 60 * 60 * 1000; // derniers 30 jours
			break;
		default:
			filterTime = 0; // tous les enregistrements
	}

	return callHistory.filter(call => call.timestamp >= filterTime);
}

// Fonction pour créer et afficher une fenêtre modale avec l'historique des appels
function showCallHistoryModal() {
	// Сбрасываем анимацию кнопки истории при открытии модального окна
	resetHistoryButtonAnimation();

	// Si la fenêtre modale existe déjà, on met simplement à jour les données et on l'affiche
	if (callHistoryModal) {
		populateCallHistoryTable('day'); // Par défaut, afficher les données des dernières 24h
		callHistoryModal.style.display = 'flex';
		return;
	}

	// Créer la fenêtre modale
	callHistoryModal = window.top.document.createElement('div');
	callHistoryModal.className = 'call-history-modal';
	callHistoryModal.innerHTML = `
        <div class="call-history-content">
            <div class="call-history-header">
                <div class="header-left">
                    <button class="clear-history-btn" title="Vider l'historique">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M3 6h18"></path>
                            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path>
                        </svg>
                    </button>
                    <h2>Historique des appels entrants en attente</h2>
                </div>
                <div class="header-right">
                    <div class="call-history-filters">
                        <button class="filter-btn active" data-period="day">24 heures</button>
                        <button class="filter-btn" data-period="week">7 jours</button>
                        <button class="filter-btn" data-period="month">30 jours</button>
                    </div>
                    <div class="export-buttons">
                        <button class="export-btn export-excel" title="Exporter en Excel">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"></path>
                                <polyline points="7 10 12 15 17 10"></polyline>
                                <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                            Excel
                        </button>
                        <button class="export-btn export-csv" title="Exporter en CSV">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"></path>
                                <polyline points="7 10 12 15 17 10"></polyline>
                                <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                            CSV
                        </button>
                    </div>
                    <span class="close-modal">&times;</span>
                </div>
            </div>
            <div class="call-history-table-container">
                <table class="call-history-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Numéro de téléphone</th>
                            <th>Campagne</th>
                            <th>Date et heure</th>
                        </tr>
                    </thead>
                    <tbody>
                        <!-- Les données seront ajoutées dynamiquement -->
                    </tbody>
                </table>
            </div>
        </div>
    `;

	window.top.document.body.appendChild(callHistoryModal);

	// Ajouter des gestionnaires d'événements
	const closeBtn = callHistoryModal.querySelector('.close-modal');
	closeBtn.addEventListener('click', function () {
		callHistoryModal.style.display = 'none';
	});

	// Fermeture de la fenêtre modale lors d'un clic en dehors de son contenu
	callHistoryModal.addEventListener('click', function (event) {
		if (event.target === callHistoryModal) {
			callHistoryModal.style.display = 'none';
		}
	});

	// Gestionnaires pour les boutons de filtrage
	const filterButtons = callHistoryModal.querySelectorAll('.filter-btn');
	filterButtons.forEach(button => {
		button.addEventListener('click', function () {
			// Supprimer la classe active de tous les boutons
			filterButtons.forEach(btn => btn.classList.remove('active'));
			// Ajouter la classe active au bouton actuel
			this.classList.add('active');
			// Obtenir la période et mettre à jour le tableau
			const period = this.getAttribute('data-period');
			populateCallHistoryTable(period);
		});
	});

	// Ajout de l'événement pour le bouton de nettoyage de l'historique
	const clearBtn = callHistoryModal.querySelector('.clear-history-btn');
	clearBtn.addEventListener('click', function () {
		showConfirmDialog('Êtes-vous sûr de vouloir effacer tout l\'historique des appels ?', clearCallHistory);
	});

	// Initialiser les boutons d'exportation
	initializeExportButtons();

	// Remplir le tableau avec des données (par défaut pour les dernières 24h)
	populateCallHistoryTable('day');

	// Afficher la fenêtre modale
	callHistoryModal.style.display = 'flex';
}

// Fonction pour remplir le tableau avec des données
function populateCallHistoryTable(period) {
	const callHistory = getCallHistory(period);
	const tableBody = callHistoryModal.querySelector('.call-history-table tbody');

	// Очищаем текущую таблицу
	tableBody.innerHTML = '';

	if (callHistory.length === 0) {
		// Если нет данных, отображаем сообщение
		const emptyRow = document.createElement('tr');
		emptyRow.innerHTML = `<td colspan="4" style="text-align: center;">Aucune donnée pour la période sélectionnée</td>`;
		tableBody.appendChild(emptyRow);
		return;
	}

	// Сортируем звонки по времени (новые сверху)
	callHistory.sort((a, b) => b.timestamp - a.timestamp);

	// Добавляем строки в таблицу
	callHistory.forEach(call => {
		const row = document.createElement('tr');
		const date = new Date(call.timestamp);
		const formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;

		row.innerHTML = `
            <td>${call.id}</td>
            <td>${call.telClient}</td>
            <td>${call.campagne}</td>
            <td>${formattedDate}</td>
        `;

		// Проверяем, есть ли этот звонок в списке пропущенных уведомлений
		const missedNotification = $missedNotifications.find(missed => missed.id === call.id);
		if (missedNotification) {
			row.classList.add('history-table-missed-row');
			// Добавляем класс пульсации только для непрочитанных уведомлений
			if (!missedNotification.isRead) {
				row.classList.add('pulse');
			}
		}

		tableBody.appendChild(row);

		// Проверяем, обрезан ли текст в ячейках и добавляем класс, если необходимо
		const cells = row.querySelectorAll('td');
		cells.forEach(cell => {
			if (cell.scrollWidth > cell.clientWidth) {
				cell.classList.add('truncated');
			}
		});
	});
}

// Fonction pour exporter le tableau au format Excel
function exportTableToExcel(period) {
	// Ajouter une animation de chargement
	const exportBtn = callHistoryModal.querySelector('.export-excel');
	exportBtn.classList.add('loading');
	const originalContent = exportBtn.innerHTML;
	exportBtn.innerHTML = '<div class="loading-spinner"></div> Excel';

	setTimeout(() => {
		try {
			const callHistory = getCallHistory(period);
			if (callHistory.length === 0) {
				alert('Aucune donnée à exporter pour la période sélectionnée');
				exportBtn.classList.remove('loading');
				exportBtn.innerHTML = originalContent;
				return;
			}

			// Trier les appels par heure (les plus récents d'abord)
			callHistory.sort((a, b) => b.timestamp - a.timestamp);

			// Créer un nouveau classeur
			const wb = XLSX.utils.book_new();

			// Préparer les données avec les en-têtes
			const headers = ['ID', 'Numéro de téléphone', 'Campagne', 'Date et heure'];
			const rows = callHistory.map(call => {
				const date = new Date(call.timestamp);
				const formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
				return [
					call.id,
					call.telClient,
					call.campagne,
					formattedDate
				];
			});

			// Créer une feuille de calcul avec les en-têtes
			const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

			// Définir les styles
			ws['!cols'] = [
				{ wch: 45 },  // ID - plus large pour les longs identifiants
				{ wch: 15 },  // Numéro de téléphone
				{ wch: 15 },  // Campagne
				{ wch: 20 }   // Date et heure
			];

			// Appliquer les styles aux cellules
			const range = XLSX.utils.decode_range(ws['!ref']);

			// Style pour les en-têtes
			const headerStyle = {
				fill: {
					fgColor: { rgb: "E6E1F0" }, // Светло-фиолетовый цвет как на скриншоте
					patternType: "solid"
				},
				font: {
					bold: true,
					color: { rgb: "000000" } // Черный цвет для текста
				},
				alignment: {
					horizontal: "center",
					vertical: "center"
				},
				border: {
					top: { style: "thin", color: { rgb: "000000" } },
					bottom: { style: "thin", color: { rgb: "000000" } },
					left: { style: "thin", color: { rgb: "000000" } },
					right: { style: "thin", color: { rgb: "000000" } }
				}
			};

			// Style pour les cellules de données
			const cellStyle = {
				alignment: {
					horizontal: "left",
					vertical: "center"
				},
				border: {
					top: { style: "thin", color: { rgb: "000000" } },
					bottom: { style: "thin", color: { rgb: "000000" } },
					left: { style: "thin", color: { rgb: "000000" } },
					right: { style: "thin", color: { rgb: "000000" } }
				}
			};

			// Appliquer les styles
			for (let C = range.s.c; C <= range.e.c; C++) {
				// Style des en-têtes
				const headerCell = XLSX.utils.encode_cell({ r: 0, c: C });
				ws[headerCell].s = headerStyle;

				// Style des cellules de données
				for (let R = 1; R <= range.e.r; R++) {
					const cell = XLSX.utils.encode_cell({ r: R, c: C });
					if (ws[cell]) ws[cell].s = cellStyle;
				}
			}

			// Ajouter la feuille au classeur
			XLSX.utils.book_append_sheet(wb, ws, "Historique des appels");

			// Générer le fichier Excel
			const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
			const periodLabel = {
				'day': '24h',
				'week': '7j',
				'month': '30j'
			}[period];

			// Sauvegarder le fichier
			XLSX.writeFile(wb, `historique_appels_${periodLabel}_${timestamp}.xlsx`);

			console.log(`Exportation Excel de l'historique des appels pour la période: ${period}`);
		} catch (error) {
			console.error('Erreur lors de l\'exportation Excel:', error);
			alert('Erreur lors de l\'exportation. Veuillez réessayer.');
		} finally {
			// Enlever l'animation de chargement
			exportBtn.classList.remove('loading');
			exportBtn.innerHTML = originalContent;
		}
	}, 500);
}

// Fonction pour exporter le tableau au format CSV
function exportTableToCSV(period) {
	// Ajouter une animation de chargement
	const exportBtn = callHistoryModal.querySelector('.export-csv');
	exportBtn.classList.add('loading');
	const originalContent = exportBtn.innerHTML;
	exportBtn.innerHTML = '<div class="loading-spinner"></div> CSV';

	setTimeout(() => {
		try {
			const callHistory = getCallHistory(period);
			if (callHistory.length === 0) {
				alert('Aucune donnée à exporter pour la période sélectionnée');
				exportBtn.classList.remove('loading');
				exportBtn.innerHTML = originalContent;
				return;
			}

			// Trier les appels par heure (les plus récents d'abord)
			callHistory.sort((a, b) => b.timestamp - a.timestamp);

			// Créer un contenu CSV avec BOM UTF-8 для поддержки французских символов
			let csvContent = '\uFEFF';

			// Ajouter les en-têtes
			const headers = ['ID', 'Numéro de téléphone', 'Campagne', 'Date et heure'];
			csvContent += headers.join(';') + '\r\n';

			// Ajouter les lignes
			callHistory.forEach(call => {
				const date = new Date(call.timestamp);
				const formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;

				// Échapper les données pour le format CSV
				const row = [
					call.id,
					call.telClient,
					call.campagne,
					formattedDate
				].map(field => {
					// Si le champ contient des caractères spéciaux, l'entourer de guillemets
					if (field.includes(';') || field.includes('"') || field.includes('\n')) {
						return `"${field.replace(/"/g, '""')}"`;
					}
					return field;
				});

				csvContent += row.join(';') + '\r\n';
			});

			// Créer un blob et le télécharger
			const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
			const url = URL.createObjectURL(blob);
			const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
			const periodLabel = {
				'day': '24h',
				'week': '7j',
				'month': '30j'
			}[period];

			const link = document.createElement('a');
			link.href = url;
			link.setAttribute('download', `historique_appels_${periodLabel}_${timestamp}.csv`);
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);

			console.log(`Exportation CSV de l'historique des appels pour la période: ${period}`);
		} catch (error) {
			console.error('Erreur lors de l\'exportation CSV:', error);
			alert('Erreur lors de l\'exportation. Veuillez réessayer.');
		} finally {
			// Enlever l'animation de chargement
			exportBtn.classList.remove('loading');
			exportBtn.innerHTML = originalContent;
		}
	}, 500);
}

// Mise à jour des gestionnaires d'événements pour les boutons d'exportation
function initializeExportButtons() {
	const excelBtn = callHistoryModal.querySelector('.export-excel');
	const csvBtn = callHistoryModal.querySelector('.export-csv');

	excelBtn.addEventListener('click', function () {
		const activePeriod = callHistoryModal.querySelector('.filter-btn.active').getAttribute('data-period');
		exportTableToExcel(activePeriod);
	});

	csvBtn.addEventListener('click', function () {
		const activePeriod = callHistoryModal.querySelector('.filter-btn.active').getAttribute('data-period');
		exportTableToCSV(activePeriod);
	});
}

// Fonction pour vider l'historique des appels
function clearCallHistory() {
	try {
		// Récupérer l'historique actuel des appels depuis localStorage
		const storedHistory = localStorage.getItem($callHistoryKey);
		if (!storedHistory) {
			console.log('Aucun historique d\'appels à effacer');
			return;
		}

		// Supprimer l'historique des appels
		localStorage.removeItem($callHistoryKey);
		console.log('Historique des appels effacé avec succès');

		// Mettre à jour l'affichage de la table
		populateCallHistoryTable('day');

	} catch (error) {
		console.error('Erreur lors de l\'effacement de l\'historique des appels:', error);
		alert('Erreur lors de l\'effacement de l\'historique. Veuillez réessayer.');
	}
}

// Fonction pour afficher une boîte de dialogue de confirmation
function showConfirmDialog(message, onConfirm) {
	// Créer un overlay
	const overlay = window.top.document.createElement('div');
	overlay.className = 'confirm-overlay';

	// Créer la boîte de dialogue
	const dialog = window.top.document.createElement('div');
	dialog.className = 'confirm-dialog';
	dialog.innerHTML = `
        <div class="confirm-dialog-content">
            <p>${message}</p>
            <div class="confirm-dialog-buttons">
                <button class="confirm-dialog-button confirm-yes">Oui</button>
                <button class="confirm-dialog-button confirm-no">Non</button>
            </div>
        </div>
    `;

	// Ajouter les éléments au DOM
	window.top.document.body.appendChild(overlay);
	window.top.document.body.appendChild(dialog);

	// Gestionnaires d'événements
	const yesButton = dialog.querySelector('.confirm-yes');
	const noButton = dialog.querySelector('.confirm-no');

	yesButton.addEventListener('click', function () {
		// Exécuter la callback de confirmation
		onConfirm();
		// Fermer la boîte de dialogue
		overlay.remove();
		dialog.remove();
	});

	noButton.addEventListener('click', function () {
		// Fermer la boîte de dialogue
		overlay.remove();
		dialog.remove();
	});

	// Fermer la boîte de dialogue en cliquant sur l'overlay
	overlay.addEventListener('click', function () {
		overlay.remove();
		dialog.remove();
	});
}

// Функция для обработки непоказанных уведомлений
function handleMissedNotifications(callId, telClient, campagne) {
	// Проверяем, не превышено ли максимальное количество отображаемых уведомлений
	const activeNotifications = Object.keys($displayedNotifications).length;

	if (activeNotifications >= maxPopups) {
		// Добавляем информацию о пропущенном звонке в массив
		$missedNotifications.push({
			id: callId,
			telClient: telClient,
			campagne: campagne,
			timestamp: Date.now(),
			isRead: false
		});

		// Увеличиваем счетчик пропущенных уведомлений
		$missedNotificationsCount++;

		// Сохраняем звонок в историю, даже если уведомление не было показано
		saveCallToHistory(callId, telClient, campagne);

		// Обновляем статистику звонков
		updateCallStatistics(callId, 'notDisplayed');

		// Запускаем анимацию кнопки истории
		animateHistoryButton();

		console.warn(`Уведомление для звонка ${callId} не было показано из-за ограничения количества уведомлений. Всего пропущено: ${$missedNotificationsCount}`);
		return true; // Уведомление не показано
	}

	return false; // Уведомление может быть показано
}

// Функция для анимации кнопки истории
function animateHistoryButton() {
	const historyButton = window.top.document.getElementById('call');
	if (!historyButton) return;

	// Добавляем класс для пульсации
	historyButton.classList.add('pulse-animation');

	// Обновляем текст кнопки, добавляя счетчик пропущенных уведомлений
	const buttonText = historyButton.querySelector('.button-text');
	if (buttonText) {
		buttonText.innerHTML = `Historique A.E. <span class="missed-counter">${$missedNotificationsCount}</span>`;
	}

}

// Функция для сброса анимации кнопки истории
function resetHistoryButtonAnimation() {
	const historyButton = window.top.document.getElementById('call');
	if (!historyButton) return;

	// Удаляем класс для пульсации
	historyButton.classList.remove('pulse-animation');

	// Сбрасываем текст кнопки
	const buttonText = historyButton.querySelector('.button-text');
	if (buttonText) {
		buttonText.textContent = 'Historique A.E.';
	}

	// Отмечаем все пропущенные уведомления как прочитанные
	$missedNotifications.forEach(notification => {
		notification.isRead = true;
	});

	// Сбрасываем счетчик
	$missedNotificationsCount = 0;
}

// Fonction pour créer une notification Windows native
function createWindowsNotification(callId, telClient, campagne) {
	const iconUrl = 'https://images.centrerelationsclients.com/Clochette/Notif_Entrant/icon-incall.png';
	const title = `📱 ${telClient} vous appelle\nHèrmes.net`;

	// Créer une balise unique pour chaque notification
	const uniqueTag = `call-${callId}-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

	const options = {
		body: `\nCampagne : "${campagne}"`,
		icon: iconUrl,
		tag: uniqueTag, // Tag complètement unique pour chaque notification
		requireInteraction: true, // Obligatoire pour que la notification ne se ferme pas automatiquement
		silent: false, // Autoriser explicitement le son pour chaque notification
		timestamp: Date.now(),
		data: {
			callId: callId,
			createdAt: Date.now(),
			uniqueId: Math.random().toString(36).substring(2, 15) // Identifiant unique supplémentaire
		}
	};

	// Créer la notification
	const notification = new Notification(title, options);

	// Ajouter un gestionnaire de fermeture pour la journalisation
	notification.onclose = function () {
		console.warn(`La notification d'appel ${callId} a été fermée. Cela peut être dû à une fermeture explicite ou automatique.`);

		// Supprimer la notification de la liste des notifications affichées
		if ($displayedNotifications[callId]) {
			delete $displayedNotifications[callId];
		}
	};

	// Gestionnaire de clic sur la notification
	notification.onclick = function () {
		// Marquer que la notification a été cliquée
		if ($displayedNotifications[callId]) {
			$displayedNotifications[callId].clicked = true;
		}

		try {
			// Reproduire un son court pour activer la fenêtre
			const audio = new Audio("data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==");
			audio.play().catch(e => { });

			// Fermer la notification lors du clic
			this.close();
			console.log(`La notification d'appel ${callId} a été fermée après un clic de l'utilisateur.`);

			// Focaliser la fenêtre
			window.top.focus();

			// Envoyer un message pour activer la fenêtre
			window.top.postMessage('FOCUS_WINDOW', '*');

			console.log("L'utilisateur a cliqué sur la notification d'appel: " + callId);
		} catch (error) {
			console.error('Erreur lors de la tentative d\'activation de la fenêtre:', error);
		}
	};

	// Sauvegarder la notification dans la liste des notifications affichées
	$displayedNotifications[callId] = {
		element: notification,
		telClient: telClient,
		campagne: campagne,
		clicked: false,
		createdAt: Date.now(),
		tag: uniqueTag // Sauvegarder le tag pour le suivi
	};

	// Sauvegarder l'appel dans l'historique
	saveCallToHistory(callId, telClient, campagne);

	// Vérifier le nombre de notifications actives
	const activeNotifications = Object.keys($displayedNotifications).length;
	console.log(`Notifications actives: ${activeNotifications}`);

	// Reproduire le son
	const audio = new Audio('https://images.centrerelationsclients.com/Clochette/Notif_Entrant/rington_for_workspace_hermes.mp3');
	audio.volume = 0.7;
	audio.play().catch(error => {
		console.error('Erreur de lecture audio:', error);
	});
}

// Déclaration de la fonction pour vider les popups
function removePopups() {
	// Fermer toutes les notifications natives
	Object.values($displayedNotifications).forEach(notifData => {
		if (notifData.element && typeof notifData.element.close === 'function') {
			notifData.element.close();
		}
	});

	// Nettoyer l'objet de suivi des notifications affichées
	$displayedNotifications = {};

	// Réinitialiser le compteur de popups
	popupCounter = 0;
}

// +++++++++++++++++ Déclaration de la fonction qui affiche la notification
window.top["inject_notif_entrante"] = () => {
	// Extraire les identifiants d'appels actuels de $dataNotifEntrante
	let currentCallIds = $dataNotifEntrante.map(row => row[0]); // Supposé que l'ID est dans la première colonne

	// Obtenir tous les identifiants d'appels actuels de $currentCallData
	let allCurrentCallIds = $currentCallData.map(call => call.Id);

	// Trouver les nouveaux appels (présents dans les données actuelles mais pas dans les données précédentes)
	let newCallIds = currentCallIds.filter(id => !previousCallIds.includes(id));

	// Trouver les appels terminés
	// (qui étaient dans les données précédentes, ne sont pas dans $currentCallData et ne sont pas marqués comme traités)
	let endedCallIds = previousCallIds.filter(id =>
		!allCurrentCallIds.includes(id) &&
		// Vérifier la présence d'une notification pour cet appel
		$displayedNotifications[id]
	);

	// Trouver les appels déjà traités et affichés dans les notifications
	let processedDisplayedCallIds = [];
	if ($autoCloseNotifications) {
		processedDisplayedCallIds = Object.keys($displayedNotifications).filter(id =>
			$processedCallIds.includes(id) && // L'appel est déjà traité
			!allCurrentCallIds.includes(id)   // Et n'est pas dans le résultat de la requête actuelle
		);
	}

	// НОВАЯ ЛОГИКА: Не закрываем уведомления при завершении звонков
	// Вместо этого полагаемся на таймер в createGroupedWindowsNotification

	console.log(`Traitement des données: tous les appels actuels=${allCurrentCallIds.length}, nouveaux appels=${newCallIds.length}, appels terminés=${endedCallIds.length}, traités affichés=${processedDisplayedCallIds.length}, fermeture auto=${$autoCloseNotifications}`);

	// НОВАЯ ЛОГИКА: Группируем все текущие звонки в одно уведомление
	if (newCallIds.length > 0) {
		// Собираем информацию о новых звонках
		const newCalls = newCallIds.map(id => {
			const row = $dataNotifEntrante.find(row => row[0] === id);
			return {
				id: id,
				telClient: row[6], // Téléphone du client (index 6)
				campagne: row[7]  // Nom de la campagne (index 7)
			};
		});

		// Создаем групповое уведомление для всех новых звонков
		createGroupedWindowsNotification(newCalls);
		console.log(`Создано групповое уведомление для ${newCalls.length} новых звонков`);

		// Добавляем ID новых звонков в список обработанных
		newCallIds.forEach(id => {
			if (!$processedCallIds.includes(id)) {
				$processedCallIds.push(id);
			}
		});
	}

	// НЕ закрываем уведомления при завершении звонков
	// Вместо этого обновляем статистику для завершенных звонков
	endedCallIds.forEach(id => {
		// Обновляем статистику звонков как пропущенный
		updateCallStatistics(id, 'missed');

		// НЕ удаляем уведомление из списка отображаемых
		// Это будет сделано автоматически через таймер в createGroupedWindowsNotification
	});

	// НЕ закрываем автоматически уведомления обработанных звонков
	// Вместо этого полагаемся на таймер в createGroupedWindowsNotification

	// Mettre à jour previousCallIds pour le cycle suivant, y compris tous les appels de $currentCallData
	previousCallIds = allCurrentCallIds.slice();

	// Nettoyer $dataNotifEntrante pour le cycle suivant
	$dataNotifEntrante = [];

	console.warn('Notification mise à jour');
}

// Функция для обновления статистики звонков
function updateCallStatistics(callId, status) {
	// Получаем текущую статистику из localStorage
	let callStats = JSON.parse(localStorage.getItem('fimainfo_call_statistics') || '{}');

	// Инициализируем счетчики, если их нет
	if (!callStats.total) callStats.total = 0;
	if (!callStats.answered) callStats.answered = 0;
	if (!callStats.missed) callStats.missed = 0;
	if (!callStats.notDisplayed) callStats.notDisplayed = 0;
	if (!callStats.details) callStats.details = [];

	// Увеличиваем общий счетчик
	callStats.total++;

	// Увеличиваем соответствующий счетчик в зависимости от статуса
	if (status === 'answered') {
		callStats.answered++;
	} else if (status === 'missed') {
		callStats.missed++;
	} else if (status === 'notDisplayed') {
		callStats.notDisplayed++;
	}

	// Добавляем детали звонка
	const callData = $currentCallData.find(call => call.Id === callId);
	if (callData) {
		callStats.details.push({
			id: callId,
			telClient: callData.TelClient,
			campagne: callData.NomCampagne,
			status: status,
			timestamp: new Date().toISOString()
		});
	}

	// Ограничиваем количество деталей, чтобы не перегружать localStorage
	if (callStats.details.length > 100) {
		callStats.details = callStats.details.slice(-100);
	}

	// Сохраняем обновленную статистику
	localStorage.setItem('fimainfo_call_statistics', JSON.stringify(callStats));

	console.log(`Статистика звонков обновлена: ${status} (ID: ${callId})`);
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

		// Проверяем изменился ли счетчик в любую сторону
		if ($inCallsCounter !== $newInCallsCounter) {
			$newInCallsCounter = $inCallsCounter;
			main().then(() => {
				console.warn('Code after MAIN function');
			}).catch(error => {
				console.error('Error in main:', error);
			});
		} else {
			$newInCallsCounter = $inCallsCounter;
			//console.warn('Aucun changement détecté');
		}
	} else {
		console.log('Pas d\'éléments <td> suffisants dans le <span id="Pan_Queue">');
	}
	setTimeout(callsCounter, 100);
}


// ===================================================================================================================

// Declaration de la fonction qui surveille les appels entrants
function monitorInCalls() {
	const agentLink = GetAgentLink();
	if (agentLink && agentLink.Telephony && agentLink.Telephony.Sessions && agentLink.Telephony.Sessions._data[0]) {
		const sessionData = agentLink.Telephony.Sessions._data[0];
		// Récupérons les valeurs actuelles de CampaignId et de ContactNumber
		const currentCampaignId = sessionData.CampaignId ? sessionData.CampaignId.split('-')[1] || sessionData.CampaignId : null;
		const currentContactNumber = sessionData.ContactNumber ? sessionData.ContactNumber.split('-')[1] || sessionData.ContactNumber : null;
		// Vérifions si les données ont changé
		if (
			(!$inCallsAnswered[0] || $inCallsAnswered[0].CampaignId !== currentCampaignId) ||
			(!$inCallsAnswered[0] || $inCallsAnswered[0].ContactNumber !== currentContactNumber)
		) {
			// Vidons le tableau et ajoutons les nouvelles données
			$inCallsAnswered.length = 0;
			$inCallsAnswered.push({
				CampaignId: currentCampaignId,
				ContactNumber: currentContactNumber
			});
			console.warn("Données mises à jour $inCallsAnswered:", $inCallsAnswered);

			// Мы больше не обновляем флаг InCallAnswered, так как он не нужен для автоматического закрытия попапов
			// reqUpdateAnsweredCallFlag(); - это больше не выполняется
		}
	} else {
		console.warn("Données de session indisponibles, nouvelle vérification...");
	}
	setTimeout(monitorInCalls, 1000);
}



// Declaration de la fonction principale
async function main() {
	console.warn('DEBUT MAIN');
	await reqSelectDataCall();
	console.table('DATA NOTIF', $dataNotifEntrante);
	window.top.inject_notif_entrante();

	// Обновляем статус пропущенных уведомлений
	updateMissedNotificationsStatus();

	// Очищаем старые идентификаторы звонков, если прошло слишком много времени
	// (например, удаляем записи старше 1 часа)
	const oneHourAgo = new Date().getTime() - 60 * 60 * 1000;
	if ($currentCallData.length > 0) {
		// Очистка старых записей (например, каждые 100 запросов или по времени)
		if ($processedCallIds.length > 100) {
			console.warn('Очистка списка обработанных звонков (более 100 записей)');
			// Оставляем только последние 50 записей
			$processedCallIds = $processedCallIds.slice(-50);
		}
	}

	// Периодическая очистка localStorage от записей старше 30 дней
	// Выполняем очистку примерно раз в час (вероятность 1/100 при каждом вызове)
	if (Math.random() < 0.01) {
		try {
			const storedHistory = localStorage.getItem($callHistoryKey);
			if (storedHistory) {
				let callHistory = JSON.parse(storedHistory);
				const initialLength = callHistory.length;

				// Удаляем записи старше 30 дней
				const oneMonthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
				callHistory = callHistory.filter(call => call.timestamp >= oneMonthAgo);

				// Если были удалены какие-то записи, сохраняем обновленную историю
				if (callHistory.length < initialLength) {
					localStorage.setItem($callHistoryKey, JSON.stringify(callHistory));
					console.warn(`Очистка истории звонков: удалено ${initialLength - callHistory.length} записей старше 30 дней`);
				}
			}
		} catch (error) {
			console.error('Ошибка при очистке истории звонков:', error);
		}
	}
}

validateAndCreateView();

initializePopupContainer();
appendNotifHtml();
// Appeler la fonction pour charger le fichier CSS personnalisé dans le DOM de Hermes.net
loadCssFileInWorkspace('fimainfo_notifications.css');
monitorInCalls();

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
		// Action qui recupere le TEL du client + la CAMPAGNE ENTRANTE dans la base
		//window._g.wscript.ExecuteAction("req-notification", "", false);
		//main(); // Appeler la fonction qui affiche la notification
		//console.warn('Popup affiché');

		// Ajouter des données de test pour l'affichage dans l'historique des appels
		if (localStorage.getItem($callHistoryKey) === null) {
			// S'il n'y a pas de données, ajouter des données de démonstration
			const demoData = [
				{
					id: "123456",
					telClient: "+33 1 23 45 67 89",
					campagne: "Campagne Test 1",
					timestamp: Date.now() - 30 * 60 * 1000, // il y a 30 minutes
					date: new Date(Date.now() - 30 * 60 * 1000).toISOString()
				},
				{
					id: "123457",
					telClient: "+33 4 56 78 90 12",
					campagne: "Campagne Test 2",
					timestamp: Date.now() - 2 * 60 * 60 * 1000, // il y a 2 heures
					date: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
				},
				{
					id: "123458",
					telClient: "+33 6 78 90 12 34",
					campagne: "Campagne Test 3",
					timestamp: Date.now() - 25 * 60 * 60 * 1000, // il y a 1 jour
					date: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()
				},
				{
					id: "123459",
					telClient: "+33 7 89 01 23 45",
					campagne: "Campagne Test 4",
					timestamp: Date.now() - 5 * 24 * 60 * 60 * 1000, // il y a 5 jours
					date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
				},
				{
					id: "123460",
					telClient: "+33 9 01 23 45 67",
					campagne: "Campagne Test 5",
					timestamp: Date.now() - 20 * 24 * 60 * 60 * 1000, // il y a 20 jours
					date: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString()
				}
			];

			localStorage.setItem($callHistoryKey, JSON.stringify(demoData));
			console.log("Données de démonstration pour l'historique des appels ajoutées");
		}

		// Changer le gestionnaire de clic du bouton S.A. pour afficher l'historique des appels
		showCallHistoryModal();
	});
} else {
	console.error("Bouton de Test non trouvé");
}

//----------------------------------------------------------------------------------------------
//----------------------------------------------------------------------------------------------

// Init container popups
function initializePopupContainer() {
	if (!popupContainer) {
		popupContainer = window.top.document.createElement('div');
		popupContainer.className = 'popup-container';
		popupContainer.style.display = 'none'; // Изначально скрываем контейнер
		window.top.document.body.appendChild(popupContainer);
	}
}


// Affichage du container des popup
function affichePopupContainer(isVisible) {
	if (popupContainer) {
		popupContainer.style.display = isVisible ? 'block' : 'none';
	}
}


// Функция для включения/выключения автоматического закрытия уведомлений
function toggleAutoCloseNotifications() {
	$autoCloseNotifications = !$autoCloseNotifications;
	console.log(`Fermeture automatique des notifications ${$autoCloseNotifications ? 'activée' : 'désactivée'}`);
	return $autoCloseNotifications;
}

// Функция для установки значения автоматического закрытия уведомлений
function setAutoCloseNotifications(value) {
	if (typeof value === 'boolean') {
		$autoCloseNotifications = value;
		console.log(`Fermeture automatique des notifications ${$autoCloseNotifications ? 'activée' : 'désactivée'}`);
	} else {
		console.error('La valeur doit être de type boolean (true/false)');
	}
	return $autoCloseNotifications;
}

//toggleAutoCloseNotifications() - bascule le mode de fermeture automatique
//setAutoCloseNotifications(value) - définit une valeur spécifique

// Fonction pour créer une notification Windows native
function showPopup(callId, telClient, campagne) {
	// Проверяем, не превышен ли лимит отображаемых уведомлений
	if (handleMissedNotifications(callId, telClient, campagne)) {
		return; // Если уведомление не может быть показано, возвращаемся
	}

	// Vérifier la prise en charge des notifications par le navigateur
	if (!("Notification" in window)) {
		console.error("Ce navigateur ne prend pas en charge les notifications de bureau");
		return;
	}

	// Vérifier l'autorisation d'envoyer des notifications
	if (Notification.permission === "granted") {
		// Si autorisé, créer une notification
		createWindowsNotification(callId, telClient, campagne);
	} else if (Notification.permission !== "denied") {
		// Si l'autorisation n'a pas encore été demandée, la demander
		Notification.requestPermission().then(permission => {
			if (permission === "granted") {
				createWindowsNotification(callId, telClient, campagne);
			}
		});
	}
}

// Функция для обновления статуса пропущенных уведомлений
function updateMissedNotificationsStatus() {
	// Проверяем, есть ли просроченные пропущенные уведомления (старше 1 часа)
	const oneHourAgo = Date.now() - 60 * 60 * 1000;
	// Фильтруем массив пропущенных уведомлений
	$missedNotifications = $missedNotifications.filter(notification => {
		// Удаляем просроченные уведомления или прочитанные уведомления
		return notification.timestamp >= oneHourAgo && !notification.isRead;
	});

	// Обновляем счетчик пропущенных уведомлений
	const newCount = $missedNotifications.length;

	// Если счетчик изменился, обновляем анимацию
	if (newCount !== $missedNotificationsCount) {
		$missedNotificationsCount = newCount;

		if (newCount > 0) {
			animateHistoryButton();
		} else {
			resetHistoryButtonAnimation();
		}
	}
}

// Функция для периодической проверки и закрытия старых попапов
function periodicNotificationCleanup() {
	// Получаем текущее время
	const currentTime = new Date().getTime();

	// Проверяем все отображаемые уведомления
	Object.keys($displayedNotifications).forEach(id => {
		const notifData = $displayedNotifications[id];

		if (notifData && notifData.element && typeof notifData.element.close === 'function') {
			// Вычисляем время жизни уведомления
			const notificationLifetime = currentTime - (notifData.createdAt || 0);

			// Если уведомление существует слишком долго - закрываем его
			if (notificationLifetime > maxNotificationLifetime) {
				console.log(`[Cleanup] Fermeture automatique de la notification trop ancienne pour l'appel ${id}. Durée de vie: ${notificationLifetime / 1000} sec.`);
				notifData.element.close();

				// Обновляем статистику звонков как пропущенный
				updateCallStatistics(id, 'missed');

				// Удаляем из списка отображаемых уведомлений
				delete $displayedNotifications[id];
			}
		}
	});

	// Запускаем проверку каждые 5 секунд
	setTimeout(periodicNotificationCleanup, 5000);
}

// Запускаем периодическую проверку при загрузке скрипта
periodicNotificationCleanup();

// Функция для создания группового уведомления Windows со всеми текущими звонками
function createGroupedWindowsNotification(calls) {
	if (!calls || calls.length === 0) return;

	const iconUrl = 'https://images.centrerelationsclients.com/Clochette/Notif_Entrant/icon-incall.png';
	const title = `📱 ${calls.length} ${calls.length > 1 ? 'appels en attente' : 'appel en attente'}\nHèrmes.net`;

	// Создаем уникальный тег для группового уведомления
	const uniqueTag = `group-call-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

	// Формируем тело уведомления с информацией о каждом звонке
	let body = '';
	calls.forEach((call, index) => {
		body += `${index + 1}. ${call.telClient} - ${call.campagne}\n`;
	});


	const options = {
		body: body,
		icon: iconUrl,
		tag: uniqueTag,
		requireInteraction: true,
		silent: false,
		timestamp: Date.now(),
		data: {
			callIds: calls.map(call => call.id),
			createdAt: Date.now(),
			uniqueId: Math.random().toString(36).substring(2, 15)
		}
	};

	// Создаем уведомление
	const notification = new Notification(title, options);

	// Устанавливаем таймер для автоматического закрытия уведомления через 10 секунд
	setTimeout(() => {
		if (notification && typeof notification.close === 'function') {
			console.log(`Автоматическое закрытие группового уведомления через ${maxNotificationLifetime / 1000} секунд`);
			notification.close();

			// Обновляем статистику для всех звонков в уведомлении как пропущенные
			calls.forEach(call => {
				updateCallStatistics(call.id, 'missed');
			});
		}
	}, maxNotificationLifetime);

	// Добавляем обработчик закрытия
	notification.onclose = function () {
		console.warn(`Групповое уведомление для ${calls.length} звонков было закрыто.`);

		// Удаляем все звонки из списка отображаемых уведомлений
		calls.forEach(call => {
			if ($displayedNotifications[call.id]) {
				delete $displayedNotifications[call.id];
			}
		});
	};

	// Обработчик клика по уведомлению
	notification.onclick = function () {
		try {
			// Воспроизводим короткий звук для активации окна
			const audio = new Audio("data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==");
			audio.play().catch(e => { });

			// Закрываем уведомление при клике
			this.close();
			console.log(`Групповое уведомление для ${calls.length} звонков было закрыто после клика пользователя.`);

			// Фокусируем окно
			window.top.focus();

			// Отправляем сообщение для активации окна
			window.top.postMessage('FOCUS_WINDOW', '*');

			console.log("Пользователь кликнул на групповое уведомление");
		} catch (error) {
			console.error('Ошибка при попытке активации окна:', error);
		}
	};

	// Сохраняем уведомление в списке отображаемых уведомлений для каждого звонка
	calls.forEach(call => {
		$displayedNotifications[call.id] = {
			element: notification,
			telClient: call.telClient,
			campagne: call.campagne,
			clicked: false,
			createdAt: Date.now(),
			tag: uniqueTag,
			isGrouped: true
		};
	});

	// Воспроизводим звук
	const audio = new Audio('https://images.centrerelationsclients.com/Clochette/Notif_Entrant/rington_for_workspace_hermes.mp3');
	audio.volume = 0.7;
	audio.play().catch(error => {
		console.error('Ошибка воспроизведения аудио:', error);
	});
}
