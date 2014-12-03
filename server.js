//  On require les modules dont on a besoin
var express = require('express'),
	app = express(),
	server = require('http').createServer(app),
	io = require('socket.io').listen(server),
	mysql = require('mysql'),
	User = require("./Classes/User.js"),
	Message = require("./Classes/Message.js");
//  On initialise le serveur node.js
server.listen(3000);


//  Routes ( fichiers )
app.get('/', function(req, res){
	res.sendFile(__dirname + '/index.html');
});
app.get('/register', function(req, res){
	res.sendFile(__dirname + '/register.html');
});

//  Routes ( dossiers )
app.use("/css", express.static(__dirname + '/css'));
app.use("/js", express.static(__dirname + '/js'));
app.use("/node_modules", express.static(__dirname + '/node_modules'));

//  L'objet onlineUsers est surtout utile côté serveur, on va stocker toutes les infos sur l'user dont on à besoin, y compris le socket
var onlineUsers = {};
//  L'objet userList est beaucoup plus simple et ne contient que les users en ligne et leur statut. On envoie celui-là au client.
var userList = {};


//  Quand un utilisateur charge la page ('connection' est un event prédéfini par socket.io)
io.sockets.on('connection', function(socket){

	var user = new User(socket);

	//  Lorsque l'utilisateur arrive sur la page de chat, on affiche la liste des personnes connectées.
	updateUserList();

	//  Infos MySQL 
	var connection = mysql.createConnection({
		host: "127.0.0.1",
		user: "root",
		password: "root",
		database: "Chat", 
		port: 8889
		
	});


	socket.on('showCmds', function(){
		var list = {};
		for(cmd in cmdList){
			if(cmdList[cmd].auth <= user._authority){
				list[cmd] = cmdList[cmd].desc;
			}
		}
		socket.emit('showCmds', list);
	});


	/**
	*	FONCTIONS
	**/

	function offlineUser(){
		//  On retire le nom de l'utilisateur du tableau online
		delete onlineUsers[user._username];
		//  Puis on dit à tous les clients de mettre la liste à jour 
		updateUserList();
	}

	function updateUserList(){
		//  On vide la liste
		userList = {};
		//  Puis on ajoute les infos selon le modèle {username: blabla, status: blabla}
		for(var usr in onlineUsers){
			userList[usr] = {username: onlineUsers[usr].username, status: onlineUsers[usr].status, avatarHash: onlineUsers[usr].avatarHash };
		}
		io.sockets.emit('updateUsersList', userList);
	}

	function escapeHtml(string) {
		return string
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
	}

	
	/**
	*	EVENTS
	*	Ecouteurs pour les événements qui sont envoyés par les clients (voir main.js, login.js, register.js). 
	*	Le client envoie un event avec des informations, le serveur traite les informations et renvoie un événement en réponse.	
	**/

	/**
	*	Un utilisateur se connecte. 
	**/
	socket.on('login', function(info){

		//  On vérifie les identifiants via la méthode login de notre objet user, puis on exécute le callback avec le résultat
		user.login(info.username, info.password, connection, onlineUsers, function(user){
			//  Callback de user.login, on vérifie si on est bien connectés
			if(user._connected === true){
				//  Puis on rafraichit la liste de tous les utilisateurs.
				updateUserList();
			}
			else{
				if(user._banned === 1)
					socket.emit('banned');
				else
					socket.emit('wrong info');
			}
		});
	});

	/**
	*	Un utilisateur envoie un message. 
	**/
	socket.on('send message', function(data, callback){

		//  Par défaut, un message n'est pas privé -> Il sera visible par tout le monde.
		//  Certaines commandes peuvent spécifier private = true, 
		//  dans ce cas le message ne sera pas transmis publiquement ni enregistré dans la BDD.
		private = false;

		var message = new Message(data);

		if(message.hasCmd())
			message.executeCmd(onlineUsers, user, io, connection);

		//  Si le message n'est pas privé
		if(!private){
			//  On ajoute les détails et on l'enregistre
			message.addGodIcon(onlineUsers[message._author]);
			message.addDate();
			message.save(connection);
			message.highlightLinks();
			//  On envoie un event 'new message' avec le message en question à TOUS les clients connectés 
			//  io.sockets.emit -> tous les clients connectés contrairement à
			//  socket.emit -> uniquement le client qui a envoyé l'event originel
			io.sockets.emit('new message', message);
			console.log(message._author + ' sent a message : ' + message._content);
		}
	});


	/**
	*	Un utilisateur quitte la page
	**/
	socket.on('disconnect', function(data){
		//  On ferme la connection à MySQL
		connection.end();
		//  Si la personne ne s'est pas login, on sort de la fonction
		if(user._connected === false) return;
		//  Si on arrive jusqu'ici alors on a un username et on le retire du tableau
		offlineUser();
	});


	/**
	*	Un utilisateur se déconnecte
	**/
	socket.on('logout', function(user){
		//  On envoie un event 'logged out' au client
		socket.emit('logged out');
		offlineUser();
		console.log(user + ' has logged out');
	});


	/**
	*	Un utilisateur crée un nouveau compte
	**/
	socket.on('register', function(data){
		user.register(connection,  data);
	});


});

//  Liste de commandes disponibles sur le chat, avec description + role nécessaire pour les utiliser (0 = user, 1 = mod, 2 = admin)
var cmdList = {
	"/w"		: { desc: "Private message (whisper). Usage:  /w target message",			auth: 0 },
	"/r"		: { desc: "Reply to last whisper. Usage:  /r message",					auth: 0 },
	"/red"	: { desc: "Red text. Usage:  /red message",							auth: 0 },
	"/b"		: { desc: "Bold text. Usage:  /b message", 							auth: 0 },
	"/i"		: { desc: "Italic text. Usage:  /i message", 							auth: 0 },
	"/online"	: { desc: "Changes status to online. Usage:  /online", 					auth: 0 },
	"/busy"	: { desc: "Changes status to busy. Usage:  /busy", 						auth: 0 },
	"/away"	: { desc: "Changes status to away. Usage:  /away", 						auth: 0 },
	"/status"	: { desc: "Changes status to custom value. Usage:  /status value", 			auth: 0 },
	"/mute"	: { desc: "Blocks messages from somebody. Usage:  /mute target", 			auth: 0 },
	"/allow"	: { desc: "Cancels the effect of /mute. Usage:  /allow target", 				auth: 0 },
	"/muted"	: { desc: "Shows list of blocked users. Usage:  /muted", 					auth: 0 },
	"/slap"	: { desc: "Makes a fool of somebody. Usage:  /slap target", 				auth: 0 },
	
	"/admin"	: { desc: "Test for administrator privileges. Usage: /admin", 				auth: 2 },
	"/mod"	: { desc: "Test for moderator privileges. Usage: /mod", 					auth: 1 },
	"/promote"	: { desc: "Changes privileges for specified user. Usage:  /promote target role", 	auth: 2 },
	"/kick"	: { desc: "Kicks the target out of the chat. Usage:  /kick target", 			auth: 1 },
	"/ban"	: { desc: "Bans the target from the chat. Usage:  /ban target", 				auth: 1 },
	"/unban"	: { desc: "Allows banned user back in the chat. Usage:  /unban target", 		auth: 1 },
	"/clear"	: { desc: "Deletes every message in the chat. Usage:  /clear", 				auth: 1 }
};