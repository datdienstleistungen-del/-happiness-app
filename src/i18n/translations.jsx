import { createContext, useContext, useState, useEffect } from 'react'

const translations = {
  de: {
    nav: { home: 'Start', community: 'Community', friends: 'Freunde', marketplace: 'Marktplatz', jobs: 'Jobbörse', courses: 'Kurse', housing: 'Wohnungen', profile: 'Profil', notifications: 'Benachrichtigungen', history: 'Verlauf', admin: 'Admin', logout: 'Logout' },
    home: { welcome: 'Willkommen bei der Happiness App!', subtitle: 'Schön, dass du da bist,', desc: 'Deine europäische Plattform für Glück und Vernetzung' },
    auth: { login: 'Anmelden', register: 'Registrieren', email: 'E-Mail', password: 'Passwort', name: 'Name', username: 'Benutzername', noAccount: 'Noch kein Konto?', hasAccount: 'Bereits ein Konto?', loginHere: 'Hier anmelden', registerHere: 'Hier registrieren', createAccount: 'Erstelle dein Konto', loginSubtitle: 'Melde dich an, um fortzufahren', registering: 'Wird registriert...', logging: 'Wird angemeldet...' },
    community: { title: 'Community', share: 'Teile deine Gedanken mit der Community', placeholder: 'Was möchtest du teilen?', post: 'Posten', comment: 'Kommentar...', send: 'Senden', noPosts: 'Noch keine Beiträge. Sei der Erste!' },
    friends: { title: 'Freunde', yourFriends: 'Deine Freunde', requests: 'Anfragen', findUsers: 'Nutzer finden', noFriends: 'Noch keine Freunde.', noRequests: 'Keine ausstehenden Anfragen.', sendRequest: 'Freundschaftsanfrage senden', accept: 'Akzeptieren', decline: 'Ablehnen', remove: 'Entfernen', search: 'Name oder Benutzername suchen...' },
    marketplace: { title: 'Marktplatz', browse: 'Anzeigen', create: 'Neue Anzeige', newAd: 'Neue Anzeige erstellen', titleField: 'Titel', desc: 'Beschreibung', price: 'Preis (€)', category: 'Kategorie', createBtn: 'Erstellen', search: 'Suchen...', allCategories: 'Alle Kategorien', noItems: 'Keine Anzeigen gefunden.', contact: 'Kontaktieren' },
    jobs: { title: 'Jobbörse', browse: 'Jobs suchen', create: 'Job ausschreiben', titleField: 'Jobtitel', desc: 'Beschreibung', location: 'Standort', type: 'Jobtyp', contact: 'Kontakt (E-Mail)', createBtn: 'Ausschreiben', search: 'Suchen...', allTypes: 'Alle Typen', noJobs: 'Keine Jobs gefunden.', apply: 'Bewerben' },
    courses: { title: 'Kurse', browse: 'Kurse entdecken', create: 'Kurs anbieten', titleField: 'Kurstitel', desc: 'Beschreibung', category: 'Kategorie', duration: 'Dauer', price: 'Preis (€)', max: 'Max. Teilnehmer', createBtn: 'Kurs erstellen', search: 'Suchen...', allCategories: 'Alle Kategorien', noCourses: 'Keine Kurse gefunden.', join: 'Teilnehmen', leave: 'Abmelden', full: 'Ausgebucht' },
    profile: { title: 'Profil', settings: 'Einstellungen', edit: 'Profil bearbeiten', bio: 'Über mich', avatar: 'Avatar-URL', save: 'Speichern', changePw: 'Passwort ändern', newPw: 'Neues Passwort', confirmPw: 'Neues Passwort wiederholen', noPosts: 'Noch keine Beiträge.' },
    notifications: { title: 'Benachrichtigungen', markAll: 'Alle als gelesen markieren', markRead: 'Als gelesen markieren', none: 'Keine Benachrichtigungen.' },
    history: { title: 'Verlauf', posts: 'Beiträge', items: 'Anzeigen', jobs: 'Jobs', courses: 'Kurse', none: 'Noch keine' },
    admin: { title: 'Admin-Bereich', noAccess: 'Kein Zugriff. Nur für Admins.', users: 'Nutzer', posts: 'Beiträge', items: 'Anzeigen', delete: 'Löschen' },
    housing: { title: 'Wohnungen', subtitle: 'Finde dein neues Zuhause — WG-Zimmer, Wohnungen und mehr', browse: 'Suchen', create: 'Inserat erstellen', titleField: 'Titel', desc: 'Beschreibung', price: 'Preis (€/Monat)', type: 'Wohnungstyp', location: 'Standort', size: 'Größe (m²)', availableFrom: 'Verfügbar ab', contact: 'Kontakt', contactInfo: 'Kontakt', contactBtn: 'Kontaktieren', publish: 'Inserat veröffentlichen', search: 'Standort oder Titel suchen...', allTypes: 'Alle Typen', maxPrice: 'Max. Preis', noResults: 'Keine Wohnungen gefunden.', createAd: 'Neues Inserat' },
    time: { justNow: 'Gerade eben', minutes: 'Min.', hours: 'Std.', days: 'Tg.' },
    dashboard: { posts: 'Beiträge', users: 'Nutzer', friends: 'Freunde', notifications: 'Benachrichtigungen', lastPosts: 'Letzte Beiträge' },
    welcome: { morning: 'Guten Morgen', afternoon: 'Guten Tag', evening: 'Guten Abend' }
  },
  en: {
    nav: { home: 'Home', community: 'Community', friends: 'Friends', marketplace: 'Marketplace', jobs: 'Jobs', courses: 'Courses', housing: 'Housing', profile: 'Profile', notifications: 'Notifications', history: 'History', admin: 'Admin', logout: 'Logout' },
    home: { welcome: 'Welcome to the Happiness App!', subtitle: 'Great to have you here,', desc: 'Your European platform for happiness and connection' },
    auth: { login: 'Login', register: 'Register', email: 'Email', password: 'Password', name: 'Name', username: 'Username', noAccount: "Don't have an account?", hasAccount: 'Already have an account?', loginHere: 'Login here', registerHere: 'Register here', createAccount: 'Create your account', loginSubtitle: 'Login to continue', registering: 'Registering...', logging: 'Logging in...' },
    community: { title: 'Community', share: 'Share your thoughts with the community', placeholder: 'What do you want to share?', post: 'Post', comment: 'Comment...', send: 'Send', noPosts: 'No posts yet. Be the first!' },
    friends: { title: 'Friends', yourFriends: 'Your Friends', requests: 'Requests', findUsers: 'Find Users', noFriends: 'No friends yet.', noRequests: 'No pending requests.', sendRequest: 'Send friend request', accept: 'Accept', decline: 'Decline', remove: 'Remove', search: 'Search name or username...' },
    marketplace: { title: 'Marketplace', browse: 'Browse', create: 'New Ad', newAd: 'Create new ad', titleField: 'Title', desc: 'Description', price: 'Price (€)', category: 'Category', createBtn: 'Create', search: 'Search...', allCategories: 'All categories', noItems: 'No ads found.', contact: 'Contact' },
    jobs: { title: 'Jobs', browse: 'Browse Jobs', create: 'Post Job', titleField: 'Job Title', desc: 'Description', location: 'Location', type: 'Job Type', contact: 'Contact (Email)', createBtn: 'Post', search: 'Search...', allTypes: 'All types', noJobs: 'No jobs found.', apply: 'Apply' },
    courses: { title: 'Courses', browse: 'Discover Courses', create: 'Offer Course', titleField: 'Course Title', desc: 'Description', category: 'Category', duration: 'Duration', price: 'Price (€)', max: 'Max. Participants', createBtn: 'Create Course', search: 'Search...', allCategories: 'All categories', noCourses: 'No courses found.', join: 'Enroll', leave: 'Unenroll', full: 'Full' },
    profile: { title: 'Profile', settings: 'Settings', edit: 'Edit Profile', bio: 'About me', avatar: 'Avatar URL', save: 'Save', changePw: 'Change Password', newPw: 'New Password', confirmPw: 'Confirm New Password', noPosts: 'No posts yet.' },
    notifications: { title: 'Notifications', markAll: 'Mark all as read', markRead: 'Mark as read', none: 'No notifications.' },
    history: { title: 'History', posts: 'Posts', items: 'Ads', jobs: 'Jobs', courses: 'Courses', none: 'No' },
    admin: { title: 'Admin Area', noAccess: 'No access. Admins only.', users: 'Users', posts: 'Posts', items: 'Ads', delete: 'Delete' },
    housing: { title: 'Housing', subtitle: 'Find your new home — shared rooms, apartments and more', browse: 'Search', create: 'Create Listing', titleField: 'Title', desc: 'Description', price: 'Price (€/month)', type: 'Housing Type', location: 'Location', size: 'Size (m²)', availableFrom: 'Available from', contact: 'Contact', contactInfo: 'Contact', contactBtn: 'Contact', publish: 'Publish Listing', search: 'Search location or title...', allTypes: 'All types', maxPrice: 'Max. price', noResults: 'No housing found.', createAd: 'New Listing' },
    time: { justNow: 'Just now', minutes: 'min.', hours: 'hrs.', days: 'days' },
    dashboard: { posts: 'Posts', users: 'Users', friends: 'Friends', notifications: 'Notifications', lastPosts: 'Recent Posts' },
    welcome: { morning: 'Good Morning', afternoon: 'Good Afternoon', evening: 'Good Evening' }
  },
  es: {
    nav: { home: 'Inicio', community: 'Comunidad', friends: 'Amigos', marketplace: 'Mercado', jobs: 'Empleos', courses: 'Cursos', housing: 'Viviendas', profile: 'Perfil', notifications: 'Notificaciones', history: 'Historial', admin: 'Admin', logout: 'Salir' },
    home: { welcome: '¡Bienvenido a la Happiness App!', subtitle: 'Qué alegría que estés aquí,', desc: 'Tu plataforma europea de felicidad y conexión' },
    auth: { login: 'Iniciar sesión', register: 'Registrarse', email: 'Correo', password: 'Contraseña', name: 'Nombre', username: 'Usuario', noAccount: '¿No tienes cuenta?', hasAccount: '¿Ya tienes cuenta?', loginHere: 'Inicia aquí', registerHere: 'Regístrate aquí', createAccount: 'Crea tu cuenta', loginSubtitle: 'Inicia sesión para continuar', registering: 'Registrando...', logging: 'Iniciando sesión...' },
    community: { title: 'Comunidad', share: 'Comparte tus pensamientos con la comunidad', placeholder: '¿Qué quieres compartir?', post: 'Publicar', comment: 'Comentar...', send: 'Enviar', noPosts: '¡Aún no hay publicaciones. Sé el primero!' },
    friends: { title: 'Amigos', yourFriends: 'Tus Amigos', requests: 'Solicitudes', findUsers: 'Buscar Usuarios', noFriends: 'Aún no tienes amigos.', noRequests: 'No hay solicitudes pendientes.', sendRequest: 'Enviar solicitud de amistad', accept: 'Aceptar', decline: 'Rechazar', remove: 'Eliminar', search: 'Buscar nombre o usuario...' },
    marketplace: { title: 'Mercado', browse: 'Explorar', create: 'Nuevo Anuncio', newAd: 'Crear nuevo anuncio', titleField: 'Título', desc: 'Descripción', price: 'Precio (€)', category: 'Categoría', createBtn: 'Crear', search: 'Buscar...', allCategories: 'Todas las categorías', noItems: 'No se encontraron anuncios.', contact: 'Contactar' },
    jobs: { title: 'Empleos', browse: 'Buscar Empleos', create: 'Publicar Empleo', titleField: 'Título del Empleo', desc: 'Descripción', location: 'Ubicación', type: 'Tipo de Empleo', contact: 'Contacto (Correo)', createBtn: 'Publicar', search: 'Buscar...', allTypes: 'Todos los tipos', noJobs: 'No se encontraron empleos.', apply: 'Aplicar' },
    courses: { title: 'Cursos', browse: 'Descubrir Cursos', create: 'Ofrecer Curso', titleField: 'Título del Curso', desc: 'Descripción', category: 'Categoría', duration: 'Duración', price: 'Precio (€)', max: 'Máx. Participantes', createBtn: 'Crear Curso', search: 'Buscar...', allCategories: 'Todas las categorías', noCourses: 'No se encontraron cursos.', join: 'Inscribirse', leave: 'Abandonar', full: 'Lleno' },
    profile: { title: 'Perfil', settings: 'Configuración', edit: 'Editar Perfil', bio: 'Sobre mí', avatar: 'URL de Avatar', save: 'Guardar', changePw: 'Cambiar Contraseña', newPw: 'Nueva Contraseña', confirmPw: 'Confirmar Nueva Contraseña', noPosts: 'Aún no hay publicaciones.' },
    notifications: { title: 'Notificaciones', markAll: 'Marcar todo como leído', markRead: 'Marcar como leído', none: 'No hay notificaciones.' },
    history: { title: 'Historial', posts: 'Publicaciones', items: 'Anuncios', jobs: 'Empleos', courses: 'Cursos', none: 'No hay' },
    admin: { title: 'Área de Admin', noAccess: 'Sin acceso. Solo administradores.', users: 'Usuarios', posts: 'Publicaciones', items: 'Anuncios', delete: 'Eliminar' },
    housing: { title: 'Viviendas', subtitle: 'Encuentra tu nuevo hogar — habitaciones compartidas, apartamentos y más', browse: 'Buscar', create: 'Crear Anuncio', titleField: 'Título', desc: 'Descripción', price: 'Precio (€/mes)', type: 'Tipo de Vivienda', location: 'Ubicación', size: 'Tamaño (m²)', availableFrom: 'Disponible desde', contact: 'Contacto', contactInfo: 'Contacto', contactBtn: 'Contactar', publish: 'Publicar Anuncio', search: 'Buscar ubicación o título...', allTypes: 'Todos los tipos', maxPrice: 'Precio máx.', noResults: 'No se encontraron viviendas.', createAd: 'Nuevo Anuncio' },
    time: { justNow: 'Ahora mismo', minutes: 'min.', hours: 'hrs.', days: 'días' },
    dashboard: { posts: 'Publicaciones', users: 'Usuarios', friends: 'Amigos', notifications: 'Notificaciones', lastPosts: 'Últimas Publicaciones' },
    welcome: { morning: 'Buenos Días', afternoon: 'Buenas Tardes', evening: 'Buenas Noches' }
  },
  fr: {
    nav: { home: 'Accueil', community: 'Communauté', friends: 'Amis', marketplace: 'Marché', jobs: 'Emplois', courses: 'Cours', housing: 'Logements', profile: 'Profil', notifications: 'Notifications', history: 'Historique', admin: 'Admin', logout: 'Déconnexion' },
    home: { welcome: 'Bienvenue sur Happiness App!', subtitle: 'Ravi de vous voir,', desc: 'Votre plateforme européenne de bonheur et de connexion' },
    auth: { login: 'Connexion', register: "S'inscrire", email: 'E-mail', password: 'Mot de passe', name: 'Nom', username: "Nom d'utilisateur", noAccount: 'Pas encore de compte?', hasAccount: 'Déjà un compte?', loginHere: 'Connectez-vous ici', registerHere: 'Inscrivez-vous ici', createAccount: 'Créez votre compte', loginSubtitle: 'Connectez-vous pour continuer', registering: 'Inscription...', logging: 'Connexion...' },
    community: { title: 'Communauté', share: 'Partagez vos pensées avec la communauté', placeholder: 'Que voulez-vous partager?', post: 'Publier', comment: 'Commenter...', send: 'Envoyer', noPosts: "Aucune publication. Soyez le premier!" },
    friends: { title: 'Amis', yourFriends: 'Vos Amis', requests: 'Demandes', findUsers: 'Trouver des Utilisateurs', noFriends: "Pas encore d'amis.", noRequests: 'Aucune demande en attente.', sendRequest: "Envoyer une demande d'amitié", accept: 'Accepter', decline: 'Refuser', remove: 'Supprimer', search: 'Rechercher un nom...' },
    marketplace: { title: 'Marché', browse: 'Parcourir', create: 'Nouvelle Annonce', newAd: 'Créer une annonce', titleField: 'Titre', desc: 'Description', price: 'Prix (€)', category: 'Catégorie', createBtn: 'Créer', search: 'Rechercher...', allCategories: 'Toutes les catégories', noItems: 'Aucune annonce trouvée.', contact: 'Contacter' },
    jobs: { title: 'Emplois', browse: 'Chercher un Emploi', create: 'Publier un Emploi', titleField: "Titre de l'Emploi", desc: 'Description', location: 'Lieu', type: "Type d'Emploi", contact: 'Contact (E-mail)', createBtn: 'Publier', search: 'Rechercher...', allTypes: 'Tous les types', noJobs: 'Aucun emploi trouvé.', apply: 'Postuler' },
    courses: { title: 'Cours', browse: 'Découvrir les Cours', create: 'Proposer un Cours', titleField: 'Titre du Cours', desc: 'Description', category: 'Catégorie', duration: 'Durée', price: 'Prix (€)', max: 'Max. Participants', createBtn: 'Créer le Cours', search: 'Rechercher...', allCategories: 'Toutes les catégories', noCourses: 'Aucun cours trouvé.', join: "S'inscrire", leave: 'Se désinscrire', full: 'Complet' },
    profile: { title: 'Profil', settings: 'Paramètres', edit: 'Modifier le Profil', bio: 'À propos de moi', avatar: 'URL Avatar', save: 'Enregistrer', changePw: 'Changer le Mot de passe', newPw: 'Nouveau Mot de passe', confirmPw: 'Confirmer le Nouveau Mot de passe', noPosts: 'Aucune publication.' },
    notifications: { title: 'Notifications', markAll: 'Tout marquer comme lu', markRead: 'Marquer comme lu', none: 'Aucune notification.' },
    history: { title: 'Historique', posts: 'Publications', items: 'Annonces', jobs: 'Emplois', courses: 'Cours', none: 'Aucun' },
    admin: { title: 'Zone Admin', noAccess: 'Accès refusé. Admins uniquement.', users: 'Utilisateurs', posts: 'Publications', items: 'Annonces', delete: 'Supprimer' },
    housing: { title: 'Logements', subtitle: 'Trouvez votre nouveau chez-vous — chambres partagées, appartements et plus', browse: 'Rechercher', create: 'Créer une Annonce', titleField: 'Titre', desc: 'Description', price: 'Prix (€/mois)', type: 'Type de Logement', location: 'Lieu', size: 'Surface (m²)', availableFrom: 'Disponible dès', contact: 'Contact', contactInfo: 'Contact', contactBtn: 'Contacter', publish: 'Publier l\'Annonce', search: 'Rechercher lieu ou titre...', allTypes: 'Tous les types', maxPrice: 'Prix max', noResults: 'Aucun logement trouvé.', createAd: 'Nouvelle Annonce' },
    time: { justNow: "À l'instant", minutes: 'min.', hours: 'h.', days: 'j.' },
    dashboard: { posts: 'Publications', users: 'Utilisateurs', friends: 'Amis', notifications: 'Notifications', lastPosts: 'Dernières Publications' },
    welcome: { morning: 'Bonjour', afternoon: 'Bon Après-midi', evening: 'Bonsoir' }
  },
  it: {
    nav: { home: 'Home', community: 'Community', friends: 'Amici', marketplace: 'Mercato', jobs: 'Lavori', courses: 'Corsi', housing: 'Alloggi', profile: 'Profilo', notifications: 'Notifiche', history: 'Cronologia', admin: 'Admin', logout: 'Esci' },
    home: { welcome: 'Benvenuto nella Happiness App!', subtitle: 'Felice di averti qui,', desc: 'La tua piattaforma europea per la felicità e la connessione' },
    auth: { login: 'Accedi', register: 'Registrati', email: 'Email', password: 'Password', name: 'Nome', username: 'Username', noAccount: 'Non hai un account?', hasAccount: 'Hai già un account?', loginHere: 'Accedi qui', registerHere: 'Registrati qui', createAccount: 'Crea il tuo account', loginSubtitle: 'Accedi per continuare', registering: 'Registrazione...', logging: 'Accesso...' },
    community: { title: 'Community', share: 'Condividi i tuoi pensieri con la community', placeholder: 'Cosa vuoi condividere?', post: 'Pubblica', comment: 'Commenta...', send: 'Invia', noPosts: 'Nessun post ancora. Sii il primo!' },
    friends: { title: 'Amici', yourFriends: 'Tuoi Amici', requests: 'Richieste', findUsers: 'Trova Utenti', noFriends: 'Nessun amico ancora.', noRequests: 'Nessuna richiesta in sospeso.', sendRequest: 'Invia richiesta di amicizia', accept: 'Accetta', decline: 'Rifiuta', remove: 'Rimuovi', search: 'Cerca nome o username...' },
    marketplace: { title: 'Mercato', browse: 'Sfoglia', create: 'Nuovo Annuncio', newAd: 'Crea nuovo annuncio', titleField: 'Titolo', desc: 'Descrizione', price: 'Prezzo (€)', category: 'Categoria', createBtn: 'Crea', search: 'Cerca...', allCategories: 'Tutte le categorie', noItems: 'Nessun annuncio trovato.', contact: 'Contatta' },
    jobs: { title: 'Lavori', browse: 'Cerca Lavori', create: 'Pubblica Lavoro', titleField: 'Titolo del Lavoro', desc: 'Descrizione', location: 'Posizione', type: 'Tipo di Lavoro', contact: 'Contatto (Email)', createBtn: 'Pubblica', search: 'Cerca...', allTypes: 'Tutti i tipi', noJobs: 'Nessun lavoro trovato.', apply: 'Candidati' },
    courses: { title: 'Corsi', browse: 'Scopri Corsi', create: 'Offri Corso', titleField: 'Titolo del Corso', desc: 'Descrizione', category: 'Categoria', duration: 'Durata', price: 'Prezzo (€)', max: 'Max. Partecipanti', createBtn: 'Crea Corso', search: 'Cerca...', allCategories: 'Tutte le categorie', noCourses: 'Nessun corso trovato.', join: 'Iscriviti', leave: 'Lascia', full: 'Completo' },
    profile: { title: 'Profilo', settings: 'Impostazioni', edit: 'Modifica Profilo', bio: 'Su di me', avatar: 'URL Avatar', save: 'Salva', changePw: 'Cambia Password', newPw: 'Nuova Password', confirmPw: 'Conferma Nuova Password', noPosts: 'Nessun post ancora.' },
    notifications: { title: 'Notifiche', markAll: 'Segna tutto come letto', markRead: 'Segna come letto', none: 'Nessuna notifica.' },
    history: { title: 'Cronologia', posts: 'Post', items: 'Annunci', jobs: 'Lavori', courses: 'Corsi', none: 'Nessun' },
    admin: { title: 'Area Admin', noAccess: 'Accesso negato. Solo admin.', users: 'Utenti', posts: 'Post', items: 'Annunci', delete: 'Elimina' },
    housing: { title: 'Alloggi', subtitle: 'Trova la tua nuova casa — stanze condivise, appartamenti e altro', browse: 'Cerca', create: 'Crea Annuncio', titleField: 'Titolo', desc: 'Descrizione', price: 'Prezzo (€/mese)', type: 'Tipo di Alloggio', location: 'Posizione', size: 'Superficie (m²)', availableFrom: 'Disponibile dal', contact: 'Contatto', contactInfo: 'Contatto', contactBtn: 'Contatta', publish: 'Pubblica Annuncio', search: 'Cerca posizione o titolo...', allTypes: 'Tutti i tipi', maxPrice: 'Prezzo máx', noResults: 'Nessun alloggio trovato.', createAd: 'Nuovo Annuncio' },
    time: { justNow: 'Adesso', minutes: 'min.', hours: 'ore', days: 'giorni' },
    dashboard: { posts: 'Post', users: 'Utenti', friends: 'Amici', notifications: 'Notifiche', lastPosts: 'Ultimi Post' },
    welcome: { morning: 'Buongiorno', afternoon: 'Buon Pomeriggio', evening: 'Buonasera' }
  },
  nl: {
    nav: { home: 'Home', community: 'Community', friends: 'Vrienden', marketplace: 'Marktplaats', jobs: 'Banen', courses: 'Cursussen', housing: 'Woningen', profile: 'Profiel', notifications: 'Meldingen', history: 'Geschiedenis', admin: 'Admin', logout: 'Uitloggen' },
    home: { welcome: 'Welkom bij de Happiness App!', subtitle: 'Fijn dat je er bent,', desc: 'Jouw Europese platform voor geluk en verbinding' },
    auth: { login: 'Inloggen', register: 'Registreren', email: 'E-mail', password: 'Wachtwoord', name: 'Naam', username: 'Gebruikersnaam', noAccount: 'Nog geen account?', hasAccount: 'Al een account?', loginHere: 'Log hier in', registerHere: 'Registreer hier', createAccount: 'Maak je account aan', loginSubtitle: 'Log in om verder te gaan', registering: 'Registreren...', logging: 'Inloggen...' },
    community: { title: 'Community', share: 'Deel je gedachten met de community', placeholder: 'Wat wil je delen?', post: 'Plaatsen', comment: 'Reageren...', send: 'Verzenden', noPosts: 'Nog geen berichten. Wees de eerste!' },
    friends: { title: 'Vrienden', yourFriends: 'Jouw Vrienden', requests: 'Verzoeken', findUsers: 'Gebruikers Zoeken', noFriends: 'Nog geen vrienden.', noRequests: 'Geen openstaande verzoeken.', sendRequest: 'Vriendschapsverzoek sturen', accept: 'Accepteren', decline: 'Afwijzen', remove: 'Verwijderen', search: 'Zoek op naam...' },
    marketplace: { title: 'Marktplaats', browse: 'Bladeren', create: 'Nieuwe Advertentie', newAd: 'Nieuwe advertentie maken', titleField: 'Titel', desc: 'Beschrijving', price: 'Prijs (€)', category: 'Categorie', createBtn: 'Aanmaken', search: 'Zoeken...', allCategories: 'Alle categorieën', noItems: 'Geen advertenties gevonden.', contact: 'Contact' },
    jobs: { title: 'Banen', browse: 'Banen Zoeken', create: 'Baan Plaatsen', titleField: 'Functietitel', desc: 'Beschrijving', location: 'Locatie', type: 'Functietype', contact: 'Contact (E-mail)', createBtn: 'Plaatsen', search: 'Zoeken...', allTypes: 'Alle typen', noJobs: 'Geen banen gevonden.', apply: 'Solliciteren' },
    courses: { title: 'Cursussen', browse: 'Cursussen Ontdekken', create: 'Cursus Aanbieden', titleField: 'Curstitel', desc: 'Beschrijving', category: 'Categorie', duration: 'Duur', price: 'Prijs (€)', max: 'Max. Deelnemers', createBtn: 'Cursus Aanmaken', search: 'Zoeken...', allCategories: 'Alle categorieën', noCourses: 'Geen cursussen gevonden.', join: 'Inschrijven', leave: 'Uitschrijven', full: 'Vol' },
    profile: { title: 'Profiel', settings: 'Instellingen', edit: 'Profiel Bewerken', bio: 'Over mij', avatar: 'Avatar URL', save: 'Opslaan', changePw: 'Wachtwoord Wijzigen', newPw: 'Nieuw Wachtwoord', confirmPw: 'Nieuw Wachtwoord Bevestigen', noPosts: 'Nog geen berichten.' },
    notifications: { title: 'Meldingen', markAll: 'Alles als gelezen markeren', markRead: 'Als gelezen markeren', none: 'Geen meldingen.' },
    history: { title: 'Geschiedenis', posts: 'Berichten', items: 'Advertenties', jobs: 'Banen', courses: 'Cursussen', none: 'Geen' },
    admin: { title: 'Admin Gebied', noAccess: 'Geen toegang. Alleen admins.', users: 'Gebruikers', posts: 'Berichten', items: 'Advertenties', delete: 'Verwijderen' },
    housing: { title: 'Woningen', subtitle: 'Vind je nieuwe thuis — gedeelde kamers, appartementen en meer', browse: 'Zoeken', create: 'Advertentie Aanmaken', titleField: 'Titel', desc: 'Beschrijving', price: 'Prijs (€/maand)', type: 'Woningtype', location: 'Locatie', size: 'Oppervlakte (m²)', availableFrom: 'Beschikbaar vanaf', contact: 'Contact', contactInfo: 'Contact', contactBtn: 'Contact', publish: 'Advertentie Publiceren', search: 'Zoek op locatie of titel...', allTypes: 'Alle typen', maxPrice: 'Max. prijs', noResults: 'Geen woningen gevonden.', createAd: 'Nieuwe Advertentie' },
    time: { justNow: 'Zojuist', minutes: 'min.', hours: 'u.', days: 'd.' },
    dashboard: { posts: 'Berichten', users: 'Gebruikers', friends: 'Vrienden', notifications: 'Meldingen', lastPosts: 'Recente Berichten' },
    welcome: { morning: 'Goedemorgen', afternoon: 'Goedemiddag', evening: 'Goedenavond' }
  },
  el: {
    nav: { home: 'Αρχική', community: 'Κοινότητα', friends: 'Φίλοι', marketplace: 'Αγορά', jobs: 'Εργασίες', courses: 'Μαθήματα', housing: 'Κατοικίες', profile: 'Προφίλ', notifications: 'Ειδοποιήσεις', history: 'Ιστορικό', admin: 'Διαχειριστής', logout: 'Αποσύνδεση' },
    home: { welcome: 'Καλωσήρθατε στη Happiness App!', subtitle: 'Χαίρουμε που είσαστε εδώ,', desc: 'Η ευρωπαϊκή σας πλατφόρμα για ευτυχία και σύνδεση' },
    auth: { login: 'Σύνδεση', register: 'Εγγραφή', email: 'Email', password: 'Κωδικός', name: 'Όνομα', username: 'Χρήστης', noAccount: 'Δεν έχετε λογαριασμό;', hasAccount: 'Έχετε ήδη λογαριασμό;', loginHere: 'Συνδεθείτε εδώ', registerHere: 'Εγγραφείτε εδώ', createAccount: 'Δημιουργήστε τον λογαριασμό σας', loginSubtitle: 'Συνδεθείτε για να συνεχίσετε', registering: 'Εγγραφή...', logging: 'Σύνδεση...' },
    community: { title: 'Κοινότητα', share: 'Μοιραστείτε τις σκέψεις σας', placeholder: 'Τι θέλετε να μοιραστείτε;', post: 'Δημοσίευση', comment: 'Σχολιάστε...', send: 'Αποστολή', noPosts: 'Δεν υπάρχουν αναρτήσεις. Είστε ο πρώτος!' },
    friends: { title: 'Φίλοι', yourFriends: 'Οι Φίλοι σας', requests: 'Αιτήσεις', findUsers: 'Εύρεση Χρηστών', noFriends: 'Δεν έχετε ακόμα φίλους.', noRequests: 'Δεν υπάρχουν εκκρεμείς αιτήσεις.', sendRequest: 'Αποστολή αίτησης φιλίας', accept: 'Αποδοχή', decline: 'Απόρριψη', remove: 'Αφαίρεση', search: 'Αναζήτηση ονόματος...' },
    marketplace: { title: 'Αγορά', browse: 'Περιήγηση', create: 'Νέα Αγγελία', newAd: 'Δημιουργία αγγελίας', titleField: 'Τίτλος', desc: 'Περιγραφή', price: 'Τιμή (€)', category: 'Κατηγορία', createBtn: 'Δημιουργία', search: 'Αναζήτηση...', allCategories: 'Όλες οι κατηγορίες', noItems: 'Δεν βρέθηκαν αγγελίες.', contact: 'Επικοινωνία' },
    jobs: { title: 'Εργασίες', browse: 'Αναζήτηση Εργασιών', create: 'Καταχώριση Εργασίας', titleField: 'Τίτλος Εργασίας', desc: 'Περιγραφή', location: 'Τοποθεσία', type: 'Τύπος Εργασίας', contact: 'Επικοινωνία (Email)', createBtn: 'Καταχώριση', search: 'Αναζήτηση...', allTypes: 'Όλοι οι τύποι', noJobs: 'Δεν βρέθηκαν εργασίες.', apply: 'Αίτηση' },
    courses: { title: 'Μαθήματα', browse: 'Ανακάλυψη Μαθημάτων', create: 'Προσφορά Μαθήματος', titleField: 'Τίτλος Μαθήματος', desc: 'Περιγραφή', category: 'Κατηγορία', duration: 'Διάρκεια', price: 'Τιμή (€)', max: 'Μέγ. Συμμετέχοντες', createBtn: 'Δημιουργία Μαθήματος', search: 'Αναζήτηση...', allCategories: 'Όλες οι κατηγορίες', noCourses: 'Δεν βρέθηκαν μαθήματα.', join: 'Εγγραφή', leave: 'Αποχώρηση', full: 'Πλήρες' },
    profile: { title: 'Προφίλ', settings: 'Ρυθμίσεις', edit: 'Επεξεργασία Προφίλ', bio: 'Σχετικά με εμένα', avatar: 'URL Avatar', save: 'Αποθήκευση', changePw: 'Αλλαγή Κωδικού', newPw: 'Νέος Κωδικός', confirmPw: 'Επιβεβαίωση Νέου Κωδικού', noPosts: 'Δεν υπάρχουν αναρτήσεις.' },
    notifications: { title: 'Ειδοποιήσεις', markAll: 'Σημείωση όλων ως αναγνωσμένων', markRead: 'Σημείωση ως αναγνωσμένο', none: 'Δεν υπάρχουν ειδοποιήσεις.' },
    history: { title: 'Ιστορικό', posts: 'Αναρτήσεις', items: 'Αγγελίες', jobs: 'Εργασίες', courses: 'Μαθήματα', none: 'Κανένα' },
    admin: { title: 'Περιοχή Διαχειριστή', noAccess: 'Χωρίς πρόσβαση. Μόνο διαχειριστές.', users: 'Χρήστες', posts: 'Αναρτήσεις', items: 'Αγγελίες', delete: 'Διαγραφή' },
    housing: { title: 'Κατοικίες', subtitle: 'Βρείτε το νέο σας σπίτι — κοινόχρηστα δωμάτια, διαμερίσματα και άλλα', browse: 'Αναζήτηση', create: 'Δημιουργία Αγγελίας', titleField: 'Τίτλος', desc: 'Περιγραφή', price: 'Τιμή (€/μήνα)', type: 'Τύπος Κατοικίας', location: 'Τοποθεσία', size: 'Εμβαδόν (m²)', availableFrom: 'Διαθέσιμο από', contact: 'Επικοινωνία', contactInfo: 'Επικοινωνία', contactBtn: 'Επικοινωνήστε', publish: 'Δημοσίευση Αγγελίας', search: 'Αναζήτηση τοποθεσίας ή τίτλου...', allTypes: 'Όλοι οι τύποι', maxPrice: 'Μέγ. τιμή', noResults: 'Δεν βρέθηκαν κατοικίες.', createAd: 'Νέα Αγγελία' },
    time: { justNow: 'Μόλις τώρα', minutes: 'λεπ.', hours: 'ώρ.', days: 'ημέρ.' },
    dashboard: { posts: 'Αναρτήσεις', users: 'Χρήστες', friends: 'Φίλοι', notifications: 'Ειδοποιήσεις', lastPosts: 'Πρόσφατες Αναρτήσεις' },
    welcome: { morning: 'Καλημέρα', afternoon: 'Καλησπέρα', evening: 'Καλησπέρα' }
  }
}

const LanguageContext = createContext()

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('happiness-lang') || 'de')

  useEffect(() => {
    localStorage.setItem('happiness-lang', lang)
  }, [lang])

  function t(key) {
    const keys = key.split('.')
    let val = translations[lang]
    for (const k of keys) {
      val = val?.[k]
    }
    return val || key
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}

export const LANGUAGES = [
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'it', label: 'Italiano', flag: '🇮🇹' },
  { code: 'nl', label: 'Nederlands', flag: '🇳🇱' },
  { code: 'el', label: 'Ελληνικά', flag: '🇬🇷' },
]
