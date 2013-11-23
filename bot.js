/*
* @QuoteGen (https://twitter.com/quotegen)
* This bot will grab a random, recent tweet that has been posted and turn it into a quote for a current news topic.
* 
* Creator: Eli Cooper
* 
* My objective was to change the context of these tweets by giving them a different presenter. It makes us think
* more about the meaning of the words if they are attributed to someone or something we wouldn't expect. This
* can result in silly, senseless, rude, or any number of seemingly circumstantial combinations which evoke 
* reactions that the original tweet may not have.
*/

// DEBUG -- if true, won't post to Twitter
var debug = false;

// HTTP request
var request = require('request');

// Perform promises
var _ = require('underscore.deferred');

// Used to parse HTML
var cheerio = require('cheerio');

// Twitter stuff
var Twit = require('twit');
var T = new Twit(require('./config.js'));
var tweets = [];

// Helper functions for arrays, picks a random thing
Array.prototype.pick = function() {
	return this[Math.floor(Math.random()*this.length)];
};
Array.prototype.pickRemove = function() {
  var index = Math.floor(Math.random()*this.length);
  return this.splice(index,1)[0];
};

// Get a sample of 100 tweets
function getTweets() {
	var dfd = _.Deferred();
	var stream = T.stream('statuses/sample', { language: 'en' });

	stream.on('tweet', function (tweet) {
		tweets.push(tweet);
		if (tweets.length >= 100) {
			stream.stop();
			dfd.resolve(tweets);
		}
	});

	return dfd.promise();
}

// Grab the news topics from Google News
function getTopics(category) {
	var topics = [];
	var dfd = new _.Deferred();
	request('http://news.google.com/news/section?ned=us&topic=' + category, function(err, response, body) {
		if (!err && response.statusCode === 200) {
			var $ = cheerio.load(body);
			$('.topic').each(function() {
				var topic = this.text();
				topics.push(topic);
			});
			dfd.resolve(topics);
		}
		else {
			dfd.reject();
		}
	});

	return dfd.promise();
}

//Post to Twitter
function tweet() {
	var tweetText = "\"" + quote + "\"" + " - " + topic;
	
	if (debug) 
		console.log(tweetText);
	else
		T.post('statuses/update', {status: tweetText }, function(err, reply) {
			if (err !== null) {
				console.log('Error: ', err);
			}
			else {
				console.log('Tweeted: ', tweetText);
			}
		});
}

// Give a mentioner their own quote
function respondToMention() {
	T.get('statuses/mentions_timeline', { count:100, include_rts:0 },  function (err, reply) {
		  if (err !== null) {
			console.log('Error: ', err);
		  }
		  else if (reply.length === 0) {
		  	console.log("No mentions!");
		  }
		  else {
		  	mention = reply.pick();
		  	mentionId = mention.id_str;
		  	mentioner = '@' + mention.user.screen_name;

		  	var tweet = quote + " - " + mentioner;
		  	
			if (debug) 
				console.log(tweet);
			else
				T.post('statuses/update', {status: tweet, in_reply_to_status_id: mentionId }, function(err, reply) {
					if (err !== null) {
						console.log('Error: ', err);
					}
					else {
						console.log('Tweeted: ', tweet);
					}
				});
		  }
	});
}

// Follow a mentioner
function followAMentioner() {
	T.get('statuses/mentions_timeline', { count:50, include_rts:1 },  function (err, reply) {
		  if (err !== null) {
			console.log('Error: ', err);
		  }
		  else if (reply.length === 0) {
		  	console.log("No mentions!");
		  }
		  else {
		  	var sn = reply.pick().user.screen_name;
			if (debug) 
				console.log(sn);
			else {
				//Now follow that user
				T.post('friendships/create', {screen_name: sn }, function (err, reply) {
					if (err !== null) {
						console.log('Error: ', err);
					}
					else {
						console.log('Followed: ' + sn);
					}
				});
			}
		}
	});
}

// Perform everything
function run() {
	getTweets().then(function(tweets) {
		var status = tweets.pickRemove();
		if (typeof status.entities.media !== 'undefined') {
			media = 1;
		}
		else {
			media = 0;
		}
		var stEntities = status.entities.hashtags.length + status.entities.urls.length + status.entities.user_mentions.length + media;

		while(stEntities !== 0 || status.text.length > 100) {
			status = tweets.pickRemove();
			if (typeof status.entities.media !== 'undefined') {
				media = 1;
			}
			else {
				media = 0;
			}
			stEntities = status.entities.hashtags.length + status.entities.urls.length + status.entities.user_mentions.length + media;
		}

		quote = status.text;

		console.log("Quote: " + quote);

		var categoryCodes = ['w', 'n', 'b', 'tc', 'e', 's'];
		getTopics(categoryCodes.pickRemove()).then(function(topics) {
			topic = topics.pickRemove();
			while (topic.length > 40) {
				topic = topics.pickRemove();
			}
			console.log("Topic: " + topic);

			var rand = Math.random();

			if (rand <= 0.80) {
				console.log("Tweeting.......................");
				tweet();
			}
			else if (rand <= 0.90) {
				console.log("Tweeting @someone ..............");
				respondToMention();
			}
			else {
				console.log("Following someone ...............");
				followAMentioner();
			}

		});
	});
}

// Run the bot
run();

// Run the bot every 60 minutes
setInterval(function() {
	try {
		run();
	}
	catch(e) {
		console.log(e);
	}
}, 1000 * 60 * 60);