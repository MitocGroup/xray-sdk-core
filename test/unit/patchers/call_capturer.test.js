var assert = require('chai').assert;
var sinon = require('sinon');
var fs = require('fs');

var CallCapturer = require('../../../lib/patchers/call_capturer');

describe('CallCapturer', function() {
  var sandbox;

  beforeEach(function() {
    sandbox = sinon.sandbox.create();
  });

  afterEach(function() {
    sandbox.restore();
  });

  describe('#constructor', function() {
    var jsonDoc = {
      services: {
        s3: {}
      }
    };

    it('should return a call capturer object loaded with the default JSON document', function() {
      sandbox.stub(fs, 'readFileSync').returns();
      sandbox.stub(JSON, 'parse').returns(jsonDoc);

      var capturer = new CallCapturer();

      assert(capturer);
      assert(capturer.services.s3);
    });
  });

  describe('#capture', function() {
    var response = {
      request: {
        operation: 'getItem',
        params: {
          TableName: 'myTable',
          ProjectionExpression: 'Table',
          ConsistentRead: true,
          ExpressionAttributeNames: {
            '#attrName': 'SessionID'
          }
        }
      },
      ConsumedCapacity: '10'
    };

    var response2 = {
      request: {
        operation: 'sendMessageBatch',
        params: {}
      },
      data: {
        Failed: [1,2,3],
        Successful: [1,2,3,4,5,6,7]
      }
    };

    var jsonDoc = {
      services: {
        dynamodb: {
          operations: {
            getItem: {
              request_parameters: [ 'TableName' ],
              response_parameters: [ 'ConsumedCapacity' ]
            }
          }
        }
      }
    };

    var jsonDoc2 = {
      services: {
        dynamodb: {
          operations: {
            getItem: {
              request_descriptors: {
                ExpressionAttributeNames: {
                  get_keys: true,
                  rename_to: 'attribute_names_substituted'
                }
              }
            }
          }
        }
      }
    };

    var jsonDoc3 = {
      services: {
        sqs: {
          operations: {
            sendMessageBatch: {
              response_descriptors: {
                Failed: {
                  list: true,
                  get_count: true,
                },
                Successful: {
                  list: true,
                  get_count: true,
                },
              }
            }
          }
        }
      }
    };

    it('should capture the request and response params noted', function () {
      sandbox.stub(fs, 'readFileSync').returns();
      sandbox.stub(JSON, 'parse').returns(jsonDoc);

      var capturer = new CallCapturer('/path/here');
      var data = capturer.capture('dynamodb', response);

      assert.deepEqual(data, { table_name: 'myTable', consumed_capacity: '10' });
    });

    it('should capture the request descriptors as noted', function () {
      sandbox.stub(fs, 'readFileSync').returns();
      sandbox.stub(JSON, 'parse').returns(jsonDoc2);

      var capturer = new CallCapturer('/path/here');
      var data = capturer.capture('dynamodb', response);

      assert.deepEqual(data, { attribute_names_substituted: [ '#attrName' ] });
    });

    it('should capture the response descriptors as noted', function () {
      sandbox.stub(fs, 'readFileSync').returns();
      sandbox.stub(JSON, 'parse').returns(jsonDoc3);

      var capturer = new CallCapturer('/path/here');
      var data = capturer.capture('sqs', response2);

      assert.deepEqual(data, { failed: 3, successful: 7 });
    });
  });
});
