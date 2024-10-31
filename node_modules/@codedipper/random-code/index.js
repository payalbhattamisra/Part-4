module.exports = function(n, ch){
	var c = "";

	if (n == "0" || n == null || !n) n = 10;
	if (!ch) ch = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-";
	for (var i = 0; i < parseInt(n); i++){
		c += ch.split("")[Math.floor(Math.random() * ch.length)];
	}

	return c;
};
