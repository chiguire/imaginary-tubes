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
    createTracery = function (randomCall) {
      var t = require('./tracery.js');
      t.randomCall = randomCall;
      return t;
    },
    { fabric } = require('fabric'),
    atob = require('atob'),
    { bookmark } = require('./bookmark.js'),
    MersenneTwister = require('mersenne-twister');

const bookmarkPath = './bookmark.txt';
const timeBetweenTweets = 60;

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
  const seed = Date.now().valueOf();
  const rnd = new MersenneTwister(seed);
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
  return { pngImage, pngImageB64 };
}

app.all("/" + process.env.BOT_ENDPOINT, function (req, res) {
  var bmk = bookmark.leer(bookmarkPath);
  
  var now = Date.now();
  var timeBetweenTweetsMS = timeBetweenTweets * 60 * 1000;
  if (bmk.fecha_ultimo_tuit + timeBetweenTweetsMS > now.valueOf()) {
    console.log("Let's wait (last_tweet: "+ JSON.stringify(new Date(bmk.last_tweet).toJSON()) + ", now: " + JSON.stringify(new Date(now).toJSON()) + " bmk: "+JSON.stringify(bmk));
    res.sendStatus(200);
    return;
  }
  
  const { pngImage, pngImageB64 } = tubeImage();
  var media_id = 0;
	console.log('Starting upload');
  T.post('media/upload',
    {
      command: 'INIT',
      total_bytes: pngImage.length,
      media_type: 'image/png'
    },
    function (err, data, response) {
      if (err) {
				console.log(err);
				res.sendStatus(502);
				return;
			}
			media_id = data.media_id_string;
      console.log('Sending ' + pngImage.length + ' bytes to media_id ' + media_id);
			T.post('media/upload',
				{
					command: 'APPEND',
					media_id: media_id,
					media_data: pngImageB64,
					segment_index: 0
				},
				function (err, data, response) {
					if (err) {
						console.log(err);
						res.sendStatus(502);
						return;
					}
					console.log('Finalizando envío');
					T.post('media/upload',
						{
							command: 'FINALIZE',
							media_id: media_id
						},
						function (err, data, response) {
							if (err) {
								console.log(err);
								res.sendStatus(502);
								return;
							}
							console.log('Enviando tuit');
							T.post('statuses/update', 
							Object.assign({
								  status: parte.status,
								  media_ids: [media_id],
                  lat: 10.505314,
                  long: -66.915711,
                  display_coordinates: true,
							  }, 
                (ml.respuesta === null?
                  {}:
                  {
                    in_reply_to_status_id: ml.respuesta,
                  }
                )
              ),
							function(err, data, response) {
								if (err){
									console.log('error!', err);
									res.sendStatus(502);
								}
								else{
									console.log('Enviado tuit ' + JSON.stringify(parte) + ' correctamente');
                  
                  ml.tuit += 1;
                  ml.respuesta = data.id_str;
                  marcalibro.escribir(marcalibroPath, ml);
  
									res.sendStatus(200);
								}
							}
						);
						}
					);
				}
			);
    }
  );
});

app.get("/gimme-an-image-please", function (req, res) {
  const { pngImage, pngImageB64 } = tubeImage();
  res.set('Content-Type', 'image/png');
  res.send(Buffer.from(pngImage, 'binary'));
});

var listener = app.listen(process.env.PORT, function () {
  console.log('Your bot is running on port ' + listener.address().port);
});
