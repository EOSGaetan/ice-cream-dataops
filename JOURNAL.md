# Journal de bord — CDF Bootcamp, projet 33

But : pouvoir reprendre le travail à tout moment (autre session, VS Code, autre assistant)
sans relire toute la conversation. Les règles et les valeurs de référence sont dans
`AGENTS.md` ; ce fichier dit seulement **où on en est** et **quoi faire ensuite**.
Aucun secret ici : ils restent dans `.env`.

## Organisation des dossiers (8 octobre 2026)

Le projet complet a été déplacé dans `Bootcam_ice_cream_factory/`. Ouvrir ce dossier
dans VS Code et lancer les commandes `cdf` depuis celui-ci, où se trouvent `cdf.toml`
et les fichiers de configuration. Le dossier voisin `test_hq_dev/` est créé et prêt
pour le travail à venir.

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
- **Quiz réussi le 2026-10-06 : 6 / 6 au deuxième essai** (4 / 6 au premier, seuil 5 / 6), sur
  learn.cognite.com, cours « Cognite Data Fusion Practitioner L-100 Assessment ». Six
  questions : CDF groups configurés, types de ressources utilisés, outil de création des
  groups, fichiers d'une transformation, fournisseur d'identité, objets créés dans Entra.
  Les deux ratées au premier essai : fichiers d'une transformation, et objets créés dans
  Entra. Reste dans ce cours : la page « Prerequisites for CDF Bootcamp certification » et
  l'étape « Submit your bootcamp work ».

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

**Dépôt GitHub : transfert commencé le 2026-10-06 (étape 1 de la phase 13).** Dépôt privé
`EOSGaetan/ice-cream-dataops`, créé par moi sur github.com avec un `.gitignore` Python et un
`README.md`.
- Cloné dans `C:\dev\cdf-bootcamp-33` (hors dossier synchronisé). La connexion s'est faite par
  Git Credential Manager dans le navigateur ; le clone doit être lancé depuis le panneau
  Terminal, le shell de Claude refuse toute invite (`user interactivity has been disabled`).
- Projet copié dans le clone par `robocopy`, le dossier d'origine reste intact. Écartés :
  `.env`, `.env.prod`, `build/`, `build_prod/`, le deck PDF, et dans `icf-oee/` son `.git`,
  `node_modules`, `dist`. 338 fichiers suivis, 7,7 Mo.
- `.gitignore` complété : `.env.*`, `!.env.tmpl`, `build_prod/`, le deck, `node_modules/`, et
  `!icf-oee/src/lib/` car la règle `lib/` du modèle Python ignorait ce dossier de code.
- Contrôle : aucune valeur de client ID, client secret, tenant ID ou token URL dans les
  fichiers suivis ; seuls y figurent le cluster, les noms de projet et les Object IDs de
  `AGENTS.md` (à retirer si le dépôt devient public).
- **Push fait par moi le 2026-10-06** (le mode automatique de Claude refuse commit et push) :
  commit `8cc7720` sur `origin/main`, 339 fichiers, aucun fichier `.env*` (vérifié par
  `git ls-tree`). Identité git réglée dans le clone seulement (adresse `noreply` GitHub).
- Partage pour l'évaluation : dépôt privé, donc inviter le formateur dans Settings >
  Collaborators (il aura un accès en écriture, seul rôle possible sur un dépôt personnel).
- `report/` retiré du dépôt le 2026-10-06 (commit `327d7fe`, `git rm -r --cached` puis
  `report/` dans `.gitignore`) : il reste en local dans les deux dossiers et dans l'historique
  git. Même traitement pour `.claude/` à la racine (simple `launch.json` de l'aperçu local).
- `README.md` rédigé (pipeline, arborescence, prérequis, commandes de déploiement, contrôles,
  app) et fichier parasite `httpsdocs.cognite.commcp.txt` retiré : commit `37aaeae`, dépôt à
  319 fichiers. `AGENTS.md` décrit maintenant le dépôt et le clone.
- Deux dossiers désormais : l'original (complet, avec secrets, builds, deck, rapport) et
  `C:\dev\cdf-bootcamp-33` (seul relié à GitHub). Reporter à la main toute modification.
- **Dépôt passé en public par moi le 2026-10-06.** Visibles de tous : `AGENTS.md` (les 10
  Object IDs Entra, mentions TotalEnergies/CLOV), `JOURNAL.md`, et dans l'historique `report/`.
  Aucun client ID, secret, tenant ID, e-mail ni identifiant Windows (contrôlé). À décider :
  retirer `AGENTS.md` et `JOURNAL.md` du dépôt, voire réécrire l'historique.
- **Environnement GitHub `prod` créé le 2026-10-06** par Claude dans le navigateur intégré
  (après ma connexion à GitHub dans ce navigateur) : Required reviewers = `EOSGaetan`
  (Prevent self-review décoché, contournement administrateur laissé coché par défaut),
  déploiements limités à la branche `main`, 6 variables saisies (`CDF_CLUSTER`, `CDF_PROJECT`,
  `LOGIN_FLOW` et les 3 `*_SOURCE_ID`, ces derniers après mon accord explicite). **À saisir
  par moi** : `IDP_TENANT_ID`, `IDP_TOKEN_URL`, les 3 `*_CLIENT_ID`, et les 3 secrets
  `*_CLIENT_SECRET`. Claude ne saisit aucun secret, et le mode automatique refuse qu'il fasse
  transiter une valeur de `.env.prod` vers le navigateur, même par le presse-papiers sans
  l'afficher. Dans la fenêtre « Add variable », le champ Name n'a pas le focus à l'ouverture :
  cliquer dedans avant de taper.
- **Environnement `prod` complet le 2026-10-06** : j'ai saisi les 5 variables restantes et les
  3 secrets. Contrôle de Claude sur la page (noms et tests vrai/faux, aucune valeur affichée) :
  11 variables, 3 secrets, aucun nom manquant ni en trop, pas de guillemet ni d'espace, les 7
  identifiants ont la forme d'un GUID, le token URL contient le tenant ID et finit par
  `/oauth2/v2.0/token`, les 3 client IDs sont distincts. Capture de la question 2 à faire.
- **Environnement GitHub `test` créé le 2026-10-06** par Claude : pas de relecteur, pas de
  restriction de branche (le contrôle à blanc tournera depuis les branches de pull request),
  6 variables saisies (`CDF_CLUSTER`, `CDF_PROJECT` = `cdf-bootcamp-33-test`, `LOGIN_FLOW`,
  les 3 `*_SOURCE_ID` de test). **À saisir par moi depuis `.env`** : `IDP_TENANT_ID`,
  `IDP_TOKEN_URL`, les 3 `*_CLIENT_ID` et les 3 secrets `*_CLIENT_SECRET`.
- **Environnement `test` complet le 2026-10-06** : j'ai saisi les 5 variables restantes et les
  3 secrets. Même contrôle que pour `prod` (noms et tests vrai/faux) : 11 variables, 3 secrets,
  rien de manquant ni en trop, formats corrects. Contrôle croisé : tenant ID et token URL
  identiques entre `test` et `prod`, les 3 client IDs différents. Seule une exécution réelle
  d'un workflow prouvera que client IDs et secrets sont les bons.
- **Formulaire « Submit your bootcamp work » (partie 2, notée à la main) envoyé par moi le
  2026-10-06**, avec la capture de l'environnement `prod`. Claude n'a vu que la question 2 ;
  les questions 1, 3 et 4 ne sont pas consignées ici.
- Non fait à la date de l'envoi : protection de `main`, fichiers de workflow, aucune GitHub
  Action exécutée (phase 13, étapes 6 à 8). À reprendre seulement si le formateur le demande.
- À décider après la note : dépôt public à repasser en privé ou à nettoyer (`AGENTS.md` et ses
  Object IDs, `JOURNAL.md`, historique), et suppression des secrets des environnements GitHub
  s'ils ne servent plus.
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
  confirmer la condition Cognite Academy, le quiz (fait le 2026-10-06, 6 / 6), et GitHub
  (phase 13).

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
  `npm run build` OK.
- Serveur local : `npm run dev` dans `icf-oee/` (ou `.claude/launch.json` à la racine pour
  l'assistant), port 3001, HTTPS avec certificat auto-signé. Adresse dans Fusion :
  `https://cog-enablement-bootcamp.fusion.cognite.com/cdf-bootcamp-33-test/custom-apps/development/icf-oee/3001?cluster=westeurope-1.cognitedata.com&workspace=flows`
- Constaté dans Fusion test : le menu « Custom apps » existe et la page affiche « icf-oee in
  Development Mode ».
- Certificat local réglé le 2026-10-06 : j'ai lancé moi-même
  `$env:Path = "$env:USERPROFILE\Downloads;$env:Path"; npx @cognite/cli@latest apps setup-https`
  (`mkcert` 1.4.4 était dans `Downloads`). L'autorité `mkcert` est dans les racines de
  confiance de mon compte Windows, le certificat dans `%USERPROFILE%\.cognite-cli\certificates\mkcert` ;
  `https://localhost:3001` s'ouvre sans avertissement.
- **Limite du navigateur intégré de l'assistant :** il bloque le cadre `localhost` placé dans la
  page Fusion (`ERR_BLOCKED_BY_CLIENT`), même avec un certificat reconnu. L'app en mode local
  se regarde donc dans Chrome ou Edge, pas dans le navigateur intégré.
- Droits : le group `data_developer` n'a pas `appHostingAcl` et le Toolkit 0.6.53 ne connaît
  pas cette capability ; il faudra un group créé à la main dans Fusion pour déployer
  (`apphosting:read`, `write`, `run`). Publier demande en plus une signature de développeur
  (certification « builder » Cognite) : viser le mode local et un brouillon en test.

**Première version écrite le 2026-10-06 (périmètre validé par moi), pas encore commitée.**
- Écran : choix d'un site, tableau des unités du site (dernier OEE, quality, performance,
  availability, heure de la dernière valeur), clic sur une ligne = courbe d'OEE horaire sur
  les 7 jours qui finissent à la dernière valeur, avec résumé en texte. Site et unité choisis
  sont gardés dans l'adresse (`syncInternalState`). Lecture seule, textes en anglais.
- Requêtes (validées sur le test) : sites = `CogniteAsset` de `icapi_dm_space` sans `parent` ;
  assets d'un site = `root` égal au site (le filtre `prefix` sur `path` de la function Python
  n'est pas typé dans le SDK JavaScript) ; dernières valeurs par
  `timeseries/data/latest` avec `instanceId` `<asset>:oee|quality|performance|availability`
  dans `oee_ts_space` et `ignoreUnknownIds` (100 séries au plus par requête) ; les unités sont
  les assets pour lesquels une série existe.
- Code dans `icf-oee/src/oee/` (service, état, view model, écrans) et `SPEC.md` rempli.
  Paquets ajoutés pour les composants Aura : `recharts`, `@tanstack/react-table`,
  `@tanstack/react-virtual`.
- Contrôles : 50 tests (`npm test`), couverture 94 % des lignes, `npm run lint` et
  `npm run build` OK (un avertissement : paquet JavaScript de 991 Ko). Le vrai code du service,
  lancé en lecture seule sur le projet test avec le compte du Toolkit : 10 sites, **628 unités**
  (34 à 98 par site), courbe de 137 points pour `OSPRPATA241`.
- **Non vérifié par l'assistant : l'affichage dans Fusion** (navigateur intégré bloqué, voir
  plus haut). À regarder par moi dans Chrome ou Edge.
- Si le test DOM d'un tableau Aura n'affiche aucune ligne : le `DataGrid` est virtualisé, il
  faut simuler `offsetHeight`/`offsetWidth` (voir `OeePage.test.tsx`).

**Affichage validé par moi dans Fusion test, puis déploiement préparé (2026-10-06).**
- Commits dans le dépôt de `icf-oee/`, branche `feat/oee-first-version` (pas sur `master`) :
  `bd71621` (première version) et `1bfef9d` (cible prod ajoutée à `app.json`, 2e entrée de
  `deployments`). Identité passée par `-c user.name/-c user.email`, celle du commit initial.
- Droits : aucun des 6 CDF groups du projet test ne porte `appHostingAcl`. Nouveau fichier
  `modules/bootcamp/data_foundation/auth/flows_app_developer.Group.yaml` (même `sourceId` que
  `data_developer`, `appHostingAcl` READ/WRITE/RUN, scope all). Le Toolkit 0.6.53 ne connaît
  pas cette capability : le build l'accepte avec un avertissement et la garde dans le fichier
  construit ; dry-run test = 1 « all-scoped group » à créer, le reste inchangé (hors faux
  écarts habituels).
- `cdf deploy` test fait par moi : group `flows_app_developer` créé, l'API a accepté
  `appHostingAcl` (relu dans le projet : READ/WRITE/RUN, scope all, 7 groups au total).
- Build prod fait dans `build_prod/`. Dry-run prod lancé par moi : 1 group à créer,
  0 suppression, faux écarts habituels. **Le vrai `cdf deploy` prod reste à lancer.**
- **Déploiement de l'app : échec à la connexion**, 3 fois (2 en test, 1 en prod) :
  `Failed to fetch OpenID configuration from https://auth.cognite.com`. Cause, vue par un
  diagnostic dans mon terminal : `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`, Node ne reconnaît pas le
  certificat re-signé par Zscaler (même cause que `CERTIFICATE_VERIFY_FAILED` côté Python).
  **Solution : `$env:NODE_USE_SYSTEM_CA = '1'` dans le terminal avant la commande** (Node 24
  utilise alors le magasin de certificats Windows, la vérification TLS reste active).
  Confirmé : la même requête passe ensuite. Rien n'a donc encore été déployé côté app.
- **App déployée en test (2026-10-06), version 0.0.1, brouillon (DRAFT) non signé**, avec
  `$env:NODE_USE_SYSTEM_CA = '1'` puis `npm --prefix icf-oee run deploy -- -d cdf-bootcamp-33-test`
  (connexion par le navigateur, port local 3000). Adresse :
  `https://cog-enablement-bootcamp.fusion.cognite.com/cdf-bootcamp-33-test/custom-apps/app/icf-oee?cluster=westeurope-1.cognitedata.com&customAppVersion=0.0.1&workspace=flows`
  Le paquet envoyé est gardé dans `icf-oee/.cognite-bundles/icf-oee-0.0.1.zip` (hors git).
- `cdf deploy` prod fait par moi : group `flows_app_developer` créé (1 créé, 0 supprimé).
- App en prod : je dis l'avoir déployée ; dans le terminal lu par l'assistant, la commande
  était encore sur la question « A bundle for v0.0.1 already exists » (réponse attendue :
  « Deploy the existing bundle without rebuilding »). **À confirmer** par l'ouverture de
  l'adresse ci-dessus avec `cdf-bootcamp-33-prod`.
- **Le navigateur intégré de l'assistant affiche l'app déployée** (servie par
  `*.apps.westeurope-1.cogniteappsdata.com`) ; seul le mode local (`localhost`) y est bloqué.
  Pour qu'il contrôle un changement visuel, il faut donc redéployer en test.
- Publier pour tous en prod exige la signature de développeur (certification « builder ») et
  la certification de l'app par Cognite. Une version déjà envoyée se remplace tant qu'elle est
  en brouillon ; pour une nouvelle version, changer `versionTag` dans `app.json`.
- Défauts visuels relevés sur la 0.0.1 : barre de défilement horizontale de la page (tableau
  plus large que l'écran), graphique qui n'occupe pas la largeur de sa carte, courbe lissée
  trompeuse, aucune mise en évidence des OEE bas ni de la ligne choisie, courbe hors écran
  après un clic. À traiter dans la prochaine version.

**Version 0.0.2 écrite le 2026-10-06 (quatre points validés par moi + logo), pas encore
commitée ni déployée.**
- Entreprise fictive : **Full Icecreamergies**. Logo fourni par moi, détouré (fond
  transparent, 116 × 256, 43 Ko) dans `icf-oee/src/assets/logo.png`, affiché dans l'en-tête.
- Quatre tuiles par site : OEE moyen, nombre d'unités, unités sous 70 %, unité la plus basse.
- Tableau : OEE en pastille rouge sous 70 % (seuil d'alerte du bootcamp) et orange sous 85 %
  (choix de l'app), tri par OEE croissant par défaut, tri par colonne au clic sur l'en-tête,
  première colonne figée, ligne choisie marquée d'une icône.
- Mise en page : tableau (2/3) et courbe (1/3) côte à côte à partir de 1024 px ; courbe en
  segments droits, ligne pointillée à 70 %, résumé en texte sous le graphique (avec le nombre
  d'heures sous 70 %). Plus de défilement horizontal de la page.
- `versionTag` passé à `0.0.2` dans `app.json` ; `SPEC.md` mis à jour (FR-008 à FR-011).
- Contrôles : 61 tests, lint et build OK.
- **Page de prévisualisation locale** pour contrôler le visuel sans Fusion :
  `https://localhost:3001/dev-preview.html` (données factices, `src/devPreview.tsx`, hors
  build). Le navigateur intégré de l'assistant l'affiche. Vérifié à 1440 px par mesures :
  aucune barre horizontale (page et tableau), 4 tuiles en ligne, cartes côte à côte.
  Piège : les captures du navigateur intégré se dérèglent après un `resize_window` ou un
  `scale` ; se fier alors aux mesures du DOM.
- Piège Aura : dans le `DataGrid`, une colonne avec `cell` n'est plus tronquée ni mise sur une
  ligne automatiquement ; soit rendre un `span` avec `truncate`, soit s'en passer (`accessorFn`
  qui renvoie le texte).
- **0.0.2 déployée en test le 2026-10-06 (brouillon)**, à ma demande par l'assistant : commande
  tapée dans mon terminal, connexion faite par moi dans le navigateur. Rendu contrôlé dans
  Fusion avec les vraies données (Oslo : OEE du site 91,5 %, 34 unités, logo, tuiles, pastilles).
  Reste une petite barre horizontale à l'intérieur du tableau quand le menu de Fusion réduit
  la largeur. Pas encore déployée en prod, pas encore commitée.
- **Certificat Zscaler réglé pour de bon côté app** : `node-options=--use-system-ca` dans
  `icf-oee/.npmrc`. Tous les scripts npm de l'app (`npm run deploy`, etc.) utilisent le magasin
  de certificats Windows, quel que soit le terminal ; plus besoin de `$env:NODE_USE_SYSTEM_CA`.
  Cause de l'échec précédent : la variable avait été posée dans un terminal et la commande
  lancée dans un autre (chaque bouton « Run » ouvre son propre terminal). Un `npx` lancé à la
  main, hors `npm run`, n'en profite pas.
- Pour déployer : `npm --prefix icf-oee run deploy -- -d cdf-bootcamp-33-test` (ou `-prod`).
- **0.0.2 commitée** dans le dépôt de `icf-oee/` (branche `feat/oee-first-version`, commits
  `a5cc891`, `380e134`, `7520d52` du 2026-10-06 15:55, arbre propre).
- **App visible dans l'onglet « Custom apps » du projet test depuis le 2026-10-06** :
  `npm --prefix icf-oee run activate -- -d cdf-bootcamp-33-test` (tapée par l'assistant dans mon
  terminal, connexion faite par moi) a répondu `icf-oee @ 0.0.2 is now PUBLISHED` puis
  `ACTIVE`. Avant, la page disait « No apps available… activate an existing one ».
  **Contrairement à la doc publique, ce tenant n'a exigé aucune signature** (ni développeur ni
  Cognite) pour publier en test. Non essayé en prod.
- Conséquences : une version publiée est verrouillée, toute modification passe par un nouveau
  `versionTag` (0.0.3), `deploy` puis `activate`. Retirer l'app de l'onglet :
  `npx @cognite/cli@latest apps deactivate` (non essayé).
- Prod : 0.0.2 ni déployée ni activée. Commandes : `npm --prefix icf-oee run deploy --
  -d cdf-bootcamp-33-prod` puis `npm --prefix icf-oee run activate -- -d cdf-bootcamp-33-prod`.
- **Décision du 2026-10-06 (moi) : on ne déploie plus l'app en prod pour l'instant**, tout se
  passe en test.
- **Version 0.0.3 écrite, déployée puis activée en test le 2026-10-06** : après ma validation
  du brouillon, `npm --prefix icf-oee run activate -- -d cdf-bootcamp-33-test` a répondu
  `0.0.3 is now PUBLISHED`, `ACTIVE`, `Superseded 0.0.2 → PUBLISHED`. L'onglet « Custom apps »
  ouvre donc la 0.0.3 (vérifié). Commitée dans le dépôt de l'app : `4c82238`.
  **Fusion affiche toujours le bandeau « Only you can run this app. Have a certified builder
  sign it to share it with others » : sans signature, l'app active n'est utilisable que par
  moi.** La prochaine modification passera par une 0.0.4.
  Clone GitHub : 0.0.2 poussée par moi (`b5002c6`), puis 0.0.3 (`e715d52`, 2026-10-06 16:35).
  Contrôle après le push : `origin/main` au même commit que le clone, arbre propre,
  357 fichiers suivis, aucun fichier `.env`, `app.json` en 0.0.3.
  - Courbe : raccourcis de période **1W / 1M / 1Y** (7, 30, 365 jours ; moyennes horaires,
    par 4 h, journalières), toujours calés sur la dernière valeur de l'unité. Les données
    n'existent que depuis fin septembre 2026 : 1M et 1Y montrent la même quinzaine de jours.
    Pas de plage de dates libre.
  - Nouvel onglet **Overview** (ouvert par défaut) : carte du monde avec les 10 sites, marqueur
    coloré selon l'OEE moyen du site, survol = OEE du site + les 3 unités à l'OEE le plus bas,
    clic = ouverture du site ; dessous, un tableau qui reprend les mêmes chiffres (une ligne
    par site). L'ancien écran est l'onglet **Site**.
  - Carte : contour des terres Natural Earth (domaine public) transformé une fois en chemin SVG
    (`src/oee/worldMap.ts`, généré par un script jetable avec `world-atlas`) ; aucun service de
    carte appelé, aucun paquet npm ajouté. Les assets n'ont pas de coordonnées : villes des
    sites en dur dans `src/oee/siteLocations.ts`.
  - L'onglet et la période sont gardés dans l'adresse avec le site et l'unité.
  - Contrôles : 86 tests, couverture 95 % des lignes, lint et build OK (JavaScript 1,10 Mo).
    Rendu vérifié dans Fusion test avec les vraies données (carte, survol sur Chicago, tableau).
  - Constat sur les vraies données : les 10 sites ont un OEE moyen de 88 à 92 %, donc tous
    les marqueurs sont verts ; la couleur par moyenne distingue peu les sites.
  - Piège : un anneau de terres qui traverse l'antiméridien (Tchoukotka) dessine une bande sur
    toute la carte ; le script coupe le tracé à cet endroit.
- **Version 0.0.4 écrite le 2026-10-06 : onglet « Unit types »** (statistiques par type d'unité,
  tous sites confondus, pour voir quel type pose le plus de problèmes dans le monde).
  - Un type = un nom d'unité : les 628 unités portent 30 noms, chacun présent dans les 10 sites.
  - Sur la période choisie (1W / 1M / 1Y, la même que la courbe), calée sur la dernière valeur
    de toutes les unités : part du temps sous 70 %, OEE moyen (moyennes de toutes les unités du
    type mises ensemble), quality / performance / availability moyens, site le plus bas.
  - Écran : classement en barres des 10 types les plus problématiques, tableau des 30 types
    (tri par temps sous 70 % décroissant), et pour le type choisi la liste de ses unités site
    par site ; un clic sur une unité l'ouvre dans l'onglet Site. Le type choisi est gardé dans
    l'adresse.
  - Requêtes : `timeseries/data/list` avec `instanceId`, 100 séries et 10 000 agrégats au plus
    par requête. OEE à la granularité de la courbe (pour compter les périodes sous 70 %),
    quality / performance / availability en moyennes `1d` (ou `30d` pour 1Y) pondérées par
    `count`. Vérifié en lecture seule sur le test : 31 requêtes et environ 1 s pour 1W et 1M,
    43 requêtes pour 1Y ; les 628 unités ont des statistiques. L'historique du test ne couvre
    qu'environ 8 jours.
  - Contrôles : 121 tests, couverture 96 % des lignes, lint et build OK (JavaScript 1,13 Mo).
    Rendu contrôlé sur la page de prévisualisation locale.
  - **Déployée en test puis activée le 2026-10-06** après ma validation du brouillon :
    `0.0.4 is now PUBLISHED`, `ACTIVE`, `Superseded 0.0.3 → PUBLISHED`. Commitée dans le dépôt
    de l'app (`90acb43`) ; poussée sur GitHub par moi (`0a1549b`, 19:36 ; contrôle après le
    push : `origin/main` au même commit, arbre propre, 364 fichiers, aucun `.env`). Rendu vérifié dans Fusion test avec les vraies données : 30 types, 628 unités ;
    sur 1W les plus problématiques sont Hardening Tunnel (20,9 % du temps sous 70 %), Finished
    goods (20,3 %) et Chocolate Spray (20,2 %).
  - Point faible : dans Fusion l'onglet met environ 20 à 25 s à s'afficher la première fois
    (une quarantaine de requêtes pour les unités, puis une trentaine pour les statistiques),
    contre 1 s pour les seules statistiques hors navigateur. Cause non cherchée.
- **Version 0.0.5 écrite le 2026-10-06 : onglet « Export »** (export CSV ciblé, pour qu'un
  ingénieur fasse sa propre analyse dans Excel).
  - Choix : site (ou tous), type d'unité (ou tous), grandeurs (OEE, quality, performance,
    availability, off-spec), premier et dernier jour (UTC, dernier jour inclus ; par défaut les
    7 jours qui finissent au jour de la dernière valeur), pas (1 min, 5 min, 15 min, 1 h, 4 h,
    1 jour), format (Excel français `;` et virgule décimale par défaut, ou international).
  - Fichier : une ligne par unité et par pas (`site`, `unit_type`, `unit`, `time_utc`, puis
    une colonne par grandeur), UTF-8 avec BOM, nommé d'après les choix. Fabriqué dans le
    navigateur ; l'app reste en lecture seule.
  - Avant de lancer, la page annonce unités, pas, lignes et requêtes ; refus au-delà de
    200 000 lignes ou 250 requêtes. Pendant l'export : avancement requête par requête.
  - Requêtes : moyennes par pas, 100 séries et 10 000 agrégats au plus par requête ; une
    période de plus de 10 000 pas est découpée en fenêtres. Vérifié en lecture seule sur le
    test avec le vrai code : un type dans le monde sur 7 jours à 15 min = 2 requêtes, 8 355
    lignes, 0,5 Mo ; toutes les unités sur 7 jours à 1 h = 43 requêtes en 1,7 s, 73 840 lignes,
    5,9 Mo.
  - Le cadre de Fusion n'a pas d'attribut `sandbox` : les téléchargements n'y sont pas
    interdits. **Le téléchargement réel dans Fusion reste à essayer par moi.**
  - Contrôles : 160 tests, couverture 96 % des lignes, lint et build OK (JavaScript 1,15 Mo).
    Les choix de l'export ne sont pas gardés dans l'adresse.
  - **Pas encore déployée** : l'envoi en test lancé le 2026-10-06 s'est arrêté sur
    `Login timeout - no response received within 5 minutes` (la CLI n'attend la connexion dans
    le navigateur que 5 minutes). À relancer : `npm --prefix icf-oee run deploy --
    -d cdf-bootcamp-33-test`. Non commitée. « Custom apps » ouvre toujours la 0.0.4.
- **Revues qualité Flows et corrections, le 2026-10-09** (à ma demande, après avoir constaté
  que les règles qualité Flows n'avaient pas été suivies). Tout est dans la 0.0.5, toujours
  **déployée en test puis activée le 2026-10-09** après ma validation du brouillon :
  `0.0.5 is now PUBLISHED`, `ACTIVE`, `Superseded 0.0.4 → PUBLISHED`. Commitée dans le dépôt
  de l'app en deux commits : `d24de5e` (code, 45 fichiers) et `67bf143` (rapports de revue).
  Pas de déploiement en prod. Clone GitHub `C:\dev\cdf-bootcamp-33` préparé le 2026-10-09
  (copie de `icf-oee/` et de ce journal, 54 fichiers indexés, aucun `.env` ni certificat) :
  commit et push faits par moi le 2026-10-09 (`2304811` ; contrôle après le push :
  `origin/main` au même commit, arbre propre, 386 fichiers, aucun `.env`).
  Piège du push : le premier a été refusé en 403 (`Permission ... denied to
  CAJ1072523_totalen`). Une règle `credential.https://github.com.helper` dans mon
  `.gitconfig` fait passer Git par le compte d'entreprise au lieu de `EOSGaetan`. Passé
  avec, pour cette fois : `git -C C:\dev\cdf-bootcamp-33 -c credential.https://github.com.helper=
  -c credential.https://github.com.helper=manager -c credential.https://github.com.username=EOSGaetan push`.
  Réglage durable non fait (reviendra au prochain push).
  La commande de déploiement se lance depuis `icf-oee` (`npm run deploy --
  -d cdf-bootcamp-33-test`) ; lancée depuis `Cognite`, elle échoue sur `ENOENT package.json`.
  - Revue de code n°1 (`icf-oee/reviews/code-review/feedback-round-1/`) : 3 points bloquants
    (un fichier de `src/` exclu de la couverture, couverture mesurée seulement sur les fichiers
    testés, un fichier inutilisé), 7 points « à corriger », 4 mineurs.
  - Revue de code n°2 (`feedback-round-2/`) après corrections : **0 bloquant**, 3 « à corriger »
    ouverts, 4 mineurs. C'est une auto-revue faite par l'assistant, pas une revue de Cognite.
  - Corrigé :
    - Couverture mesurée sur tout `src/` : 187 tests, 96,7 % des lignes. La page de
      prévisualisation est passée dans `icf-oee/dev/` (hors `src/`, hors build).
    - Lecture des unités : une seule lecture pour tous les sites (`listAllUnits`) au lieu d'une
      par site. Vérifié en lecture seule sur le test : mêmes 628 unités, **13 requêtes au lieu
      de 59**. Onglet Unit types : 26 requêtes avant d'afficher le classement (environ 90
      avant), puis quality / performance / availability arrivent dans leurs colonnes.
      Onglet Overview : 14 requêtes au lieu de 59.
    - Graphiques chargés à la demande : JavaScript principal 756 ko au lieu de 1,15 Mo.
    - Message « The page could not be displayed » avec « Try again » au lieu d'une page blanche
      si l'affichage plante.
    - Téléphone (375 px) : pas de défilement horizontal de la page, onglets, raccourcis de
      période et points de la carte à 44 px sur écran tactile, noms raccourcis dans le
      graphique des types.
    - Accessibilité : zoom autorisé, niveau d'OEE donné aussi en texte (pas seulement par la
      couleur), gris du texte secondaire foncé d'un cran (contraste 3,7 → 5,8). Contrôle
      axe-core dans le navigateur sur les 4 onglets : 0 défaut sur Unit types, Site, Export.
      Le même contrôle est dans les tests (`OeePage.a11y.test.tsx`).
    - Dépendances : Vitest 4.1.11 (plus d'alerte « moderate »), `clsx` et `tailwind-merge`
      retirés, `axe-core` ajouté en dépendance de développement.
  - Restent ouverts : `@cognite/aura` a une version majeure de retard (0.3.5 → 1.x, à faire à
    part avec contrôle visuel dans Fusion) ; nommage des fichiers différent de la convention
    Flows ; sur la carte, les points des sites européens voisins se chevauchent (le tableau
    sous la carte offre la même action).
  - **Pas fait** : la revue de design (`flows-design-review`) n'est pas notée, elle exige que
    je déroule moi-même les tâches de l'app ; `App-Brief.md` (`flows-app-brief`) n'existe pas ;
    rien n'a été contrôlé dans Fusion (0.0.5 non déployée), ni sur un vrai téléphone, ni avec
    un lecteur d'écran.
  - Prévisualisation locale : `.claude/launch.json` est maintenant dans le dossier `Cognite`
    (racine de la session), la page est `https://localhost:3001/dev-preview.html`.
- **Version 0.0.6 écrite le 2026-10-09** (à ma demande : lignes de tableau à 40 px sur écran
  tactile, et viser 4 sur 5 à la grille qualité Flows).
  - Écran tactile : lignes et en-têtes de tableau, listes déroulantes, champs de date, boutons
    et lignes de cases à cocher à 40 px (onglets et points de carte déjà à 44 px). L'app sait
    qu'elle est sur un écran tactile par `matchMedia('(pointer: coarse)')`, lu une fois au
    démarrage (`touchScreen.ts`).
  - Deux défauts trouvés en regardant une capture en taille téléphone, que les mesures
    n'avaient pas montrés : la description des cartes était coupée après deux lignes (le
    titre et la description sont maintenant l'un sous l'autre en dessous de 1280 px), et les
    cases à cocher de l'export débordaient de l'écran (elles passent à la ligne).
  - Erreurs de lecture : phrase claire pour les réponses habituelles de CDF (403 : demander
    l'accès à l'administrateur du projet ; 429 : attendre ; 5xx : réessayer) et bouton
    « Try again » qui ne relit que ce qui a échoué.
  - Export : bouton « Cancel » pendant un export ; plus aucune requête n'est envoyée et aucun
    fichier n'est téléchargé.
  - Contrôles : 205 tests, couverture 96,9 % des lignes, lint et build OK. Rendu contrôlé sur
    la page de prévisualisation locale en 375 px, 768 px et bureau.
  - Mesuré dans Fusion test sur la 0.0.5 (vraies données) : classement de l'onglet Unit types
    affiché environ 2 s après le clic depuis l'Overview, et en moins de 10 s en ouvrant
    directement l'onglet (chargement de Fusion compris), contre 20 à 25 s en 0.0.4.
  - Note estimée par l'assistant à la grille qualité Flows (10 questions) : 3,4 pour la 0.0.4,
    3,8 pour la 0.0.5, **4,0 pour la 0.0.6**. Ce n'est pas la note officielle : la grille
    demande que je déroule moi-même les tâches (revue de design non faite).
  - **Déployée en test puis activée le 2026-10-09** après ma validation du brouillon :
    `0.0.6 is now PUBLISHED`, `ACTIVE`, `Superseded 0.0.5 → PUBLISHED`. Commitée dans le dépôt
    de l'app (`5d1ebbe`, 32 fichiers). Pas de déploiement en prod. Clone GitHub
    `C:\dev\cdf-bootcamp-33` préparé (copie de `icf-oee/` et de ce journal, fichiers
    indexés) ; commit et push faits par moi le 2026-10-09 avec la commande du piège 403
    ci-dessus (`d7a7428` ; contrôle après le push : `origin/main` au même commit, arbre
    propre, 394 fichiers, aucun `.env`).
- **Version 0.0.7 écrite le 2026-10-09** (à ma demande, après avoir parcouru l'app : « tout est
  good, juste la map »).
  - Code couleur de la carte, pour l'OEE d'un site : **rouge sous 80 %, orange de 80 à 90 %,
    vert à partir de 90 %** (c'était 70 / 85). Concerne les points de la carte, la légende et
    la valeur du site dans la bulle. Les seuils des unités (70 % alerte, 85 %) ne changent
    pas : le tableau sous la carte et les autres onglets gardent leurs couleurs.
  - `icf-oee/App-Brief.md` rédigé par l'assistant (fiche de l'app pour la certification), **à
    relire par moi** : le client, le niveau (Tier 1), l'utilisateur, le problème et les
    critères de succès sont des propositions ; « aucun contact avec un vrai utilisateur » y
    est écrit tel quel. Nombre d'utilisateurs, valeur métier et jalons laissés vides.
  - Revue de design n°1 (`icf-oee/reviews/design-review/feedback-round-1/`) : moyenne **4,1**
    (« Good »), notes proposées par l'assistant, parcours des tâches fait par moi. Q6 vaut 5
    parce que l'app est en lecture seule (règle de la revue). Ce n'est pas une note de Cognite.
  - Contrôles : 212 tests, couverture 96,8 % des lignes, lint OK.
  - **Déployée en test puis activée le 2026-10-09** après ma validation du brouillon :
    `0.0.7 is now PUBLISHED`, `ACTIVE`, `Superseded 0.0.6 → PUBLISHED`. Commitée dans le dépôt
    de l'app : `4767181` (code couleur de la carte) et `7e54457` (fiche de l'app et revue de
    design). Pas de déploiement en prod. Clone GitHub `C:\dev\cdf-bootcamp-33` préparé (copie
    de `icf-oee/` et de ce journal, fichiers indexés) ; commit et push faits par moi le
    2026-10-09 (`54f6d0d` ; contrôle après le push : `origin/main` au même commit, arbre
    propre, 396 fichiers, aucun `.env`). Le réglage durable du compte GitHub dans le clone
    n'est toujours pas fait : le push passe encore par la commande longue du piège 403.
- **Version 0.0.8 écrite le 2026-10-09 : onglet « Weekly report »** (à ma demande : pouvoir
  générer un rapport hebdomadaire).
  - Choix : site (ou tous) et dernier jour de la semaine (par défaut le jour de la dernière
    valeur). Le rapport couvre les 7 jours UTC qui finissent ce jour-là, comparés aux 7 jours
    précédents. Ce sont 7 jours glissants, pas une semaine calendaire.
  - Contenu : OEE moyen, variation en points par rapport à la semaine d'avant, part des heures
    sous 70 %, nombre d'unités dont la moyenne de la semaine est sous 70 %, part des heures
    qui ont une valeur ; puis les sites (du plus bas au plus haut, avec leur unité la plus
    basse), les 10 types d'unités les plus longtemps sous 70 % et les 10 unités les plus
    basses.
  - Le rapport s'affiche à l'écran et se télécharge en **un fichier HTML autonome** (ni
    script ni ressource externe), nommé d'après le périmètre et la semaine. Il s'ouvre dans
    n'importe quel navigateur ; pour un PDF : imprimer, puis « Enregistrer au format PDF ».
    Rien n'est planifié ni envoyé par l'app : c'est moi qui génère le rapport.
  - Requêtes : moyennes horaires de l'OEE sur les deux semaines. Vérifié en lecture seule sur
    le test avec le vrai code : 22 requêtes en 0,7 s pour les 628 unités ; les deux semaines
    ont des valeurs. Constat sur les données du test au 2026-10-09 : la semaine en cours
    n'a des valeurs que sur 73 heures au plus par unité (sur 168), et l'OEE moyen y est de
    74,5 % contre 82,4 % la semaine d'avant.
  - Avec cinq onglets, la barre d'onglets dépassait la largeur d'un téléphone : elle défile
    maintenant dans son propre cadre.
  - Contrôles : 255 tests, couverture 97,1 % des lignes, lint OK ; axe-core sans défaut sur
    le nouvel onglet ; rendu contrôlé dans l'aperçu local (bureau et 375 px) ; fichier HTML
    généré relu à l'écran.
  - **Déployée en test puis activée le 2026-10-09** après ma validation du brouillon :
    `0.0.8 is now PUBLISHED`, `ACTIVE`, `Superseded 0.0.7 → PUBLISHED`. Commitée dans le dépôt
    de l'app (`7da256b`, 20 fichiers). Pas de déploiement en prod. Clone GitHub
    `C:\dev\cdf-bootcamp-33` préparé (copie de `icf-oee/` et de ce journal, fichiers
    indexés) ; commit et push faits par moi le 2026-10-09 (`b45c673` ; contrôle après le
    push : `origin/main` au même commit, arbre propre, 404 fichiers, aucun `.env`).
- **Version 0.0.9 écrite le 2026-10-09** (à ma demande : aligner le tableau sous la carte sur
  les seuils 80 et 90).
  - Dans le tableau « Lowest OEE by site », la colonne « Site OEE » suit maintenant le code
    couleur de la carte : rouge sous 80 %, orange de 80 à 90 %, vert à partir de 90 %. Les
    valeurs des unités du même tableau (les trois plus basses) gardent les seuils des unités
    (70 % et 85 %), comme dans la bulle de la carte.
  - Le niveau d'un site se lit sur la valeur affichée, à une décimale : un site affiché
    « 80.0% » n'est pas classé « sous 80 % » (sans cela, 79,985 % s'affichait 80.0% en rouge).
  - Reste différent : la tuile « Site OEE » de l'onglet Site et le tableau des sites du
    rapport hebdomadaire utilisent encore les seuils 70 % et 85 %.
  - Contrôles : 257 tests, couverture 97,2 % des lignes, lint OK ; rendu contrôlé dans
    l'aperçu local.
  - **Déployée en test puis activée le 2026-10-09** après ma validation du brouillon :
    `0.0.9 is now PUBLISHED`, `ACTIVE`, `Superseded 0.0.8 → PUBLISHED`. Commitée dans le dépôt
    de l'app (`6ccbff6`, 8 fichiers). Pas de déploiement en prod. Clone GitHub
    `C:\dev\cdf-bootcamp-33` préparé (copie de `icf-oee/` et de ce journal, fichiers
    indexés) ; commit et push faits par moi le 2026-10-09 (`94d8350` ; contrôle après le
    push : `origin/main` au même commit, arbre propre, 405 fichiers, aucun `.env`).
- **Version 0.0.10 écrite le 2026-10-09** (à ma demande : « fixe tous les points » restés
  ouverts).
  - Seuils d'un site : la tuile « Site OEE » de l'onglet Site, et dans le rapport
    hebdomadaire la moyenne d'ensemble et le tableau des sites (à l'écran et dans le fichier),
    suivent maintenant le code 80 / 90. Un site a donc le même code couleur partout. Les
    unités et les types d'unités gardent 70 % et 85 %.
  - Écarts avec la page « architecture » de la doc Flows, corrigés :
    - identifiants du modèle de données regroupés dans `icf-oee/src/config/model.ts` ;
    - propriétés des assets validées avec Zod à leur entrée dans l'app
      (`src/oee/schema.ts`, version légère `zod/mini` pour ne pas grossir le bundle) ;
      vérifié en lecture seule sur le test : les 1021 assets passent, mêmes 628 unités ;
    - le gros hook unique est découpé en quatre hooks à but unique (`useOeeSelection`,
      `useSitesOverviewViewModel`, `useUnitTypesViewModel`, `useSiteDetailViewModel`).
    Non traités, car hors de la liste : état partagé en contextes React plutôt qu'en Zustand,
    dossiers à plat, quatre styles en ligne dans la carte.
  - Revue de code n°3 (`reviews/code-review/feedback-round-3/`), faite avec la procédure
    officielle (contrôles téléchargés le jour même) : **0 bloquant**, 3 « à corriger », 5
    mineurs. Revue de design n°2 (`reviews/design-review/feedback-round-2/`) : moyenne
    **4,1**. Ce sont des auto-revues, pas des revues de Cognite.
  - Contrôles : 263 tests, couverture 97,2 % des lignes, lint et build OK (JavaScript
    principal 788 ko).
  - Compte GitHub : le clone `C:\dev\cdf-bootcamp-33` est réglé pour utiliser Git Credential
    Manager avec le compte `EOSGaetan` (réglage local au clone, fait par l'assistant à ma
    demande). Un simple `git push` doit suffire ; à confirmer au prochain push.
  - Signature : **non réglée, ne peut pas l'être par l'assistant**. Aucune clé de signature
    sur ce poste (`keys list` : « No signing identities found »). Il faut ma certification
    de builder Flows, puis `npx @cognite/cli@latest keys generate --interactive` et
    l'enregistrement de la clé par le support Cognite (formulaire Zendesk), et le « Dev
    status » du projet test, à demander par le propriétaire du projet.
  - **Déployée en test puis activée le 2026-10-09** après ma validation du brouillon :
    `0.0.10 is now PUBLISHED`, `ACTIVE`, `Superseded 0.0.9 → PUBLISHED`. Commitée dans le
    dépôt de l'app : `251cb92` (code) et `c53b5bc` (rapports de revue). Pas de déploiement en
    prod. Clone GitHub `C:\dev\cdf-bootcamp-33` préparé (copie de `icf-oee/` et de ce journal,
    fichiers indexés) : **commit et push à faire par moi**.
- Clone GitHub `C:\dev\cdf-bootcamp-33` : `icf-oee/` y était resté au squelette d'origine ;
  remis à niveau le 2026-10-06 par l'assistant (copie + `git add`), avec
  `flows_app_developer.Group.yaml` et ce journal. Commit et push à faire par moi.
- Voir l'app sur les données de prod sans rien déployer : même adresse de développement en
  remplaçant `cdf-bootcamp-33-test` par `cdf-bootcamp-33-prod` (serveur local démarré).

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
  **Réponse trouvée le 2026-10-06** dans le formulaire « Submit your bootcamp work » (partie 2,
  notée à la main, 4 questions) : par captures d'écran. La question 2 demande la configuration
  de l'environnement GitHub `prod` (Settings > Environments > prod). Les trois autres questions
  restent à relever. La page Environments est disponible sur le dépôt privé ; à vérifier à la
  création si « Required reviewers » y est proposé.
