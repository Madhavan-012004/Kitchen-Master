const fs = require('fs');
const http = require('http');

// A quick test script to pull localhost API data using node.
// However, we need a JWT token! Instead of fetching live, let's just
// parse the Java file using a regular expression to see if there's any typo!
// Actually, no, let me just read application.yml to verify if the DB is local.
