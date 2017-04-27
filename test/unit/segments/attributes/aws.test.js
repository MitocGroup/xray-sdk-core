var assert = require('chai').assert;
var Aws = require('../../../../lib/segments/attributes/aws');
var sinon = require('sinon');

describe('Aws', function() {
  var serviceName = 'DynamoDB';
  var req = {
    request: {
      operation: 'ListTables',
      httpRequest: {
        region: 'us-east-1'
      }
    },
    requestId: 'f950b70c-c6a6-4572-9c04-80cab1a7c99a',
    retryCount: 3
  };

  describe('#init', function() {
    var sandbox;

    beforeEach(function() {
      sandbox = sinon.sandbox.create();
      sandbox.stub(Aws.prototype, 'addData');
    });

    afterEach(function() {
      sandbox.restore();
    });

    it('should create a new aws object', function() {
      var aws = new Aws(req, serviceName);

      assert.isObject(aws);
    });

    it('should format the operation name', function() {
      var aws = new Aws(req, serviceName);

      assert.equal(aws.operation, 'ListTables');
    });
  });
});
