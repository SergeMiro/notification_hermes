
-- Créer une Vue dans SQL Server :
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

-- -----------------------------------------------------------
-- Récuperation des données dans Hèrmes
-- "NotificationHermes" - le nom de la Vue dans SQL Server
SELECT TOP (10) * FROM ${$db_client}.${$view_notif}
WHERE Type = 'Inbound call' 
AND Indice = 0 -- Les appels en cours
AND CustomerID = '${$customerId}' -- CustomerID de l'agent
AND IdCampagne IN (${$idsAgentCampaigns.map(id => `'${id}'`).join(', ')}) -- IDs des campagnes auxquelles l'agent est connecté
ORDER BY CallLocalTime DESC

-- -----------------------------------------------------------
-- Meme requette mais associée à une variable
$req_notif = `
SELECT TOP (10) * FROM ${$db_client}.${$view_notif}
WHERE Type = 'Inbound call'
AND CustomerID = '${$customerId}' -- CustomerID de l'agent
AND IdCampagne IN (${$idsAgentCampaigns.map(id => `'${id}'`).join(', ')}) -- IDs des campagnes auxquelles l'agent est connecté
AND Indice = 0 -- Les appels en cours
ORDER BY CallLocalTime DESC
`;


 WHERE Type = 'Inbound call' 
 AND CustomerID = 25	
 AND Indice = 0
 
 ORDER BY CallLocalTime DESC

console.log(`Requête SELECT les appels en cours : \n${$req_notif}`);
console.log(`Les appels entrants en cours : \n${$dataNotif}`);
