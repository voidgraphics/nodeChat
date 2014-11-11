$(document).ready(function(){

	//  On initialise la connection à socket
	var socket = io.connect();

	//  On récupère les éléments dont on aura besoin dans le script
	var messageForm = $('#inputArea'),
	username = $('#username'),
	messageBox = $('#messageInput'),
	logoutButton = $('#logoutButton'),
	onlineUsers = $('#onlineUsers'),
	chat = $('#chat > .inner');

	//  On scrolle tout en bas de la div pour afficher le message le plus récent
	$("#chat").scrollTop($("#chat")[0].scrollHeight);

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
		socket.emit('send message', { "message" : messageBox.val(), "author" : username.val() });
		//  On remet le focus dans le textarea et on le vide
		messageBox.focus();
		messageBox.val('');
	});

	
	//  La méthode socket.on permet d'écouter un événement envoyé par le serveur. 
	//  On précise le nom de l'événement envoyé par le serveur en premier argument,
	//  et une fonction à exécuter quand l'événement se déclenche en deuxième argument.
	socket.on('new message', function(data){
		//  Ensuite on insère simplement le html formaté avec les informations provenant du serveur
		chat.append('<div class="item"><p class="Author">' + data.author + '&nbsp;:</p><p class="message">' + data.message +'</p>');

		//  On scrolle pour afficher le nouveau message si on est déjà en bas de la page. NOTE: bug, ne fonctionne plus après x messages
		var atBottom = $('#chat').scrollTop() + $('#chat').innerHeight()>=$('#chat')[0].scrollHeight;
		if(atBottom){
			$('#chat').animate({scrollTop: $('#chat > .inner').outerHeight()});
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
		logoutButton.hide();
		$('#loginButton').show(); $('#registerButton').show();
	});

	//  Ecouteur qui affiche les utilisateurs connectés chaque fois que le serveur détecte un changement
	socket.on('updateUsersList', function(data){
		var html = '';
		for(i=0; i < data.length; i++){
			html += '<li> '+ data[i] + '</li>';
		}
		onlineUsers.html(html);
	});

	//  On affiche une erreur en cas de commande érronée
	socket.on('errorCmd', function(){
		chat.append('<p class="error">Wrong info / Or command not found</p>');
	});

});

