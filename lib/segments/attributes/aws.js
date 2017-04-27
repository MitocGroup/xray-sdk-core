var _ = require('underscore');
var CallCapturer = require('../../patchers/call_capturer.js');

var capturer = new CallCapturer();

/**
 * Represents a AWS client call. Automatically captures data from the supplied response object,
 * Data captured depends on the whitelisting file supplied.
 * The base whitelisting file can be found at /lib/resources/aws_whitelist.json.
 * @constructor
 * @param {AWS.Response} res - The response object from the AWS call.
 * @param {string} serviceName - The service name of the AWS client.
 * @see https://github.com/aws/aws-sdk-js/blob/master/lib/response.js
 */

function Aws(res, serviceName) {
  this.init(res, serviceName);
}

Aws.prototype.init = function init(res, serviceName) {
  //TODO: account ID
  this.operation = formatOperation(res.request.operation) || '';
  this.region = res.request.httpRequest.region || '';
  this.request_id = res.extendedRequestId || res.requestId || '';
  this.retries = res.retryCount || 0;

  this.addData(capturer.capture(serviceName, res));
};

Aws.prototype.addData = function addData(data) {
  _.extend(this, data);
};

/**
 * Overrides the default whitelisting file to specify what params to capture on each AWS Service call.
 * @param {String} location - The path to the custom whitelist file.
 * @exports setAWSWhitelist
 */

var setAWSWhitelist = function setAWSWhitelist(location) {
  if (_.isUndefined(location))
    throw new Error('Please specify a path to the local whitelist file.');

  capturer = new CallCapturer(location);
};

function formatOperation(operation) {
  if (!operation)
    return;

  return operation.charAt(0).toUpperCase() + operation.slice(1);
}

module.exports = Aws;
module.exports.setAWSWhitelist = setAWSWhitelist;
