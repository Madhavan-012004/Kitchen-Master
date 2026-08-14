const http = require('http');

const putData = JSON.stringify({
    requireKotBeforeBilling: false
});

// We need a token from sessionStorage, but we can just use the DB to spoof it,
// OR we can just try to log in and fetch. But we don't know the password...
// Wait, can we just ask the user to show the Network tab response?
// Yes! 
