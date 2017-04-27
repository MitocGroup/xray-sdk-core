var assert = require('chai').assert;

var SegmentUtils = require('../../../lib/segments/segment_utils');

describe('SegmentUtils', function() {
  describe('#setStreamingThreshold', function() {
    it('should override the default streaming threshold', function() {
      SegmentUtils.setStreamingThreshold(10);

      assert.equal(SegmentUtils.streamingThreshold, 10);
    });
  });
});
