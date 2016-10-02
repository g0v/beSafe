const express = require('express')
var app = express()

app.use('/*', express.static('assets'))
app.listen(3000, function () {
  console.log('3000');
});
