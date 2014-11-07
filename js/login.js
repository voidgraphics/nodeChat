$(document).ready(function(){

	//  On initialise la connection à socket
	var socket = io.connect();

	//  On récupère les éléments dont on aura besoin dans le script
	var loginForm = $('#loginArea');
	var username = $('#loginUsername');
	var password = $('#password');
	var loginButton = $('#loginButton');
	var registerButton = $('#registerButton');
	var logoutButton = $('#logoutButton');
	var error = 0;
	
	//  Ecouteur qui affiche le formulaire pour se connecter quand on clique sur le bouton login
	$("#loginButton").click(function(){
		loginForm.fadeIn("slow");
		//  Ecouteur (trouvé sur le net ^^') qui permet de cacher le formulaire si on clique en dehors de celui-ci
		$(document).mouseup(function (e){
		   	if (!loginForm.is(e.target) //  if the target of the click isn't the container...
		        	&& loginForm.has(e.target).length === 0) //  ... nor a descendant of the container
		    	{
		        		loginForm.hide();
		    	}
		});
	});

	//  Ecouteur qui envoie les infos de connexion au serveur quand on soumet le formulaire
	loginForm.submit(function(e){
		e.preventDefault();
		
		//  On envoie un événement login avec les infos. NOTE : Il faut trouver un moyen de hasher le password en md5 avant de l'envoyer.
		//  Le serveur va répondre (voir app.js) en envoyant un événement à son tour.
		socket.emit('login', {
			"username": username.val(),
			"password": password.val()
		})

		//  Si les infos sont correctes, le serveur envoie un event 'logged in'. 
		//  On retire les erreurs si il y en a, puis on cache le formulaire, on met le nom de l'auteur dans le champ caché et on change les boutons
		socket.on('logged in', function(){
			if(error == 1) $('#error').remove();
			error = 0;
			loginForm.fadeOut("slow");
			$('#username').val(username.val());
			loginButton.hide(); registerButton.hide();
			logoutButton.show();
		});

		//  Sinon on affiche une erreur
		socket.on('wrong info', function(){
			loginForm.append('<p id="error" class="error">Wrong username / password</p>');
			error = 1;
		});
	});
});