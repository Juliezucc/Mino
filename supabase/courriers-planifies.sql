-- =====================================================================
-- Mino — la tournée de nuit des e-mails
--
-- À coller dans l'éditeur SQL de Supabase, **après avoir remplacé les deux
-- valeurs entre chevrons**. Rejouable : la tâche est déprogrammée avant d'être
-- reprogrammée.
--
-- ---------------------------------------------------------------------
-- Ce que cette tâche envoie
--
--   `fin_essai`     — trois jours avant le premier prélèvement. Apple et
--                     Google préviennent déjà leurs abonnés ; la route
--                     n'écrit donc qu'aux familles passées par Stripe, sans
--                     quoi un même prélèvement produirait deux messages.
--
--   `reconduction`  — un mois avant l'échéance d'un abonnement annuel. Ce
--                     n'est pas une politesse : l'article L. 215-1 du code de
--                     la consommation impose d'informer le consommateur de sa
--                     faculté de non-reconduction, entre trois mois et un mois
--                     avant le terme.
--
-- Aucun doublon possible : la table `courriers` a pour clé primaire (famille,
-- genre), et la trace n'est écrite qu'après un envoi réussi.
--
-- ---------------------------------------------------------------------
-- Avant de coller — deux choses à préparer
--
-- 1. **Le secret partagé.** Fabriquez-le vous-même, dans un terminal :
--
--        openssl rand -hex 32
--
--    Posez-le à DEUX endroits, et nulle part ailleurs :
--      - dans les secrets des fonctions Edge, sous `COURRIER_CRON_SECRET` ;
--      - dans le `<SECRET>` ci-dessous.
--
--    Il n'y a pas d'utilisateur derrière cet appel : c'est ce secret qui tient
--    la porte, comme pour les webhooks des boutiques. Ne le collez dans aucune
--    conversation.
--
-- 2. **Les réglages SMTP** sur les mêmes secrets : `SMTP_HOST`, `SMTP_PORT`,
--    `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`, et `MAIL_REPLY_TO` si l'adresse de
--    réponse diffère. Sans eux la fonction répond 502 et rien ne part.
-- =====================================================================

create extension if not exists pg_net;

do $$
declare j record;
begin
  for j in select jobid from cron.job where jobname = 'mino-courriers' loop
    perform cron.unschedule(j.jobid);
  end loop;
end $$;

-- 07:00 UTC, soit 9 h à Paris l'été et 8 h l'hiver. Un rappel qui parle
-- d'argent se lit le matin, pas au milieu de la nuit — et une heure creuse
-- côté serveur SMTP évite de se faire prendre pour un envoi de masse.
select cron.schedule(
  'mino-courriers',
  '0 7 * * *',
  $$
  select net.http_post(
    url := 'https://<REF_DU_PROJET>.supabase.co/functions/v1/courrier/lot',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-mino-cron', '<SECRET>'
    ),
    body := '{}'::jsonb,
    -- La tournée peut prendre du temps s'il y a beaucoup de familles ; pg_net
    -- abandonne à 5 secondes par défaut, ce qui la couperait en plein milieu.
    timeout_milliseconds := 120000
  )
  $$
);

-- ---------------------------------------------------------------------
-- Vérifier
--
--   select jobname, schedule, active from cron.job where jobname = 'mino-courriers';
--
-- Puis, après le premier passage, la réponse qu'a rendue la fonction :
--
--   select status_code, content, created
--   from net._http_response
--   order by created desc limit 5;
--
-- Un `401` veut dire que le secret des deux côtés ne correspond pas. Un `502`,
-- que le serveur SMTP a refusé — vérifiez `SMTP_HOST`, `SMTP_PORT` et
-- `SMTP_PASS`. Un `200` avec `{"examinees":0}` est le cas normal tant qu'aucun
-- essai ne se termine dans trois jours.
-- =====================================================================
