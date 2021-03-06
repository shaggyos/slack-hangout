var express = require('express');
var logfmt = require('logfmt');
var app = express();
var moment = require('moment');
var google = require('googleapis');
var calendar = google.calendar('v3');
var OAuth2 = google.auth.OAuth2;
var Slack = require('slack-node');

var oauth2Client = oauth2Client = new OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URL
);

var googleToken = process.env.GOOGLE_TOKEN;
var slack = new Slack(process.env.SLACK_API_TOKEN);

app.use(logfmt.requestLogger());

// Authentication request folder
app.get('/auth', function(req, res){
  var url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: 'https://www.googleapis.com/auth/calendar'
  });
  res.redirect(url);
});

// Authentication response from Google authentication API
app.get('/oauth2callback', function(req, res) {
  oauth2Client.getToken(req.query["code"], function(err, token) {
    if (err) {
      console.log("Error: " + err);
      //res.send(500, "Error getting token.");
	  res.status(500).send("Error getting token.");
      return;
    }

    console.log('Received token: ', token);

    if (typeof(token.refresh_token) != 'undefined') {
      oauth2Client.credentials = {
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        token_type: 'Bearer'
      };
      oauth2Client.refreshAccessToken(function(err, tokens) {
        if (!err) {
          console.log('Error: ', err);
          // res.send(500, err);
		  res.status(500).send(err);
        } else {
          console.log('Refreshed tokens: ', tokens);
          res.send(tokens);
        }
      });
    } else {
      res.send(token);
    }
  });
});

// Slack command interface.  Responds to /hangout only with a defined username.
app.get('/', function(req, res) {
  if ((req.query.command == '/hangout') && (typeof(req.query.user_name) != 'undefined')) {
    oauth2Client.credentials = {
      access_token: googleToken,
      token_type: 'Bearer'
    };
    var now = moment().format();

    calendar
      .events
      .insert({
        calendarId: 'primary',
        resource: {
          summary: req.query.user_name + '\'s hangout',
          description: 'Hangout started from Slack',
          reminders: {
            overrides: {
              method: 'popup',
              minutes: 0
            }
          },
          start: {
            dateTime: now
          },
          end: {
            dateTime: now
          },
          attendees: []
        },
        auth: oauth2Client
      }, function(err, event) {
        if (event != null) {
          slack.api('chat.postMessage', {
            channel: req.query.channel_id,
            text: req.query.user_name + ' invites to Hangout: <' + event.hangoutLink + '>',
            username: 'Slack Hangout'
          }, function(err, response) {
            if (err != null) {
              console.log('Error while posting to Slack: ' + err);
              //res.send(500, err);
			  res.status(500).send(err);
            } else {
              res.send();
            }
          });
        } else {
          // res.send(500, err);
		  res.status(500).send(err);
        }
      });
  } else {
    res.send(400, 'Invalid parameters');
	res.status(400).send('Invalid parameters');
  }
});

var port = Number(process.env.PORT || 5000);
app.listen(port, function() {
  console.log('Listening on ' + port);
});
