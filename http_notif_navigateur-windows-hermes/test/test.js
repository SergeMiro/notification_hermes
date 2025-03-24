
let dataNotif = [
	['574099d2585e49ae88bbaaa1735efc24', '2024-09-10 16:03:07.397', 31, 'Inbound call', '1519115555', '345584727', '0661481269', 'SRA dernier appel'],
	['8677d838d3d640858573d0763011ab7e', '2024-09-10 16:02:46.047', 31, 'Inbound call', '5456554545', '345584721', '0699372176', 'SRA avant-dernier appel'],
	['aadf832bcf6a4c448cdcd445e71b09c3', '2024-09-10 15:59:48.127', 31, 'Inbound call', '4654654664', '345584489', '0380515151', 'SRA 33333'],
	['bf8b8fb3524f41e0b1a63412fbfd92a8', '2024-09-10 16:03:07.397', 31, 'Inbound call', '1111111111', '345584555', '0661481269', 'SRA 44444'],
	['c7d5fd7e47a64f758ca1a9799ec3d5af', '2024-09-10 16:02:46.047', 31, 'Inbound call', '1112222222', '345584455', '0699372176', 'SRA еееее'],
	['90a1c6843b634be4ae8b34826e1fb12c', '2024-09-10 15:59:48.127', 31, 'Inbound call', '1113666666', '345584246', '0380515151', 'SRA ыыыыы'],
	['9b3f3d1c5b9f4bcf8b878f15b8c7ec97', '2024-09-10 16:03:07.397', 31, 'Inbound call', '1113333333', '345584715', '0661481269', 'SRA ццццц'],
	['6548c1a5e0f14be095b65e3e9f913e1b', '2024-09-10 16:02:46.047', 31, 'Inbound call', '1113444444', '345584724', '0699372176', 'SRA ннннн'],
	['8677d838d3d640858573d0763011ab7e', '2024-09-10 16:02:46.047', 31, 'Inbound call', '5456554545', '345584721', '0699372176', 'SRA LYON'],
	['574099d2585e49ae88bbaaa1735efc24', '2024-09-10 16:03:07.397', 31, 'Inbound call', '1519115555', '345584727', '0661481269', 'SRA DIJON']
];

$dataNotif2 = [
	['574099d2585e49ae88bbaaa1735efc24', '2024-09-10 16:03:07.397', 31, 'Inbound call', '1519115555', '345584727', '0661481269', 'SRA DIJON'], // Повтор
	['8677d838d3d640858573d0763011ab7e', '2024-09-10 16:02:46.047', 31, 'Inbound call', '5456554545', '345584721', '0699372176', 'SRA LYON'],
	['90a1c6843b634be4ae8b34826e1fb12c', '2024-09-10 15:59:48.127', 31, 'Inbound call', '1113666666', '345584246', '0380515151', 'SRA ыыыыы'],
	['9b3f3d1c5b9f4bcf8b878f15b8c7ec97', '2024-09-10 16:03:07.397', 31, 'Inbound call', '1113333333', '345584715', '0661481269', 'SRA ццццц'],
	['6548c1a5e0f14be095b65e3e9f913e1b', '2024-09-10 16:02:46.047', 31, 'Inbound call', '1113444444', '345584724', '0699372176', 'SRA ннннн'],
	['aadf832bcf6a4c448cdcd445e71b09c3', '2024-09-10 15:59:48.127', 31, 'Inbound call', '4654654664', '345584489', '0380515151', 'SRA PARIS'] // Повтор
];

$dataNotif3 = [
	['574099d2585e49ae88bbaaa1735efc24', '2024-09-10 16:03:07.397', 31, 'Inbound call', '1519115555', '345584727', '0661481269', 'SRA DIJON'], // Повтор
	['8677d838d3d640858573d0763011ab7e', '2024-09-10 16:02:46.047', 31, 'Inbound call', '5456554545', '345584721', '0699372176', 'SRA LYON'],
	['aadf832bcf6a4c448cdcd445e71b09c3', '2024-09-10 15:59:48.127', 31, 'Inbound call', '4654654664', '345584489', '0380515151', 'SRA PARIS'] // Повтор
];

$dataNotif4 = [
	['574099d2585e49ae88bbaaa1735efc24', '2024-09-10 16:03:07.397', 31, 'Inbound call', '1519115555', '345584727', '0661481269', 'SRA DIJON'], // Повтор
	['8677d838d3d640858573d0763011ab7e', '2024-09-10 16:02:46.047', 31, 'Inbound call', '5456554545', '345584721', '0699372176', 'SRA LYON'],
	['90a1c6843b634be4ae8b34826e1fb12c', '2024-09-10 15:59:48.127', 31, 'Inbound call', '1113666666', '345584246', '0380515151', 'SRA ыыыыы'],
	['9b3f3d1c5b9f4bcf8b878f15b8c7ec97', '2024-09-10 16:03:07.397', 31, 'Inbound call', '1113333333', '345584715', '0661481269', 'SRA ццццц'],
	['6548c1a5e0f14be095b65e3e9f913e1b', '2024-09-10 16:02:46.047', 31, 'Inbound call', '1113444444', '345584724', '0699372176', 'SRA ннннн'],
	['aadf832bcf6a4c448cdcd445e71b09c3', '2024-09-10 15:59:48.127', 31, 'Inbound call', '4654654664', '345584489', '0380515151', 'SRA PARIS'] // Повтор
];

$dataNotif5 = [
	['574099d2585e49ae88bbaaa1735efc24', '2024-09-10 16:03:07.397', 31, 'Inbound call', '1519115555', '345584727', '0661481269', 'SRA DIJON'], // Повтор
	['8677d838d3d640858573d0763011ab7e', '2024-09-10 16:02:46.047', 31, 'Inbound call', '5456554545', '345584721', '0699372176', 'SRA LYON'],
	['aadf832bcf6a4c448cdcd445e71b09c3', '2024-09-10 15:59:48.127', 31, 'Inbound call', '4654654664', '345584489', '0380515151', 'SRA PARIS'], // Повтор
	['bf8b8fb3524f41e0b1a63412fbfd92a8', '2024-09-10 16:03:07.397', 31, 'Inbound call', '1111111111', '345584555', '0661481269', 'SRA шшшшш'],
	['c7d5fd7e47a64f758ca1a9799ec3d5af', '2024-09-10 16:02:46.047', 31, 'Inbound call', '1112222222', '345584455', '0699372176', 'SRA еееее'],
	['90a1c6843b634be4ae8b34826e1fb12c', '2024-09-10 15:59:48.127', 31, 'Inbound call', '1113666666', '345584246', '0380515151', 'SRA ыыыыы'],
	['9b3f3d1c5b9f4bcf8b878f15b8c7ec97', '2024-09-10 16:03:07.397', 31, 'Inbound call', '1113333333', '345584715', '0661481269', 'SRA ццццц'],
	['6548c1a5e0f14be095b65e3e9f913e1b', '2024-09-10 16:02:46.047', 31, 'Inbound call', '1113444444', '345584724', '0699372176', 'SRA ннннн'],
	['e97b66b086d94f92af8bbff63d97d4f1', '2024-09-10 15:59:48.127', 31, 'Inbound call', '1115555555', '345584728', '0380515151', 'SRA йййй'],
	['574099d2585e49ae88bbaaa1735efc24', '2024-09-10 16:03:07.397', 31, 'Inbound call', '1519115555', '345584727', '0661481269', 'SRA DIJON'], // Повтор
	['aadf832bcf6a4c448cdcd445e71b09c3', '2024-09-10 15:59:48.127', 31, 'Inbound call', '4654654664', '345584489', '0380515151', 'SRA PARIS'], // Повтор
	['bf8b8fb3524f41e0b1a63412fbfd92a8', '2024-09-10 16:03:07.397', 31, 'Inbound call', '1111111111', '345584555', '0661481269', 'SRA шшшшш']
];

$dataNotif6 = [
	['574099d2585e49ae88bbaaa1735efc24', '2024-09-10 16:03:07.397', 31, 'Inbound call', '1519115555', '345584727', '0661481269', 'SRA DIJON'], // Повтор
	['8677d838d3d640858573d0763011ab7e', '2024-09-10 16:02:46.047', 31, 'Inbound call', '5456554545', '345584721', '0699372176', 'SRA LYON'],
	['aadf832bcf6a4c448cdcd445e71b09c3', '2024-09-10 15:59:48.127', 31, 'Inbound call', '4654654664', '345584489', '0380515151', 'SRA PARIS'], // Повтор
	['9b3f3d1c5b9f4bcf8b878f15b8c7ec97', '2024-09-10 16:03:07.397', 31, 'Inbound call', '1113333333', '345584715', '0661481269', 'SRA ццццц']
];

// Массив текущих ID звонков
let currentCallIds = dataNotif.map(call => call[0]);
// Массив для новых данных после SQL-запроса
let notifNewLines = [];
// Объект для отслеживания скрытых оповещений и их таймеров
let hiddenNotifications = {}; // { [callId]: timeoutId }
// Объект для отслеживания отображаемых попапов
let displayedPopups = {}; // { [callId]: popupElement }
let popupContainer = null;
initializePopupContainer();

// Функция для инициализации контейнера попапов
function initializePopupContainer() {
	if (!popupContainer) {
		popupContainer = window.top.document.createElement('div');
		popupContainer.className = 'popup-container';
		window.top.document.body.appendChild(popupContainer);
	}
}

// Функция для обновления оповещений
async function updateNotifications() {
	// Получаем новые данные из базы данных
	notifNewLines = await fetchNewDataNotif(); // Реализуйте эту функцию для выполнения вашего SQL-запроса

	// Извлекаем новые ID звонков
	let newCallIds = notifNewLines.map(call => call[0]);

	// Определяем добавленные и удаленные звонки
	let addedCallIds = newCallIds.filter(id => !currentCallIds.includes(id));
	let removedCallIds = currentCallIds.filter(id => !newCallIds.includes(id));

	// Обрабатываем добавленные звонки
	addedCallIds.forEach(id => {
		let callData = notifNewLines.find(call => call[0] === id);
		showPopup(id, callData[4], callData[7]); // telClient: index 4, campagne: index 7
	});

	// Обрабатываем удаленные звонки
	removedCallIds.forEach(id => {
		removePopup(id);
	});

	// Обновляем текущие данные
	currentCallIds = newCallIds;
	dataNotif = notifNewLines;
}


// Функция для получения новых данных из базы данных
async function fetchNewDataNotif() {
	// Здесь вы выполняете свой SQL-запрос и возвращаете новые данные в том же формате, что и dataNotif
	// Например, используя fetch или XMLHttpRequest для обращения к серверу

	// Пример с использованием fetch (замените URL и параметры на свои)
	try {
		const response = await fetch('/your-api-endpoint', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ /* ваши параметры запроса */ })
		});
		const result = await response.json();
		return result.data; // Предполагается, что сервер возвращает данные в поле data
	} catch (error) {
		console.error('Ошибка при получении новых данных:', error);
		return [];
	}
}

//Функция для отображения попапа
function showPopup(callId, telClient, campagne) {
	// Проверяем, не скрыто ли оповещение пользователем
	if (hiddenNotifications[callId]) {
		return;
	}

	// Проверяем, не отображается ли уже попап
	if (displayedPopups[callId]) {
		return;
	}

	const popup = window.top.document.createElement('div');
	popup.className = 'custom-popup show';
	popup.id = 'popup-' + callId;

	popup.innerHTML = `
	<div class="call-animation">
		 <img id="icon-call-in" class="popup-icon"
			  src="http://192.168.9.237/hermes_net_v5/InterfaceDesigner/upload/dAlKTsEK/img/icon-appel-4.png"
			  alt="Icone d'appel">
	</div>
	<div>
		 <div class="entete-popup">
			  <h4>Appel entrant Hèrmes</h4>
		 </div>
		 <p class="nom-campagne">Campagne: "${campagne}"</p>
		 <p class="tel-client">Tél. du client: ${telClient}</p>
	</div>
	`;

	// Добавляем обработчик клика для скрытия попапа
	popup.onclick = function () {
		hidePopup(callId);
	};

	popupContainer.appendChild(popup);

	// Воспроизводим звук
	const audio = new Audio('https://github.com/SergeMiro/stock_files/raw/refs/heads/main/notif_appel_court.mp3');
	audio.volume = 0.7;
	audio.play().catch(error => {
		console.error('Ошибка при воспроизведении звука:', error);
	});

	// Сохраняем информацию о отображаемом попапе
	displayedPopups[callId] = popup;
}


//Функция для скрытия попапа при клике и повторного показа через 10 секунд
function hidePopup(callId) {
	// Скрываем попап
	const popup = window.top.document.getElementById('popup-' + callId);
	if (popup) {
		popup.style.display = 'none';
	}
	// Запускаем таймер на 10 секунд
	hiddenNotifications[callId] = setTimeout(() => {
		// Удаляем запись о скрытом оповещении
		delete hiddenNotifications[callId];
		// Проверяем, активен ли еще звонок
		if (currentCallIds.includes(callId)) {
			// Показываем попап снова
			let callData = dataNotif.find(call => call[0] === callId);
			if (callData) {
				showPopup(callId, callData[4], callData[7]);
			}
		}
	}, 10000); // 10 секунд
}


// Функция для удаления попапа при завершении звонка
function removePopup(callId) {
	// Удаляем попап из DOM
	const popup = window.top.document.getElementById('popup-' + callId);
	if (popup) {
		popup.remove();
	}

	// Останавливаем таймер повторного показа, если он есть
	if (hiddenNotifications[callId]) {
		clearTimeout(hiddenNotifications[callId]);
		delete hiddenNotifications[callId];
	}

	// Удаляем из списка отображаемых попапов
	delete displayedPopups[callId];
}

// Запуск периодического обновления оповещений
// Обновляем оповещения каждые 5 секунд (настройте интервал по необходимости)
setInterval(updateNotifications, 5000);
