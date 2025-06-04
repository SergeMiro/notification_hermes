-- CREER TOUT DANS LA BASE : "HN_FIMAINFO" DU CLOUD CONCERNE

-- Création de la Vue SQL pour les appels entrants
USE [HN_FIMAINFO];
GO

CREATE VIEW [dbo].[Fimainfo_Notif_Son_C4] AS
SELECT
    c.ID AS 'Id',
    FORMAT(c.CallLocalTime, 'yyyy-MM-dd HH:mm:ss.fff') AS 'CallLocalTime',
    c.CustomerID,
    c.CallType AS 'CallType',
    ISNULL(t.Description, c.CallType) AS 'Type',
    c.Indice,
    CASE 
        WHEN ISNULL(t.Description, c.CallType) = 'Outbound call' THEN c.FirstCampaign
        ELSE LEFT(
            CASE 
                WHEN c.OutTel = '' THEN c.ANI 
                ELSE c.OutTel 
            END, 
            IIF(
                CHARINDEX('-', CASE WHEN c.OutTel = '' THEN c.ANI ELSE c.OutTel END) > 0, 
                CHARINDEX('-', CASE WHEN c.OutTel = '' THEN c.ANI ELSE c.OutTel END) - 1, 
                0
            )
        )
    END AS 'IdCampagne',
    CASE 
        WHEN ISNULL(t.Description, c.CallType) = 'Outbound call' THEN 
            CASE 
                WHEN LEFT(c.OutTel, 1) = '0' THEN '+33' + SUBSTRING(c.OutTel, 2, LEN(c.OutTel) - 1)
                WHEN LEFT(c.OutTel, 2) = '00' THEN '+' + SUBSTRING(c.OutTel, 3, LEN(c.OutTel) - 2)
                ELSE c.OutTel
            END
        ELSE 
            CASE 
                WHEN CHARINDEX('-', CASE WHEN c.OutTel = '' THEN c.ANI ELSE c.OutTel END) > 0 THEN
                    CASE 
                        WHEN LEFT(RIGHT(CASE WHEN c.OutTel = '' THEN c.ANI ELSE c.OutTel END, 
                                    LEN(CASE WHEN c.OutTel = '' THEN c.ANI ELSE c.OutTel END) - 
                                    CHARINDEX('-', CASE WHEN c.OutTel = '' THEN c.ANI ELSE c.OutTel END)), 1) = '0' THEN 
                            '+33' + SUBSTRING(RIGHT(CASE WHEN c.OutTel = '' THEN c.ANI ELSE c.OutTel END, 
                                                LEN(CASE WHEN c.OutTel = '' THEN c.ANI ELSE c.OutTel END) - 
                                                CHARINDEX('-', CASE WHEN c.OutTel = '' THEN c.ANI ELSE c.OutTel END)), 2, 
                                                LEN(RIGHT(CASE WHEN c.OutTel = '' THEN c.ANI ELSE c.OutTel END, 
                                                LEN(CASE WHEN c.OutTel = '' THEN c.ANI ELSE c.OutTel END) - 
                                                CHARINDEX('-', CASE WHEN c.OutTel = '' THEN c.ANI ELSE c.OutTel END))) - 1)
                        WHEN LEFT(RIGHT(CASE WHEN c.OutTel = '' THEN c.ANI ELSE c.OutTel END, 
                                    LEN(CASE WHEN c.OutTel = '' THEN c.ANI ELSE c.OutTel END) - 
                                    CHARINDEX('-', CASE WHEN c.OutTel = '' THEN c.ANI ELSE c.OutTel END)), 2) = '00' THEN 
                            '+' + SUBSTRING(RIGHT(CASE WHEN c.OutTel = '' THEN c.ANI ELSE c.OutTel END, 
                                                LEN(CASE WHEN c.OutTel = '' THEN c.ANI ELSE c.OutTel END) - 
                                                CHARINDEX('-', CASE WHEN c.OutTel = '' THEN c.ANI ELSE c.OutTel END)), 3, 
                                                LEN(RIGHT(CASE WHEN c.OutTel = '' THEN c.ANI ELSE c.OutTel END, 
                                                LEN(CASE WHEN c.OutTel = '' THEN c.ANI ELSE c.OutTel END) - 
                                                CHARINDEX('-', CASE WHEN c.OutTel = '' THEN c.ANI ELSE c.OutTel END))) - 2)
                        ELSE 
                            RIGHT(CASE WHEN c.OutTel = '' THEN c.ANI ELSE c.OutTel END, 
                                LEN(CASE WHEN c.OutTel = '' THEN c.ANI ELSE c.OutTel END) - 
                                CHARINDEX('-', CASE WHEN c.OutTel = '' THEN c.ANI ELSE c.OutTel END))
                    END
                ELSE 
                    CASE 
                        WHEN LEFT(CASE WHEN c.OutTel = '' THEN c.ANI ELSE c.OutTel END, 1) = '0' THEN 
                            '+33' + SUBSTRING(CASE WHEN c.OutTel = '' THEN c.ANI ELSE c.OutTel END, 2, LEN(CASE WHEN c.OutTel = '' THEN c.ANI ELSE c.OutTel END) - 1)
                        WHEN LEFT(CASE WHEN c.OutTel = '' THEN c.ANI ELSE c.OutTel END, 2) = '00' THEN 
                            '+' + SUBSTRING(CASE WHEN c.OutTel = '' THEN c.ANI ELSE c.OutTel END, 3, LEN(CASE WHEN c.OutTel = '' THEN c.ANI ELSE c.OutTel END) - 2)
                        ELSE 
                            CASE WHEN c.OutTel = '' THEN c.ANI ELSE c.OutTel END
                    END
            END
    END AS 'TelClient',
cam.Description AS 'NomCampagne',
c.FirstAgent AS 'Agent',
c.WaitDuration AS 'TempsAttente', 
c.Duration AS 'DureeAppel', 
c.Abandon AS 'AppelAbandonne'
FROM
    [HN_Ondata].[dbo].[ODCalls] AS c
LEFT OUTER JOIN
    [HN_Ondata].[dbo].[CallTypes] AS t ON c.CallType = t.CallType
LEFT OUTER JOIN
    [HN_Admin].[dbo].[Campaigns] AS cam ON 
    CASE 
        WHEN ISNULL(t.Description, c.CallType) = 'Outbound call' THEN c.FirstCampaign
        ELSE LEFT(
            CASE 
                WHEN c.OutTel = '' THEN c.ANI 
                ELSE c.OutTel 
            END, 
            IIF(
                CHARINDEX('-', CASE WHEN c.OutTel = '' THEN c.ANI ELSE c.OutTel END) > 0, 
                CHARINDEX('-', CASE WHEN c.OutTel = '' THEN c.ANI ELSE c.OutTel END) - 1, 
                0
            )
        )
    END = cam.DID;




-- Création de la table 
CREATE TABLE dbo.Fimainfo_C4_notif_son_details_appels (
    Id             NVARCHAR(50) NOT NULL PRIMARY KEY CLUSTERED,
    TempsAttente   INT,
    DureeAppel     INT,
    AppelAbandonne INT,
    Agent          INT,
    CallLocalTime  DATETIME,
    TelClient      NVARCHAR(50),
    Status         NVARCHAR(20) DEFAULT ('non traité')
);
GO


-- Création d'INDEX sur colonne ID pour recherche rapide coté client (front)
CREATE NONCLUSTERED INDEX IX_Details_Id_Cover
ON dbo.Fimainfo_C4_notif_son_details_appels (Id)
INCLUDE (Status,
         TelClient,
         CallLocalTime,
         TempsAttente,
         DureeAppel,
         AppelAbandonne,
         Agent);
GO

-- ------------------------------------------------------------------------------------------------
-- Création de la procedure stockée v1.1
USE [HN_FIMAINFO]
GO
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE PROCEDURE [dbo].[Notif_son_load_details_appels_C4_Fimainfo]
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;
        -- Table variable to capture inserted rows
        DECLARE @InsertedCalls TABLE (
            TelClient   NVARCHAR(50),
            CallStatus  NVARCHAR(20)
        );
        -- Insert new calls and capture TelClient and Status
        INSERT INTO dbo.Fimainfo_C4_notif_son_details_appels (
             [Id]
            ,[TempsAttente]
            ,[DureeAppel]
            ,[AppelAbandonne]
            ,[Agent]
            ,[CallLocalTime]
            ,[TelClient]
            ,[Status]
        )
        OUTPUT inserted.TelClient, inserted.Status INTO @InsertedCalls(TelClient, CallStatus)
        SELECT 
            v.[Id],
            v.[TempsAttente],
            v.[DureeAppel],
            v.[AppelAbandonne],
            v.[Agent],
            TRY_CONVERT(DATETIME, v.[CallLocalTime], 120) AS [CallLocalTime],
            v.[TelClient],
				CASE
					WHEN v.Agent = 0 OR v.Agent IS NULL THEN N'non traité'
					ELSE N'traité'
				END AS Status
        FROM dbo.Fimainfo_Notif_Son_C4 v
        WHERE 
            v.[AppelAbandonne] IN (0, 1)
            AND NOT EXISTS (
                SELECT 1 
                FROM dbo.Fimainfo_C4_notif_son_details_appels d 
                WHERE d.Id = v.Id
            );
        -- For each newly inserted call with Status = 'traité', update past 30 days calls of same TelClient to 'traité'
        UPDATE d
        SET d.Status = N'traité'
        FROM dbo.Fimainfo_C4_notif_son_details_appels d
        INNER JOIN @InsertedCalls ic
            ON d.TelClient = ic.TelClient
        WHERE ic.CallStatus = N'traité'
          AND d.CallLocalTime >= DATEADD(DAY, -30, GETDATE());

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
        RAISERROR (@ErrorMessage, 16, 1);
    END CATCH;
END;

