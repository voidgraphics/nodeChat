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

	var user = new User();

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
		user.login(info.username, info.password, connection, function(user){
			//  Callback de user.login, on vérifie si on est bien connectés
			if(user._connected === true){
				socket.emit('logged in');
				//  Puis on ajoute le nom en clé et le socket en valeur à l'objet des users connectés
				onlineUsers[user._username] = socket;
				onlineUsers[user._username].username = user._username;
				onlineUsers[user._username].status = "online";
				onlineUsers[user._username].authority = user._authority;
				onlineUsers[user._username].avatarHash = user._avatarHash;
				socket.broadcast.emit('server message', user._username + " has joined the chat.");  
				//  Puis on rafraichit la liste de tous les utilisateurs.
				updateUserList();
				console.log(user._username + " has logged in to the chat");
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

		private = false;
		var message = new Message(data);
		if(message.isSetCmd()){
			message.executeCmd(onlineUsers, user, io, connection);
		}

		//  Si le message n'est pas privé
		if(!private){
			//  On ajoute les détails et on l'enregistre
			message.addGodIcon(onlineUsers[message._author]);
			message.addDate();
			message.save(connection);

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
		if(!user._connected) return;
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
		user.register(connection, socket, data);
	});
});