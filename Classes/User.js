var 	mysql = require('mysql'),
	md5 = require('MD5');

var method = User.prototype;

//  Définition de la classe User
function User(){
	this._username = "Anonymous";
	this._authority = 0;
	this._connected = false;
}

//  Fonction qui permet de se connecter
method.login = function(user, pass, connection, callback){
	var username = escapeHtml(user);
	var password = md5(pass);
	//  On sauve la valeur de this pour pouvoir l'utiliser dans le callback de connection.query (sinon this représente la fonction callback au lieu de l'instance de User)
	var that = this;
	var queryString = "SELECT * FROM users WHERE username = '" + username + "' AND password = '" + password + "';";
	connection.query(queryString, function(error, result){
		//  Si le tableau retourné par MySQL est vide, alors il y a un problème, on envoie un event 'wrong info' au client
		if(result.length === 0) that._connected = false;
		else { 
			if(result[0].banned === 1){
				that._connected = false;
				that._banned = 1;
			}
			else{
			that._connected = true;
			that._username = username;
			that._authority = result[0].authority;
			that._avatarHash = result[0].avatarHash;
				
			}
		}
		callback(that);
	});
};

method.register = function(connection, socket, data){
	var username = escapeHtml(data.username);
	var password = md5(data.password);
	var email = escapeHtml(data.email.trim());
	var avatarHash = md5(email.toLowerCase());

	//  On check si l'utilisateur existe déjà dans la BDD
	var queryString = "SELECT * FROM users WHERE username = '" + username + "';";
	connection.query(queryString, function(error, result){
		//  Si on ne le trouve pas on l'ajoute
		if(result.length === 0){	
			queryString = 'INSERT INTO users (username, password, email, avatarHash) VALUES ("' +  username + '", "' + password + '", "' + email + '",  "' + avatarHash + '");';
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
		else socket.emit('account exists');
	}); 
};

module.exports = User;


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