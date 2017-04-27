var fs = require('fs');
var path = require('path');

var Sampler = require('./sampler');
var Utils = require('../../utils');

var rulesLocation = path.join(__dirname, '../../', 'resources', 'default_sampling_rules.json');

/**
 * Represents a set of matchers and rules in regards to sampling rates.
 * @constructor
 * @param {string} [location] - The location of the custom sampling rules file.  If none is provided, the default file will be used.
 */

function SamplingRules(location) {
  this.init(location);
}

SamplingRules.prototype.init = function init(location) {
  var loc = location ? location : rulesLocation;
  this.rules = addRulesConfig(loc);
};

SamplingRules.prototype.shouldSample = function shouldSample(serviceName, httpMethod, urlPath) {
  var matched;

  this.rules.some(function (rule) {
    if (rule.default || (Utils.wildcardMatch(rule.service_name, serviceName)
      && Utils.wildcardMatch(rule.http_method, httpMethod) && Utils.wildcardMatch(rule.url_path, urlPath))) {

      matched = rule.sampler;
      return true;
    }
  });

  if (matched)
    return matched.isSampled();
  else
    return false;
};

function addRulesConfig(location) {
  var config = JSON.parse(fs.readFileSync(location, 'utf8'));

  if (!config.version)
    throw new Error('Error in sampling file. Missing "version" attribute.');

  if (config.version === 1)
    return parseRulesConfig(config);
  else
    throw new Error('Error in sampling file. Unknown version "' + config.version + '".');
}

function parseRulesConfig(config) {
  var defaultRule;
  var rules = [];

  if (config.default) {
    var defaultConfig = {
      fixed_target: config.default.fixed_target,
      rate: config.default.rate
    };

    var missing = [];

    delete config.default.fixed_target;
    delete config.default.rate;

    if (Object.keys(config.default).length !== 0 && config.default.constructor === Object)
      throw new Error('Error in sampling file. Invalid attributes for default: ' + Object.keys(config.default) +
        '. Valid attributes for default are "fixed_target" and "rate".');

    if (!defaultConfig.fixed_target)
      missing.push('fixed_target');

    if (!defaultConfig.rate)
      missing.push('rate');

    if (missing.length !== 0)
      throw new Error('Error in sampling file. Missing required attributes for default: ' + missing + '.');

    defaultRule = { default: true, sampler: new Sampler(defaultConfig.fixed_target, defaultConfig.rate) };
  } else {
    throw new Error('Error in sampling file. Expecting "default" object to be defined with attributes "fixed_target" and "rate".');
  }

  if (Array.isArray(config.rules)) {
    config.rules.forEach(function (rawRule) {
      var params = {};
      var required = { service_name: 1, http_method: 1, url_path: 1, fixed_target: 1, rate: 1 };

      for(var key in rawRule) {
        var value = rawRule[key];

        if (!required[key] && key != 'description')
          throw new Error('Error in sampling file. Rule ' + JSON.stringify(rawRule) + ' has invalid attribute: ' + key + '.');
        else if (key != 'description' && !value && value !== 0)
          throw new Error('Error in sampling file. Rule ' + JSON.stringify(rawRule) + ' attribute "' + key + '" has invalid value: ' + value + '.');
        else {
          params[key] = value;
          delete required[key];
        }
      }

      if (Object.keys(required).length !== 0 && required.constructor === Object)
        throw new Error('Error in sampling file. Rule ' + JSON.stringify(rawRule) + ' is missing required attributes: ' + Object.keys(required) + '.');

      var rule = params;
      rule.sampler = new Sampler(rawRule.fixed_target, rawRule.rate);
      rules.push(rule);
    });
  }

  rules.push(defaultRule);

  return rules;
}

module.exports = SamplingRules;
