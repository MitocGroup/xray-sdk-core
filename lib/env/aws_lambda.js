var fs = require('fs');

var contextUtils = require('../context_utils');
var LambdaUtils = require('../utils').LambdaUtils;
var Segment = require('../segments/segment');
var SegmentEmitter = require('../segment_emitter');
var SegmentUtils = require('../segments/segment_utils');

var logger = require('../logger');

/**
* Used to initialize segments on AWS Lambda with extra data from the context.
*/


/**
 * @namespace
 * @ignore
 */
var xAmznTraceIdPrev = null;

module.exports.init = function init() {
  contextUtils.enableManualMode = function () {
    logger.getLogger().warn('AWS Lambda does not support AWS X-Ray manual mode.');
  };

  fs.mkdir('/tmp/', function() {
    fs.mkdir('/tmp/.aws-xray/', function() {
      var filename = '/tmp/.aws-xray/initialized';
      fs.closeSync(fs.openSync(filename, 'a'));
      var now = new Date();
      fs.utimesSync(filename, now, now);
    });
  });

  SegmentEmitter.disableReusableSocket();
  SegmentUtils.setStreamingThreshold(0);

  var namespace = contextUtils.getNamespace();
  namespace.enter(namespace.createContext());
  contextUtils.setSegment(facadeSegment());
};

var facadeSegment = function facadeSegment() {
  var segment = new Segment('facade');
  var whitelistFcn = ['addNewSubsegment', 'addSubsegment', 'toString'];
  var xAmznTraceId = process.env._X_AMZN_TRACE_ID;

  for (var key in segment) {
    if (typeof segment[key] === 'function' && whitelistFcn.indexOf(key) === -1)
      segment[key] = function facade() { return; };
  }

  segment.trace_id = null;
  segment.isClosed = function() { return true; };
  segment.in_progress = false;
  segment.counter = 1;
  this.notTraced = true;

  segment.reset = function reset() {
    this.trace_id = null;
    this.id = null;
    delete this.subsegments;
    this.notTraced = true;
  };

  segment.resolveLambdaTraceData = function resolveLambdaTraceData() {
    var xAmznLambda = process.env._X_AMZN_TRACE_ID;

    if (xAmznLambda) {
      if (xAmznLambda != xAmznTraceIdPrev) {
        this.reset();

        if (LambdaUtils.populateTraceData(segment, xAmznLambda))
          xAmznTraceIdPrev = xAmznLambda;
      }
    }
    else {
      this.reset();
      contextUtils.contextMissingStrategy.contextMissing('Missing AWS Lambda trace data for X-Ray. Expected _X_AMZN_TRACE_ID to be set.');
    }
  };

  segment.__addSubsegment = segment.addSubsegment;
  segment.addSubsegment = function addSubsegment(subsegment) {
    this.resolveLambdaTraceData();
    this.__addSubsegment(subsegment);
  };

  if (LambdaUtils.validTraceData(xAmznTraceId)) {
    if (LambdaUtils.populateTraceData(segment, xAmznTraceId))
      xAmznTraceIdPrev = xAmznTraceId;
  }

  return segment;
};
