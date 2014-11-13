//  On require les modules dont on a besoin
var express = require('express'),
	app = express(),
	server = require('http').createServer(app),
	io = require('socket.io').listen(server),
	mysql = require('mysql'),
	md5 = require('MD5');
//  On initialise le serveur node.js
server.listen(3000);


//  Routes ( fichiers )
app.get('/chat', function(req, res){
	res.sendFile(__dirname + '/index.html');
});
app.get('/register', function(req, res){
	res.sendFile(__dirname + '/register.html');
});

//  Routes ( dossiers )
app.use("/css", express.static(__dirname + '/css'));
app.use("/js", express.static(__dirname + '/js'));
app.use("/node_modules", express.static(__dirname + '/node_modules'));


var onlineUsers = {};

//  Quand un utilisateur charge la page ('connection' est un event prédéfini par socket.io)
io.sockets.on('connection', function(socket){

	//  Infos MySQL 
	var connection = mysql.createConnection({
		host: "127.0.0.1",
		user: "root",
		password: "root",
		database: "Chat",
		port: "8889"
	});


	/**
	*	FONCTIONS
	**/

	function offlineUser(){
		//  On retire le nom de l'utilisateur du tableau online
		delete onlineUsers[socket.username];
		//  Puis on dit à tous les clients de mettre la liste à jour 
		io.sockets.emit('updateUsersList', Object.keys(onlineUsers));
	}

	function isSetCmd(message){
		if(message.charAt(0) == "/")
			return true;
		else
			return false;
	}

	function getCmd(string){
		var ind = string.indexOf(" ");
		if(ind == -1)
			return string;
		else 
			var command = string.substr(0, ind);
		return command;
	}

	function getName(string){
		cmd = [];
		cmd = string.split(" ", 2);
		return cmd[1];
	}

	function getParam(string){
		cmd = [];
		cmd = string.split(" ", 3);
		return cmd[2];
	}

	function executeCmd(data, callback){
		var command = getCmd(data.message);
		switch(command){
			case "/w":
				private = "other";
				var name = getName(data.message);
				var message = data.message.replace(command, '').replace(name, '').trim();
				//  Si l'utilisateur ciblé est bien en ligne
				if(name in onlineUsers){
					data.message = message;
					//  On envoie un event whisper à son socket
					onlineUsers[name].emit('whisper', data);
					//  Et on envoie une confirmation de whisper au client
					data.whisperTarget = name;
					socket.emit('whisper sent', data);
					console.log("Whisper from " + socket.username + " to " + name + ": " + message);
				} 
				else callback(name + ' is not online!');
				break;
			case "/red":
				var message = data.message.replace(command, "").trim();
				data.message = "<span class='red'>"+ message + "</span>";
				break;
			case "/b":
				var message = data.message.replace(command, "").trim();
				data.message = "<span class='bold'>"+ message + "</span>";
				break;
			case "/i":
				var message = data.message.replace(command, "").trim();
				data.message = "<span class='italic'>"+ message + "</span>";
				break;
			case "/mute":
				private = "other";
				var name = getName(data.message);
				if(name in onlineUsers)
					socket.emit('mute', name);
				else
					socket.emit('mute error', name);
				break;
			case "/allow":
				private = "other";
				var name = getName(data.message);
				socket.emit('allow', name);
				break;
			case "/admin":
				//  Sert seulement à tester si on a les droits d'admin ou pas
				private = true;
				if(socket.authority >= 2){
					data.message = "Admin command successful";
				}
				else data.message = "You do not have the rights to use this command";
				break;
			case "/mod":
				//  Sert seulement à tester si on a les droits de mod ou pas
				private = true;
				if(socket.authority >= 1){
					data.message = "Moderator command successful";
				}
				else data.message = "You do not have the rights to use this command";
				break;
			case "/promote":
				private = true;
				if(socket.authority >= 2){
					var name = getName(data.message);
					var role = roleName = getParam(data.message);
					if(role == "admin")
						role = 2;
					else if(role == "mod")
						role = 1;
					else if(role == "user")
						role =  0;

					var queryString = "UPDATE users SET authority='" + role + "' WHERE username='" + name + "';";
					connection.query(queryString);
					//  On check si l'user est en ligne pour mettre directement son autorité dans son socket,
					//  Comme ça il doit pas se déco / reco pour profiter de ses nouveaux pouvoirs
					if(name in onlineUsers)
						onlineUsers[name].authority = role;
					data.message = "Promoted " + name + " to " + roleName;
				}
				else data.message = "You do not have the rights to use this command";
				break;
		}
	}

	function escapeHtml(string) {
		return string
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
	}

	//  Lorsque l'utilisateur arrive sur la page de chat, on affiche la liste des personnes connectées.
	socket.emit('updateUsersList', Object.keys(onlineUsers));

	/**
	*	EVENTS
	*	Ecouteurs pour les événements qui sont envoyés par les clients (voir main.js, login.js, register.js). 
	*	Le client envoie un event avec des informations, le serveur traite les informations et renvoie un événement en réponse.	
	**/

	/**
	*	Un utilisateur se connecte. 
	**/
	socket.on('login', function(user){
		var username = escapeHtml(user.username);
		var password = md5(user.password);
		//  On vérifie si les infos reçues existent dans la BDD -> l'utilisateur existe / a correctement rentré son user/pass ?
		var queryString = "SELECT * FROM users WHERE username = '" + username + "' AND password = '" + password + "';";
		connection.query(queryString, function(error, result){
			//  Si le array retourné par MySQL est vide, alors il y a un problème, on envoie un event 'wrong info' au client
			if(result.length == 0) socket.emit('wrong info');
			else { 
				//  Sinon c'est que tout va bien et on envoie un event 'logged in' au client
				socket.emit('logged in');
				//  On stocke le nom d'utilisateur dans le socket (utile pour la déconnexion) et son autorité (null = user, 1 = modo, 2 = admin)
				socket.username = username;
				socket.authority = result[0].authority;
				//  Puis on ajoute le nom en clé et le socket en valeur à l'objet des users connectés
				onlineUsers[socket.username] = socket;

				// 	Puis on rafraichit la liste de tous les utilisateurs.
				io.sockets.emit('updateUsersList', Object.keys(onlineUsers));
				console.log(username + " has logged in to the chat");
			}
		});
	});

	/**
	*	Un utilisateur envoie un message. 
	**/
	socket.on('send message', function(data, callback){

		private = false;

		data.message = escapeHtml(data.message);
		//  Si il y a une commande, on l'exécute
		if(isSetCmd(data.message)) executeCmd(data, callback);
			
		var queryString = 'INSERT INTO messages (message_content, author) VALUES ("' +  data.message +'", "' + data.author + '");';

		//  Si le message n'est pas privé
		if(!private){
			//  On enregistre le message dans la BDD
			connection.query(queryString, function(error, results){
				//  On affiche une erreur dans la console si il y a un soucis avec la requête
				if(error) throw error;
			});
			//  On envoie un event 'new message' avec le contenu du message à TOUS les clients connectés 
			//  io.sockets.emit -> tous les clients connectés contrairement à
			//  socket.emit -> uniquement le client qui a envoyé l'event originel
			io.sockets.emit('new message', data);
			console.log(data.author + ' sent a message : ' + data.message);
		}else if(private == true){
			connection.query(queryString, function(error, results){
				if(error) throw error;
			});
			socket.emit('new message', data);
			console.log(data.author + ' sent a message : ' + data.message);
		}
		
	});


	/**
	*	Un utilisateur quitte la page
	**/
	socket.on('disconnect', function(data){
		//  On ferme la connection à MySQL
		connection.end();
		//  Si la personne ne s'est pas login et donc n'a pas de nom d'utilisateur, on sort de la fonction
		if(!socket.username) return;
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
	socket.on('register', function(user){
		var username = escapeHtml(user.username);
		var password = md5(user.password);

		//  On check si l'utilisateur existe déjà dans la BDD
		var queryString = "SELECT * FROM users WHERE username = '" + username + "';";
		connection.query(queryString, function(error, result){
			//  Si on ne le trouve pas on l'ajoute
			if(result.length == 0){	
				queryString = 'INSERT INTO users (username, password) VALUES ("' +  username + '", "' + password + '");';
				connection.query(queryString, function(error, result){
					//  Si qq chose foire on affiche l'erreur dans la console
					if(error) throw error;
					else {
						//  Sinon on envoie un event 'account created' au client
						socket.emit('account created');
						console.log(username + " has created an account");
					}
				});
			}
			//  Sinon on renvoie une erreur
			else console.log("There is already an account called " + username + ". Please choose another one.");	   
		});
	});
});