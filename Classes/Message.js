var mysql = require('mysql');

var method = Message.prototype;

//  Définition de la classe Message
function Message(data){
	this._author = data.author;
	this._content = escapeHtml(data.message);
}

//  Fonction qui enregistre le message dans la BDD
method.save = function(connection){
	var queryString = 'INSERT INTO messages (message_content, author, date) VALUES ("' +  this._content +'", "' + this._author + '", NOW());';
	connection.query(queryString, function(error, results){
		if(error) throw error;
	});
};

//  Fonction qui remplace les liens par des liens cliquables
method.highlightLinks = function(){
	var replacedText, replacePattern1, replacePattern2, replacePattern3;

	//URLs starting with http://, https://, or ftp://
	replacePattern1 = /(\b(https?|ftp):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gim;
	replacedText = this._content.replace(replacePattern1, '<a href="$1" target="_blank">$1</a>');

	//URLs starting with "www." (without // before it, or it'd re-link the ones done above).
	replacePattern2 = /(^|[^\/])(www\.[\S]+(\b|$))/gim;
	replacedText = replacedText.replace(replacePattern2, '$1<a href="http://$2" target="_blank">$2</a>');

	//Change email addresses to mailto:: links.
	replacePattern3 = /(\w+@[a-zA-Z_]+?(\.[a-zA-Z]{2,6})+)/gim;
	replacedText = replacedText.replace(replacePattern3, '<a href="mailto:$1">$1</a>');

	this._content = replacedText;
}

//  Fonction qui vérifie si le message est une commande
method.hasCmd = function(){
	if(this._content.charAt(0) == "/")
		return true;
	else
		return false;
};

//  Fonction qui retourne la commande du message
method.getCmd = function(){
	var ind = this._content.indexOf(" ");
	var command;
	if(ind == -1)
		return this._content;
	else 
		command = this._content.substr(0, ind);
	return command;
};

//  Fonction qui exécute la commande demandée
method.executeCmd = function(onlineUsers, user, io, connection){
	var command = this.getCmd();
	switch(command){
		case "/w":  //  Message privé. Utilisation:   /w cible message
			private = true;
			var name = this.getName();
			//  Si l'utilisateur ciblé est bien en ligne
			if(name in onlineUsers){
				this._content = this._content.replace(command, '').replace(name, '').trim();
				this.addDate();
				onlineUsers[name].lastWhisper = user._username;
				//  On envoie un event whisper à son socket
				onlineUsers[name].emit('whisper', this);
				//  Et on envoie une confirmation de whisper au client
				this.whisperTarget = name;
				onlineUsers[user._username].emit('whisper sent', this);
				console.log("Whisper from " + user._username + " to " + name + ": " + this._content);
			} 
			else 
				onlineUsers[user._username].emit('server message', name + " is not online!");
			break;

		case "/r":  //  Permet de répondre au dernier whisper reçu. Utilisation:  /r texte du message
			private = true;
			var name = onlineUsers[user._username].lastWhisper;
			if(name in onlineUsers){
				this._content = this._content.replace(command, '').trim();
				this.addDate();
				onlineUsers[name].lastWhisper = user._username;
				//  On envoie un event whisper à son socket
				onlineUsers[name].emit('whisper', this);
				//  Et on envoie une confirmation de whisper au client
				this.whisperTarget = name;
				onlineUsers[user._username].emit('whisper sent', this);
				console.log("Whisper from " + user._username + " to " + name + ": " + this._content);
			}
			break;

		case "/red":   //  Texte en rouge. Utilisation:   /red texte qui apparaîtra en rouge
			var msg = this._content.replace(command, "").trim();
			this._content = "<span class='red'>"+ msg + "</span>";
			break;

		case "/b":   //  Texte en gras. Utilisation:   /b texte qui apparaîtra en gras
			var msg = this._content.replace(command, "").trim();
			this._content = "<span class='bold'>"+ msg + "</span>";
			break;

		case "/i":   //  Texte en italique. Utilisation:  /i texte qui apparaîtra en italique
			var msg = this._content.replace(command, "").trim();
			this._content = "<span class='italic'>"+ msg + "</span>";
			break;

		case "/mute": 	//  Bloque les messages d'une personne. Utilisation:  /mute cible
			private = true;
			var name = this.getName();
			if(name in onlineUsers)
				onlineUsers[user._username].emit('mute', name);
			else
				user._socket.emit('server message', name + " is not online!");
			break;

		case "/allow": 	//  Annule les effets de /mute. Utilisation:  /allow cible
			private = true;
			var name = this.getName();
			user._socket.emit('allow', name);
			break;

		case "/muted":  //  Affiche la liste des utilisateurs bloqués par /mute. Utilisation:  /muted
			private = true;
			user._socket.emit('show muted');
			break;

		case "/admin":  //  Sert seulement à tester si on a les droits d'admin ou pas. Utilisation:  /admin
			private = true;
			var msg;
			if(user._authority >= 2){
				msg = "Admin command successful";
			}
			else  msg = "You do not have the rights to use this command";
			user._socket.emit('server message', msg);
			break;

		case "/mod":  //  Sert seulement à tester si on a les droits de modérateur ou pas. Utilisation:  /mod
			private = true;
			var msg;
			if(user._authority >= 1){
				msg = "Moderator command successful";
			}
			else msg = "You do not have the rights to use this command";
			user._socket.emit('server message', msg);
			break;

		case "/promote":  //  Change les permissions d'un utilisateur (admin, mod, user). Utilisation:  /promote cible role
			private = true;
			var msg;
			if(user._authority >= 2){
				var name = this.getName();
				var role = roleName = this.getParam();
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
				msg = "Promoted " + name + " to " + roleName;
			}
			else msg = "You do not have the rights to use this command";
			user._socket.emit('server message', msg);
			break;

		case "/away":  //  Fait passer le statut à Away. Utilisation:  /away
			private = true;
			if(user._username in onlineUsers){
				onlineUsers[user._username].status = "Away";
				updateUserList(onlineUsers, io);
				console.log(user._username + " is now away");
			}
			break;

		case "/busy":  //  Fait passer le statut à Busy. Utilisation:  /busy
			private = true;
			if(user._username in onlineUsers){	
				onlineUsers[user._username].status = "Busy";
				updateUserList(onlineUsers, io);
				console.log(user._username + " is now busy");
			}
			break;

		case "/online":  //  Fait passer le statut à Online. Utilisation:  /online
			private = true;
			if(user._username in onlineUsers){
				onlineUsers[user._username].status = "online";
				updateUserList(onlineUsers, io);
				console.log(user._username + " is now online");
			}
			break;

		case "/status":  //  Permet de spécifier un statut customisé. Utilisation :  /status statut
			private = true;
			var status = this.getName();
			if(user._username in onlineUsers){	
				if(status.length > 10)
					user._socket.emit('server message', "Your status can not be longer than 10 characters. (Yours was " + status.length +")");
				else {
					onlineUsers[user._username].status = status;
					updateUserList(onlineUsers, io);
					console.log(user._username + " is now " + status);
				}
			}
			break;
			
		case "/slap":  //  Donne une gifle à une cible. Utilisation:  /slap cible
			private = true;
			var name = this._content.replace(command, '').trim();
			var msg = this._author + " slaps " + name + " in the face with a big slippery fish!";
			io.sockets.emit('server message', msg);
			break;

		case "/kick":  //  Expulse un utilisateur du chat. Utilisation:  /kick cible
			if(user._authority >= 1){
				private = true;
				var name = this.getName();
				if(name in onlineUsers){
					onlineUsers[name].emit('kicked');
					onlineUsers[name].disconnect();
					io.sockets.emit('server message', name + ' was kicked out of the chat.');
				}
			}
			break;

		case "/ban":  //  Banni la cible. Utilisation:  /ban cible
			if(user._authority >=1){
				private = true;
				var name = this.getName();
				var queryString = 'UPDATE users SET banned=1 WHERE username="' + name + '";';
				connection.query(queryString, function(error, results){
					if(error) throw error;
				});
				if(name in onlineUsers){
					onlineUsers[name].emit('banned');
					onlineUsers[name].disconnect();
				}
				io.sockets.emit('server message', name + ' was banned from the chat.');
			}
			break;

		case "/unban":  //  Supprime un ban. Utilisation:  /unban cible
			if(user._authority >= 1){
				private = true;
				var name = this.getName();
				var queryString = 'UPDATE users SET banned=0 WHERE username="' + name + '";';
				connection.query(queryString, function(error, results){
					if(error) throw error;
				});
				io.sockets.emit('server message', name + ' was unbanned from the chat.');
			}
			break;

		case "/clear":  //  Efface tout les messages, pour tout le monde. Utilisation:  /clear
			if(user._authority >=1){
				private = true;
				io.sockets.emit('clear');
			}
			break;
	}
};

//  Fonction qui retourne le premier paramètre (nom) d'une commande. Ex: "/w Void hello" retourne Void
method.getName = function(){
	cmd = [];
	cmd = this._content.split(" ", 2);
	return cmd[1];
};

//  Fonction qui retourne le 2e paramètrre d'une commande. Ex: "/promote Void admin" retourne admin
method.getParam = function(){
	cmd = [];
	cmd = this._content.split(" ", 3);
	return cmd[2];
};

//  Fonction qui ajoute l'indicateur de mod/admin à côté de l'username
method.addGodIcon = function(loggedUser){
	var godSpan = "";
	if(loggedUser){
		if(loggedUser.authority == 1)
			godSpan = '<span class="modTag" title="Moderator">*</span>';
		if(loggedUser.authority > 1)
			godSpan = '<span class="adminTag" title="Administrator">*</span>';
	}
	this.godSpan = godSpan;
};

//  Fonction qui crée la date du message pour le client
method.addDate = function(){
	var clientDate = new Date();	
	this.date = { 
		hours: addZero(clientDate.getHours()), 
		minutes: addZero(clientDate.getMinutes())
	};
};


module.exports = Message;


/*
 *	Fonctions utiles
 */

function escapeHtml(string) {
	return string
	.replace(/&/g, "&amp;")
	.replace(/</g, "&lt;")
	.replace(/>/g, "&gt;")
	.replace(/"/g, "&quot;")
	.replace(/'/g, "&#039;");
}

function addZero(i) {
	if (i < 10) {
		i = "0" + i;
	}
	return i;
}

function updateUserList(onlineUsers, io){
	//  On vide la liste
	userList = {};
	//  Puis on ajoute les infos selon le modèle {username: blabla, status: blabla}
	for(var usr in onlineUsers){
		userList[usr] = {
			username: onlineUsers[usr].username, 
			status: onlineUsers[usr].status, 
			avatarHash: onlineUsers[usr].avatarHash
		};
	}
	io.sockets.emit('updateUsersList', userList);
}