 /**
  * @module context_utils
  */

var cls = require('continuation-local-storage');

var logger = require('./logger');
var Segment = require('./segments/segment');
var Subsegment = require('./segments/attributes/subsegment');

var cls_mode = false;
var NAMESPACE ='AWSXRay';
var SEGMENT = 'segment';

var overrideFlag = !!process.env.AWS_XRAY_CONTEXT_MISSING;

var contextUtils = {
  CONTEXT_MISSING_STRATEGY: {
    RUNTIME_ERROR: {
      contextMissing: function contextMissing(message) {
        throw new Error(message);
      }
    },
    LOG_ERROR: {
      contextMissing: function contextMissing(message) {
        logger.getLogger().error(message);
      }
    }
  },

  contextMissingStrategy: {
    contextMissing: function contextMissing(message) {
      throw new Error(message);
    }
  },

  /**
   * Resolves the segment or subsegment given manual mode and params on the call required.
   * @param [Segment|Subsegment] segment - The segment manually provided via params.XraySegment, if provided.
   * @returns {Segment|Subsegment}
   * @alias module:context_utils.resolveManualSegmentParams
   */

  resolveManualSegmentParams: function resolveManualSegmentParams(params) {
    if (params && !contextUtils.isAutomaticMode()) {
      var xraySegment = params.XRaySegment || params.XraySegment;
      var segment = params.Segment;
      var found = null;

      if (xraySegment && (xraySegment instanceof Segment || xraySegment instanceof Subsegment)) {
        found = xraySegment;
        delete params.XRaySegment;
        delete params.XraySegment;
      } else if (segment && (segment instanceof Segment || segment instanceof Subsegment)) {
        found = segment;
        delete params.Segment;
      }

      return found;
    }
  },

  getNamespace: function getNamespace() {
    return cls.getNamespace(NAMESPACE);
  },

  /**
   * Resolves the segment or subsegment given manual or automatic mode.
   * @param [Segment|Subsegment] segment - The segment manually provided, if provided.
   * @returns {Segment|Subsegment}
   * @alias module:context_utils.resolveSegment
   */

  resolveSegment: function resolveSegment(segment) {
    if (cls_mode) {
      return this.getSegment();
    } else if (segment && !cls_mode) {
      return segment;
    } else if (!segment && !cls_mode) {
      contextUtils.contextMissingStrategy.contextMissing('No sub/segment specified. A sub/segment must be provided for manual mode.');
    }
  },

  /**
   * Returns the current segment or subsegment.  For use with in automatic mode only.
   * @returns {Segment|Subsegment}
   * @alias module:context_utils.getSegment
   */

  getSegment: function getSegment() {
    if (cls_mode) {
      var segment = cls.getNamespace(NAMESPACE).get(SEGMENT);

      if (!segment) {
        contextUtils.contextMissingStrategy.contextMissing('Failed to get the current sub/segment from the context.');
      }

      return segment;
    } else {
      contextUtils.contextMissingStrategy.contextMissing('Cannot get sub/segment from context. Not supported in manual mode.');
    }
  },

  /**
   * Sets the current segment or subsegment.  For use with in automatic mode only.
   * @param [Segment|Subsegment] segment - The sub/segment to set.
   * @returns {Segment|Subsegment}
   * @alias module:context_utils.setSegment
   */

  setSegment: function setSegment(segment) {
    if (cls_mode) {
      if (!cls.getNamespace(NAMESPACE).set(SEGMENT, segment))
        logger.getLogger().warn('Failed to set the current sub/segment on the context.');
    } else {
      contextUtils.contextMissingStrategy.contextMissing('Cannot set sub/segment on context. Not supported in manual mode.');
    }
  },

  /**
   * Returns true if in automatic mode, otherwise false.
   * @returns {Segment|Subsegment}
   * @alias module:context_utils.isAutomaticMode
   */

  isAutomaticMode: function isAutomaticMode() {
    return cls_mode;
  },

  /**
   * Enables automatic mode. Automatic mode uses 'continuation-local-storage'.
   * @see https://github.com/othiym23/node-continuation-local-storage
   * @alias module:context_utils.enableAutomaticMode
   */

  enableAutomaticMode: function enableAutomaticMode() {
    cls_mode = true;
    cls.createNamespace(NAMESPACE);
  },

  /**
   * Disables automatic mode. Current segment or subsegment then must be passed manually
   * via the parent optional on captureFunc, captureAsyncFunc etc.
   * @alias module:context_utils.enableManualMode
   */

  enableManualMode: function enableManualMode() {
    cls_mode = false;

    if (cls.getNamespace(NAMESPACE))
      cls.destroyNamespace(NAMESPACE);
  },

  /**
   * Finds a context missing strategy object from the available pre-configured strategies on this module's
   * CONTEXT_MISSING_STRATEGY property. Returns the strategy if found, null otherwise.
   * @param {string} strategy - The name of the strategy to lookup.
   * @returns {Object}
   */

  lookupContextMissingStrategy: function lookupContextMissingStrategy(strategy) {
    var lookupStrategy = module.exports.CONTEXT_MISSING_STRATEGY[strategy.toUpperCase()];
    if (lookupStrategy) {
      return lookupStrategy;
    } else {
      logger.getLogger().error('Context missing strategy "' + strategy + '" not found.');
      return null;
    }
  },

  /**
   * Sets the context missing strategy if no context missing strategy is set using the environment variable with
   * key AWS_XRAY_CONTEXT_MISSING. The context missing strategy's contextMissing function will be called whenever
   * trace context is not found.
   * @param {string|object} strategy - The strategy to set. If this parameter is a string, it will be passed through
   *                                   lookupContextMissingStrategy and the resultant strategy object will be used. If
   *                                   this parameter is an object, it will be treated as a custom context missing strategy.
   */

  setContextMissingStrategy: function setContextMissingStrategy(strategy) {
    if(!overrideFlag && typeof strategy === 'object') {
      module.exports.contextMissingStrategy = strategy;
    } else if (!overrideFlag && typeof strategy === 'string') {
      var lookupStrategy = module.exports.lookupContextMissingStrategy(strategy);
      if (lookupStrategy) {
        module.exports.contextMissingStrategy = lookupStrategy;
      }
    } else {
      var contextMissingString = undefined;
      if (module.exports.contextMissingStrategy && module.exports.contextMissingStrategy.contextMissing) {
        contextMissingString = module.exports.contextMissingStrategy.contextMissing.toString();
      }

      if (!overrideFlag) {
        logger.getLogger().error('Param strategy must be either a string or an object. The current context missing strategy will not be changed. contextMissingStrategy.contextMissing:\n' + contextMissingString);
      } else {
        logger.getLogger().warn('Ignoring call to setContextMissingStrategy as AWS_XRAY_CONTEXT_MISSING is set. The current context missing strategy will not be changed. contextMissingStrategy.contextMissing:\n' + contextMissingString);
      }
    }
  }
};

module.exports = contextUtils;
