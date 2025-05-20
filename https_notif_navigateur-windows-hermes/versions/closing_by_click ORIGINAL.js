// *** IMPORTANT ***
// le fichier "fimainfo_notifications.css" avec tout le code CSS du projet se trouve dans le dossier suivant : \\192.168.9.237\d\hermes_net_v5\PlateformPublication\Frameset_Includes\styles
// "fimainfo_notifications.css" est modfiable mais ne jamais doit etre deplacé.


// PARAMETRES
// Максимальное время жизни уведомления (10 секунд)
const maxNotificationLifetime = 10 * 1000;
// Измените на true, если колонка ID должна отображаться, или false для скрытия
let showIdColumn = false;


// Variables globales pour la surveillance des appels en attente
let pendingCallsCheckInterval = null;
let detailsUpdateInterval = null;
let isDetailsUpdateActive = false;

// Fonction pour vérifier s'il existe des appels avec statut "en attente" ou "non traité"
function checkForPendingCalls() {
	console.log('Vérification des appels avec statut "en attente" ou "non traité"...');

	// Récupérer l'historique des appels pour toutes les périodes
	const callHistoryDay = getCallHistory('day');
	const callHistoryWeek = getCallHistory('week');
	const callHistoryMonth = getCallHistory('month');

	// Combiner les historiques en un seul tableau (en supprimant les doublons par ID)
	const allCallHistory = [];
	const processedIds = new Set();

	// Fonction pour ajouter des appels uniques à allCallHistory
	const addUniqueCallsToHistory = (calls) => {
		calls.forEach(call => {
			if (!processedIds.has(call.id)) {
				processedIds.add(call.id);
				allCallHistory.push(call);
			}
		});
	};

	// Ajouter les appels de chaque période
	addUniqueCallsToHistory(callHistoryDay);
	addUniqueCallsToHistory(callHistoryWeek);
	addUniqueCallsToHistory(callHistoryMonth);

	// Filtrer pour trouver les appels avec statut "en attente" OU "non traité"
	const pendingCalls = allCallHistory.filter(call =>
		call.status === 'en attente' || call.status === 'non traité'
	);

	console.log(`Nombre d'appels avec statut "en attente" ou "non traité" trouvés: ${pendingCalls.length}`);

	if (pendingCalls.length > 0) {
		// Si des appels "en attente" ou "non traité" sont trouvés
		console.log("IDs des appels à mettre à jour:", pendingCalls.map(call => call.id));
		startDetailsUpdate();
	} else if (isDetailsUpdateActive) {
		// Si tous les appels sont traités et que la mise à jour des détails est active, l'arrêter
		stopDetailsUpdate();
	}
}

// Fonction pour démarrer les mises à jour des détails toutes les 90 secondes
function startDetailsUpdate() {
	if (isDetailsUpdateActive) {
		// Déjà actif, pas besoin de redémarrer
		return;
	}
	console.log('Démarrage des mises à jour des détails des appels en attente...');
	isDetailsUpdateActive = true;
	// Exécuter immédiatement une mise à jour
	updatePendingCallDetails();
	// Configurer l'intervalle de mise à jour (90 secondes)
	detailsUpdateInterval = setInterval(updatePendingCallDetails, 90000);
}

// Fonction pour arrêter les mises à jour des détails
function stopDetailsUpdate() {
	if (!isDetailsUpdateActive) {
		return;
	}
	console.log('Arrêt des mises à jour des détails des appels en attente');
	isDetailsUpdateActive = false;
	// Arrêter l'intervalle de mise à jour
	if (detailsUpdateInterval) {
		clearInterval(detailsUpdateInterval);
		detailsUpdateInterval = null;
	}
}

// Fonction pour mettre à jour les détails des appels en attente ou non traités
function updatePendingCallDetails() {
	console.log('Mise à jour des détails des appels en attente ou non traités...');

	// Récupérer également les appels directement depuis la table si elle est visible
	if (callHistoryModal && callHistoryModal.style.display !== 'none') {
		const table = callHistoryModal.querySelector('.call-history-table');
		if (table) {
			const rows = table.querySelectorAll('tbody tr');
			const nonProcessedIds = [];

			// Parcourir toutes les lignes pour trouver les appels non traités
			rows.forEach(row => {
				const cells = row.querySelectorAll('td');
				if (!cells || cells.length === 0) return;

				// Vérifier le statut
				const statusCell = cells[cells.length - 1];
				if (!statusCell) return;

				const statusSpan = statusCell.querySelector('.status-unprocessed, .status-waiting');
				if (statusSpan && (statusSpan.textContent.trim() === 'non traité' || statusSpan.textContent.trim() === 'en attente')) {
					// Obtenir l'ID
					let callId = null;

					if (showIdColumn && cells[0]) {
						callId = cells[0].textContent.trim();
					} else {
						// Méthode alternative pour trouver l'ID
						const telClient = cells[0].textContent.trim();
						const campagne = cells[1].textContent.trim();
						const dateString = cells[2].textContent.trim();

						// Récupérer l'historique des appels
						const storedHistory = localStorage.getItem($callHistoryKey);
						if (storedHistory) {
							try {
								const callHistory = JSON.parse(storedHistory);
								// Chercher l'appel correspondant
								const matchingCall = callHistory.find(call => {
									return call.telClient === telClient &&
										call.campagne === campagne;
								});

								if (matchingCall) {
									callId = matchingCall.id;
								}
							} catch (e) {
								console.error('Erreur lors de la recherche de l\'ID:', e);
							}
						}
					}

					// Si ID trouvé et valide, l'ajouter à la liste
					if (callId && callId !== '' && !callId.startsWith('+') && !callId.match(/^\d+$/)) {
						nonProcessedIds.push(callId);
						console.log(`ID d'appel non traité trouvé dans la table: ${callId}`);
					}
				}
			});

			// Si des IDs non traités ont été trouvés, lancer une mise à jour manuelle pour ceux-ci
			if (nonProcessedIds.length > 0) {
				updateSpecificCallsStatuses(nonProcessedIds);
			}
		}
	}

	// Appeler la fonction existante de mise à jour des détails
	reqSelectDataCallDetails(false)
		.then(() => {
			// Après la mise à jour, vérifier à nouveau s'il reste des appels en attente
			setTimeout(checkForPendingCalls, 1000);
		})
		.catch(error => {
			console.error('Erreur lors de la mise à jour des détails des appels:', error);
		});
}

// Nouvelle fonction pour mettre à jour des appels spécifiques par leurs IDs
function updateSpecificCallsStatuses(callIds) {
	if (!callIds || callIds.length === 0) return;

	console.log(`Mise à jour spécifique de ${callIds.length} appels non traités...`);

	// Former et exécuter la requête SQL pour obtenir les statuts actuels
	const query = `
 SELECT
  [Id],
  [Status],
  [TelClient],
  [CallLocalTime]
 FROM ${$db_dev}.dbo.[Fimainfo_C4_notif_son_details_appels]
 WHERE [Id] IN (${callIds.map(id => `'${id}'`).join(', ')})
 `;

	console.log('Requête SQL pour la mise à jour spécifique:', query);

	// Exécuter la requête SQL
	reqSelect(`${$db_client}`, query)
		.then(result => {
			console.log('Résultats de la requête de statut spécifique:', result);

			if (!result || (Array.isArray(result) && result.length === 0)) {
				console.log('Aucun nouveau statut trouvé pour les appels spécifiques');
				return;
			}

			// Convertir le résultat en tableau si ce n'est pas déjà le cas
			const resultArray = Array.isArray(result) ? result : [result];

			// Récupérer l'historique complet des appels
			let callHistory = [];
			const storedHistory = localStorage.getItem($callHistoryKey);

			if (storedHistory) {
				try {
					callHistory = JSON.parse(storedHistory);
				} catch (e) {
					console.error('Erreur lors de la lecture de l\'historique des appels:', e);
				}
			}

			// Mettre à jour chaque statut dans localStorage en suivant les règles
			let updatesCount = 0;

			// Identifier les numéros qui ont au moins un appel traité
			const numbersWithTraitedCalls = new Set();

			// Première passe : trouver les numéros avec des appels traités
			resultArray.forEach(status => {
				if (status.Status === 'traité' && status.TelClient) {
					numbersWithTraitedCalls.add(status.TelClient);
					console.log(`Numéro avec appel traité détecté: ${status.TelClient}`);
				}
			});

			// Deuxième passe : mettre à jour les statuts
			resultArray.forEach(status => {
				// Règle 1: Ne JAMAIS changer un statut de "traité" vers "non traité"
				// Si l'appel est déjà marqué comme "traité" dans l'historique, on ignore la mise à jour si le nouveau statut est "non traité"
				const existingCall = callHistory.find(call => call.id === status.Id);

				if (existingCall && existingCall.status === 'traité' && status.Status === 'non traité') {
					console.log(`L'appel ${status.Id} est déjà marqué comme "traité", on ne change pas son statut vers "non traité"`);
					return; // Ignorer cette mise à jour
				}

				// Règle 2: Si un numéro a un appel récent marqué comme "traité", marquer tous ses appels précédents comme "traité"
				if (numbersWithTraitedCalls.has(status.TelClient) && status.Status === 'non traité') {
					// Vérifier si c'est un appel plus récent qui est "traité" en comparant les dates
					const hasNewerTraitedCall = callHistory.some(call =>
						call.telClient === status.TelClient &&
						call.status === 'traité' &&
						new Date(call.timestamp) > new Date(status.CallLocalTime)
					);

					if (hasNewerTraitedCall) {
						console.log(`L'appel ${status.Id} est marqué comme "traité" car un appel plus récent du même numéro est "traité"`);
						status.Status = 'traité'; // Forcer le statut à "traité"
					}
				}

				// Mise à jour du statut
				updateCallHistoryStatus(status.Id, status.Status);
				updatesCount++;
			});

			console.log(`${updatesCount} statuts mis à jour pour les appels spécifiques`);

			// Si la modale est ouverte, mettre à jour aussi l'affichage
			if (callHistoryModal && callHistoryModal.style.display !== 'none') {
				populateCallHistoryTable(callHistoryModal.querySelector('.filter-btn.active')?.getAttribute('data-period') || 'day');
			}

			// Rechercher les appels plus anciens du même numéro pour les numéros ayant des appels traités
			if (numbersWithTraitedCalls.size > 0) {
				updateOlderCallsForTraitedNumbers(Array.from(numbersWithTraitedCalls));
			}
		})
		.catch(error => {
			console.error('Erreur lors de la mise à jour spécifique des statuts:', error);
		});
}

// Nouvelle fonction pour mettre à jour les appels plus anciens des numéros ayant des appels traités
function updateOlderCallsForTraitedNumbers(phoneNumbers) {
	if (!phoneNumbers || phoneNumbers.length === 0) return;

	console.log(`Recherche d'appels plus anciens pour ${phoneNumbers.length} numéros avec appels traités...`);

	// Récupérer l'historique des appels
	let callHistory = [];
	const storedHistory = localStorage.getItem($callHistoryKey);

	if (storedHistory) {
		try {
			callHistory = JSON.parse(storedHistory);

			// Pour chaque numéro ayant des appels traités
			phoneNumbers.forEach(phoneNumber => {
				// Trouver tous les appels de ce numéro
				const calls = callHistory.filter(call => call.telClient === phoneNumber);

				// Trier par date (du plus récent au plus ancien)
				calls.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

				// Trouver l'appel le plus récent avec statut "traité"
				const mostRecentTraitedCall = calls.find(call => call.status === 'traité');

				if (mostRecentTraitedCall) {
					const mostRecentTraitedDate = new Date(mostRecentTraitedCall.timestamp);

					// Pour tous les appels plus anciens avec statut "non traité", les marquer comme "traité"
					let updatedCount = 0;
					calls.forEach(call => {
						const callDate = new Date(call.timestamp);
						if (call.status === 'non traité' && callDate <= mostRecentTraitedDate) {
							call.status = 'traité';
							updatedCount++;
						}
					});

					if (updatedCount > 0) {
						console.log(`${updatedCount} appels plus anciens du numéro ${phoneNumber} ont été marqués comme "traité"`);
					}
				}
			});

			// Sauvegarder l'historique mis à jour
			localStorage.setItem($callHistoryKey, JSON.stringify(callHistory));

			// Si la modale est ouverte, mettre à jour l'affichage
			if (callHistoryModal && callHistoryModal.style.display !== 'none') {
				populateCallHistoryTable(callHistoryModal.querySelector('.filter-btn.active')?.getAttribute('data-period') || 'day');
				// Обновляем состояние кнопок экспорта после обновления таблицы
				updateExportButtonsState();
			}
		} catch (e) {
			console.error('Erreur lors de la mise à jour des appels plus anciens:', e);
		}
	}
}

// Fonction pour démarrer la surveillance des appels en attente
function startPendingCallsMonitoring() {
	console.log('Démarrage de la surveillance des appels en attente...');
	// Arrêter la surveillance existante si elle est active
	if (pendingCallsCheckInterval) {
		clearInterval(pendingCallsCheckInterval);
	}
	// Exécuter immédiatement une vérification
	checkForPendingCalls();
	// Configurer l'intervalle de vérification (10 secondes)
	pendingCallsCheckInterval = setInterval(checkForPendingCalls, 10000);
}

// Initialisation de la surveillance lors du chargement
function initializeCallsMonitoring() {
	// Déclencher le démarrage de la surveillance après le chargement initial
	setTimeout(startPendingCallsMonitoring, 3000);
}

// Функция для загрузки настройки из localStorage при инициализации
function loadIdColumnSetting() {
	const storedSetting = localStorage.getItem('idColumnVisibility');
	// Если значение хранится и равно "true", то включаем колонку, иначе выключаем
	showIdColumn = storedSetting === 'true';
	// Если у нас есть элемент управления (например, checkbox), синхронизируем его состояние:
	const toggleCheckbox = window.top.document.getElementById('toggle-id-column');
	if (toggleCheckbox) {
		toggleCheckbox.checked = showIdColumn;
	}
}

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
$db_client = 'HN_GUYOT'
$db_dev = 'HN_FIMAINFO'
$view_notif = "Fimainfo_Notif_Son_C4";

$customerId = 31;  // CustomerID à changer en fonction du client
$campaignType = 1; // 1 - entrants, 2 - sortants
$queuesType = "Queues"; // "Queues" - Campagnes entrants | "QueuesOutbound" - sortants

// Paramètre de gestion automatique de fermeture des notifications
// true - les notifications seront fermées automatiquement lorsque la conversation est terminée
// false - les notifications seront fermées uniquement lors d'un clic sur elles
$autoCloseNotifications = true;

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
let currentCallIds = []; // ID актуальных звонков
let previousCallIds = []; // Variable globale pour stocker les identifiants précédents

// ------------------ DECLARATION DES FONCTIONS avec REQUETTES SQL ------------------------
// Fonctions SELECT appels en attente
async function reqSelectDataCall() {
	const query = `
 SELECT TOP (10) * FROM ${$db_dev}.dbo.${$view_notif}
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
			NomCampagne: call.NomCampagne,
			"TempsAttente": call["TempsAttente"],
			"DureeAppel": call["DureeAppel"],
			"AppelAbandonne": call["AppelAbandonne"],
			"Agent": call["Agent"]
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

		console.log('Les appels filtrés pour l\'affichage :', $dataNotifEntrante);
		console.log('Les appels déjà traités :', $processedCallIds);
	} catch (error) {
		console.error('Erreur lors de l\'exécution de la requête :', error);
		$dataNotifEntrante = [];
	}
}

// Функция для получения деталей завершенных звонков
async function reqSelectDataCallDetails(forExport = false) {
	// Получаем историю звонков из localStorage
	let callHistory = [];
	const storedHistory = localStorage.getItem($callHistoryKey);

	if (!storedHistory) {
		console.log('Pas d\'historique des appels pour vérifier les détails');
		if (forExport && isExportInProgress) {
			completeExport();
		}
		return;
	}

	try {
		callHistory = JSON.parse(storedHistory);
	} catch (e) {
		console.error('Erreur lors de la lecture de l\'historique des appels depuis localStorage:', e);
		if (forExport && isExportInProgress) {
			completeExport();
		}
		return;
	}

	// Фильтруем звонки, у которых отсутствуют детали
	const callsWithoutDetails = callHistory.filter(call =>
		call.waitTime === null ||
		call.callDuration === null ||
		call.isAbandoned === null ||
		call.agent === undefined
	);

	if (callsWithoutDetails.length === 0) {
		console.log('Il n\'y a pas d\'appels sans détails pour vérifier');
		if (forExport && isExportInProgress) {
			completeExport();
		}
		return;
	}

	// Получаем ID звонков без деталей
	const callIds = callsWithoutDetails.map(call => call.id);

	// Формируем запрос к базе данных
	const query = `
    SELECT 
        Id,
        [TelClient],
        [CallLocalTime],
        [TempsAttente],
        [DureeAppel],
        [AppelAbandonne],
        [Agent],
        [Status]
    FROM ${$db_dev}.dbo.[Fimainfo_C4_notif_son_details_appels]
    WHERE Id IN (${callIds.map(id => `'${id}'`).join(', ')}) 
    `;

	console.log('Req SELECT details des appels :', query);

	try {
		const result = await reqSelect(`${$db_client}`, query);
		console.log('Resultats de reqSelectDataCallDetails:', result);

		// Проверяем, что результат не пустой
		if (!result || (Array.isArray(result) && result.length === 0)) {
			console.log('Pas de nouvelles détails des appels');
			if (forExport && isExportInProgress) {
				completeExport();
			}
			return;
		}

		// Преобразуем результат в массив, если это не массив
		const resultArray = Array.isArray(result) ? result : [result];

		// Обновляем историю звонков с новыми деталями
		let historyUpdated = false;

		callHistory = callHistory.map(call => {
			// Ищем детали для текущего звонка
			const callDetails = resultArray.find(detail => detail.Id === call.id);

			if (callDetails) {
				// Обновляем все детали звонка одновременно
				historyUpdated = true;
				return {
					...call,
					waitTime: callDetails['TempsAttente'] ?? call.waitTime,
					callDuration: callDetails['DureeAppel'] ?? call.callDuration,
					isAbandoned: callDetails['AppelAbandonne'] !== undefined ? callDetails['AppelAbandonne'] : call.isAbandoned,
					agent: callDetails['Agent'] !== undefined ? callDetails['Agent'] : call.agent,
					status: callDetails['Status'] !== undefined ? callDetails['Status'] : call.status
				};
			}

			return call;
		});

		// Если были обновления, сохраняем обновленную историю
		if (historyUpdated) {
			localStorage.setItem($callHistoryKey, JSON.stringify(callHistory));
			console.log('Historique des appels mis à jour avec de nouvelles détails');

			// === НОВЫЙ БЛОК КОДА ===
			// Собираем все номера, у которых только что статус стал "traité"
			const treatedNumbers = resultArray
				.filter(detail => detail.Status === 'traité')
				.map(detail => detail.TelClient);

			if (treatedNumbers.length > 0) {
				console.log('Обновляем все старые звонки для номеров:', treatedNumbers);
				// Запускаем массовое обновление в localStorage
				updateOlderCallsForTraitedNumbers(treatedNumbers);
				// Если модальное окно открыто — сразу перерисовываем таблицу
				if (callHistoryModal && callHistoryModal.style.display !== 'none') {
					const activePeriod = callHistoryModal
						.querySelector('.filter-btn.active')
						.getAttribute('data-period') || 'day';
					populateCallHistoryTable(activePeriod);
				}
			}
			// === КОНЕЦ НОВОГО БЛОКА ===

			// Обновляем таблицу истории звонков, если она открыта
			if (callHistoryModal && callHistoryModal.style.display !== 'none') {
				populateCallHistoryTable(exportPendingPeriod || 'day');
			}

			// Если запрос был для экспорта и не все данные еще загружены, запускаем повторный запрос
			if (forExport && isExportInProgress) {
				// Проверяем, полностью ли загружены данные теперь
				const updatedCallHistory = JSON.parse(localStorage.getItem($callHistoryKey));
				if (isCallHistoryComplete(updatedCallHistory)) {
					completeExport();
				} else {
					// Если еще есть незагруженные данные, повторяем запрос
					setTimeout(() => reqSelectDataCallDetails(true), 500);
				}
			}
		} else {
			if (forExport && isExportInProgress) {
				completeExport();
			}
		}

	} catch (error) {
		console.error('Erreur lors de l\'exécution de reqSelectDataCallDetails:', error);
		if (forExport && isExportInProgress) {
			completeExport();
		}
	}
}

// Функция для завершения экспорта после загрузки всех данных
function completeExport() {
	if (!isExportInProgress) return;

	const exportBtn = exportPendingType === 'excel'
		? callHistoryModal.querySelector('.export-excel')
		: callHistoryModal.querySelector('.export-csv');

	if (exportPendingType === 'excel') {
		exportTableToExcel(exportPendingPeriod);
	} else if (exportPendingType === 'csv') {
		exportTableToCSV(exportPendingPeriod);
	}

	// Сбрасываем флаги
	isExportInProgress = false;
	exportPendingType = null;
	exportPendingPeriod = null;
}

// ----------------------------- FONCTIONS UTILITAIRES ------------------------------------
// Fonction pour valider et creer la vue SQL si elle n'existe pas

// Fonction pour charger le fichier CSS personnalisé dans DOM de Hermes.net (Workspace) 
function loadCssFileInWorkspace(filename) {
	var link = window.top.document.createElement('link');
	var timestamp = new Date().getTime();
	link.href = `https://${$cloud_4}/hermes_net_v5/PlateformPublication/Frameset_Includes/${filename}?v=${timestamp}`;
	console.warn("CSS File URL:", link.href);
	link.type = 'text/css';
	link.rel = 'stylesheet';
	link.setAttribute('cache-control', 'no-cache, no-store, must-revalidate');
	link.setAttribute('pragma', 'no-cache');
	link.setAttribute('expires', '0');
	window.top.document.head.appendChild(link);
}


function loadTailwindInWorkspace(filename) {
	var script = window.top.document.createElement('script');
	var timestamp = new Date().getTime();
	script.src = `https://${$cloud_4}/hermes_net_v5/PlateformPublication/Frameset_Includes/${filename}?v=${timestamp}`;
	console.warn("JS File URL:", script.src);
	script.type = 'text/javascript';
	script.async = false;
	script.setAttribute('cache-control', 'no-cache, no-store, must-revalidate');
	script.setAttribute('pragma', 'no-cache');
	script.setAttribute('expires', '0');
	window.top.document.head.appendChild(script);
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
		setTimeout(() => checkCampaignsConnected(queuesType), 3000);
	} else if (currentCount !== previousCount) {
		$idsAgentCampaigns = [];
		matchingCampaigns();
		setTimeout(() => checkCampaignsConnected(queuesType), 3000);
	} else {
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
//  console.table('waitForDataNotif', $dataNotifEntrante);
//  while (typeof $dataNotifEntrante === 'undefined' || $dataNotifEntrante === '' || (Array.isArray($dataNotifEntrante) && $dataNotifEntrante.length === 0)) {
//   await new Promise(resolve => setTimeout(resolve, 100));
//  }
//  console.log(`La variable est chargée : \n${$dataNotifEntrante}`);
// }




// ================== Fonctions pour gerer les PARAMETRES ======================
// Функция для обновления заголовка таблицы
function updateCallHistoryHeader() {
	if (!callHistoryModal) return;
	const table = callHistoryModal.querySelector('.call-history-table');
	if (table) {
		// Определяем количество колонок: если showIdColumn включена,
		// то в таблице 1 колонка ID + 7 остальных = 8, иначе 7
		const totalCols = showIdColumn ? 8 : 7;
		// Вычисляем ширину каждой колонки
		const colWidth = (100 / totalCols).toFixed(2);

		// Генерируем разметку для colgroup
		let colgroupHTML = '<colgroup>';
		for (let i = 0; i < totalCols; i++) {
			colgroupHTML += `<col style="width: ${colWidth}%;">`;
		}
		colgroupHTML += '</colgroup>';

		// Генерируем заголовок <thead>
		let theadHTML = `<thead>
   <tr>
   ${showIdColumn ? '<th class="id-column">ID</th>' : ''}
   <th>Numéro de téléphone</th>
   <th>Campagne</th>
   <th>Date et heure</th>
   <th>Temps d'attente</th>
   <th>Durée de l'appel</th>
   <th>Abandonné</th>
   <th>État</th>
   </tr>
   </thead>`;

		// Устанавливаем table-layout: fixed для таблицы (либо можно добавить в CSS)
		table.style.tableLayout = 'fixed';

		// Помещаем colgroup + thead внутрь таблицы
		table.innerHTML = colgroupHTML + theadHTML;
	}
}


function updateCallHistoryTable() {
	if (!callHistoryModal) return;
	updateCallHistoryHeader();
	// Получаем активный период для фильтра (например, 'day')
	const activeFilter = callHistoryModal.querySelector('.filter-btn.active');
	const activePeriod = activeFilter ? activeFilter.getAttribute('data-period') : 'day';
	populateCallHistoryTable(activePeriod);
	updateTableWidth();
}


// Функция‑переключатель, которая меняет видимость колонки, сохраняет настройку и перерисовывает таблицу
function toggleIdColumnVisibility(visible) {
	showIdColumn = visible;
	// Сохраняем настройку в localStorage ("true" или "false")
	localStorage.setItem('idColumnVisibility', visible);
	updateCallHistoryTable();
}

// Привяжем функции к объекту window, чтобы они стали глобальными:
window.updateCallHistoryTable = updateCallHistoryTable;
window.toggleIdColumnVisibility = toggleIdColumnVisibility;


// Функция для обновления ширины таблицы (или её контейнера)
function updateTableWidth() {
	if (!callHistoryModal) return;
	// Предположим, таблица находится в контейнере с классом .call-history-table-container
	const container = callHistoryModal.querySelector('.call-history-table-container');
	if (container) {
		// Если колонка ID отображается, устанавливаем ширину на 120%, иначе оставляем 100%
		container.style.width = '100%';
	}
}


// Пример для checkbox с id "toggle-id-column"
// TODO добавить в параметры для вкл/выкл togle колонки ID
// Пример привязки к checkbox (допустим, на странице есть элемент с id "toggle-id-column")
const toggleCheckbox = window.top.document.getElementById('toggle-id-column');
if (toggleCheckbox) {
	// При изменении состояния checkbox вызываем переключатель
	toggleCheckbox.addEventListener('change', function () {
		toggleIdColumnVisibility(this.checked);
	});
}

// Вызов функции загрузки настройки при инициализации (до показа таблицы)
loadIdColumnSetting();
updateCallHistoryTable();

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
	let offsetY = 0; // Смещение относительно курсора
	let currentY = 0;
	let lastY = 0;
	let dragStartTime = 0;
	let hasMoved = false;
	let wasRealDrag = false;
	let totalDragDistance = 0;
	let lastMoveTime = 0;

	// Сразу устанавливаем fixed позиционирование
	container.style.position = 'fixed';

	// Загружаем сохраненную позицию
	const savedPosition = localStorage.getItem('historyButtonPosition');
	if (savedPosition) {
		container.style.top = savedPosition;
		container.style.bottom = 'auto';
		currentY = parseInt(savedPosition) || 0;
	} else {
		// Если позиция не сохранена, устанавливаем начальное положение
		container.style.top = '85px';
		container.style.bottom = 'auto';
		currentY = 85;
	}

	const dragStart = (e) => {
		// Предотвращаем стандартное поведение браузера
		e.preventDefault();

		if (e.target.closest('.history-button')) {
			isDragging = true;
			dragStartTime = Date.now();
			lastMoveTime = dragStartTime;
			hasMoved = false;
			wasRealDrag = false;
			totalDragDistance = 0;

			// Вычисляем смещение от верха элемента до позиции курсора
			const rect = container.getBoundingClientRect();
			const mouseY = e.type === "touchstart" ? e.touches[0].clientY : e.clientY;
			offsetY = mouseY - rect.top;

			// Добавляем класс для визуального отображения захвата
			container.classList.add('dragging');
		}
	};

	const dragEnd = (e) => {
		if (!isDragging) return;

		const dragDuration = Date.now() - dragStartTime;
		const timeSinceLastMove = Date.now() - lastMoveTime;

		// Определяем конечную позицию мыши
		const mouseY = e.type === "touchend"
			? (e.changedTouches[0] ? e.changedTouches[0].clientY : lastY)
			: e.clientY;

		// Рассчитываем расстояние перемещения
		const totalDistance = Math.abs(mouseY - lastY);

		isDragging = false;
		container.classList.remove('dragging');

		// Сохраняем позицию в localStorage
		localStorage.setItem('historyButtonPosition', container.style.top);

		// Открываем модальное окно только если это был клик, а не перетаскивание
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

		// Предотвращаем стандартное поведение браузера
		e.preventDefault();

		// Получаем текущую позицию курсора
		const mouseY = e.type === "touchmove" ? e.touches[0].clientY : e.clientY;

		// Обновляем время последнего движения
		lastMoveTime = Date.now();

		// Рассчитываем расстояние перемещения
		const deltaY = mouseY - lastY;
		if (lastY !== 0) {
			totalDragDistance += Math.abs(deltaY);
		}
		lastY = mouseY;

		// Если было значительное движение, отмечаем это
		if (Math.abs(deltaY) > 2 || totalDragDistance > 5) {
			hasMoved = true;
		}

		// Если общее расстояние перетаскивания превысило порог, считаем это реальным перетаскиванием
		if (totalDragDistance > 15) {
			wasRealDrag = true;
		}

		// Рассчитываем новую позицию кнопки (точно под курсором с учетом смещения)
		const newY = mouseY - offsetY;

		// Получаем высоту видимой области окна
		const windowHeight = window.top.innerHeight || window.innerHeight;

		// Ограничения для верхней и нижней границы
		const topMargin = 85; // верхняя граница
		const footerHeight = 50; // базовая высота футера
		const bottomMargin = 30; // отступ от футера

		// Ограничиваем движение в пределах указанных границ
		const minY = topMargin;
		const maxY = windowHeight - container.offsetHeight - (footerHeight + bottomMargin);
		const boundedY = Math.min(Math.max(minY, newY), maxY);

		// Добавляем минимальную плавность (5% от прежней идеи плавности)
		// 95% новой позиции + 5% текущей позиции
		currentY = currentY * 0.05 + boundedY * 0.95;

		// Обновляем позицию кнопки с очень небольшой плавностью
		container.style.top = `${currentY}px`;
		container.style.transition = 'none'; // Отключаем CSS-переходы для более точного контроля
	};

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

	// Получаем дополнительные данные о звонке из текущих данных
	const callData = $currentCallData.find(call => call.Id === callId);
	let waitTime = null;
	let callDuration = null;
	let isAbandoned = null;
	let agent = undefined;
	let status = null;

	if (callData) {
		// Если есть данные в $currentCallData, берем оттуда все значения одновременно
		waitTime = callData['TempsAttente'] || null;
		callDuration = callData['DureeAppel'] || null;
		isAbandoned = callData['AppelAbandonne'] || null;
		agent = callData['Agent'];
		status = callData['Status'] || null;
	}

	// Ajouter un nouvel appel à l'historique
	const callInfo = {
		id: callId,
		telClient: telClient,
		campagne: campagne,
		waitTime: waitTime,
		callDuration: callDuration,
		isAbandoned: isAbandoned,
		agent: agent,
		status: status,
		timestamp: Date.now(),
		date: new Date().toISOString()
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
	// Если модальное окно уже существует, просто обновляем данные
	if (callHistoryModal) {
		populateCallHistoryTable('day');
		callHistoryModal.style.display = 'flex';
		updateTableWidth();
		// Обновляем состояние кнопок экспорта при повторном открытии
		updateExportButtonsState();
		return;
	}


	// Создаем HTML модального окна, используя шаблонную строку
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
             <div class="call-history-table-container" style="width: ${showIdColumn ? '120%' : '100%'};">
     <table class="call-history-table">
      <thead>
       <tr>
       ${showIdColumn ? '<th>ID</th>' : ''}
       <th>Numéro de téléphone</th>
       <th>Campagne</th>
       <th>Date et heure</th>
       <th>Temps d'attente</th>
       <th>Durée de l'appel</th>
       <th>Abandonné</th>
       <th>État</th>
       </tr>
      </thead>
      <tbody>
       <!-- Les données seront ajoutées dynamiquement -->
      </tbody>
     </table>
     </div>
     <div class="call-history-footer">
      <div class="fimainfo-credit">
       <span>Created by </span>
       <a href="https://fimainfo.fr" target="_blank" title="Fimainfo">
        <img src="https://images.centrerelationsclients.com/Clochette/icon_fimainfo.png" alt="Fimainfo" class="fimainfo-logo">
        <span>Fimainfo</span>
       </a>
      </div>
     </div>
    </div>
   `;

	window.top.document.body.appendChild(callHistoryModal);

	// Проверяем, что callHistoryModal успешно добавлен в DOM
	if (!window.top.document.querySelector('.call-history-modal')) {
		console.error("Erreur: le modale n'a pas été ajouté au DOM");
		return;
	}

	// Привязка обработчиков (закрытие модального окна, фильтры, экспорт, очистка и т.д.)
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
			filterButtons.forEach(btn => btn.classList.remove('active'));
			this.classList.add('active');
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
	updateTableWidth();
	// Обновляем состояние кнопок экспорта при первом открытии
	updateExportButtonsState();
	callHistoryModal.style.display = 'flex';

	// Modification: Ajouter ici для démarrer la vérification des appels non traités
	startNonProcessedCallsCheck();
}

// Функция для проверки возможности экспорта
function updateExportButtonsState() {
	if (!callHistoryModal) return;
	const tableBody = callHistoryModal.querySelector('.call-history-table tbody');
	const hasWaiting = !!tableBody.querySelector('.status-waiting');

	const excelBtn = callHistoryModal.querySelector('.export-excel');
	const csvBtn = callHistoryModal.querySelector('.export-csv');

	excelBtn.disabled = hasWaiting;
	csvBtn.disabled = hasWaiting;
}

// Fonction pour remplir le tableau avec des données
function populateCallHistoryTable(period) {
	if (!callHistoryModal) return;
	const callHistory = getCallHistory(period);
	const tableBody = callHistoryModal.querySelector('.call-history-table tbody');
	if (!tableBody) return;

	tableBody.innerHTML = '';
	if (callHistory.length === 0) {
		const emptyRow = document.createElement('tr');
		emptyRow.innerHTML = `<td colspan="8" style="text-align: center;">Aucune donnée pour la période sélectionnée</td>`;
		tableBody.appendChild(emptyRow);
		// Обновляем состояние кнопок экспорта
		updateExportButtonsState();
		return;
	}
	callHistory.sort((a, b) => b.timestamp - a.timestamp);
	const safeDisplay = value => (value === undefined || value === null || value === "undefined") ? "" : value;

	// Функция для форматирования времени из секунд в формат "XXm : YYsec"
	const formatTimeInSeconds = seconds => {
		if (seconds === undefined || seconds === null || seconds === "" || isNaN(parseInt(seconds))) return '';
		const mins = Math.floor(parseInt(seconds) / 60);
		const secs = parseInt(seconds) % 60;
		return `${mins.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}sec`;
	};

	callHistory.forEach(call => {
		if (!call || !call.timestamp) return;
		const row = document.createElement('tr');
		const date = new Date(call.timestamp);

		// Форматируем дату без секунд (DD/MM/YYYY HH:MM)
		const day = date.getDate().toString().padStart(2, '0');
		const month = (date.getMonth() + 1).toString().padStart(2, '0');
		const year = date.getFullYear();
		const hours = date.getHours().toString().padStart(2, '0');
		const minutes = date.getMinutes().toString().padStart(2, '0');
		const formattedDate = `${day}/${month}/${year} ${hours}h${minutes}`;

		// Преобразуем значения для Abandonné
		const abandonedStatus = call.isAbandoned === 0 ? "Non" : call.isAbandoned === 1 ? "Oui" : "";

		// Определяем статус "État" на основе значения Agent и наличия данных
		// Если данные о времени ожидания, продолжительности или отказе отсутствуют - статус "en attente"
		// Если доступны данные - используем статус из БД, если он есть
		const processedStatus =
			(call.waitTime === null || call.waitTime === undefined ||
				call.callDuration === null || call.callDuration === undefined ||
				call.isAbandoned === null || call.isAbandoned === undefined)
				? "en attente"
				: (call.status ? call.status : (call.agent === 0 ? "non traité" : "traité"));

		let statusClass = '';
		if (processedStatus === "en attente") {
			statusClass = 'status-waiting';
		} else if (processedStatus === "traité") {
			statusClass = 'status-processed';
		} else if (processedStatus === "non traité") {
			statusClass = 'status-unprocessed';
		}

		row.innerHTML = `
		${showIdColumn ? `<td class="id-column">${safeDisplay(call.id)}</td>` : ''}
		<td>${safeDisplay(call.telClient)}</td>
		<td>${safeDisplay(call.campagne)}</td>
		<td>${formattedDate}</td>
		<td>
		  ${processedStatus === "en attente"
				? '<div class="loading-spinner-cell"></div>'  /* spinner */
				/*? '<span class="loading-dot"></span>'*/    /* ou point clignotant */
				: formatTimeInSeconds(call.waitTime)
			}
		</td>
		<td>
		  ${processedStatus === "en attente"
				? '<div class="loading-spinner-cell"></div>'
				: formatTimeInSeconds(call.callDuration)
			}
		</td>
		<td>
		  ${processedStatus === "en attente"
				? '<div class="loading-spinner-cell"></div>'
				: abandonedStatus
			}
		</td>
		<td><span class="${statusClass}">${processedStatus}</span></td>
	 `;

		tableBody.appendChild(row);
	});

	// Обновляем состояние кнопок экспорта
	updateExportButtonsState();
}



// Fonction pour exporter le tableau au format Excel
function exportTableToExcel(period) {
	if (!callHistoryModal) return;
	const exportBtn = callHistoryModal.querySelector('.export-excel');
	if (!exportBtn) return;

	// Если экспорт не в процессе ожидания загрузки данных, показываем анимацию
	let originalContent = exportBtn.innerHTML;
	if (!isExportInProgress) {
		exportBtn.classList.add('loading');
		exportBtn.innerHTML = '<div class="loading-spinner"></div> Excel';
	}

	setTimeout(() => {
		try {
			const callHistory = getCallHistory(period);
			if (callHistory.length === 0) {
				alert('Aucune donnée à exporter pour la période sélectionnée');
				if (!isExportInProgress) {
					exportBtn.classList.remove('loading');
					exportBtn.innerHTML = originalContent;
				} else {
					hideExportWaitingMessage(exportBtn, originalContent);
				}
				return;
			}

			// Trier les appels par heure (les plus récents d'abord)
			callHistory.sort((a, b) => b.timestamp - a.timestamp);

			// Créer un nouveau classeur
			const wb = XLSX.utils.book_new();

			// Préparer les données avec les en-têtes
			const headers = ['ID', 'Numéro de téléphone', 'Campagne', 'Date et heure', "Temps d'attente", "Durée de l'appel", "Appel abandoné", "État"];

			// Функция для форматирования времени из секунд в формат "XXm : YYsec"
			const formatTimeInSeconds = seconds => {
				if (seconds === undefined || seconds === null || seconds === "" || isNaN(parseInt(seconds))) return '';
				const mins = Math.floor(parseInt(seconds) / 60);
				const secs = parseInt(seconds) % 60;
				return `${mins.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}sec`;
			};

			const rows = callHistory.map(call => {
				const date = new Date(call.timestamp);

				// Форматируем дату без секунд (DD/MM/YYYY HH:MM)
				const day = date.getDate().toString().padStart(2, '0');
				const month = (date.getMonth() + 1).toString().padStart(2, '0');
				const year = date.getFullYear();
				const hours = date.getHours().toString().padStart(2, '0');
				const minutes = date.getMinutes().toString().padStart(2, '0');
				const formattedDate = `${day}/${month}/${year} ${hours}:${minutes}`;

				// Преобразуем значения для Appel abandoné
				const abandonedStatus = call.isAbandoned === 0 ? "Non" : call.isAbandoned === 1 ? "Oui" : "";

				// Определяем статус "État" на основе значения Agent
				const processedStatus =
					(call.agent === null || call.agent === undefined)
						? "en attente"       // Данные ещё не получены – звонок в процессе
						: (call.status ? call.status : (call.agent === 0 ? "non traité" : "traité"));

				return [
					call.id,
					call.telClient,
					call.campagne,
					formattedDate,
					formatTimeInSeconds(call.waitTime),
					formatTimeInSeconds(call.callDuration),
					abandonedStatus,
					processedStatus
				];
			});

			// Créer une feuille de calcul avec les en-têtes
			const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

			// Définir les styles
			ws['!cols'] = [
				{ wch: 45 },  // ID - plus large pour les longs identifiants
				{ wch: 15 },  // Numéro de téléphone
				{ wch: 15 },  // Campagne
				{ wch: 20 },  // Date et heure
				{ wch: 15 },  // Temps d'attente
				{ wch: 15 },  // Durée de l'appel
				{ wch: 15 },  // Abandonné
				{ wch: 15 }   // État
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
			// Скрываем анимацию загрузки и сообщение об ожидании
			if (!isExportInProgress) {
				exportBtn.classList.remove('loading');
				exportBtn.innerHTML = originalContent;
			} else {
				hideExportWaitingMessage(exportBtn, originalContent);
			}
		}
	}, 500);
}

// Fonction pour exporter le tableau au format CSV
function exportTableToCSV(period) {
	if (!callHistoryModal) return;
	const exportBtn = callHistoryModal.querySelector('.export-csv');
	if (!exportBtn) return;

	// Если экспорт не в процессе ожидания загрузки данных, показываем анимацию
	let originalContent = exportBtn.innerHTML;
	if (!isExportInProgress) {
		exportBtn.classList.add('loading');
		exportBtn.innerHTML = '<div class="loading-spinner"></div> CSV';
	}

	setTimeout(() => {
		try {
			const callHistory = getCallHistory(period);
			if (callHistory.length === 0) {
				alert('Aucune donnée à exporter pour la période sélectionnée');
				if (!isExportInProgress) {
					exportBtn.classList.remove('loading');
					exportBtn.innerHTML = originalContent;
				} else {
					hideExportWaitingMessage(exportBtn, originalContent);
				}
				return;
			}

			// Trier les appels par heure (les plus récents d'abord)
			callHistory.sort((a, b) => b.timestamp - a.timestamp);

			// Créer un contenu CSV avec BOM UTF-8 для поддержки французских символов
			let csvContent = '\uFEFF';

			// Ajouter les en-têtes
			const headers = ['ID', 'Numéro de téléphone', 'Campagne', 'Date et heure', "Temps d'attente", "Durée de l'appel", "Appel abandoné", "État"];
			csvContent += headers.join(';') + '\r\n';

			// Функция для форматирования времени из секунд в формат "XXm : YYsec"
			const formatTimeInSeconds = seconds => {
				if (seconds === undefined || seconds === null || seconds === "" || isNaN(parseInt(seconds))) return '';
				const mins = Math.floor(parseInt(seconds) / 60);
				const secs = parseInt(seconds) % 60;
				return `${mins.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}sec`;
			};

			// Ajouter les lignes
			callHistory.forEach(call => {
				const date = new Date(call.timestamp);

				// Форматируем дату без секунд (DD/MM/YYYY HH:MM)
				const day = date.getDate().toString().padStart(2, '0');
				const month = (date.getMonth() + 1).toString().padStart(2, '0');
				const year = date.getFullYear();
				const hours = date.getHours().toString().padStart(2, '0');
				const minutes = date.getMinutes().toString().padStart(2, '0');
				const formattedDate = `${day}/${month}/${year} ${hours}:${minutes}`;

				// Преобразуем значения для Appel abandoné
				const abandonedStatus = call.isAbandoned === 0 ? "Non" : call.isAbandoned === 1 ? "Oui" : "";

				// Определяем статус "État" на основе значения Agent
				const processedStatus =
					(call.agent === null || call.agent === undefined)
						? "en attente"       // Данные ещё не получены – звонок в процессе
						: (call.status ? call.status : (call.agent === 0 ? "non traité" : "traité"));

				// Échapper les données для le format CSV
				const row = [
					call.id,
					call.telClient,
					call.campagne,
					formattedDate,
					formatTimeInSeconds(call.waitTime),
					formatTimeInSeconds(call.callDuration),
					abandonedStatus,
					processedStatus
				].map(field => {
					// Si le champ contient des caractères spéciaux, l'entourer de guillemets
					if (field && typeof field === 'string' && (field.includes(';') || field.includes('"') || field.includes('\n'))) {
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
			// Скрываем анимацию загрузки и сообщение об ожидании
			if (!isExportInProgress) {
				exportBtn.classList.remove('loading');
				exportBtn.innerHTML = originalContent;
			} else {
				hideExportWaitingMessage(exportBtn, originalContent);
			}
		}
	}, 500);
}

// Mise à jour des gestionnaires d'événements pour les boutons d'exportation
function initializeExportButtons() {
	if (!callHistoryModal) {
		console.error("Erreur: callHistoryModal est null dans initializeExportButtons");
		return;
	}

	const excelBtn = callHistoryModal.querySelector('.export-excel');
	const csvBtn = callHistoryModal.querySelector('.export-csv');

	if (!excelBtn || !csvBtn) {
		console.error("Erreur: les boutons d'exportation n'ont pas été trouvés", {
			excelBtn: !!excelBtn,
			csvBtn: !!csvBtn
		});
		return;
	}

	excelBtn.addEventListener('click', function () {
		// Проверяем, не отключена ли кнопка
		if (this.disabled) return;

		if (isExportInProgress) return; // Предотвращаем повторные клики во время экспорта

		if (!callHistoryModal) return;
		const activeBtnElement = callHistoryModal.querySelector('.filter-btn.active');
		const activePeriod = activeBtnElement ? activeBtnElement.getAttribute('data-period') || 'day' : 'day';

		// Получаем историю звонков для выбранного периода
		const callHistory = getCallHistory(activePeriod);

		// Проверяем на наличие незавершенных данных
		if (isCallHistoryComplete(callHistory)) {
			exportTableToExcel(activePeriod);
		} else {
			// Иначе показываем всплывающее сообщение и запускаем загрузку данных
			console.log('Обнаружены незавершенные данные, запрашиваем обновление перед экспортом');
			isExportInProgress = true;
			exportPendingType = 'excel';
			exportPendingPeriod = activePeriod;

			const { waitingPopup, originalContent } = showExportWaitingMessage(excelBtn);

			// Запрашиваем детали звонков и ждем их загрузки
			reqSelectDataCallDetails(true); // Передаем true для автоматического экспорта после загрузки
		}
	});

	csvBtn.addEventListener('click', function () {
		// Проверяем, не отключена ли кнопка
		if (this.disabled) return;

		if (isExportInProgress) return; // Предотвращаем повторные клики во время экспорта

		if (!callHistoryModal) return;
		const activeBtnElement = callHistoryModal.querySelector('.filter-btn.active');
		const activePeriod = activeBtnElement ? activeBtnElement.getAttribute('data-period') || 'day' : 'day';

		// Получаем историю звонков для выбранного периода
		const callHistory = getCallHistory(activePeriod);

		// Проверяем на наличие незавершенных данных
		if (isCallHistoryComplete(callHistory)) {
			exportTableToCSV(activePeriod);
		} else {
			// Иначе показываем всплывающее сообщение и запускаем загрузку данных
			console.log('Обнаружены незавершенные данные, запрашиваем обновление перед экспортом');
			isExportInProgress = true;
			exportPendingType = 'csv';
			exportPendingPeriod = activePeriod;

			const { waitingPopup, originalContent } = showExportWaitingMessage(csvBtn);

			// Запрашиваем детали звонков и ждем их загрузки
			reqSelectDataCallDetails(true); // Передаем true для автоматического экспорта после загрузки
		}
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
		silent: true, // Autoriser explicitement le son pour chaque notification
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

	// Trouver les nouveaux appels (présents dans les données actuelles но не в данных предыдущих)
	let newCallIds = currentCallIds.filter(id => !previousCallIds.includes(id));

	// Trouver les appels terminés
	// (qui étaient dans les données précédentes, ne sont pas dans $currentCallData и не отмечены как обработанные)
	let endedCallIds = previousCallIds.filter(id =>
		!allCurrentCallIds.includes(id) &&
		// Vérifier la présence d'une notification pour cet appel
		$displayedNotifications[id]
	);

	// Trouver les appels déjà traités et affichés dans les notifications
	let processedDisplayedCallIds = [];
	if ($autoCloseNotifications) {
		processedDisplayedCallIds = Object.keys($displayedNotifications).filter(id =>
			$processedCallIds.includes(id) && // L'appel est déjà État
			!allCurrentCallIds.includes(id)   // Et n'est pas dans le résultat de la requête actuelle
		);
	}

	// НОВАЯ ЛОГИКА: Не закрываем уведомления при завершении звонков
	// Вместо этого полагаемся на таймер в createGroupedWindowsNotification

	console.log(`Traitement des données: tous les appels actuels=${allCurrentCallIds.length}, nouveaux appels=${newCallIds.length}, appels terminés=${endedCallIds.length}, traités affichés=${processedDisplayedCallIds.length}, fermeture auto=${$autoCloseNotifications}`);

	if (newCallIds.length > 0) {
		// Récupération des nouvelles données d'appel
		const newCalls = newCallIds.map(id => {
			const row = $dataNotifEntrante.find(row => row[0] === id);
			return {
				id: id,
				telClient: row[6], // Téléphone du client (index 6)
				campagne: row[7]   // Nom de la campagne (index 7)
			};
		});

		if (newCalls.length === 1) {
			// S'il n'y a qu'un appel, afficher une notification individuelle.
			// La fonction "showPopup" prend en charge les vérifications de permission.
			const call = newCalls[0];
			showPopup(call.id, call.telClient, call.campagne);
			console.log(`Créé une notification individuelle pour 1 nouvel appel`);
		} else if (newCalls.length > 1) {
			// Sinon, regrouper tous les appels dans une notification groupée.
			createGroupedWindowsNotification(newCalls);
			console.log(`Créé une notification groupée pour ${newCalls.length} nouveaux appels`);
		}

		// Ajouter l'ensemble des appels nouvellement traités dans la liste des appels déjà traités.
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

	if (callHistoryModal && callHistoryModal.style.display !== 'none') {
		// On récupère la période active (day|week|month)
		const activePeriod = callHistoryModal
			.querySelector('.filter-btn.active')
			?.getAttribute('data-period') || 'day';
		// On recharge les données dans le tableau
		populateCallHistoryTable(activePeriod);
		// On ajuste la largeur au besoin
		updateTableWidth();
	}
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

	console.log(`Statistique des appels mise à jour : ${status} (ID: ${callId})`);
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
	}
	setTimeout(monitorInCalls, 1000);
}


// Declaration de la fonction principale
async function main() {
	console.warn('DEBUT MAIN');
	await reqSelectDataCall();
	console.table('DATA NOTIF', $dataNotifEntrante);
	window.top.inject_notif_entrante();

	// Очищаем старые идентификаторы звонков, если прошло слишком много времени
	// (например, удаляем записи старше 1 часа)
	const oneHourAgo = new Date().getTime() - 60 * 60 * 1000; //TODO удалить эту часть
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

// Функция для периодического запуска проверки деталей звонков
function startCallDetailsCheck() {
	console.log('Запуск периодической проверки деталей звонков');
	// Функция для запуска одной проверки
	function runSingleCheck() {
		reqSelectDataCallDetails(false)
			.catch(error => {
				console.error('Ошибка при выполнении проверки деталей звонков:', error);
			});
	}
	// Запускаем первую проверку
	runSingleCheck();
	setInterval(runSingleCheck, 70000);
}

initializePopupContainer();
appendNotifHtml();
// Appeler la fonction pour charger le fichier CSS personnalisé dans le DOM de Hermes.net
loadCssFileInWorkspace('fimainfo_notifications.css');



// loadTailwindInWorkspace('fimainfo_tailwind_4.js');
monitorInCalls();
// Appel des fonctions pour récupérer les campagnes et les comparer
checkCampaigns($campaignType);
checkCampaignsConnected($queuesType);
// Запускаем периодическую проверку деталей звонков
startCallDetailsCheck();
// Démarrer la surveillance des appels en attente
initializeCallsMonitoring();
callsCounter();



const callButton = window.top.document.getElementById('call');
if (callButton) {
	callButton.addEventListener('click', function () {
		//console.warn('Bouton "HISTO APPELS" cliqué : ');
		showCallHistoryModal();
	});
} else {
	console.error('Bouton "HISTO APPELS" n\'est pas trouvé');
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
		body += `${index + 1}. ${call.telClient} | ${call.campagne}\n`;
	});

	const options = {
		body: body,
		icon: iconUrl,
		tag: uniqueTag,
		silent: true,
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

		// Сохраняем каждый звонок в историю
		saveCallToHistory(call.id, call.telClient, call.campagne);
	});

	// Воспроизводим звук
	const audio = new Audio('https://images.centrerelationsclients.com/Clochette/Notif_Entrant/rington_for_workspace_hermes.mp3');
	audio.volume = 0.7;
	audio.play().catch(error => {
		console.error('Ошибка воспроизведения аудио:', error);
	});
}

// Глобальные переменные для контроля экспорта
let isExportInProgress = false;
let exportPendingType = null; // 'excel' или 'csv'
let exportPendingPeriod = null;

// Функция для проверки, полностью ли загружены данные в таблице
function isCallHistoryComplete(callHistory) {
	// Если хотя бы одна запись имеет статус "en attente", считаем данные незагруженными
	const hasIncompleteData = callHistory.some(call =>
		call.agent === null || call.agent === undefined
	);

	// Возвращаем true только если нет записей в процессе загрузки
	return !hasIncompleteData;
}

// Функция для отображения всплывающего сообщения "Patientez, téléchargement en cours"
function showExportWaitingMessage(exportBtn) {
	// Создаем всплывающее сообщение, если его еще нет
	let waitingPopup = callHistoryModal.querySelector('.export-waiting-popup');
	if (!waitingPopup) {
		waitingPopup = document.createElement('div');
		waitingPopup.className = 'export-waiting-popup';
		waitingPopup.innerHTML = 'Patientez, téléchargement en cours';
		callHistoryModal.querySelector('.export-buttons').appendChild(waitingPopup);
	}

	// Показываем сообщение
	waitingPopup.style.display = 'block';

	// Добавляем класс загрузки для анимации
	exportBtn.classList.add('loading');
	const originalContent = exportBtn.innerHTML;
	exportBtn.innerHTML = '<div class="loading-spinner"></div> ' +
		(exportBtn.classList.contains('export-excel') ? 'Excel' : 'CSV');

	return { waitingPopup, originalContent };
}

// Функция для скрытия всплывающего сообщения
function hideExportWaitingMessage(exportBtn, originalContent) {
	const waitingPopup = callHistoryModal.querySelector('.export-waiting-popup');
	if (waitingPopup) {
		waitingPopup.style.display = 'none';
	}

	exportBtn.classList.remove('loading');
	exportBtn.innerHTML = originalContent;
}

function initializeExportButtons() {
	if (!callHistoryModal) {
		console.error('Fenêtre modale de l\'historique des appels non trouvée.');
		return;
	}

	const excelButton = callHistoryModal.querySelector('.export-excel');
	const csvButton = callHistoryModal.querySelector('.export-csv');

	if (!excelButton) {
		console.error('Bouton d\'exportation Excel non trouvé.');
	} else {
		excelButton.addEventListener('click', function () {
			if (!callHistoryModal) {
				console.error('Fenêtre modale de l\'historique des appels non disponible.');
				return;
			}

			// Определяем активный период
			const periodButtons = callHistoryModal.querySelectorAll('.period-button');
			let activePeriod = 'day'; // По умолчанию день

			periodButtons.forEach(button => {
				if (button.classList.contains('active')) {
					activePeriod = button.dataset.period;
				}
			});

			// Напрямую вызываем функцию экспорта в Excel
			exportTableToExcel(activePeriod);
		});
	}

	if (!csvButton) {
		console.error('Bouton d\'exportation CSV non trouvé.');
	} else {
		csvButton.addEventListener('click', function () {
			if (!callHistoryModal) {
				console.error('Fenêtre modale de l\'historique des appels non disponible.');
				return;
			}

			// Определяем активный период
			const periodButtons = callHistoryModal.querySelectorAll('.period-button');
			let activePeriod = 'day'; // По умолчанию день

			periodButtons.forEach(button => {
				if (button.classList.contains('active')) {
					activePeriod = button.dataset.period;
				}
			});

			// Напрямую вызываем функцию экспорта в CSV
			exportTableToCSV(activePeriod);
		});
	}
}

// Variables globales pour contrôler la vérification des appels non traités
let checkNonProcessedInterval = null;
let lastCheckTime = 0;
let isBackgroundMode = false; // Indique si on est en mode arrière-plan (fenêtre fermée)

// Fonction pour vérifier et mettre à jour les appels non traités
function checkAndUpdateNonProcessedCalls() {
	// Vérifier si la table d'historique des appels existe
	if (!callHistoryModal || callHistoryModal.style.display === 'none') {
		// Si la modal n'est pas ouverte, on passe en mode arrière-plan
		if (!isBackgroundMode) {
			console.log('Fenêtre modale fermée, passage en mode vérification arrière-plan (toutes les 3 minutes)');
			isBackgroundMode = true;
			// Ajuster l'intervalle à 3 minutes
			if (checkNonProcessedInterval) {
				clearInterval(checkNonProcessedInterval);
				checkNonProcessedInterval = setInterval(checkAndUpdateNonProcessedCalls, 50000); // 50 sec
			}
		}

		// On continue quand même à vérifier le localStorage pour les mises à jour
		checkNonProcessedCallsFromLocalStorage();
		return;
	} else if (isBackgroundMode) {
		// Si la fenêtre est maintenant ouverte mais nous étions en mode arrière-plan, repasser en mode normal
		console.log('Fenêtre modale ouverte, retour en mode vérification normale (toutes les 1,5 minutes)');
		isBackgroundMode = false;
		// Ajuster l'intervalle à 1,5 minute
		if (checkNonProcessedInterval) {
			clearInterval(checkNonProcessedInterval);
			checkNonProcessedInterval = setInterval(checkAndUpdateNonProcessedCalls, 90000); // 1,5 minutes
		}
	}

	// Obtenir la table d'historique des appels
	const table = callHistoryModal.querySelector('.call-history-table');
	if (!table) return;

	// Obtenir toutes les lignes du tableau
	const rows = table.querySelectorAll('tbody tr');
	if (!rows || rows.length === 0) return;

	// Tableau pour stocker les IDs des appels non traités
	const nonProcessedCallIds = [];

	// Parcourir toutes les lignes pour trouver les appels non traités
	rows.forEach(row => {
		// Rechercher la cellule d'état (dernière cellule)
		const cells = row.querySelectorAll('td');
		if (!cells || cells.length === 0) return;

		// Obtenir la cellule d'état (dernière colonne)
		const statusCell = cells[cells.length - 1];
		if (!statusCell) return;

		// Vérifier si la cellule contient un statut "non traité"
		const statusSpan = statusCell.querySelector('.status-unprocessed');
		if (statusSpan && statusSpan.textContent.trim() === 'non traité') {
			// CORRECTION: Nous devons obtenir l'ID de l'appel, pas le numéro de téléphone
			// Utilisons un attribut data-id sur la ligne ou cherchons dans l'historique localStorage

			// Méthode 1: Essayer d'obtenir l'ID depuis la colonne ID si visible
			let callId = null;
			if (showIdColumn && cells[0]) {
				callId = cells[0].textContent.trim();
			} else {
				// Méthode 2: Si l'ID n'est pas visible, nous devons obtenir l'ID à partir du numéro de téléphone
				// en cherchant dans l'historique des appels stocké dans localStorage
				const telClient = cells[0].textContent.trim(); // Numéro de téléphone (première colonne visible)
				const campagne = cells[1].textContent.trim();  // Nom de la campagne (deuxième colonne visible)
				const dateString = cells[2].textContent.trim(); // Date (troisième colonne visible)

				// Récupérer l'historique des appels
				const storedHistory = localStorage.getItem($callHistoryKey);
				if (storedHistory) {
					try {
						const callHistory = JSON.parse(storedHistory);
						// Chercher l'appel correspondant
						const matchingCall = callHistory.find(call => {
							return call.telClient === telClient &&
								call.campagne === campagne &&
								call.status === 'non traité';
						});

						if (matchingCall) {
							callId = matchingCall.id;
							console.log(`ID d'appel '${callId}' trouvé pour le numéro ${telClient} dans l'historique`);
						}
					} catch (e) {
						console.error('Erreur lors de la lecture de l\'historique pour trouver l\'ID d\'appel:', e);
					}
				}
			}

			// Vérifier que l'ID a été trouvé et n'est pas vide
			if (callId && callId !== '') {
				// Vérifier que l'ID semble être un ID valide (généralement guid ou valeur hexadécimale)
				// et pas un numéro de téléphone qui commencerait par + ou des chiffres
				if (!callId.startsWith('+') && !callId.match(/^\d+$/)) {
					nonProcessedCallIds.push(callId);
				} else {
					console.warn(`ID potentiellement invalide ignoré: ${callId}`);
				}
			}
		}
	});

	// Si aucun appel non traité trouvé dans l'interface, vérifier aussi dans localStorage
	if (nonProcessedCallIds.length === 0) {
		console.log('Aucun appel non traité trouvé dans l\'interface, vérification dans localStorage');
		checkNonProcessedCallsFromLocalStorage();
		return;
	}

	// Éviter de faire des requêtes trop fréquentes (au moins 10 secondes d'écart)
	const currentTime = new Date().getTime();
	if (currentTime - lastCheckTime < 10000) {
		console.log('Dernière vérification trop récente, attente...');
		return;
	}
	lastCheckTime = currentTime;

	console.log(`${nonProcessedCallIds.length} appels non traités trouvés, mise à jour...`);

	// Former et exécuter la requête SQL pour obtenir les statuts actuels
	const query = `
    SELECT
        [Id],
        [Status]
    FROM ${$db_dev}.dbo.[Fimainfo_C4_notif_son_details_appels]
    WHERE [Id] IN (${nonProcessedCallIds.map(id => `'${id}'`).join(', ')})
    `;
	console.log('Requête SQL pour la vérification des statuts:', query);

	// Exécuter la requête SQL
	reqSelect(`${$db_client}`, query)
		.then(result => {
			console.log('Résultats de la requête de statut:', result);

			// Si aucun résultat, sortir
			if (!result || (Array.isArray(result) && result.length === 0)) {
				console.log('Aucun nouveau statut trouvé');
				return;
			}
			// Convertir le résultat en tableau si ce n'est pas déjà le cas
			const resultArray = Array.isArray(result) ? result : [result];
			// Tableau pour suivre les mises à jour
			let updatesCount = 0;
			// Mettre à jour les statuts dans le tableau
			resultArray.forEach(status => {
				// Trouver la ligne correspondante dans le tableau
				rows.forEach(row => {
					const cells = row.querySelectorAll('td');
					if (!cells || cells.length === 0) return;

					// Obtenir l'ID de la ligne
					let rowCallId = null;

					// Si la colonne ID est visible, l'ID est dans la première colonne
					if (showIdColumn && cells[0]) {
						rowCallId = cells[0].textContent.trim();
					} else {
						// Sinon, on doit utiliser les mêmes critères de recherche que précédemment
						const telClient = cells[0].textContent.trim();
						const campagne = cells[1].textContent.trim();

						// Récupérer l'historique des appels
						const storedHistory = localStorage.getItem($callHistoryKey);
						if (storedHistory) {
							try {
								const callHistory = JSON.parse(storedHistory);
								// Chercher l'appel correspondant
								const matchingCall = callHistory.find(call => {
									return call.telClient === telClient &&
										call.campagne === campagne &&
										call.id === status.Id; // Vérifie que l'ID correspond
								});

								if (matchingCall) {
									rowCallId = matchingCall.id;
								}
							} catch (e) {
								console.error('Erreur lors de la recherche de l\'ID dans l\'historique:', e);
							}
						}
					}

					// Si l'ID correspond
					if (rowCallId === status.Id) {
						// Obtenir la cellule de statut (dernière colonne)
						const statusCell = cells[cells.length - 1];
						if (!statusCell) return;
						// Créer ou mettre à jour le span de statut
						let statusSpan = statusCell.querySelector('span');
						if (!statusSpan) {
							statusSpan = document.createElement('span');
							statusCell.appendChild(statusSpan);
						}
						// Déterminer la classe et le texte du statut
						let statusClass = '';
						let statusText = '';
						if (status.Status === 'traité') {
							statusClass = 'status-processed';
							statusText = 'traité';
						} else if (status.Status === 'non traité') {
							statusClass = 'status-unprocessed';
							statusText = 'non traité';
						} else if (status.Status === 'en attente') {
							statusClass = 'status-waiting';
							statusText = 'en attente';
						} else {
							// Statut par défaut ou personnalisé
							statusClass = 'status-custom';
							statusText = status.Status || 'inconnu';
						}
						// Mettre à jour la classe et le texte
						statusSpan.className = statusClass;
						statusSpan.textContent = statusText;
						// Mettre à jour également l'historique dans localStorage
						updateCallHistoryStatus(rowCallId, status.Status);
						// Compter les mises à jour
						updatesCount++;
					}
				});
			});
			console.log(`${updatesCount} statuts mis à jour dans le tableau`);

			// Vérifier s'il reste des appels non traités
			const remainingNonProcessed = table.querySelectorAll('.status-unprocessed');
			if (remainingNonProcessed.length === 0) {
				console.log('Tous les appels dans l\'interface sont maintenant traités');
				// Mais on ne s'arrête pas, on continue à vérifier en arrière-plan
				checkNonProcessedCallsFromLocalStorage();
			}
		})
		.catch(error => {
			console.error('Erreur lors de la vérification des statuts:', error);
		});
}

// Fonction pour vérifier les appels non traités directement depuis localStorage
function checkNonProcessedCallsFromLocalStorage() {
	// Récupérer l'historique des appels depuis localStorage
	let callHistory = [];
	const storedHistory = localStorage.getItem($callHistoryKey);

	if (!storedHistory) {
		console.log('Aucun historique trouvé dans localStorage');
		return;
	}

	try {
		callHistory = JSON.parse(storedHistory);
	} catch (e) {
		console.error('Erreur lors de la lecture de l\'historique des appels depuis localStorage:', e);
		return;
	}

	// Filtrer pour obtenir uniquement les appels non traités
	const nonProcessedCalls = callHistory.filter(call =>
		call.status === 'non traité'
	);

	// Si aucun appel non traité, on peut arrêter les vérifications
	if (nonProcessedCalls.length === 0) {
		console.log('Aucun appel non traité trouvé dans localStorage, arrêt de la vérification périodique');
		if (checkNonProcessedInterval) {
			clearInterval(checkNonProcessedInterval);
			checkNonProcessedInterval = null;
		}
		return;
	}

	// Éviter de faire des requêtes trop fréquentes
	const currentTime = new Date().getTime();
	if (currentTime - lastCheckTime < 10000) {
		console.log('Dernière vérification trop récente, attente...');
		return;
	}
	lastCheckTime = currentTime;

	// Extraire les IDs en vérifiant qu'ils ne sont pas des numéros de téléphone
	const nonProcessedCallIds = nonProcessedCalls
		.map(call => call.id)
		.filter(id => id && !id.startsWith('+') && !id.match(/^\d+$/));

	console.log(`${nonProcessedCallIds.length} appels non traités trouvés dans localStorage, mise à jour...`);

	// Former et exécuter la requête SQL
	const query = `
    SELECT
        [Id],
        [Status]
    FROM ${$db_dev}.dbo.[Fimainfo_C4_notif_son_details_appels]
    WHERE [Id] IN (${nonProcessedCallIds.map(id => `'${id}'`).join(', ')})
    `;

	console.log('Requête SQL pour la vérification des statuts (depuis localStorage):', query);

	// Exécuter la requête
	reqSelect(`${$db_client}`, query)
		.then(result => {
			console.log('Résultats de la requête de statut (depuis localStorage):', result);

			// Si aucun résultat, sortir
			if (!result || (Array.isArray(result) && result.length === 0)) {
				console.log('Aucun nouveau statut trouvé');
				return;
			}

			// Convertir le résultat en tableau si ce n'est pas déjà le cas
			const resultArray = Array.isArray(result) ? result : [result];

			// Nombre de mises à jour effectuées
			let updatesCount = 0;

			// Mettre à jour chaque statut dans localStorage
			resultArray.forEach(status => {
				updateCallHistoryStatus(status.Id, status.Status);
				updatesCount++;
			});

			console.log(`${updatesCount} statuts mis à jour dans localStorage`);

			// Si la modale est ouverte, mettre à jour aussi l'affichage
			if (callHistoryModal && callHistoryModal.style.display !== 'none') {
				console.log('Mise à jour de l\'affichage du tableau dans la modale ouverte');
				populateCallHistoryTable(callHistoryModal.querySelector('.filter-btn.active')?.getAttribute('data-period') || 'day');
			}

			// Vérifier s'il reste des appels non traités après mise à jour
			const remainingNonProcessed = callHistory.filter(call =>
				resultArray.every(status => status.Id !== call.id || status.Status === 'non traité')
			);

			if (remainingNonProcessed.length === 0) {
				console.log('Tous les appels dans localStorage sont maintenant traités, arrêt de la vérification périodique');
				if (checkNonProcessedInterval) {
					clearInterval(checkNonProcessedInterval);
					checkNonProcessedInterval = null;
				}
			}
		})
		.catch(error => {
			console.error('Erreur lors de la vérification des statuts (depuis localStorage):', error);
		});
}

// Fonction pour mettre à jour le statut d'un appel dans l'historique localStorage
function updateCallHistoryStatus(callId, newStatus) {
	// Récupérer l'historique des appels depuis localStorage
	let callHistory = [];
	const storedHistory = localStorage.getItem($callHistoryKey);

	if (storedHistory) {
		try {
			callHistory = JSON.parse(storedHistory);
		} catch (e) {
			console.error('Erreur lors de la lecture de l\'historique des appels depuis localStorage:', e);
			return;
		}
	}

	// Rechercher et mettre à jour l'appel spécifique
	let updated = false;
	callHistory = callHistory.map(call => {
		if (call.id === callId) {
			updated = true;
			return { ...call, status: newStatus };
		}
		return call;
	});

	// Si l'appel a été mis à jour, sauvegarder l'historique actualisé
	if (updated) {
		try {
			localStorage.setItem($callHistoryKey, JSON.stringify(callHistory));
			console.log(`Statut de l'appel ${callId} mis à jour dans l'historique: ${newStatus}`);

			// Si la modale est ouverte, mettre à jour l'affichage pour toutes les périodes
			if (callHistoryModal && callHistoryModal.style.display !== 'none') {
				// Récupérer la période active pour pouvoir la restaurer après
				const activeFilterBtn = callHistoryModal.querySelector('.filter-btn.active');
				const activePeriod = activeFilterBtn ? activeFilterBtn.getAttribute('data-period') : 'day';

				// Mettre à jour le tableau pour chaque période si la modale est ouverte
				const periods = ['day', 'week', 'month'];
				periods.forEach(period => {
					// Stockage temporaire de l'historique de la période
					const filteredHistory = getCallHistory(period);
					// Mettre à jour les appels avec le même ID dans cette période
					const updatedFilteredHistory = filteredHistory.map(call => {
						if (call.id === callId) {
							return { ...call, status: newStatus };
						}
						return call;
					});

					// Si on est sur la période active, mettre à jour l'affichage
					if (period === activePeriod) {
						populateCallHistoryTable(period);
						// Обновляем состояние кнопок экспорта после обновления таблицы
						updateExportButtonsState();
					}
				});
			}
		} catch (e) {
			console.error('Erreur lors de la sauvegarde de l\'historique des appels dans localStorage:', e);
		}
	}
}

// Fonction pour démarrer la vérification périodique des appels non traités
function startNonProcessedCallsCheck() {
	// Arrêter l'intervalle existant s'il y en a un
	if (checkNonProcessedInterval) {
		clearInterval(checkNonProcessedInterval);
	}

	// Réinitialiser le mode arrière-plan
	isBackgroundMode = callHistoryModal.style.display === 'none';
	const checkInterval = isBackgroundMode ? 120000 : 60000; // 2 minutes en arrière-plan, 1 minute en mode normal

	// Exécuter immédiatement une première vérification
	checkAndUpdateNonProcessedCalls();

	// Configurer l'intervalle selon le mode
	checkNonProcessedInterval = setInterval(checkAndUpdateNonProcessedCalls, checkInterval);
	console.log(`Vérification périodique des appels non traités démarrée (toutes les ${isBackgroundMode ? '2' : '1'} minutes)`);
}
