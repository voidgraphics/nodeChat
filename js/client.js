$(document).ready(function(){

	//  On initialise la connection à socket
	var socket = io.connect();

	//  On récupère les éléments et on crée les variables dont on aura besoin dans le script
	var messageForm = $('#inputArea'),
	username = $('#username'),
	messageBox = $('#messageInput'),
	logoutButton = $('#logoutButton'),
	onlineUsers = $('#onlineUsers'),
	cmdButton = $('#showCmdButton'),
	muted = [];
	chat = $('#chat > .inner'),
	atBottom = true,
	nbNotifs = 0,
	antispamBefore = Date.parse(new Date());


	/*
	 *	Ecouteurs d'événement
	 */

	//  Ecouteur qui permet de soumettre le formulaire quand on appuie sur Enter alors qu'on se trouve dans un textarea
	messageBox.keypress(function(e){
		if(e.which == 13){
			messageForm.submit();
			return false;
		}
	});

	//  Ecouteur qui envoie le message lorsque le formulaire est soumis (soit en cliquant sur Send soit en appuyant sur Enter)
	messageForm.submit(function(e){
		e.preventDefault();

		var antispam = new Date();
		antispam = Date.parse(antispam);
		if(antispam > antispamBefore + 1000){
			//  La méthode socket.emit envoie un événement au serveur. 
			//  On précise le nom de l'événement en premier argument, et un objet avec les infos à passer en 2e argument.
			socket.emit('send message', { "message" : messageBox.val(), "author" : username.val() }, function(data){
				//  Callback en cas d'erreur
				chat.append('<div class="item error"><p>'+ data +'</p></div>');
			});
			//  On remet le focus dans le textarea et on le vide
			messageBox.focus();
			messageBox.val('');
		}
		else {
			checkScroll();
			chat.append('<p class="serverMessage"><span class="red" title="Message from the server">»&nbsp;</span>Slow down!</p>');
			scroll(atBottom);
		}
		antispamBefore = antispam;
	});

	//  Ecouteur qui supprime les notifs de l'onglet quand on ouvre l'onglet (si on est scrollé tout en bas)
	$(window).on('focus', function(){
		checkScroll();
		if(atBottom === true)
			removeNotification();
	});
	
	//  Ecouteur qui dit au serveur d'afficher la liste de commandes au click sur le lien dans la sidebar
	cmdButton.on('click', function(){
		socket.emit('showCmds');
	});


	//  La méthode socket.on permet d'écouter un événement envoyé par le serveur. 
	//  On précise le nom de l'événement envoyé par le serveur en premier argument,
	//  et une fonction à exécuter quand l'événement se déclenche en deuxième argument.
	socket.on('new message', function(message){
		//  On check si l'auteur du message est dans la liste des gens bloqués, s'il ne l'est pas on affiche le message
		if(muted.indexOf(message._author) == -1){
			
			//  Le nom de l'user est en rouge pour se différencier des autres
			if(message._author == username.val() && message._author != "Anonymous"){
				message._author = '<span class="red">' + message._author + '</span>';
			}

			checkScroll();

			if(atBottom === false || document.hidden === true)
				addNotification();
			else
				removeNotification();

			//  Ensuite on insère simplement le html formaté avec les informations provenant du serveur
			chat.append('<div class="item">' + message.godSpan + '<span class="Author">' + 
					message._author + 
					'&nbsp;:</span><span class="message"> ' + 
					message._content +
					'</span><span class="time">'+ message.date.hours +':'+ message.date.minutes +'</span></div>');

			//  On scrolle pour afficher le nouveau message si on est déjà en bas de la page. NOTE: bug, ne fonctionne plus après x messages
			scroll(atBottom);
		}
	});

	//  Ecouteur sur le click du bouton logout
	logoutButton.click(function(){
		//  On envoie un event logout au serveur
		socket.emit('logout', username.val());
	});

	//  Ecouteur qui supprime la valeur du champ caché quand le serveur répond avec la confirmation 'logged out'
	socket.on('logged out', function(){
		username.val("Anonymous");
		$('.logged').hide();
		$('.anon').show();
		$('#loginButton').show(); $('#registerButton').show();
	});

	//  Ecouteur qui affiche les utilisateurs connectés chaque fois que le serveur détecte un changement
	socket.on('updateUsersList', function(data){
		var html = '';
		var nbOnline = 0;
		var myStatus, myAvatar;
		for(var user in data){
			nbOnline++;
			var avatar = '<img src="http://www.gravatar.com/avatar/' + data[user].avatarHash + '?d=retro" alt="avatar" />';
			var status = data[user].status=="online"?"":' <span class="status">(' + data[user].status + ')</span>';
			html += '<li> ' + avatar + data[user].username + status + '</li>';
			if(data[user].username == username.val()){
				myAvatar = '<img src="http://www.gravatar.com/avatar/' + data[user].avatarHash + '?d=retro" alt="avatar" />';
				myStatus = data[user].status;
			}
		}
		onlineUsers.html(html);
		$('.logged .head .avatarArea').html(myAvatar);
		$('.logged .head .status span').html(myStatus);
		$('.online h2').html('In the chat now (' + nbOnline + ')');
	});

	//  Ecouteur qui affiche un whisper reçu
	socket.on('whisper', function(message){
		if(muted.indexOf(message._author) == -1){
			checkScroll();
			chat.append('<div class="item whisper"><span class="Author">From ' + 
				message._author + 
				'&nbsp;:</span><span class="message"> ' + 
				message._content +
				'</span><span class="time">' + 
				message.date.hours +':'+ message.date.minutes +
				'</span></div>');
			scroll(atBottom);
		}
	});

	//  Ecouteur qui affiche un whisper envoyé
	socket.on('whisper sent', function(message){
		checkScroll();
		chat.append('<div class="item whisper"><span class="Author">To ' + 
			message.whisperTarget + '&nbsp;:</span><span class="message"> ' + 
			message._content +'</span><span class="time">' + 
			message.date.hours +':'+ message.date.minutes +
			'</span></div>');
		scroll(atBottom);
	});

	//  Ecouteur qui bloque un utilisateur (commande /mute)
	socket.on('mute', function(name){
		checkScroll();
		if(muted.indexOf(name) != -1){
			chat.append('<p class="serverMessage"><span class="red" title="Message from the server">»&nbsp;</span>' + name + ' is already muted. /allow ' + name + ' to revert.</p>');
		} else {
			muted.push(name);
			chat.append('<p class="serverMessage"><span class="red" title="Message from the server">»&nbsp;</span>' + name + ' is now muted. /allow ' + name + ' to revert.</p>');
		}
		scroll(atBottom);
	});

	//  Ecouteur qui retire le mute sur un utilisateur (commande /allow)
	socket.on('allow', function(name){
		checkScroll();
		if(muted.indexOf(name) != -1){
			muted.splice(muted.indexOf(name), 1);
			chat.append('<p class="serverMessage"><span class="red" title="Message from the server">»&nbsp;</span>You will now see messages from ' + name + ' again.</p>');
		} else {
			chat.append('<p class="serverMessage"><span class="red" title="Message from the server">»&nbsp;</span>' + name + ' is not currently muted.</p>');
		}
		scroll(atBottom);
	});

	//  Ecouteur qui affiche la liste des utilisateurs bloqués (commande /muted)
	socket.on('show muted', function(){
		checkScroll();
		if(muted.length > 0){
			html = '<p class="serverMessage"><span class="red" title="Message from the server">»&nbsp;</span>Currently muted: ' + muted + '</p>';
		} else 
			html = '<p class="serverMessage"><span class="red" title="Message from the server">»&nbsp;</span>Nobody is muted.</p>';
		chat.append(html);
		scroll(atBottom);
	});

	//  Ecouteur qui affiche un message envoyé par le serveur
	socket.on('server message', function(message){
		checkScroll();
		chat.append('<p class="serverMessage"><span class="red" title="Message from the server">»&nbsp;</span>' + message + '</p>');
		scroll(atBottom);
	});

	//  Ecouteur qui prévient l'utilisateur lorsqu'il a été kické du chat
	socket.on('kicked', function(){
		$('#alertoverlay').fadeIn('slow');
		$('#alert').html('You have been kicked out of the chat.');
		$('#alert').fadeIn('slow');
	});

	//  Ecouteur qui prévient l'utilisateur lorsqu'il a été banni du chat
	socket.on('banned', function(){
		$('#loginArea').hide();
		$('#overlay').hide();
		$('#alertoverlay').fadeIn('slow');
		$('#alert').html('Your account was banned from the chat.');
		$('#alert').fadeIn('slow');
	});

	//  Ecouteur qui affiche la liste des commandes disponibles quand on clique sur le lien dans la sidebar
	socket.on('showCmds', function(list){
		chat.append('<p class="serverMessage"><span class="red" title="Message from the server">»&nbsp;</span>List of commands you can use :</p>')
		for(cmd in list){
			checkScroll();
			chat.append('<p class="serverMessage"><span class="red" title="Message from the server">»&nbsp;</span>' + cmd + ' : <span class="cmdDesc">' + list[cmd] + '</span></p>');
			scroll(atBottom);
		}
	});

	// Ecouteur qui réinitialise le chat (commande /clear)
	socket.on('clear', function(){
		chat.html('<p class="serverMessage"><span class="red" title="Message from the server">»&nbsp;</span>Chat cleared!</p>')
	});


	/*
	 *	Fonctions utiles
	 */

	function checkScroll(){
		$('#inner').bind('scroll', function() {
		    	if($(this).scrollTop() + $(this).innerHeight() >= this.scrollHeight)
		    		atBottom = true;
		    	else
		    		atBottom = false;
		});
	}

	function addNotification(){
		nbNotifs++;
		$('head title').html('Chat (' + nbNotifs + ')');
	}

	function removeNotification(){
		nbNotifs = 0;
		$('head title').html('Chat');
	}

	function scroll(atBottom){
		if(atBottom === true){
			var chat_div = document.getElementById('inner');
			chat_div.scrollTop = chat_div.scrollHeight;
		}
	}
});