/* Setting things up. */
var path = require('path'),
    express = require('express'),
    app = express(),   
    Twit = require('twit'),
    config = {
    /* Be sure to update the .env file with your API keys. See how to get them: https://botwiki.org/tutorials/how-to-create-a-twitter-app */      
      twitter: {
        consumer_key: process.env.CONSUMER_KEY,
        consumer_secret: process.env.CONSUMER_SECRET,
        access_token: process.env.ACCESS_TOKEN,
        access_token_secret: process.env.ACCESS_TOKEN_SECRET
      }
    },
    T = new Twit(config.twitter),
    metro = require('./metro.js'),
    tracery = require('./tracery.js'),
    { fabric } = require('fabric'),
    MersenneTwister = require('mersenne-twister');

app.use(express.static('public'));

/* You can use cron-job.org, uptimerobot.com, or a similar site to hit your /BOT_ENDPOINT to wake up your app and make your Twitter bot tweet. */

function tubeImage() {
  const canvas = new fabric.Canvas(
    null, 
    {
      width:1024,
      height:512,
      backgroundColor: '#ffffff'
    }
  );
  const tracery = createTracery(function() { return rnd.random(); });
  var grammar = tracery.createGrammar(metro.stationNamesGrammar);
  grammar.addModifiers(tracery.baseEngModifiers);
  
  const gridDesc = metro.gridDescription(80, 60, 80, 80, 0, 0, canvas.width-20-120, canvas.height-20-100, 20, 5, grammar, rnd);
  //console.log(gridDesc);
  const lines = metro.tubeLines(gridDesc);
  
  //drawTetrakisGrid(canvas, gridDesc);
  metro.drawLines(canvas, lines);
  
  const pngImageB64 = canvas.toDataURL({ format: 'png' });
  const pngImage = atob(pngImageB64.split(',')[1]);
  return pngImage;
}

app.all("/" + process.env.BOT_ENDPOINT, function (req, res) {
  const pngImage = tubeImage();
  T.post('statuses/update', { status: 'hello world 👋' }, function(err, data, response) {
    if (err){
      console.log('error!', err);
      res.sendStatus(500);
    }
    else{
      res.sendStatus(200);
    }
  });
});

app.get("/gimme-an-image-please", function (req, res) {
  const pngImage = tubeImage();
  res.set('Content-Type', 'image/png');
  res.send(new Buffer(pngImage));
});

var listener = app.listen(process.env.PORT, function () {
  console.log('Your bot is running on port ' + listener.address().port);
});
