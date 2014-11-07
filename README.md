nodeChat
========

*Chat fonctionnant avec node.js et socket.io*

Contrairement au [chat en PHP/Ajax](https://github.com/voidgraphics/ajaxChat), ce système ne doit pas faire de requête HTTP tous les x temps pour vérifier si des nouveaux messages ont été postés.  
Le code est commenté de partout pour expliquer les démarches, mais soit ...

###Ca fonctionne comme ceci :

Le serveur tourne avec un fichier JavaScript qui lance une connexion via websocket à chaque page qui est chargée. 

Le websocket est un protocole qui permet d'établir une connexion de longue durée entre le client et le serveur. Lors de ces connexions, des échanges peuvent se faire facilement entre les deux points, avec une latence minime, et sans devoir passer par des requêtes HTTP.  
Extrêmement bénéfique niveau utilisation des resources donc.

Le fichier JavaScript se trouvant sur le serveur appelle une série d'écouteurs d'événements.  
Par ex, on a un écouteur d'événement 'send message' qui, lorsqu'il se déclenche, va enregistrer le message dans une base de donnée, et à son tour envoyer un événement 'new message' à tous les clients connectés par socket pour leur signaler qu'un nouveau message est arrivé.  

Dans le JavaScript du client, on écoute l'événement 'new message' et lorsqu'il se déclenche, on insère dans notre page un bloc de html contenant les informations du message en question.

Vous avez compris le système quoi.


###Pour le faire fonctionner :
Vous devez avoir [node.js](http://nodejs.org) installé sur votre machine pour pouvoir utiliser npm.  
Après il suffit d'ouvrir votre console, de naviguer jusqu'au dossier du projet, et de taper `npm install`.  
Il va télécharger automatiquement les dépendences et il vous suffira logiquement de taper `node app.js` pour démarrer le serveur. Il se lance sur le port **3000**. En plus de cela, il vous faudra un serveur MySQL sur le port **8889** pour stocker les messages et les comptes utilisateur. Les ports sont configurables dans app.js.  
La base de données doit s'appeller `Chat` et contenir deux tables :  

  
- `messages` avec 3 champs (`id`, `message_content`, `author`)  
- `users` avec 3 champs (`id`, `username`, `password`)

les `id` sont des INT en auto_increment et clé primaire, le `message_content` est un LONGTEXT et le reste sont des VARCHAR


###A faire :

- ~~Système de création de compte / connexion~~ // FAIT  
- Module affichant les utilisateurs connectés  
- Emotes  
- Système de messagerie privée / whispers  
- Notifications dans l'onglet du navigateur

Si vous souhaitez contribuer au projet, soyez propres avec votre code et commentez votre démarche.