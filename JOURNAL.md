# Journal de bord — CDF Bootcamp, projet 33

But : pouvoir reprendre le travail à tout moment (autre session, VS Code, autre assistant)
sans relire toute la conversation. Les règles et les valeurs de référence sont dans
`AGENTS.md` ; ce fichier dit seulement **où on en est** et **quoi faire ensuite**.
Aucun secret ici : ils restent dans `.env`.

## Où on en est (lundi 5 octobre 2026)

Jour 1 — Data Foundations : **déployé en test**. Un `cdf deploy --dry-run` de contrôle
lancé juste après annonce tout en « Untouched » : CDF correspond aux fichiers locaux.
Les Source ID des trois groupes ont été vérifiés dans Fusion. Le jour 1 est terminé pour
le test ; la suite est le jour 2 (Data Integration - A).

Le `cdf deploy` sur `cdf-bootcamp-33-test` a fait ceci :

| Ressource | Créé | Modifié |
|---|---|---|
| Groups (`data_developer`, `icapi_extractors`, `data_pipeline_oee`) | 3 | 0 |
| Spaces (`icapi_dm_space`, `oee_ts_space`) | 2 | 0 |
| RAW database `ice-cream-factory-db` + table `assets` | 2 | 0 |
| Data sets (`ds_icapi`, `ds_uc_oee`) | 0 | 2 |

Les deux data sets existaient déjà dans le projet (créés le 2026-04-07, 26 data sets au
total) : le projet a été pré-rempli ou réutilisé. Le déploiement n'a changé que leur nom
et leur description.

Je lance `cdf deploy` moi-même dans le terminal : l'assistant n'y est pas autorisé par la
protection automatique de l'application. Il fait le build, le dry-run et le contrôle après coup.

### Jour 2 — Data Integration A (en cours)

Hosted extractors écrits dans
`modules/bootcamp/ice_cream_api/hosted_extractors/Ice Cream Factory API/` : une `Source.yaml`
commune, puis `Destination.yaml`, `Mapping.yaml` et `Job.yaml` dans `assets/` et `timeseries/`.
Déployés en test le 2026-10-05 (1 source, 2 destinations, 2 mappings, 2 jobs).
Premier passage des deux jobs en `cdf_write_error` (403) : le service principal
`icapi-extractors` n'était pas membre du groupe Entra `bootcamp-33-test-icapi-extractors`.
Corrigé dans Entra à 11:45 UTC ; CDF le voit maintenant dans le group `icapi_extractors`.

Un job ne retente qu'à son intervalle (1 h pour les time series, 1 j pour les assets) ; ni
un second `cdf deploy` sans changement ni une pause puis reprise dans Fusion ne le relancent
(statut `waiting`). **Ce qui le relance tout de suite : modifier le job** (par exemple son
`interval`) et redéployer.

Résultat à 12:05 UTC : job `ICAPI Assets` OK, **1021 lignes dans la table RAW `assets`**
(clés uniques ; 10 lignes sans `parent_external_id`, ce sont les 10 sites racines ; une
colonne au nom vide `''` vient de l'index du CSV). L'intervalle, passé un moment à `15m`
pour forcer ce passage, est revenu à `1d` dans le fichier.

Résultat à 12:16 UTC : job `ICAPI Time series` OK, **2512 `CogniteTimeSeries`** dans
`icapi_dm_space` (628 unités × 4 séries : `count`, `good`, `status`, `planned_status` ;
external IDs de la forme `HAPRAG10TA812:count`). Les deux jobs sont en `running`.

**Écart à résorber au prochain deploy :** dans CDF le job `ICAPI Time series` tourne encore
toutes les 15 min (réglage temporaire) ; le fichier est déjà revenu à `interval: 1h`, valeur
de la doc. Le prochain `cdf deploy` l'appliquera.

### Jour 2 — Data Modeling (en cours)

Transformations écrites dans `modules/bootcamp/ice_cream_api/transformations/` (5 fichiers) :
`create_asset_hierarchy` (`.Transformation.yaml`, `.Transformation.sql`, `.schedule.yaml`
avec `33 0 * * *`) et `contextualize_ts_assets` (`.yaml` + `.sql`, sans planification ni
`instanceSpace`). Build OK (les `DataSetMissingWarning` sont attendus), dry-run OK :
2 transformations et 1 schedule à créer, 1 job modifié (retour à `1h`).

Contrôle de la source avant de lancer : dans RAW, les 10 racines (les sites) ont
`parent_external_id` = chaîne vide, tous les autres parents existent dans la table, et
`key` = `external_id` partout. La requête de la doc gère donc bien les racines.

`${IDP_SCOPES}` n'est pas dans `.env` : le Toolkit le calcule seul à partir du cluster.

**Jour 2 terminé en test le 2026-10-05.** Déployé, puis les deux transformations exécutées
dans Fusion (hiérarchie d'abord, contextualisation ensuite), toutes deux `COMPLETED`.
Contrôles : 1021 `CogniteAsset`, 10 racines (les sites), 0 parent introuvable ; 2512
`CogniteTimeSeries`, chacune rattachée à exactement 1 asset, 0 lien faux ou pendant ;
jobs en `running` aux intervalles de la doc (`1d` et `1h`). Les time series n'ont pas
encore de valeurs : ce sera la function d'extraction du jour 3.

Compte rendu `report/CDF-Bootcamp-Report.html` mis à jour (onglets Jour 2 et Synthèse).

### Jour 3 — Data Integration B (en cours, commencé le 2026-10-05)

Écrits : `extraction_pipelines/ep_icapi_datapoints.ExtractionPipeline.yaml` ; pour
`ice_cream_api/functions/` et `use_cases/oee/functions/` un `functions.Function.yaml` et un
`schedules.Schedule.yaml` ; `cognite-sdk==7.89.0` épinglé dans les deux `requirements.txt`.
Planifications : extracteur toutes les 10 min + backfill à 00:33, OEE toutes les 5 min.
Build et dry-run OK : 1 extraction pipeline, 2 functions, 3 schedules à créer.
Le dry-run affiche aussi `contextualize_ts_assets` en « Changed » : faux écart
(`instanceSpace: null` renvoyé par CDF, absent du fichier).

**Point bloquant avant d'appeler les functions :** leur code retrouve les time series d'un
site par la propriété `path` des `CogniteAsset`, calculée par CDF. Or 182 assets sur 1021
ont un `path` absent ou trop court (calculé à 12:24 UTC pendant la création, jamais
recalculé depuis) ; 480 time series sur 2512 seraient ignorées. Les liens `parent` sont
pourtant tous corrects. Relancer `Create Cognite Asset Hierarchy` (12:37 UTC) n'a rien
changé : exécution entièrement « noop », CDF ne voit aucune modification et ne recalcule
rien. Détail : 121 assets sans `path` alors que leur parent en a un correct, 15 sans `path`
sous un parent lui-même incomplet, 46 avec un `path` tronqué et une mauvaise racine. CDF
calcule donc `path` à l'écriture, d'après l'état du moment, sans reprise ni propagation
(au moins sur 15 min). Sites touchés : tous sauf Marseille et Chicago.
Pistes : (a) demander à l'instructeur si le recalcul se rattrape seul ou se déclenche ;
(b) réparation manuelle = provoquer un vrai changement de `parent`, niveau par niveau du
haut vers le bas (≈ 5 exécutions SQL), non tentée ; (c) à prévoir aussi pour la prod.

Décision (moi) : régler ce problème avant d'avancer. Outil écrit :
`scripts/repair_asset_paths.py`. Il détache puis rattache au même parent chaque asset au
`path` incorrect, niveau par niveau du haut vers le bas, après un essai sur un seul asset ;
il sauvegarde les liens parent dans `scripts/asset_parents_backup_*.json` et rattache
toujours, même en cas d'erreur. Sans option il ne fait que lire.

**Résolu à 12:46 UTC.** Lancé avec `--apply` : essai sur 1 asset puis niveaux 2 à 5, tout
`OK`. Contrôle indépendant ensuite : 1021/1021 `path` complets, les 10 sites couvrent bien
1021 assets, 0 time series derrière un `path` incomplet, liens parent et liens time series
inchangés. Hypothèse confirmée : un vrai changement de `parent` déclenche le recalcul du
`path` (en quelques secondes) ; une réécriture à l'identique ne déclenche rien.

Déployé à 12:36 UTC : extraction pipeline, 2 functions (`Ready` à 12:47), 3 schedules.
Le compte du Toolkit n'a pas `extractionRunsAcl` : pour lire les runs de l'extraction
pipeline, utiliser le compte `icapi-extractors`.

**Data Integration B terminé en test à 13:07 UTC (2026-10-05).**
- Extracteur appelé à la main en 3 lots (336 h) : runs de l'extraction pipeline tous
  `success` ; 2512/2512 time series ont des valeurs (≈ 20 161 points sur 14 jours pour
  `count` et `good`, quelques dizaines pour `status` et `planned_status`, qui n'écrivent
  qu'aux changements d'état). La planification toutes les 10 min tourne.
- `OEE TimeSeries` appelée en 2 lots (`lookback_minutes: 10160`) : 3140 time series créées
  dans `oee_ts_space` (628 × 5), toutes avec ≈ 10 161 points. Total : **5652**, comme la doc.
- Particularité du code fourni : pour chaque unité, le calcul OEE s'arrête au plus ancien
  des « derniers points » de ses 4 séries, donc souvent au dernier changement de `status`
  (jusqu'à 3,5 jours en arrière). Les séries OEE ne vont pas forcément jusqu'à maintenant ;
  à garder en tête pour Charts au jour 4.

### Jour 3 — Data Orchestration (en cours)

Écrits dans `modules/bootcamp/ice_cream_api/workflows/` : `wf_icapi_data_pipeline.Workflow.yaml`,
`.WorkflowVersion.yaml` (4 tâches enchaînées par `dependsOn` : `create_asset_hierarchy` →
`contextualize_ts_assets` → `icapi_datapoints_extractor` (`hours: 1`) → `oee_timeseries`
(`lookback_minutes: 60`)) et `.WorkflowTrigger.yaml` (`icapi_trigger`, toutes les 15 min,
compte `icapi-extractors`). L'ordre linéaire est celui du schéma de la doc (vérifié sur
l'image). Choix personnel : `concurrencyPolicy: waitForCurrent` sur les deux
transformations (défaut : `fail`). Build OK (`DataSetMissingWarning` attendu), dry-run OK : 1 workflow,
1 version, 1 trigger à créer.

**Jour 3 terminé en test à 13:19 UTC (2026-10-05).** Déployé à 13:14 ; première exécution
du workflow déclenchée à 13:15 : les 4 tâches `completed` en 3 min 52 s (le compte
`icapi-extractors` suffit, pas besoin de `workflowOrchestrationAcl`). Recontrôle après
coup : 1021/1021 `path` complets, 2512 time series toujours rattachées (le workflow rejoue
les transformations sans rien casser). Une seconde exécution a démarré à 13:16:40, hors
quart d'heure : lancement manuel probable depuis Fusion.

Compte rendu `report/CDF-Bootcamp-Report.html` mis à jour (onglets Jour 3 et Synthèse).

**Suite :** passage en **prod**, en local (page « Deploy to prod (GitHub Actions) » de la
doc, sans GitHub) : voir la liste « À prévoir pour le passage en prod » plus bas. Demande
mon accord explicite avant tout `cdf deploy` en prod. Puis jour 4 : Charts et Canvas.

À noter dans le code fourni : `icapi_datapoints_extractor` avale ses exceptions (l'appel
finit « Completed » même en échec) ; le vrai statut est dans les runs de l'extraction
pipeline `ep_icapi_datapoints`. Et `backfill = backfill or True` rend le mode frontfill
inatteignable : chaque appel recharge toute la fenêtre demandée.

**Suite :** `cdf deploy`, corriger les `path`, appeler les functions par lots de sites
(doc), puis coller « Data Orchestration ».

Après un deploy, le dry-run de contrôle affiche toujours les 2 destinations (et la source)
en « Changed » : le Toolkit ne peut pas relire les identifiants stockés. Ce n'est pas un écart.

L'exercice « créer l'extracteur dans l'interface » de la doc n'a pas été fait : le Toolkit
crée la même chose. Si on le fait quand même avant le deploy, relancer un dry-run et
surveiller un éventuel job en double sur `/site/all/csv`.

Pages de la doc pas encore reçues : la suite de « Data Integration - A » s'il y en a
(extraction pipelines, functions) et tout « Data Modeling ».

## Prochaines étapes

1. [x] `cdf deploy` sur le projet **test** (fait le 2026-10-05).
2. [x] (fait le 2026-10-05, Source ID conformes) Vérifier dans Fusion (Admin → Access management) que les 3 groupes ont le bon
       Source ID ; vérifier les spaces dans Data models → Spaces.
3. [x] Compte rendu partageable du jour 1 : `report/CDF-Bootcamp-Report.html` (FR/EN).
       À compléter à la fin de chaque jour (onglets Jour 2 à 4 encore vides).
3. [ ] Jour 2 : coller les pages « Data Integration - A » et « Data Modeling » de la doc.
4. [ ] Fin de semaine, passage en **prod** (voir la liste plus bas).

## Reprendre dans VS Code

1. Ouvrir ce dossier dans VS Code (File → Open Folder).
2. Ouvrir un terminal PowerShell (Terminal → New Terminal). Il s'ouvre dans ce dossier ;
   toutes les commandes `cdf` se lancent d'ici.
3. Le Toolkit n'est pas dans le PATH : il est dans un venv hors du dossier. Soit on
   l'appelle par son chemin complet, soit on active le venv une fois par terminal :

```powershell
& "$env:USERPROFILE\.venvs\cdf33\Scripts\Activate.ps1"   # ensuite "cdf" suffit
cdf --version                                             # doit afficher 0.6.53
```

Le cycle de travail, toujours dans cet ordre :

```powershell
cdf build --env=test     # assemble modules/ dans build/, ne touche pas à CDF
cdf deploy --dry-run     # montre ce qui changerait, ne change rien
cdf deploy               # applique au projet indiqué par CDF_PROJECT dans .env
```

`cdf auth verify` teste la connexion. Il pose une question (y/n) quand il doit ajouter
des droits au groupe du Toolkit : il faut donc le lancer soi-même dans un terminal.

## Ce qui a été fait le jour 1

- Toolkit 0.6.53 installé (version imposée par la doc) dans `%USERPROFILE%\.venvs\cdf33`.
- `cdf.toml`, `config.test.yaml`, `.env` créés à la main selon la doc (pas de `cdf init`).
- Modules écrits dans `modules/bootcamp/` : `data_foundation`, `ice_cream_api`,
  `use_cases/oee` (groups, RAW, data sets, spaces).
- Code des deux functions copié depuis le paquet « Bootcamp » du Toolkit
  (`icapi_datapoints_extractor`, `oee_timeseries`) ; il servira mercredi.
- Entra : 6 applications créées (test et prod), nommées comme les groupes, **sans** le
  suffixe `-app` de la doc. Sans conséquence : CDF utilise le client ID.
- Entra : chaque application ajoutée comme membre de son groupe.
- Fusion test : groupe `cognite_toolkit_service_principal` créé à la main, puis complété
  par `cdf auth verify`.

## Problèmes rencontrés et solutions

| Symptôme | Cause | Solution |
|---|---|---|
| `validation-type: Expected one of 'dev' or 'prod'` | Toolkit 0.8 installé au lieu de 0.6.53 | Rester en 0.6.53 |
| `AADSTS7000215: Invalid client secret` | Secret ID collé à la place de la **Value** | Recréer un secret et copier la colonne Value (contient un `~`) |
| Valeurs entourées de `<` `>` dans `.env` | Chevrons du gabarit conservés | Écrire `NOM=valeur` sans chevrons ni guillemets |
| `CERTIFICATE_VERIFY_FAILED: unable to get local issuer certificate` | Zscaler re-signe le trafic vers `*.cognitedata.com` | `pip install pip-system-certs` dans le venv (la vérification TLS reste active) |
| `Valid authentication token, but it does not give any access rights` | Pas de groupe CDF pour le compte du Toolkit | Créer `cognite_toolkit_service_principal` dans Fusion avec le Source ID du groupe `admin-tk` |
| `does not have the required capabilities` | Le groupe n'a que Projects et Groups | Lancer `cdf auth verify` et répondre `y` |
| Hosted extractor job en `cdf_write_error`, 403 `Subject does not have 'WRITE' action` ou `Not allowed to perform schema action: READ` | Le service principal de la destination n'est membre d'aucun CDF group (pas ajouté au groupe Entra) | Ajouter l'application au groupe Entra, puis forcer un nouveau passage (ligne suivante) |
| Des `CogniteAsset` ont un `path` vide ou tronqué alors que leurs liens `parent` sont justes ; les functions ignorent leurs time series | CDF calcule `path` à l'écriture du `parent`, d'après ce qui existe à cet instant ; un enfant écrit avant son parent reste incomplet, et relancer la transformation est un no-op | `python scripts/repair_asset_paths.py --apply` : détache puis rattache chaque asset concerné, du haut vers le bas |
| Un hosted extractor job reste en `waiting` après correction | Il ne retente qu'à son intervalle ; pause/reprise et redeploy sans changement ne font rien | Modifier le job (ex. `interval`) et redéployer : il repart aussitôt. Remettre ensuite la valeur d'origine |

## Passage en prod (commencé le 2026-10-05, à ma demande)

Préparé : `config.prod.yaml` ; `.env.prod` (projet, client IDs et Object IDs prod déjà
remplis, 3 secrets à coller à la place des `REPLACE_WITH_…`) ; build prod OK dans
`build_prod/` (projet `cdf-bootcamp-33-prod`). Les commandes prod passent toujours
`--env-path .env.prod` et `build_prod` (voir `AGENTS.md`). `scripts/repair_asset_paths.py`
accepte `--env-file .env.prod`.

**En attente de ma part :**
1. Entra : un nouveau secret pour chacune des 3 applications prod, **Value** collée dans `.env.prod`.
2. Entra : vérifier que chaque application prod est membre de son groupe prod.
3. Fusion prod : créer `cognite_toolkit_service_principal` (Projects + Groups, Source ID de
   `bootcamp-33-prod-admin-tk`).
4. Terminal : `cdf --env-path .env.prod auth verify`, répondre `y`.

Les 4 étapes sont faites (15:3x heure locale) : secrets au bon format, `auth verify` prod
OK avec toutes les capabilities. Dry-run prod complet : 26 ressources à créer, 2 data sets
préexistants à mettre à jour, 0 suppression.

**Plan retenu : déploiement prod en deux passes**, pour éviter le 403 du test. Les jobs des
hosted extractors partent dès leur création, alors que le Toolkit ne crée les groups
`icapi_extractors` et `data_pipeline_oee` qu'après eux.
- Passe 1 (fondations, comme le jour 1) :
  `cdf --env-path .env.prod deploy build_prod --env=prod --include auth --include data_sets --include raw --include data_models`
  puis contrôle que les 3 comptes prod obtiennent bien leur CDF group.
- Passe 2 : `cdf --env-path .env.prod deploy build_prod --env=prod` (tout le reste).

Passe 1 faite. Contrôle : les 3 comptes prod obtiennent bien leur CDF group
(`cognite_toolkit_service_principal`, `icapi_extractors`, `data_pipeline_oee`), Source ID
conformes. Dry-run de la passe 2 : 19 ressources à créer, le reste inchangé.
Pour les contrôles en lecture seule sur la prod, les scripts du scratchpad lisent la
variable `ENV_FILE=.env.prod`.

Passe 2 faite (14:49 UTC). Les deux jobs des hosted extractors ont réussi du premier
coup : 1021 lignes dans RAW `assets`, 2512 `CogniteTimeSeries`. Functions `Ready` à 14:56.
Workflow déployé, première exécution attendue à 15:00 UTC.
Workflow prod : le déclencheur a tiré à 15:01:37 (avec 1 min 37 de retard, pas à 15:00:09
comme en test) ; je l'avais aussi lancé à la main à 15:02:23. Les deux exécutions sont
`completed` (une tâche `contextualize_ts_assets` a échoué une fois sur « A job already runs
for this transform », les deux exécutions se chevauchant, puis a réussi au réessai). Une
troisième, lancée à 15:05:38, a été annulée à la main.

État prod à 15:07 UTC : 1021 assets, 10 racines, 0 parent introuvable, 2512 time series
toutes rattachées ; functions `Ready` ; runs d'extraction `success`. **Comme en test, les
`path` sont incomplets : 294 assets sur 1021 (804 time series derrière).**

**En attente de ma part, dans l'ordre :**
1. Réparer les `path` en prod :
   `$env:ALLOW_NON_TEST='yes'; python scripts\repair_asset_paths.py --env-file .env.prod --apply`
2. Fusion prod → Functions → `Ice Cream API DataPoints Extractor` : 2 appels de 5 sites,
   `hours: 336`, `backfill: true`, le second après la fin du premier.
3. Contrôle par l'assistant, puis `OEE TimeSeries` : 2 appels, `lookback_minutes: 20160`.
4. Contrôle final : 1021 assets, 5652 time series avec valeurs.

Contrôle à 15:27 UTC, après mes trois étapes :
- `path` : 1021/1021 complets (réparation prod réussie) ; hiérarchie et liens intacts.
- Extracteur : les 2 lots de 5 sites sont passés (runs `success`) ; 2512/2512 time series
  mesurées ont des valeurs sur 14 jours.
- OEE : 3140/3140 time series existent, **mais l'historique n'est calculé que pour le
  premier lot de sites** (Houston, Oslo, Kuala Lumpur, Hannover, Nuremberg : ≈ 18 000
  points). Les journaux des appels montrent que les deux appels longs ont reçu la même
  entrée. Les 5 autres sites (Marseille, Sao Paulo, Chicago, Rotterdam, London) n'ont que
  la dernière heure (≈ 61 points). **Reste à faire : un appel `OEE TimeSeries` avec ces 5
  sites et `lookback_minutes: 20160`.**
- Astuce de contrôle : la function OEE écrit dans ses logs la liste des sites traités ;
  les appels lancés par le workflow apparaissent comme « manuels » (pas de `schedule_id`).

**Prod complète à 15:34 UTC (2026-10-05).** Appel OEE du second lot fait (15:29–15:33) :
toutes les séries OEE échantillonnées ont entre 16 000 et 20 000 points. Bilan prod,
identique au test : 1021 assets, 2512 séries mesurées et 3140 séries OEE avec historique,
soit 5652 ; workflow toutes les 15 min. 44 minutes entre la passe 2 et un projet complet.

Compte rendu `report/CDF-Bootcamp-Report.html` mis à jour : prod « Déployé » dans la
Synthèse et les onglets Jour 1 à 3, bloc 13 « Passage en production » dans l'onglet Jour 3.

**6 octobre 2026, matin.** Après une nuit de fonctionnement automatique, le nouveau
`scripts/check_project.py` (21 contrôles en lecture seule) rend `ALL CHECKS OK` sur le test
et sur la prod. Livrables ajoutés à ma demande :
- onglet « Mode opératoire » dans `report/CDF-Bootcamp-Report.html` (13 phases, 47 étapes,
  FR/EN ; la phase 11 Charts et Canvas reprend la doc et reste à vérifier) ;
- `report/CDF-Bootcamp-Memo.docx`, mémo Word en anglais, 8 pages, les deux annexes
  regroupées sur la dernière page. Le générateur est `scripts/build_memo.js`
  (Node, paquet npm `docx` à installer dans un dossier temporaire ; usage :
  `node build_memo.js <logo.png> <sortie.docx>`). Fermer le fichier dans Word avant de
  régénérer, sinon l'écriture échoue (`EBUSY`).
  À régénérer et à mettre à jour quand le jour 4 sera terminé.

**Jour 4, état lu dans la prod le 2026-10-06 à 07:31 UTC :**
- P&ID : `PID_ICF.pdf` est à la racine du projet ; je l'ai chargé par le notebook Jupyter de
  Fusion à 07:22 UTC. Le `CogniteFile` `file_PID` existe, nommé « PID Exercise File »,
  contenu chargé, relié aux 7 assets. `scripts/upload_pid.py` fait la même chose en local
  (lecture seule sans `--apply`) : inutile ici, utile pour refaire ou contrôler.
- Charts : un chart `test_gd` existe (le calcul `charts_oee` et l'alerte ne sont pas
  vérifiables par l'API).
- Canvas : le canvas `OEE RCA GD` contient le P&ID, l'asset Balance Tank, 6 time series (Oee,
  Performance, Availability, Quality, status, planned_status) et le chart `test_gd`.
  À 07:37 UTC il a une sticky note (le texte d'analyse proposé) ; **il manque encore le
  rectangle** sur les chutes (une seule annotation en base, de type `stickyAnnotation`).
  L'API montre un second nœud Canvas du même nom : ce n'est pas un doublon mais une copie
  rattachée au premier par `sourceCanvasId` (sauvegarde de l'historique des versions de
  Canvas), invisible dans la liste de l'interface. Ne rien supprimer.
- Analyse des chutes d'OEE de `OSPRPATA241` (15 jours, 18 602 minutes) pour la sticky note :
  OEE moyen 0,83 ; 10,8 % des minutes à OEE = 0, toutes machine à l'arrêt : 15 arrêts
  planifiés (994 min, `planned_status` = 0) et 13 arrêts non planifiés (1007 min, `status` = 0
  alors que `planned_status` = 1), soit environ un de chaque par jour. En marche : quality
  0,95 et performance 0,98 ; 62 creux de qualité d'environ 7 min à 0,71, aux mêmes heures
  chaque jour (00:30 et 03:34 UTC). Le code compte les arrêts planifiés comme OEE = 0
  (division par zéro remplacée par 0) ; sans eux l'OEE moyen serait d'environ 0,87.
- Reste : ajouter le rectangle, me confirmer le calcul `charts_oee` et l'alerte
  `oee_monitoring`, puis remplir l'onglet
  Jour 4 du HTML, vérifier la phase 11 du mode opératoire et régénérer le mémo.

**Jour 4 terminé le 2026-10-06 (≈ 07:45 UTC) : les quatre jours du programme sont faits.**
- À ma demande, l'assistant a tracé lui-même le rectangle, en pilotant Fusion dans le
  navigateur intégré de l'application (je m'y suis connecté moi-même). Le rectangle entoure
  un groupe de chutes sur le graphique `test_gd` posé dans le canvas. L'API confirme :
  `stickyAnnotation` 1 + `rectangleAnnotation` 1 sur le canvas `OEE RCA GD`.
- Relu dans Charts : `test_gd` contient les 4 séries OEE (unité `*`) et le calcul
  `charts_oee`, de même moyenne que la série Oee (0,828) ; le dossier `oee monitoring`
  contient 6 tâches, dont la mienne `oee_monitoring_gd` (< 0,7, toutes les 5 min, > 5 min) ;
  les 5 autres viennent de sessions précédentes (dernières alertes en 2025 et début 2026).
- Compte rendu HTML : onglet Jour 4 rempli, Synthèse à 4 / 4, phase 11 du mode opératoire
  marquée vérifiée. Mémo Word régénéré (8 pages) : jour 4 « Done », nouvelle section 4.5
  « What the data shows ».
- Reste hors technique : quiz de fin de bootcamp (70 %) ; question à l'instructeur sur
  l'évaluation du dépôt GitHub. Le deck du bootcamp est à la racine
  (`2025- Cognite Data Fusion Bootcamp v3.pdf`) : utile pour préparer le quiz.

**Dépôt GitHub : documenté le 2026-10-06, pas exécuté.** À ma demande, la marche à suivre
pour porter le projet local sur GitHub est maintenant la **phase 13 du mode opératoire**
(`report/cdf-bootcamp-report.src.html`, `<section id="proc-13">`, page régénérée). Rien n'a
été créé dans ce dossier : ni `git init`, ni `.github/`, ni dépôt.
- Grille du deck (dépôt GitHub = 20 % de la note) : réussi si la prod se déploie depuis `main`
  avec revue obligatoire et si `main` est protégée (PR exigée) ; échec si les environnements
  test/prod ne sont pas configurés ou si aucune GitHub Action n'a réussi.
- Principe : copie de travail hors du dossier synchronisé (`C:\dev\cdf-bootcamp-33`),
  `git init -b main`, `cdf repo init --host None` (pose `.gitignore` et `.env.tmpl`), premier
  push ; dans GitHub deux environnements `test` et `prod` avec les 14 valeurs des fichiers de
  secrets (3 secrets, 11 variables, mêmes noms) ; protection de `main` ; puis, sur une branche,
  `cdf repo init --host GitHub` et deux workflows adaptés (`dry-run.yaml` sur pull request,
  `deploy.yaml` sur push dans `main` : test puis prod), pull request, fusion.
- Vérifié dans un dossier temporaire avec des fichiers factices : les commandes passent ; le
  `.gitignore` du Toolkit écarte `.env` et `build/` mais **pas** `.env.prod` ni `build_prod/`,
  d'où l'ajout de `.env.*`, `!.env.tmpl`, `build_prod/`. Le modèle de workflow du Toolkit vise
  un seul environnement `dev` et ne transmet que 5 variables : il faut le remplacer.
- Non vérifié (jamais exécuté) : les workflows eux-mêmes sur GitHub. Ils partent du modèle du
  Toolkit 0.6.53 et de la doc publique Cognite ; je n'ai pas le texte de la page « Deploy to
  prod (GitHub Actions) » de la doc du bootcamp : si elle diffère, elle fait foi.
- À trancher avec l'instructeur avant de créer le dépôt : où il doit se trouver et qui relit.
  Avec un compte GitHub gratuit, environnements et protection de branche n'existent que sur un
  dépôt public ; l'auteur d'une pull request ne peut pas approuver la sienne.
- `git` 2.54 est installé sur le poste, sans `user.name` ni `user.email` ; `gh` n'est pas installé.
- Mémo Word mis à jour et régénéré le 2026-10-06 (9 pages, annexes toujours sur la dernière) :
  nouvelle section 9 « Path to the GitHub repository » (grille, 5 étapes, 4 points d'attention,
  mention « documented, not executed »), anciennes sections 9 et 10 renumérotées 10 et 11,
  ligne GitHub du tableau de statut passée à « To do ». Pour compter les pages sans ouvrir
  Word : un petit `.vbs` lancé par `cscript` (l'automatisation COM depuis PowerShell échoue
  sur ce poste avec `TYPE_E_ELEMENTNOTFOUND`).

**Captures d'écran du jour 4 ajoutées le 2026-10-06 (à ma demande).** Sept images dans
`report/img/day4-*.jpg`, prises par l'assistant dans le projet prod via le navigateur intégré
(lecture seule : rien n'a été modifié dans Charts ni dans le canvas) : graphique `test_gd`,
calcul `charts_oee`, tâche `oee_monitoring_gd`, vue d'ensemble du canvas, plan + fiche
équipement, graphique avec rectangle, note adhésive.
- HTML : nouveau panneau « 04 Les écrans dans Fusion » dans l'onglet Jour 4 (les panneaux
  suivants sont renumérotés 05 à 09), clic sur une image = agrandissement.
- La page se régénère désormais par `python scripts/build_report.py <skill_dir>` : charte EOS
  puis images intégrées en base64, pour garder un fichier unique (1,1 Mo).
- Mémo Word : nouvelle « Appendix C. Screens from Fusion (day 4) », 7 figures légendées,
  12 pages. `build_memo.js` prend un 3e argument facultatif (dossier des images).
- Contrôle visuel : la page HTML se rend avec Chrome sans affichage
  (`chrome --headless=new --screenshot=...` ; Edge échoue sur ce poste), le mémo par export PDF.
- Méthode de capture, si c'est à refaire : le navigateur intégré ne capture que la taille du
  panneau (≈ 800 × 450). Pour obtenir du 1600 × 900 net : agrandir `body` par CSS à deux fois
  la fenêtre, décaler par `transform: translate`, capturer les 4 quarts et les assembler. Pour
  Canvas il faut en plus simuler `window.innerWidth/innerHeight` le temps d'un `resize`. Ne
  jamais passer `scale` à la capture : la taille de la vue reste bloquée ensuite.

**Support de la formatrice parcouru le 2026-10-06** (`2025- Cognite Data Fusion Bootcamp v3.pdf`,
128 diapositives). Inventaire rendu dans la conversation, puis intégré le même jour (voir le
bloc « Trois lots » juste après). Points à retenir :
- Grille en vigueur (diapo 10) : projets CDF 40 %, dépôt GitHub 20 %, Canvas 20 %, quiz 20 %,
  réussite à 70 %. Une ancienne grille traîne en diapo 113 (50/10/20/20) et le quiz d'exemple
  (diapos 116-120) se contredit sur les poids.
- Diapo 112 : condition supplémentaire possible, le parcours « CDF Fundamentals » de Cognite
  Academy terminé. À confirmer avec la formatrice.
- Vu sur les captures du jour 4 : le canvas `OEE RCA GD` affiche un bandeau « Private charts »
  et le graphique `test_gd` est dans « My charts ». À vérifier avant l'évaluation : la
  formatrice voit-elle le canvas et son graphique ?
- Manques du compte rendu par rapport au support : vocabulaire du data modeling (container,
  view, instance, node, edge), tailles de site (58 / 107 / 156 équipements = petit, moyen,
  grand), définition métier de l'OEE, modes d'appartenance aux groups, « streaming », démarche
  RCA en trois temps de Canvas, ressources Cognite, préparation du quiz.

**Trois lots intégrés le 2026-10-06, à ma demande** (HTML régénéré, 1,7 Mo, 14 captures ; mémo
régénéré, 16 pages, 14 figures). Rien n'a été modifié dans CDF : lecture seule.
- Lot 1. Synthèse : panneau « L'évaluation : où nous en sommes » (poids, attendu, notre
  situation), description de l'usine avec les trois tailles de site, « Les trois temps du
  trajet des données ». Jour 2 : bloc « Le data modeling, plus précisément » (container, view,
  data model, instance, relation directe et inverse, extension) avec un schéma. Jour 3 :
  définition métier de l'OEE. Mémo : sections 2, 4.1, 4.2 (colonne Size), 4.3 et 11.
- Tailles de site vérifiées par une requête en lecture seule sur le test : la zone Production
  a 7, 14 ou 21 lignes, soit 1, 2 ou 3 branches. Petits (58 équipements) : Chicago, Houston,
  Oslo, São Paulo. Moyens (107) : Hannover, London, Marseille. Grands (156) : Kuala Lumpur,
  Nuremberg, Rotterdam.
- Lot 2. Jour 1 : modes d'appartenance à un group, règles des spaces. Jour 2 : hosted
  extractor et faible latence. Jour 3 : streaming, rôle de fiche d'identité de l'extraction
  pipeline, types de tâches d'un workflow. Jour 4 : la RCA en trois temps et ce qu'on n'a pas
  utilisé. Synthèse : panneaux « Préparer le quiz » et « Ressources Cognite ». Mémo : annexe D.
- Lot 3. Sept captures des jours 1 à 3, prises en prod dans le navigateur intégré :
  `report/img/day1-access.jpg`, `day2-hosted-extractors.jpg`, `day2-transformations.jpg`,
  `day2-search.jpg`, `day3-workflow.jpg` (et `day3-workflow-2rows.jpg` pour le mémo),
  `day3-functions.jpg`, `day3-extraction-pipeline.jpg`. Dans le HTML elles sont à la fin des
  panneaux « Comment les accès sont reliés » (jour 1) et « Résultats vérifiés » (jours 2 et 3) ;
  dans le mémo, l'annexe C couvre maintenant les quatre jours.
- Sur la capture des accès, la liste des droits est tronquée par un style ajouté le temps de
  la capture (10 droits par group) ; c'est dit dans la légende.
- Adresses Fusion utiles (ajouter `?cluster=westeurope-1.cognitedata.com` après le projet) :
  `/access-management`, `/transformations`, `/functions`, `/flows`, `/extpipes` (onglet
  « Hosted extractors » : `&tab=hosted`), `/search`, `/industrial-canvas`, `/charts`.
- Captures, compléments à la méthode : mettre la capture en dernier dans un lot d'actions
  (si le lot échoue après elle, l'image est perdue) ; un `find` juste avant aide la page en
  arrière-plan à se redessiner ; certaines pages défilent dans un bloc interne limité à la
  hauteur de la fenêtre, il faut alors lever son `overflow`.
- Reste à faire, hors documentation : vérifier la visibilité du canvas pour la formatrice,
  confirmer la condition Cognite Academy, le quiz, et GitHub (phase 13).

**Suite : jour 4 dans l'interface du projet prod.** (fait, voir ci-dessus) Charts (graphique `OSPRPATA241`,
calcul `charts_oee`, alerte `oee_monitoring`) : instructions données, à confirmer par moi.
Puis Canvas : télécharger le P&ID, le charger par un notebook Jupyter dans Fusion, créer
le canvas `OEE RCA`. Ensuite remplir l'onglet Jour 4 du compte rendu.

Unité de l'exercice du jour 4, `OSPRPATA241` (Oslo, « Balance Tank ») : prête. Séries OEE
du 21/09 15:10 au 04/10 12:10 UTC (arrêt au dernier changement de `planned_status`),
OEE moyen 0,83, 43 heures sous 0,7 (par ex. 21/09 20 h–21 h et 22/09 20 h, à 0).

Pages du jour 4 (Charts et Canvas) reçues ; tout s'y fait dans l'interface du projet
**prod**. Prérequis vérifiés en prod : les 7 assets cités par l'exercice Canvas existent
(`OSPRPATA241` = « Balance Tank »…) ; les séries OEE de `OSPRPATA241` n'existeront qu'après
le backfill OEE. Les séries mesurées s'appellent `OSPRPATA241:status` (nom = external ID),
pas « OSPRPATA241 Status » comme dans la doc.

Le connecteur MCP `cognite-docs` (doc officielle Cognite) est actif depuis cette session.

Ensuite : dry-run prod (assistant), deploy prod (moi, après accord), contrôle des jobs,
réparation des `path` si besoin, backfills dans Fusion prod (extracteur 336 h en 2 lots de
5 sites, OEE `lookback_minutes: 20160` en 2 lots), contrôle final 1021 / 5652.

## Flows custom app `icf-oee` (commencée le 2026-10-06, à ma demande, hors programme)

Une Flows custom app est une application web (React, TypeScript, Vite) affichée dans Fusion,
qui lit le projet CDF avec le jeton de l'utilisateur connecté. Outil : `@cognite/cli` (npm),
sans rapport avec le Toolkit. Doc : https://docs.cognite.com/cdf/flows/.

- Créée dans `icf-oee/` (sous-dossier de ce projet, à ma demande) par
  `npx @cognite/cli@latest apps create icf-oee ...` (CLI 1.13.0). `app.json` : org
  `cog-enablement-bootcamp`, projet `cdf-bootcamp-33-test`, `https://westeurope-1.cognitedata.com`,
  `externalId` `icf-oee`, version `0.0.1`.
- **La CLI a lancé `git init` toute seule dans `icf-oee/`** (un commit « Initial commit », pas
  de dépôt distant) et posé un `.github/workflows/ci.yml` inactif. La racine du projet n'est
  toujours pas un dépôt git.
- `npm install` (708 paquets, `node_modules` dans le dossier synchronisé), `npm test` 4/4,
  `npm run build` OK. L'app est encore la page d'accueil du modèle : aucune vue OEE écrite.
- Serveur local : `npm run dev` dans `icf-oee/` (ou `.claude/launch.json` à la racine pour
  l'assistant), port 3001, HTTPS avec certificat auto-signé. Adresse dans Fusion :
  `https://cog-enablement-bootcamp.fusion.cognite.com/cdf-bootcamp-33-test/custom-apps/development/icf-oee/3001?cluster=westeurope-1.cognitedata.com&workspace=flows`
- Constaté dans Fusion test : le menu « Custom apps » existe et la page affiche « icf-oee in
  Development Mode ». Le cadre vers `https://localhost:3001` reste vide dans le navigateur
  intégré : certificat non reconnu (`ERR_BLOCKED_BY_CLIENT`, page d'erreur sur localhost).
- **À faire par moi :** soit `mkcert` + `npx @cognite/cli@latest apps setup-https` (droits
  admin, une fois), soit dans mon navigateur ouvrir `https://localhost:3001`, « Avancé →
  Continuer », puis recharger l'onglet Fusion (à refaire à chaque redémarrage du serveur).
- Droits : le group `data_developer` n'a pas `appHostingAcl` et le Toolkit 0.6.53 ne connaît
  pas cette capability ; il faudra un group créé à la main dans Fusion pour déployer
  (`apphosting:read`, `write`, `run`). Publier demande en plus une signature de développeur
  (certification « builder » Cognite) : viser le mode local et un brouillon en test.

## À prévoir pour le passage en prod

- [ ] Créer `config.prod.yaml` (copie de `config.test.yaml`, `name: prod`,
      `project: cdf-bootcamp-33-prod`, `validation-type: prod`).
- [ ] Mettre dans `.env` les valeurs prod : `CDF_PROJECT`, les 3 client IDs, les 3 secrets
      (la **Value**, à recréer si seul le Secret ID a été noté), les 3 Object IDs prod
      (dans `AGENTS.md`).
- [ ] Fusion prod : créer `cognite_toolkit_service_principal` avec le Source ID de
      `bootcamp-33-prod-admin-tk`, puis `cdf auth verify`.
- [ ] `cdf build --env=prod`, `cdf deploy --dry-run`, puis `cdf deploy` après accord.
- [ ] Vérifier que les 3 service principals prod sont bien membres de leurs groupes Entra
      **avant** de déployer les hosted extractors (sinon premier passage en 403).
- [ ] Après la première exécution de `create_asset_hierarchy` en prod, lancer
      `scripts/repair_asset_paths.py` (lecture seule d'abord ; `--apply` exige
      `ALLOW_NON_TEST=yes` hors projet test) et réparer les `path` si besoin.

## Questions pour l'instructeur

- Le projet test contient déjà 26 data sets, dont `ds_icapi` et `ds_uc_oee` : est-ce normal ?
- La doc évalue un dépôt GitHub ; on travaille en local. Comment cette partie est-elle notée ?
