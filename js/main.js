$(document).ready(function(){

	//  On initialise la connection à socket
	var socket = io.connect();

	//  On récupère les éléments dont on aura besoin dans le script
	var messageForm = $('#inputArea');
	var username = $('#username');
	var messageBox = $('#messageInput');
	var logoutButton = $('#logoutButton');
	var chat = $('#chat > .inner');
	var users = [];

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
	socket.on('logged out', function(data){
		username.val("Anonymous");
		logoutButton.hide();
		$('#loginButton').show(); $('#registerButton').show();
	});

	//	Si un utilisateur se déconnecte on le retire de la liste des connectés
	socket.on('user disconnected', function(username){
		var id = '#'+username; // On récupère l'id de l'utilisateur qui se déconnecte 
		$(id).remove(); // On le supprime de la liste
	});

	//	Si un utilisateur se connect on l'ajoute à la liste des connectés
	socket.on('new user logged', function(username){
		$('#users').append('<p class="user" id="'+ username +'">'+ username +'</p>');
	});

});

