var assert = require('chai').assert;
var sinon = require('sinon');

var Segment = require('../../lib/segments/segment');
var Subsegment = require('../../lib/segments/attributes/subsegment');
var ContextUtils = require('../../lib/context_utils');

describe('ContextUtils', function() {
  describe('#resolveManualSegmentParams', function() {
    var autoModeStub, params, sandbox;

    beforeEach(function() {
      sandbox = sinon.sandbox.create();
      autoModeStub = sandbox.stub(ContextUtils, 'isAutomaticMode').returns(false);
      params = {
        Bucket: 'moop',
        Key: 'boop'
      };
    });

    afterEach(function() {
      sandbox.restore();
    });

    it('should return null if in automatic mode', function() {
      autoModeStub.returns(true);
      params.XRaySegment = new Segment('moop');

      assert.isUndefined(ContextUtils.resolveManualSegmentParams(params));
    });

    it('should return XRaySegment if of type Segment', function() {
      var segment = params.XRaySegment = new Segment('moop');

      assert.equal(ContextUtils.resolveManualSegmentParams(params), segment);
    });

    it('should return XRaySegment if of type Subsegment', function() {
      var segment = params.XRaySegment = new Subsegment('moop');

      assert.equal(ContextUtils.resolveManualSegmentParams(params), segment);
    });

    it('should return null if XRaySegment is not of type Segment or Subsegment', function() {
      params.XRaySegment = 'moop';

      assert.isNull(ContextUtils.resolveManualSegmentParams(params));
    });

    it('should delete XRaySegment from the params passed', function() {
      params.XRaySegment = new Segment('moop');
      ContextUtils.resolveManualSegmentParams(params);

      assert.isUndefined(params.XRaySegment);
    });

    it('should return Segment if of type Segment', function() {
      var segment = params.Segment = new Segment('moop');

      assert.equal(ContextUtils.resolveManualSegmentParams(params), segment);
    });

    it('should return Segment if of type Subsegment', function() {
      var segment = params.Segment = new Subsegment('moop');

      assert.equal(ContextUtils.resolveManualSegmentParams(params), segment);
    });

    it('should return null if Segment is not of type Segment or Subsegment', function() {
      params.Segment = 'moop';

      assert.isNull(ContextUtils.resolveManualSegmentParams(params));
    });

    it('should delete Segment from the params passed', function() {
      params.Segment = new Segment('moop');
      ContextUtils.resolveManualSegmentParams(params);

      assert.isUndefined(params.Segment);
    });

    it('should take XRaySegment as a priority', function() {
      params.XRaySegment = 'moop';

      assert.isNull(ContextUtils.resolveManualSegmentParams(params));
    });
  });
});
