const fs = require('fs');
const express = require('express');
const bodyParser = require('body-parser');
const moment = require('moment');

const parser = require('./parser/parser');

const port = process.env.PORT || 4000;

var app = express();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});
app.use(express.static(__dirname + '/public'));
app.use((req, res, next) => {
  var now = moment().format('DD/MM/YYYY HH:mm');

  var log = `${now}: ${req.method} ${req.url}`;
  console.log(log);
  next();
});

app.post('/items', function(req, res) {
    console.log(req.body);
    console.time('parsing');
    parser.getItems(req.body.links)
      .then(items => {
        console.timeEnd('parsing');
        res.send(items);
      })
      .catch(err => {
        console.log(err);
      });
});


app.listen(port, () => {
  console.log(`Server is up on port ${port}`);
});
