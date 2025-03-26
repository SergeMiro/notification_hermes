// *** IMPORTANT ***
// le fichier "fimainfo_notifications.css" avec tout le code CSS du projet se trouve dans le dossier suivant : \\192.168.9.237\d\hermes_net_v5\PlateformPublication\Frameset_Includes\styles
// "fimainfo_notifications.css" est modfiable mais ne jamais doit etre deplacé.

// Добавляем обработчик сообщений для верхнего окна для фокусировки
if (window === window.top) {
	window.top.addEventListener('message', function (event) {
		if (event.data === 'FOCUS_WINDOW') {
			try {
				// Пытаемся сфокусировать и развернуть окно
				window.top.focus();

				// Разворачиваем окно, если оно минимизировано
				if (window.top.outerWidth <= 1 || window.top.outerHeight <= 1) {
					window.top.resizeTo(1024, 768); // Разумный размер по умолчанию
				}

				// Более агрессивный метод для активации окна в Windows
				try {
					// Мигание заголовка окна
					const originalTitle = document.title;
					const alertTitle = "⚠ NOUVEL APPEL ⚠";
					let titleInterval = setInterval(() => {
						document.title = document.title === originalTitle ? alertTitle : originalTitle;
					}, 500);

					// Останавливаем мигание через 5 секунд
					setTimeout(() => {
						clearInterval(titleInterval);
						document.title = originalTitle;
					}, 5000);

					// Открытие временного окна
					const tempWindow = window.open('about:blank', '_blank', 'width=1,height=1');
					if (tempWindow) setTimeout(() => tempWindow.close(), 500);

					// Попытка вызова focus несколько раз
					let focusAttempts = 0;
					const focusInterval = setInterval(() => {
						window.top.focus();
						focusAttempts++;
						if (focusAttempts >= 10) {
							clearInterval(focusInterval);
						}
					}, 100);
				} catch (e) {
					console.error("Ошибка при агрессивной фокусировке:", e);
				}

			} catch (error) {
				console.error('Ошибка при попытке активировать окно через postMessage:', error);
			}
		}
	}, false);
}

// ----------------------------- DECLARATION DES VARIABLES --------------------------------
// для SQL :
$db_client = "HN_GUYOT"
$customerId = 31;  // CustomerID à changer en fonction du client
$campaignType = 1; // 1 - entrants, 2 - sortants
$queuesType = "Queues";	// "Queues" - Campagnes entrants | "QueuesOutbound" - sortants

$view_notif = "Fimainfo_NotificationHermes_Clochette";
$cloud_1 = "192.168.9.236"
$cloud_2 = "192.168.9.237"
$cloud_4 = "c4-web.fimainfo.fr"

// для JS :
$inCallsCounter = 0;
$newInCallsCounter = 0;
$campaignAgent = [];
$listeVues = [];
$campaignsConnected = [];
$idsAgentCampaigns = [];
$dataNotif = [];
$inCallsAnswered = [];

$processedCallIds = []; // Массив для хранения Id звонков, которые уже были обработаны
$currentCallData = []; // Текущие данные о звонках после последнего запроса
$previousCallData = []; // Предыдущие данные о звонках

const maxPopups = 5;
const popups = [];
let popupCounter = 0;
let callAnimations = '';
let iconCallIn = '';
let iconCallMissed = '';
let popupContainer = null;
//let flagCallAnimation = false;

$notifNewLines = [];
$hiddenNotifications = {}; // { [callId]: timeoutId }
$displayedNotifications = {}; // { [callId]: popupElement }
let currentCallIds = []; // Текущие ID звонков
let previousCallIds = []; // Глобальная переменная для хранения предыдущих идентификаторов звонков

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
		$dataNotif = $currentCallData
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

		console.log('Отфильтрованные данные для отображения:', $dataNotif);
		console.log('Ранее обработанные звонки:', $processedCallIds);
	} catch (error) {
		console.error('Erreur lors de l\'exécution de la requête :', error);
		$dataNotif = [];
	}
}




async function reqUpdateAnsweredCallFlag() {
	try {
		const query = `
		UPDATE ${$db_client}.dbo.${$view_notif} 
		SET InCallAnswered = '1'
		WHERE IdCampagne = '${$inCallsAnswered[0].CampaignId}'
		AND TelClient = '${$inCallsAnswered[0].ContactNumber}';
		`;
		if (!$view_notif || !$db_client) {
			console.warn("");
			return;
		}

		await reqUpdate($db_client, query);
	} catch (error) {
		console.error(`Erreur d'Updade de Flag de l'appel entrant : ${$inCallsAnswered[0].ContactNumber}`, error);
	}
}















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
// 	console.table('waitForDataNotif', $dataNotif);
// 	while (typeof $dataNotif === 'undefined' || $dataNotif === '' || (Array.isArray($dataNotif) && $dataNotif.length === 0)) {
// 		await new Promise(resolve => setTimeout(resolve, 100));
// 	}
// 	console.log(`La variable est chargée : \n${$dataNotif}`);
// }
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



// Функция для создания нативного уведомления Windows
function createWindowsNotification(callId, telClient, campagne) {
	const iconUrl = 'https://images.centrerelationsclients.com/Clochette/Notif_Entrant/icon-incall.png';
	const title = `Appel entrant Hèrmes, campagne : "${campagne}"`;

	// Создаем уникальный тег для каждого уведомления, используя timestamp
	const uniqueTag = `call-${callId}-${Date.now()}`;

	const options = {
		body: `${telClient} vous appelle.`,
		icon: iconUrl,
		tag: uniqueTag, // Уникальный тег для каждого уведомления
		requireInteraction: true,
		silent: true,
		timestamp: Date.now(), // Добавляем timestamp для сортировки
		data: { // Добавляем дополнительные данные
			callId: callId,
			createdAt: Date.now()
		}
	};

	// Создаем уведомление
	const notification = new Notification(title, options);

	// Добавляем обработчик закрытия для логирования
	notification.onclose = function () {
		console.warn(`Уведомление о звонке ${callId} было закрыто. Это могло произойти из-за явного закрытия или автоматически.`);

		// Удаляем уведомление из списка отображаемых
		if ($displayedNotifications[callId]) {
			delete $displayedNotifications[callId];
		}
	};

	// Упрощенный обработчик клика на уведомление
	notification.onclick = function () {
		// Отмечаем, что на уведомление кликнули
		if ($displayedNotifications[callId]) {
			$displayedNotifications[callId].clicked = true;
		}

		try {
			// Воспроизводим короткий звук для активации окна
			const audio = new Audio("data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==");
			audio.play().catch(e => { });

			// Закрываем уведомление
			this.close();
			console.log(`Уведомление о звонке ${callId} закрыто после клика пользователя.`);

			// Фокусируем окно
			window.top.focus();

			// Отправляем сообщение для активации окна
			window.top.postMessage('FOCUS_WINDOW', '*');

			console.log('Пользователь нажал на уведомление о звонке: ' + callId);
		} catch (error) {
			console.error('Ошибка при попытке активировать окно:', error);
		}
	};

	// Сохраняем уведомление в списке отображаемых
	$displayedNotifications[callId] = {
		element: notification,
		telClient: telClient,
		campagne: campagne,
		clicked: false,
		createdAt: Date.now(),
		tag: uniqueTag // Сохраняем тег для отслеживания
	};

	// Проверяем количество активных уведомлений
	const activeNotifications = Object.keys($displayedNotifications).length;
	console.log(`Активных уведомлений: ${activeNotifications}`);

	// Воспроизводим звук
	//const audio = new Audio('https://github.com/SergeMiro/stock_files/raw/refs/heads/main/notif_appel_court.mp3');
	const audio = new Audio('https://images.centrerelationsclients.com/Clochette/Notif_Entrant/rington_for_workspace_hermes.mp3');
	audio.volume = 0.7;
	audio.play().catch(error => {
		console.error('Ошибка воспроизведения звука:', error);
	});
}

// Declaration de la fonction pour vider les popups
function removePopups() {
	// Закрываем все нативные уведомления
	Object.values($displayedNotifications).forEach(notifData => {
		if (notifData.element && typeof notifData.element.close === 'function') {
			notifData.element.close();
		}
	});

	// Очищаем объект отслеживания отображаемых уведомлений
	$displayedNotifications = {};

	// Сбрасываем счетчик попапов
	popupCounter = 0;
}

// +++++++++++++++++ Déclaration de la fonction qui affiche la notification
window.top["inject_notif"] = () => {
	// Извлекаем текущие идентификаторы звонков из $dataNotif
	let currentCallIds = $dataNotif.map(row => row[0]); // Предполагается, что Id находится в первом столбце

	// Находим новые звонки (которые есть в текущих данных, но не было в предыдущих)
	let newCallIds = currentCallIds.filter(id => !previousCallIds.includes(id));

	// Находим завершенные звонки (которые были в предыдущих данных, но нет в текущих)
	let endedCallIds = previousCallIds.filter(id => !currentCallIds.includes(id));

	console.log(`Обработка данных: текущие звонки=${currentCallIds.length}, новые звонки=${newCallIds.length}, завершенные звонки=${endedCallIds.length}`);

	// Обрабатываем новые звонки
	newCallIds.forEach(id => {
		let row = $dataNotif.find(row => row[0] === id);
		const telClientEntrant = row[6]; // Телефон клиента (индекс 6)
		const nomCampagneEntrante = row[7]; // Название кампании (индекс 7)
		showPopup(id, telClientEntrant, nomCampagneEntrante);
		console.log(`Показан попап для нового звонка ${id}`);

		// Добавляем Id в список обработанных звонков
		if (!$processedCallIds.includes(id)) {
			$processedCallIds.push(id);
		}
	});

	// Обрабатываем завершенные звонки - просто закрываем уведомления
	endedCallIds.forEach(id => {
		let notifData = $displayedNotifications[id];
		if (notifData && notifData.element && typeof notifData.element.close === 'function') {
			// Закрываем уведомление без отображения нового
			console.log(`Закрываем уведомление для завершенного звонка ${id}. Время жизни: ${(new Date().getTime() - (notifData.createdAt || 0)) / 1000} сек.`);
			notifData.element.close();

			// Удаляем из списка отображаемых уведомлений
			delete $displayedNotifications[id];
		}
	});

	// Обновляем previousCallIds для следующего цикла
	previousCallIds = currentCallIds.slice();

	// Очищаем $dataNotif для следующего цикла
	$dataNotif = [];

	console.warn('Notification mise à jour');
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
	console.table('DATA NOTIF', $dataNotif);
	window.top.inject_notif();

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
		main(); // Appeler la fonction qui affiche la notification
		console.warn('Popup affiché');
	});
} else {
	console.error("Bouton de Test n'a pa été trouvé");
}

//-----------------------------------------------------------------------------------------
//-----------------------------------------------------------------------------------------

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


// Fonction pour créer une notification native Windows
function showPopup(callId, telClient, campagne) {
	// Проверяем поддержку уведомлений браузером
	if (!("Notification" in window)) {
		console.error("Этот браузер не поддерживает уведомления рабочего стола");
		return;
	}

	// Проверяем разрешение на отправку уведомлений
	if (Notification.permission === "granted") {
		// Если разрешено, создаем уведомление
		createWindowsNotification(callId, telClient, campagne);
	} else if (Notification.permission !== "denied") {
		// Если разрешение еще не запрашивалось, запрашиваем его
		Notification.requestPermission().then(permission => {
			if (permission === "granted") {
				createWindowsNotification(callId, telClient, campagne);
			}
		});
	}
}

