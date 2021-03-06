$(document).ready(function(){

	//  On initialise la connection à socket
	var socket = io.connect();

	//  On récupère les éléments dont on aura besoin dans le script
	var registerForm = $("#registerArea");
	var username = $('#registerUsername');
	var password = $('#registerPassword');
	var email = $('#registerEmail');

	function showRegisterForm(){
		registerForm.fadeIn("slow");
		$('#regoverlay').fadeIn("slow");
		username.focus();
		//  Ecouteur (trouvé sur le net ^^') qui permet de cacher le formulaire si on clique en dehors de celui-ci
		$(document).mouseup(function (e){
		   	if (!registerForm.is(e.target) //  if the target of the click isn't the container...
		        	&& registerForm.has(e.target).length === 0) //  ... nor a descendant of the container
		    	{
		        		registerForm.hide();
		        		$('#regoverlay').hide();
		    	}
		});
	}

	//  Ecouteur qui affiche le formulaire pour se connecter quand on clique sur le bouton login
	$(".button.register").click(function(){
		showRegisterForm();
	});
	$("#loginArea a").click(function(){
		$("#loginArea").hide();
		$("#overlay").hide();
		showRegisterForm();
	});

	//  Ecouteur qui affiche le formulaire pour se connecter quand on clique sur le bouton Go
	registerForm.submit(function(e){
		e.preventDefault();
		//  La méthode socket.emit envoie un événement au serveur. 
		//  On précise le nom de l'événement en premier argument, et un objet avec les infos à passer en 2e argument.
		socket.emit('register', {
			"username": username.val(),
			"password": password.val(),
			"email": email.val()
		});
	});

	//  Si tout se passe bien côté serveur, il renvoie un événement 'account created' en confirmation
	//  On prévient l'user et on le redirige (attention, on le redirige sur la route, pas sur le fichier lui-même)
	socket.on('account created', function(){
		alert("account created!");
		window.location = '/';
	});

	socket.on('account exists', function(){
		$("#registerArea .err").html('<p id="error" class="error">This account already exists</p>');
	});
});