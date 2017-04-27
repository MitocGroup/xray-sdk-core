var assert = require('chai').assert;
var expect = require('chai').expect;
var chai = require('chai');
var sinon = require('sinon');
var sinonChai = require('sinon-chai');

chai.use(sinonChai);

var dgram = require('dgram');
var Segment = require('../../lib/segments/segment');

describe('SegmentEmitter', function() {
  var client, sandbox, SegmentEmitter;
  var DEFAULT_DAEMON_ADDRESS = '127.0.0.1';
  var DEFAULT_DAEMON_PORT = 2000;

  var ADDRESS_PROPERTY_NAME = 'daemonAddress';
  var PORT_PROPERTY_NAME = 'daemonPort';

  function getUncachedEmitter() {
    var path = '../../lib/segment_emitter';
    delete require.cache[require.resolve(path)];
    return require(path);
  }

  beforeEach(function() {
    sandbox = sinon.sandbox.create();

    delete process.env.AWS_XRAY_DAEMON_ADDRESS;
    SegmentEmitter = getUncachedEmitter();
  });

  afterEach(function() {
    sandbox.restore();
  });

  describe('init', function() {
    it('should load the default address and port', function() {
      assert.equal(SegmentEmitter[ADDRESS_PROPERTY_NAME], DEFAULT_DAEMON_ADDRESS);
      assert.equal(SegmentEmitter[PORT_PROPERTY_NAME], DEFAULT_DAEMON_PORT);
    });

    it('should load the environment variables address and port if set', function() {
      process.env.AWS_XRAY_DAEMON_ADDRESS = '192.168.0.23:8081';
      SegmentEmitter = getUncachedEmitter();

      assert.equal(SegmentEmitter[ADDRESS_PROPERTY_NAME], '192.168.0.23');
      assert.equal(SegmentEmitter[PORT_PROPERTY_NAME], 8081);
    });
  });

  describe('#send', function() {
    it('should send the segment using the dgram client', function() {
      client = dgram.createSocket('udp4');
      sandbox.stub(client, 'send');
      sandbox.stub(dgram, 'createSocket').returns(client);

      SegmentEmitter = getUncachedEmitter();

      var segment = new Segment('test');
      SegmentEmitter.send(segment);

      expect(client.send).to.have.been.calledOnce;
      expect(client.send).to.have.been.calledWithExactly(sinon.match.any, 0, sinon.match.number,
        SegmentEmitter[PORT_PROPERTY_NAME], SegmentEmitter[ADDRESS_PROPERTY_NAME], sinon.match.func);
    });
  });

  describe('#setDaemonAddress', function() {
    it('should sent the address', function() {
      SegmentEmitter.setDaemonAddress('192.168.0.23');

      assert.equal(SegmentEmitter[ADDRESS_PROPERTY_NAME], '192.168.0.23');
      assert.equal(SegmentEmitter[PORT_PROPERTY_NAME], 2000);
    });

    it('should sent the port', function() {
      SegmentEmitter.setDaemonAddress(':8081');

      assert.equal(SegmentEmitter[ADDRESS_PROPERTY_NAME], '127.0.0.1');
      assert.equal(SegmentEmitter[PORT_PROPERTY_NAME], 8081);
    });

    it('should sent the address and port', function() {
      SegmentEmitter.setDaemonAddress('192.168.0.23:8081');

      assert.equal(SegmentEmitter[ADDRESS_PROPERTY_NAME], '192.168.0.23');
      assert.equal(SegmentEmitter[PORT_PROPERTY_NAME], 8081);
    });

    it('should support IPv6 notation', function() {
      SegmentEmitter.setDaemonAddress('192.168.0.23');

      assert.equal(SegmentEmitter[ADDRESS_PROPERTY_NAME], '192.168.0.23');
      assert.equal(SegmentEmitter[PORT_PROPERTY_NAME], 2000);
    });

    it('should not override the environment variables', function() {
      process.env.AWS_XRAY_DAEMON_ADDRESS = '184.88.8.173:8081';
      SegmentEmitter = getUncachedEmitter();

      SegmentEmitter.setDaemonAddress('204.45.25.168:4553');

      assert.equal(SegmentEmitter[ADDRESS_PROPERTY_NAME], '184.88.8.173');
      assert.equal(SegmentEmitter[PORT_PROPERTY_NAME], 8081);
    });
  });
});
