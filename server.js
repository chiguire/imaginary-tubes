/* Setting things up. */
var path = require('path'),
    express = require('express'),
    app = express(),   
    Twit = require('twit'),
    megalodon = require('megalodon'),
    fs = require('fs'),
    CombinedStream = require('combined-stream'),
    Mastodon = megalodon.Mastodon,
    config = {
    /* Be sure to update the .env file with your API keys. See how to get them: https://botwiki.org/tutorials/how-to-create-a-twitter-app */      
      twitter: {
        consumer_key: process.env.TWITTER_CONSUMER_KEY,
        consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
        access_token: process.env.TWITTER_ACCESS_TOKEN,
        access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
        
      }
    },
    mastodon_config = {
      url: process.env.MASTODON_URL,
      client_key: process.env.MASTODON_CLIENT_KEY,
      client_secret: process.env.MASTODON_CLIENT_SECRET,
      access_token: process.env.MASTODON_ACCESS_TOKEN,
    }
    T = new Twit(config.twitter),
    post_to_twitter = true,
    M = new Mastodon(mastodon_config.url, mastodon_config.access_token),
    post_to_mastodon = true,
    metro = require('./metro.js'),
    createTracery = function (randomCall) {
      var t = require('./tracery.js');
      t.randomCall = randomCall;
      return t;
    },
    { fabric } = require('fabric'),
    { bookmark } = require('./bookmark.js'),
    MersenneTwister = require('mersenne-twister');

const bookmarkPath = './bookmark.txt';
const timeBetweenTweets = 180;

app.use(express.static('public'));

/* You can use cron-job.org, uptimerobot.com, or a similar site to hit your /BOT_ENDPOINT to wake up your app and make your Twitter bot tweet. */

function tubeImage(seed) {
  const canvas = new fabric.Canvas(
    null, 
    {
      width:1024,
      height:512,
      backgroundColor: '#ffffff'
    }
  );
  const rnd = new MersenneTwister(seed);
  const tracery = createTracery(function() { return rnd.random(); });
  var grammar = tracery.createGrammar(metro.stationNamesGrammar);
  grammar.addModifiers(tracery.baseEngModifiers);
  const gridDesc = metro.gridDescription(80, 60, 80, 80, 0, 0, canvas.width-20-120, canvas.height-20-100, 20, 5, grammar, rnd);
  //console.log(gridDesc);
  const lines = metro.tubeLines(gridDesc);
  
  //drawTetrakisGrid(canvas, gridDesc);
  metro.drawLines(canvas, lines);
  
  const pngImageB64 = canvas.toDataURL({ format: 'png' }).split(',')[1];
  const pngImage = Buffer.from(pngImageB64, 'base64');
  return { pngImage, pngImageB64 };
}

function tubeImageSansExceptions() {
  var tubeTries = 0;
  var maxTries = 10;
  var tubePassed = false;
  var seed = 0;
  var pngImage;
  var pngImageB64;
  do {
    try {
      seed = Date.now().valueOf();
      var a = tubeImage(seed);
      pngImage = a.pngImage;
      pngImageB64 = a.pngImageB64;
      tubePassed = true;
    }
    catch (e) {
      tubeTries++;
      if (tubeTries > maxTries) {
        console.log("Exceeded number of tries, letting go. :-(");
        throw e;
      } else {
        console.log("Attempt number " + tubeTries + "/" + maxTries);
      }
    }
  } while (!tubePassed);

  return { seed, pngImage, pngImageB64 };
}

app.all("/" + process.env.BOT_ENDPOINT, function (req, res) {
  var bmk = bookmark.read(bookmarkPath);
  
  var now = Date.now();
  var timeBetweenTweetsMS = timeBetweenTweets * 60 * 1000;
  if (bmk.last_tweet + timeBetweenTweetsMS > now.valueOf()) {
    console.log("Let's wait (last_tweet: "+ JSON.stringify(new Date(bmk.last_tweet).toJSON()) + ", now: " + JSON.stringify(new Date(now).toJSON()) + " bmk: "+JSON.stringify(bmk));
    res.sendStatus(200);
    return;
  }
  
  const {seed, pngImage, pngImageB64 } = tubeImageSansExceptions();

  if (post_to_twitter) {
    console.log('Posting to Twitter');
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
            console.log('Upload complete');
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
                console.log('Send tweet');
                T.post('statuses/update', 
                {
                  status: "Tube map #" + seed,
                  media_ids: [media_id],
                },
                function(err, data, response) {
                  if (err){
                    console.log('error!', err);
                    res.sendStatus(502);
                  }
                  else{
                    console.log('Tweet sent! ' + seed);
                    
                    bookmark.write(bookmarkPath, bmk);
    
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
  }

  if (post_to_mastodon) {
    console.log('Posting to Mastodon to ' + mastodon_config.url);
    console.log('Starting upload');

    var filename = 'metro-' + seed + '.png';
    fs.writeFileSync(filename,pngImage,{encoding:'binary'});
    var file = fs.createReadStream(filename);

    M.uploadMedia(file) 
      .then((imgRes /* : Response<Entity.Attachment> */) => {
        console.log("Upload complete! ID "+imgRes.data.id);
        M.postStatus("Tube map #" + seed, { media_ids: [imgRes.data.id] })
          .then((tootRes /* : Response<Entity.Status> */) => {
            console.log('Toot sent!');
            bookmark.write(bookmarkPath, bmk);
            res.sendStatus(200);
          }).catch((err) => {
            console.log("Error when sending toot.");
            console.log(err);
            res.sendStatus(500);
          });
      }).catch((err) => {
        console.log("Error when uploading media.");
        console.log(err);
        res.sendStatus(500);
      }).finally(() => {
        fs.rmSync(filename);
      });
  }
});

app.get("/gimme-an-image-please", function (req, res) {
  const seed = Date.now().valueOf();
  const { pngImage, pngImageB64 } = tubeImage(seed);
  res.set('Content-Type', 'image/png');
  res.send(Buffer.from(pngImage, 'binary'));
});

var listener = app.listen(process.env.PORT, function () {
  console.log('Your bot is running on port ' + listener.address().port);
});
