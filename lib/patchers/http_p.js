/**
 * @module http_p
 */

var _ = require('underscore');

var contextUtils = require('../context_utils');
var Utils = require('../utils');

var logger = require('../logger');

/**
 * Wraps the http/https.request() call to automatically capture information for the segment.
 * @param {http|https} module - The built in Node.js HTTP or HTTPS module.
 * @param {boolean} downstreamXRayEnabled - when true, adds a "traced": true hint to generated subsegments such that the AWS X-Ray service expects a corresponding segment from the downstream service.
 * @alias module:http_p.captureHTTPs
 * @returns {http|https}
 */

var captureHTTPs = function captureHTTPs(module, downstreamXRayEnabled) {
  if (module.__request)
    return module;

  var tracedModule = {};

  Object.keys(module).forEach(function (val) {
    tracedModule[val] = module[val];
  });

  tracedModule.__request = tracedModule.request;

  tracedModule.request = function captureHTTPsRequest(options, callback) {
    if (!options || (options.headers && (options.headers['X-Amzn-Trace-Id'] || options.headers['X-Amz-Date']))) {
      return tracedModule.__request(options, callback);
    }

    var parent = contextUtils.resolveSegment(contextUtils.resolveManualSegmentParams(options));
    var hostname = options.hostname || options.host || 'Unknown host';

    if (!parent) {
      var output = '[ host: ' + hostname;
      output = options.method ? (output + ', method: ' + options.method) : output;
      output += ', path: ' + options.path + ' ]';

      if (!contextUtils.isAutomaticMode()) {
        logger.getLogger().info('Options for request ' + output +
          ' requires a segment object on the options params as "XRaySegment" for tracing in manual mode. Ignoring.');
      } else {
        logger.getLogger().info('Options for request ' + output +
          ' is missing the sub/segment context for automatic mode. Ignoring.');
      }

      return tracedModule.__request(options, callback);
    }

    var subsegment = parent.addNewSubsegment(hostname);
    var root = parent.segment ? parent.segment : parent;
    subsegment.namespace = 'remote';

    var req = tracedModule.__request(_.omit(options, 'Segment'), function(res) {
      res.on('end', function() {
        if (res.statusCode === 429)
          subsegment.addThrottleFlag();

        var cause = Utils.getCauseTypeFromHttpStatus(res.statusCode);

        if (cause)
          subsegment[cause] = true;

        subsegment.addRemoteRequestData(res.req, res, !!downstreamXRayEnabled);
        subsegment.close();
      });

      if (typeof callback === 'function') {
        if (contextUtils.isAutomaticMode()) {
          var session = contextUtils.getNamespace();

          session.run(function() {
            contextUtils.setSegment(subsegment);
            callback(res);
          });
        } else {
          callback(res);
        }
      }
    });

    var errorCapturer = function (e) {
      if (subsegment.http && subsegment.http.response) {
        if (Utils.getCauseTypeFromHttpStatus(subsegment.http.response.status) == 'error') {
          subsegment.addErrorFlag();
        }
        subsegment.close(e, true);
      } else {
        var madeItToDownstream = true;
        if (e.code === 'ECONNREFUSED') {
          madeItToDownstream = false;
        }
        subsegment.addRemoteRequestData(req, null, madeItToDownstream && downstreamXRayEnabled);
        subsegment.close(e);
      }

      if (req._events && req._events.error && req._events.error.length === 1) {
        req.removeListener('error', errorCapturer);
        req.emit('error', e);
      }
    };

    req.on('error', errorCapturer);

    req.setHeader('X-Amzn-Trace-Id', 'Root=' + root.trace_id + ';Parent=' + subsegment.id +
      ';Sampled=' + (!root.notTraced ? '1' : '0'));

    return req;
  };

  return tracedModule;
};

module.exports.captureHTTPs = captureHTTPs;
