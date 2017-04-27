var _ = require('underscore');
var http = require('http');

var logger = require('../../logger');

var Plugin = {
  getPluginMetadata: function (options, callback) {
    var METADATA_TIMEOUT = 1000;
    var METADATA_RETRY_TIMEOUT = 250;
    var METADATA_RETRIES = 20;

    var retries = METADATA_RETRIES;

    var getMetadata = function() {
      var req = http.request(options, function(res) {
        var body = '';

        res.on('data', function(chunk) {
          body += chunk;
        });
        res.on('end', function() {
          if (_.contains([200, 300], this.statusCode)) {
            body = JSON.parse(body);
            callback(body);
          } else if (retries > 0 && (_.contains([400], this.statusCode)) ){
            retries--;
            setTimeout(getMetadata, METADATA_RETRY_TIMEOUT);
          } else { callback(); }
        });
      }).on('error', function(err) {
        logger.getLogger().error('Error loading plugin: ', err);
        callback();
      });

      req.on('socket', function (socket) {
        socket.on('timeout', function() {
          req.abort();
        });
        socket.setTimeout(METADATA_TIMEOUT);
      });

      req.end();
    };

    getMetadata();
  }
};

module.exports = Plugin;
