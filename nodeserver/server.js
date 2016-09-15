import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import session from 'express-session';
import passport from 'passport';
import massive from 'massive';
import path from 'path';
import AWS from 'aws-sdk';
import request from 'request';
import moment from 'moment'

var inspect = require('eyespect').inspector();
var airbnb = require('airapi');

// Configs
import serverConfig from './config.json';
import awsConfig from './AWS/config.json';

const connectionString = serverConfig.postgresPath; //database path
const app = module.exports = express();

app.use(express.static(__dirname + '/../public'));

app.use('/node_modules', express.static('./node_modules'));
var http = require('http').Server(app);
var io = require('socket.io')(http);

app.use(session({
    secret: serverConfig.sessionSecret, //session secret
    saveUninitialized: false,
    resave: true
}));

AWS.config.update({
    accessKeyId: awsConfig.aws_key, //aws config begins
    secretAccessKey: awsConfig.aws_secret,
    region: awsConfig.region
})

const s3 = new AWS.S3();

app.use(passport.initialize());
app.use(passport.session());
app.use(cors());
app.use(bodyParser.json({
    limit: '50mb'
}));
app.use(bodyParser.urlencoded({
    limit: '50mb',
    extended: true
}));

passport.serializeUser(function(user, done) {
    done(null, user);
});

passport.deserializeUser(function(user, done) {
    done(null, user);
});

app.post('/login', (req, response, next) => {

  var config = {"X-Airbnb-OAuth-Token": "ay8njrze1oalc9wgyfp26e67j"};
  var data = {
    client_id: "d306zoyjsyarp7ifhu67rjxn52tv0t20",
    currency: 'USD',
    grant_type: 'password',
    locale: "en-US",
    username: req.body.email,
    password: req.body.password
  };
  var options = {
    method: 'post',
    url: 'https://api.airbnb.com/v1/authorize',
    body: data,
    json: true,
  };

  request(options, (err, res, body) => {
    if (err) inspect(err, 'error at jsoning');
   req.session.token = body.access_token;
   console.log('req.session.token: ', req.session.token)
    var headers = res.headers
    var statusCode = res.statusCode
    inspect(headers, 'headers')
    inspect(statusCode, 'statusCode')
    inspect(body, 'body')
    console.log('response.redirect:',response.redirect);
    return response.redirect(302, '/profile/1');

  })

})

app.get('/dashboard', (req, res, next) => {

  const data2 = {
    client_id: "d306zoyjsyarp7ifhu67rjxn52tv0t20",
    currency: 'USD',
    locale: "en-US",
  }

  const options = {
    method: 'get',
    url: 'https://api.airbnb.com/v1/account/active',
    headers: {"X-Airbnb-OAuth-Token": req.session.token},
    data: data2
  }

  console.log('hit');
  request(options, (err, response, body) => {
    // console.log('Res from airbnb: ', res)

    req.session.user = body;
      res.json({body});
    })
})

app.get('/getData', (req, res, next) => {
    if (req.session.searchResults) {
        res.json(req.session.searchResults);
    } else {
      airbnb.search({
          location: 'Manila',
          checkin: '10/24/2016',
          checkout: '10/31/2016',
          guests: 2,
          page: 2,
      }).then(function(searchResults) {

        searchResults.location = 'Manila'
        searchResults.startDate = '10/24/2016'
        searchResults.endDate = '10/31/2016'
        searchResults.numGuests = 1
        // searchResults.minPrice =
        // searchResults.maxPrice =
        res.json(searchResults);
      });
    }
});

app.post('/search', (req, res, next) => {

    airbnb.search({
        location: req.body.searchVal,
        checkin: req.body.startDate,
        checkout: req.body.endDate,
        guests: req.body.numGuests,
        page: Math.round(Math.random()*10),
        room_types: req.body.room_types,
        price_min: req.body.price_min,
        price_max: req.body.price_max
    }).then(function(searchResults) {
        console.log('max price total: ', searchResults.max_price_total)
        console.log('min price total: ', searchResults.min_price_total)
        searchResults.location = req.body.searchVal
        searchResults.startDate = req.body.startDate
        searchResults.endDate = req.body.endDate
        searchResults.numGuests = req.body.numGuests

        req.session.searchResults = searchResults;

        res.json(req.session.searchResults);
    });
})


app.post('/sendMessage', (req, res, next) => {

  // THIS NEEDS TO HAVE NEW DATA
  var config = {"X-Airbnb-OAuth-Token": "ay8njrze1oalc9wgyfp26e67j"};

  var data = {
    listing_id: "14978040",
    number_of_guests: "1",
    client_id: "d306zoyjsyarp7ifhu67rjxn52tv0t20",
    currency: 'USD',
    checkout_date: "2018-04-02T22:00:00.000-0700",
    checkin_date: "2018-04-01T00:00:00.000-0700",
    locale: "en-US",
    message: "hello Paxton. this is coming from our code!!!"
  };
  var options = {
    method: 'post',
    url: 'https://api.airbnb.com/v1/threads/create',
    headers: {
      'X-Airbnb-OAuth-Token': 'ay8njrze1oalc9wgyfp26e67j'
    },
    body: data,
    json: true
  };
request(options, function(err, res, body) {
  if (err) inspect(err, 'error at jsoning');
  var headers = res.headers
  var statusCode = res.statusCode
  inspect(headers, 'headers')
  inspect(statusCode, 'statusCode')
  inspect(body, 'body')
})
})


app.get('/listingInfo', (req,res,next) => {
  //TODO NEED TO GET HOSTING_ID HERE
  airbnb.getInfo(5332664).then(function(info) {
    res.json(info);
  });
})



app.get('*', function(request, response) {
    response.sendFile(path.resolve(__dirname, '../public', 'index.html'))
});

http.listen(3000, function() {
    console.log('Hosting port: ', 3000);
});
