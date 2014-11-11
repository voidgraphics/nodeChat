$(document).ready(function(){

	//  On initialise la connection à socket
	var socket = io.connect();

	//  On récupère les éléments dont on aura besoin dans le script
	var messageForm = $('#inputArea');
	var username = $('#username');
	var password = $('#password');

	//  Ecouteur qui affiche le formulaire pour se connecter quand on clique sur le bouton Go
	messageForm.submit(function(e){
		e.preventDefault();
		//  La méthode socket.emit envoie un événement au serveur. 
		//  On précise le nom de l'événement en premier argument, et un objet avec les infos à passer en 2e argument.
		socket.emit('register', {
			"username": username.val(),
			"password": password.val()
		});
	});

	//  Si tout se passe bien côté serveur, il renvoie un événement 'account created' en confirmation
	//  On prévient l'user et on le redirige (attention, on le redirige sur la route, pas sur le fichier lui-même)
	socket.on('account created', function(){
		alert("account created!");
		window.location = '/chat';
	});
});