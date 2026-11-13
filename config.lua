Config              = {}

-- =====================================================================
-- Objet et ouverture
-- =====================================================================

-- Nom de l'objet dans ox_inventory (declare dans ox_inventory/data/items.lua, client.event = 'rz-tablet:open')
Config.ItemName     = 'tablet'

-- Touche pour ouvrir la tablette (chaque joueur peut la changer : Parametres > Raccourcis > FiveM)
Config.OpenKey      = 'F3'

-- Commande de debug qui ouvre la tablette sans objet ni verrou (laisser nil pour la desactiver)
Config.DebugCommand = 'tablet' -- commande dev (ouvre la tablette sans objet) ; 'tabletnotif' teste notification + son. Remettre nil en production

-- Objet tenu en main et animation
Config.Prop         = {
    model = `prop_cs_tablet`,
    bone = 28422,
    pos = vec3(0.0, 0.0, 0.03),
    rot = vec3(0.0, 0.0, 0.0),
}

Config.Anim         = {
    dict = 'amb@code_human_in_bus_passenger_idles@female@tablet@base',
    name = 'base',
}

-- =====================================================================
-- Marche
-- =====================================================================

-- Pouvoir marcher pendant que la tablette est ouverte (chaque joueur peut le couper dans Reglages)
Config.AllowWalk    = true
-- Opacite de la tablette quand le personnage marche (0.0 a 1.0)
Config.WalkOpacity  = 0.35

-- =====================================================================
-- Notifications
-- =====================================================================

-- Tablette rangee : elle depasse en bas de l'ecran le temps d'afficher la notification
Config.Notify       = {
    peek = true,     -- false : pas d'apercu, la notification attend dans la tablette
    peekTime = 5000, -- duree de l'apercu (ms)
    sound = true,
    volume = 0.6,    -- volume du son de notification (0.0 a 1.0), fichier html/sound/notification.ogg
}

-- =====================================================================
-- App (boutique d'apps web)
-- =====================================================================

-- Apps web installables par les joueurs. Elles s'ouvrent en plein ecran comme de vraies apps,
-- donc le site doit etre autorise dans Config.Browser.allowedHosts.
-- Le staff (Config.Services.staffGroups) peut aussi en ajouter en jeu : Reglages > Administration.
-- Celles-ci sont en base (rz_tablet_apps) et leur site est autorise automatiquement.
-- id    = identifiant unique (minuscules, chiffres, - et _)
-- color = couleur du degrade de l'icone
-- icon  = pictogramme Phosphor (nom sans suffixe, ex. 'house-line', 'car', 'shopping-cart') : liste sur https://phosphoricons.com
-- glyph = 1 a 3 lettres affichees si pas d'icon (ou nom inconnu)
-- image = icone en https (optionnel, remplace le reste)
Config.Store        = {
    {
        id = 'dynasty8',
        label = 'Dynasty 8',
        subtitle = 'Immobilier à Los Santos',
        category = 'Immobilier',
        url = 'https://dynasty8wl.fr/',
        color = '#0f8a4b',
        glyph = 'D8',
        icon = 'house-line',
        description = 'Les biens à vendre et à louer, les agents et les visites.',
    },
}

-- =====================================================================
-- Icones des apps
-- =====================================================================

-- Remplace l'icone d'une app. Cle = id de l'app :
--   apps de base : settings (Reglages), store (App), browser (Navigateur), services (Services),
--                  notes (Notes), calculator (Calculatrice), maps (Carte), vehicles (Vehicules), bank (Banque)
--   apps web     : leur id dans Config.Store (passe avant leur icon / image / color)
-- Valeur :
--   'https://exemple.com/icone.png'        image en ligne (carree, elle remplit toute l'icone)
--   'Apps.jpg'                             image locale, a deposer dans html/assets/icons/ (png, jpg, jpeg, webp)
--   'storefront'                           pictogramme Phosphor blanc sur le degrade (liste : dev/pictos.html)
--   { icon = 'storefront', color = '#ff7a00' }   pictogramme + couleur du degrade
-- Une app absente de la liste garde son icone d'origine.
Config.AppIcons     = {
    store      = 'Apps.jpg',
    settings   = 'Settings.jpg',
    browser    = 'Browser.jpg',
    services   = 'Services.jpg',
    notes      = 'Notes.jpg',
    calculator = 'Calculator.jpg',
    maps       = 'Maps.jpg',
    vehicles   = 'Registration.jpg',
}

-- =====================================================================
-- Notes
-- =====================================================================

-- Les notes sont liees a la tablette (l'objet), comme le verrou : la donner, c'est donner ses notes.
Config.Notes        = {
    maxNotes = 100,    -- notes par tablette
    maxLength = 4000,  -- caracteres par note (l'interface s'arrete aussi a 4000)
}

-- =====================================================================
-- Vehicules (carte grise et localisation)
-- =====================================================================

-- Lit la table owned_vehicles d'ESX : owner = le personnage, job = l'entreprise proprietaire du vehicule.
-- Un vehicule n'a de position que s'il existe dans le monde (sorti). Sinon : au garage (stored = 1),
-- ou l'endroit ou il a ete vu pour la derniere fois (oublie au redemarrage de la ressource).
Config.Vehicles     = {
    -- Vehicules d'entreprise : grade minimum par job (table job_grades, 0 = le grade le plus bas).
    --   police = 1                        voir la liste ET localiser a partir du grade 1
    --   police = { see = 0, locate = 1 }  tout le monde voit la liste, localiser a partir du grade 1
    -- Un job absent de la liste n'a pas d'onglet Entreprise. Tes propres vehicules sont toujours localisables.
    jobs = {
        police    = { see = 0, locate = 1 },
        ambulance = { see = 0, locate = 1 },
        mechanic  = 1,
        taxi      = 1,
    },
    needDuty = false, -- true : il faut etre en service pour localiser les vehicules de l'entreprise
    -- Commande staff (groupes de Config.Services.staffGroups) pour tester sans concessionnaire ni garage,
    -- assis dans un vehicule :
    --   /immatriculer          il devient le tien
    --   /immatriculer police   il devient un vehicule de l'entreprise police
    --   /immatriculer retirer  il est retire de owned_vehicles
    registerCommand = 'immatriculer', -- nil pour la desactiver
}

-- =====================================================================
-- Banque (solde et historique, sans virement)
-- =====================================================================

-- Chaque mouvement du compte ESX choisi est note a partir de l'installation.
-- Le motif affiche est celui donne par le script qui verse ou retire l'argent.
Config.Bank         = {
    account = 'bank', -- compte ESX suivi
    name = 'Banque',  -- nom affiche sur la carte du compte
    currency = '$',
    keepDays = 60,    -- operations plus anciennes supprimees au demarrage (0 = jamais)
}

-- =====================================================================
-- AirDrop (partage entre tablettes proches)
-- =====================================================================

-- Notes et positions. Le destinataire doit avoir une tablette sur lui et la reception active (Reglages > AirDrop).
Config.AirDrop      = {
    range = 8.0,      -- distance maximale entre les deux joueurs (metres)
    expire = 60,      -- secondes pour accepter une demande
    cooldown = 3000,  -- ms entre deux envois d'un meme joueur
    showNames = true, -- false : les tablettes apparaissent sans nom ("Tablette")
}

-- =====================================================================
-- Navigateur
-- =====================================================================

-- Beaucoup de sites interdisent l'affichage dans une iframe (X-Frame-Options / CSP) :
-- ils restent blancs en mode Frame. autoDetect les bascule tout seuls en mode Rendu.
Config.Browser      = {
    -- Liste blanche : si true, seuls les sites de allowedHosts (et leurs sous-domaines) peuvent etre ouverts.
    -- Le staff peut en autoriser d'autres en jeu (Reglages > Administration, table rz_tablet_sites).
    restrictToAllowed = true,
    allowedHosts = {
    },
    autoDetect = true, -- le serveur lit les en-tetes du site et choisit frame ou rendu automatiquement
    mode = 'frame',    -- 'frame' (iframe : clavier natif, le site doit l'autoriser) ou 'dui' (rendu en jeu, tout site, sans clavier)
    zoom = 0.6,        -- zoom par defaut des pages (0.6 = 60 %, la page se met en page comme sur un grand ecran)
    home = 'https://fr.wikipedia.org/',
    search = 'https://fr.wikipedia.org/w/index.php?search=%s',
    bookmarks = {
        { title = 'Wikipedia', url = 'https://fr.wikipedia.org/' },
        { title = 'Dynasty8',  url = 'https://dynasty8wl.fr/' },
    },
}

-- Mode Rendu (DUI : vrai navigateur interne dessine en jeu, aucun blocage d'iframe, pas de clavier)
Config.Dui          = {
    maxWidth = 1920,
    maxHeight = 1080,
    wheelScale = -1, -- inverse ce signe (-1 / 1) si la molette defile dans le mauvais sens
}

-- =====================================================================
-- Services (annuaire des entreprises = jobs ESX)
-- =====================================================================

-- Une entreprise est "ouverte" quand au moins un joueur de ce job est en service.
Config.Services     = {
    -- Groupes ESX autorises a ajouter / modifier / supprimer des entreprises (le bouton +)
    -- et a ouvrir Reglages > Administration (sites autorises, apps web)
    staffGroups = { owner = true, admin = true },
    messageCooldown = 4000,      -- ms entre deux messages d'un meme joueur
    messageMaxLength = 300,
    maxMessagesPerService = 500, -- messages conserves par entreprise (toutes conversations)
    keepMessagesDays = 7,        -- suppression automatique des vieux messages
}
