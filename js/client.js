$(document).ready(function(){

	//  On initialise la connection à socket
	var socket = io.connect();

	//  On récupère les éléments dont on aura besoin dans le script
	var messageForm = $('#inputArea'),
	username = $('#username'),
	messageBox = $('#messageInput'),
	logoutButton = $('#logoutButton'),
	onlineUsers = $('#onlineUsers'),
	muted = [];
	chat = $('#chat > .inner');

	//  On scrolle tout en bas de la div pour afficher le message le plus récent
	$("#chat").scrollTop($("#chat")[0].scrollHeight);

	function scroll(){
		//  bug pour le moment
		//var atBottom = $('#chat').scrollTop() + $('#chat').innerHeight()>=$('#chat')[0].scrollHeight;
		//if(atBottom){
			$('#chat').animate({scrollTop: $('#chat > .inner').outerHeight()});
		//}
	}

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
		//  La méthode socket.emit envoie un événement au serveur. 
		//  On précise le nom de l'événement en premier argument, et un objet avec les infos à passer en 2e argument.
		socket.emit('send message', { "message" : messageBox.val(), "author" : username.val() }, function(data){
			//  Callback en cas d'erreur
			chat.append('<div class="item error"><p>'+ data +'</p></div>');
		});
		//  On remet le focus dans le textarea et on le vide
		messageBox.focus();
		messageBox.val('');
	});

	
	//  La méthode socket.on permet d'écouter un événement envoyé par le serveur. 
	//  On précise le nom de l'événement envoyé par le serveur en premier argument,
	//  et une fonction à exécuter quand l'événement se déclenche en deuxième argument.
	socket.on('new message', function(data){
		//  On check si l'auteur du message est dans la liste des gens bloqués, s'il ne l'est pas on affiche le message
		if(muted.indexOf(data.author) == -1){
			
			//  Le nom de l'user est en rouge pour se différencier des autres
			if(data.author == username.val() && data.author != "Anonymous"){
				data.author = '<span class="red">' + data.author + '</span>';
			}

			//  Ensuite on insère simplement le html formaté avec les informations provenant du serveur
			chat.append('<div class="item">' + data.modSpan + data.adminSpan + '<span class="Author">' 
					+ data.author + 
					'&nbsp;:</span><span class="message"> ' 
					+ data.message +
					'</span><span class="time">'+ data.date.hours +':'+ data.date.minutes +'</span></div>');

			//  On scrolle pour afficher le nouveau message si on est déjà en bas de la page. NOTE: bug, ne fonctionne plus après x messages
			scroll();
		}
	});

	//  Ecouteur sur le click du bouton logout
	logoutButton.click(function(){
		//  On envoie un event logout au serveur
		socket.emit('logout', username.val());
	})

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
				myAvatar = '<img src="http://www.gravatar.com/avatar/' + data[user].avatarHash + '?d=retro" alt="avatar" />'
				myStatus = data[user].status;
			}
		}
		onlineUsers.html(html);
		$('.logged .head .avatarArea').html(myAvatar);
		$('.logged .head .status span').html(myStatus);
		$('.online h2').html('In the chat now (' + nbOnline + ')');
	});

	socket.on('whisper', function(data){
		if(muted.indexOf(data.author) == -1){
			chat.append('<div class="item whisper"><span class="Author">From '
				+ data.author + 
				'&nbsp;:</span><span class="message"> ' 
				+ data.message +
				'</span><span class="time">' 
				+ data.date.hours +':'+ data.date.minutes +
				'</span></div>');
			scroll();
		}
	});

	socket.on('whisper sent', function(data){
		chat.append('<div class="item whisper"><span class="Author">To ' 
			+ data.whisperTarget + '&nbsp;:</span><span class="message"> ' 
			+ data.message +'</span><span class="time">' 
			+ data.date.hours +':'+ data.date.minutes +
			'</span></div>');
		scroll();
	});

	socket.on('mute', function(name){
		if(muted.indexOf(name) != -1){
			chat.append('<p class="serverMessage">' + name + ' is already muted. /allow ' + name + ' to revert.</p>');
		} else {
			muted.push(name);
			chat.append('<p class="serverMessage">' + name + ' is now muted. /allow ' + name + ' to revert.</p>');
		}
		scroll();
	});

	socket.on('show muted', function(){
		if(muted.length > 0){
			html = '<p class="serverMessage">Currently muted: ' + muted + '</p>';
		} else 
			html = '<p class="serverMessage">Nobody is muted.</p>';
		chat.append(html);	
	});

	socket.on('server message', function(message){
		chat.append('<p class="serverMessage">' + message + '</p>');
	});

	socket.on('allow', function(name){
		if(muted.indexOf(name) != -1){
			muted.splice(muted.indexOf(name), 1);
			chat.append('<p class="serverMessage">You will now see messages from ' + name + ' again.</p>');
		} else {
			chat.append('<p class="serverMessage">' + name + ' is not currently muted.</p>');
		}
		scroll();
	});

});

