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
	*	EVENTS
	*	Ecouteurs pour les événements qui sont envoyés par les clients (voir main.js, login.js, register.js). 
	*	Le client envoie un event avec des informations, le serveur traite les informations et renvoie un événement en réponse.	
	**/


	/**
	*	Un utilisateur se connecte. 
	**/
	socket.on('login', function(user){
		var username = user.username;
		var password = md5(user.password);
		//  On vérifie si les infos reçues existent dans la BDD -> l'utilisateur existe / a correctement rentré son user/pass ?
		var queryString = "SELECT * FROM users WHERE username = '" + username + "' AND password = '" + password + "';";
		connection.query(queryString, function(error, result){
			//  Si le array retourné par MySQL est vide, alors il y a un problème, on envoie un event 'wrong info' au client
			if(result.length == 0) socket.emit('wrong info');
			else { 
				//  Sinon c'est que tout va bien et on envoie un event 'logged in' au client
				socket.emit('logged in');
				io.sockets.emit('new user logged', username); // On emet un event pour ajouter un utilisateur à la liste des connectés 
				console.log(username + " has logged in to the chat");
			}
		});
	});




	/**
	*	Un utilisateur envoie un message. 
	**/
	socket.on('send message', function(data){
		//  On enregistre le message dans la BDD
		var queryString = 'INSERT INTO messages (message_content, author) VALUES ("' +  data.message +'", "' + data.author + '");';
		connection.query(queryString, function(error, results){
			//  On affiche une erreur dans la console si il y a un soucis avec la requête
			if(error) throw error;
		});
		//  On envoie un event 'new message' avec le contenu du message à TOUS les clients connectés 
		//  io.sockets.emit -> tous les clients connectés contrairement à
		//  socket.emit -> uniquement le client qui a envoyé l'event originel
		io.sockets.emit('new message', data);
		console.log(data.author + ' sent a message : ' + data.message);
	});


	/**
	*	Un utilisateur quitte la page
	**/
	socket.on('disconnect', function(){
		//  On ferme la connection à MySQL
		connection.end();
	});


	/**
	*	Un utilisateur se déconnecte
	**/
	socket.on('logout', function(user){
		//  On envoie un event 'logged out' au client
		socket.emit('logged out', user);
		io.sockets.emit('user disconnected', user);
		console.log(user + ' has logged out');
	});


	/**
	*	Un utilisateur crée un nouveau compte
	**/
	socket.on('register', function(user){
		var username = user.username;
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