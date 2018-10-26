const fs = require('fs');

var bmk = {};

bmk.read = function (counterPath) {
 
  try {
    var bmk = JSON.parse(
      fs.readFileSync(counterPath)
    );
  }
  catch (e) {
    // No file, everything's fine
    return {
      last_tweet: null,
    };
  }

  return bmk;
};

bmk.write = function (counterPath, bmk) {
    bmk = Object.assign(bmk, { last_tweet: Date.now().valueOf() });
    fs.writeFileSync(counterPath, JSON.stringify(bmk));
}

exports.bookmark = bmk;