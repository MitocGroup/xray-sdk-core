var _ = require('underscore');
var fs = require('fs');
var path = require('path');

var logger = require('../logger');
var whitelistLocation = path.join(__dirname, '..', 'resources', 'aws_whitelist.json');

var paramTypes = {
  REQ_DESC: 'request_descriptors',
  REQ_PARAMS: 'request_parameters',
  RES_DESC: 'response_descriptors',
  RES_PARAMS: 'response_parameters'
};

/**
 * Represents a set of AWS services, operations and keys or params to capture.
 * @constructor
 * @param {string} [location] - The location of the custom request info whitelist file.  If none is provided, the default file will be used.
 */

function CallCapturer (location) {
  this.init(location);
}

CallCapturer.prototype.init = function (location) {
  var loc = location ? location : whitelistLocation;
  this.services = loadWhitelist(loc);
};

CallCapturer.prototype.capture = function capture(serviceName, response) {
  var operation = response.request.operation;
  var call = !_.isUndefined(this.services[serviceName]) ? this.services[serviceName].operations[operation] : undefined;

  if(_.isUndefined(call)) {
    logger.getLogger().info('Call "' + serviceName + '.' + operation + '" is not whitelisted for data capturing.  Ignorning.');
    return;
  }

  var dataCaptured = {};

  _.each(call, function(params, paramType) {
    if(paramType === paramTypes.REQ_DESC)
      _.extend(this, captureDescriptors(params, response.request.params));
    else if(paramType === paramTypes.RES_DESC)
      _.extend(this, captureDescriptors(params, response.data));
    else if(paramType === paramTypes.REQ_PARAMS)
      _.extend(this, captureCallParams(params, response.request.params));
    else if(paramType === paramTypes.RES_PARAMS)
      _.extend(this, captureCallParams(params, response));
    else
      logger.getLogger().error('Unknown parameter type "' + paramType + '".  Must be "request_descriptors", "response_descriptors", "request_parameters" or "response_parameters".');
  }, dataCaptured);

  return dataCaptured;
};

function captureCallParams(params, call) {
  var data = {};

  _.each(params, function(param) {
    var formatted = toSnakeCase(param);
    this[formatted] = call[param];
  }, data);

  return data;
}

function captureDescriptors(descriptors, params) {
  var data = {};

  _.each(descriptors, function(attributes, paramName) {
    var paramData;

    if (attributes.list && attributes.get_count)
      paramData = params[paramName].length;
    else
      paramData = attributes.get_keys === true ? _.keys(params[paramName]) : params[paramName];

    if(typeof attributes.rename_to === 'string') {
      this[attributes.rename_to] = paramData;
    } else {
      var formatted = toSnakeCase(paramName);
      this[formatted] = paramData;
    }
  }, data);

  return data;
}

function toSnakeCase(param) {
  if (param === 'IPAddress')
    return 'ip_address';
  else
    return param.split(/(?=[A-Z])/).join('_').toLowerCase();
}

function loadWhitelist(location) {
  var doc = JSON.parse(fs.readFileSync(location, 'utf8'));

  if (_.isUndefined(doc.services))
    throw new Error('Document formatting is incorrect.  Expecting "services" param.');

  return doc.services;
}

module.exports = CallCapturer;
