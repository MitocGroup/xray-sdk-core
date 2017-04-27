var assert = require('chai').assert;
var chai = require('chai');
var sinon = require('sinon');
var sinonChai = require('sinon-chai');

var captureHTTPs = require('../../../lib/patchers/http_p').captureHTTPs;
var contextUtils = require('../../../lib/context_utils');
var Utils = require('../../../lib/utils');
var Segment = require('../../../lib/segments/segment');
var TestEmitter = require('../test_utils').TestEmitter;

chai.should();
chai.use(sinonChai);

var buildFakeRequest = function() {
  var request = {
    method: 'GET',
    url: '/',
    connection: {
      remoteAddress: 'myhost'
    }
  };

  request.emitter = new TestEmitter();

  request.on = function(event, fcn) {
    this.emitter.on(event, fcn);
    return this;
  };

  request.setHeader = function() {};

  return request;
};

var buildFakeResponse = function() {
  var response = {};

  response.emitter = new TestEmitter();

  response.on = function(event, fcn) {
    this.emitter.on(event, fcn);
    return this;
  };

  return response;
};

describe('HTTP/S patcher', function() {
  describe('#captureHTTPs', function() {
    var httpClient;

    beforeEach(function() {
      httpClient = { request: function request() {} };
    });

    it('should create a copy of the module', function() {
      var capturedHttp = captureHTTPs(httpClient, true);
      assert.notEqual(httpClient, capturedHttp);
    });

    it('should stub out the old method for a new capture one', function() {
      var capturedHttp = captureHTTPs(httpClient, true);
      assert.equal(capturedHttp.request.name, 'captureHTTPsRequest');
    });
  });

  describe('#captureHTTPsRequest', function() {
    var addRemoteDataStub, closeStub, httpOptions, newSubsegmentStub, resolveManualStub, sandbox, segment, subsegment;
    var traceId = '1-57fbe041-2c7ad569f5d6ff149137be86';

    before(function() {
      httpOptions = {
        host: 'myhost',
        path: '/'
      };
    });

    beforeEach(function() {
      sandbox = sinon.sandbox.create();
      segment = new Segment('test', traceId);
      subsegment = segment.addNewSubsegment('testSub');

      newSubsegmentStub = sandbox.stub(segment, 'addNewSubsegment').returns(subsegment);

      resolveManualStub = sandbox.stub(contextUtils, 'resolveManualSegmentParams');
      sandbox.stub(contextUtils, 'isAutomaticMode').returns(true);
      sandbox.stub(contextUtils, 'resolveSegment').returns(segment);
      addRemoteDataStub = sandbox.stub(subsegment, 'addRemoteRequestData').returns();
      closeStub = sandbox.stub(subsegment, 'close').returns();
    });

    afterEach(function() {
      sandbox.restore();
    });

    describe('on invocation', function () {
      var capturedHttp, fakeRequest, fakeResponse, httpClient, requestSpy, sandbox, setHeaderStub;

      beforeEach(function() {
        sandbox = sinon.sandbox.create();
        segment = new Segment('test', traceId);

        fakeRequest = buildFakeRequest();
        fakeResponse = buildFakeResponse();

        httpClient = { request: function(options, callback) {
          callback(fakeResponse);
          return fakeRequest;
        }};

        setHeaderStub = sandbox.stub(fakeRequest, 'setHeader');
        requestSpy = sandbox.spy(httpClient, 'request');

        capturedHttp = captureHTTPs(httpClient, true); });

      afterEach(function() {
        sandbox.restore();
      });

      it('should call to resolve any manual params', function() {
        var options = {hostname: 'hostname', path: '/'};
        capturedHttp.request(options);

        resolveManualStub.should.have.been.calledWith(options);
      });

      it('should create a new subsegment with name as hostname', function() {
        var options = {hostname: 'hostname', path: '/'};
        capturedHttp.request(options);
        newSubsegmentStub.should.have.been.calledWith(options.hostname);
      });

      it('should create a new subsegment with name as host when hostname is missing', function() {
        capturedHttp.request(httpOptions);
        newSubsegmentStub.should.have.been.calledWith(httpOptions.host);
      });

      it('should create a new subsegment with name as "Unknown host" when host and hostname is missing', function() {
        capturedHttp.request({path: '/'});
        newSubsegmentStub.should.have.been.calledWith('Unknown host');
      });

      it('should call the base method', function() {
        capturedHttp.request({'Segment': segment});
        assert(requestSpy.called);
      });

      it('should attach an event handler to the "end" event', function() {
        capturedHttp.request(httpOptions);
        assert.isFunction(fakeResponse.emitter._events.end);
      });

      it('should inject the tracing headers', function() {
        capturedHttp.request(httpOptions);

        var expected = new RegExp('^Root=' + traceId + ';Parent=([a-f0-9]{16});Sampled=1$');
        setHeaderStub.should.have.been.calledWith('X-Amzn-Trace-Id', sinon.match(expected));
      });

      it('should return the request object', function() {
        var request = capturedHttp.request(httpOptions);
        assert.equal(request, fakeRequest);
      });
    });

    describe('on the "end" event', function () {
      var capturedHttp, fakeRequest, fakeResponse, httpClient, sandbox;

      beforeEach(function() {
        sandbox = sinon.sandbox.create();

        fakeRequest = buildFakeRequest();
        fakeResponse = buildFakeResponse();

        httpClient = { request: function(options, callback) {
          fakeResponse.req = fakeRequest;
          callback(fakeResponse);
          return fakeRequest;
        }};

        sandbox.stub(fakeRequest, 'setHeader');
        capturedHttp = captureHTTPs(httpClient);
      });

      afterEach(function() {
        sandbox.restore();
        delete segment.notTraced;
      });

      it('should not set "http.traced" if the enableXRayDownstream flag is not set', function(done) {
        fakeResponse.statusCode = 200;
        capturedHttp.request(httpOptions);
        fakeResponse.emitter.emit('end');

        setTimeout(function() {
          addRemoteDataStub.should.have.been.calledWithExactly(fakeRequest, fakeResponse, false);
          done();
        }, 50);
      });

      it('should set "http.traced" on the subsegment if the root is sampled and enableXRayDownstream is set', function(done) {
        capturedHttp = captureHTTPs(httpClient, true);
        fakeResponse.statusCode = 200;
        capturedHttp.request(httpOptions);
        fakeResponse.emitter.emit('end');

        setTimeout(function() {
          addRemoteDataStub.should.have.been.calledWithExactly(fakeRequest, fakeResponse, true);
          done();
        }, 50);
      });

      it('should close the subsegment', function(done) {
        fakeResponse.statusCode = 200;
        capturedHttp.request(httpOptions);
        fakeResponse.emitter.emit('end');

        setTimeout(function() {
          closeStub.should.have.been.calledWithExactly();
          done();
        }, 50);
      });

      it('should flag the subsegment as throttled if status code 429 is seen', function(done) {
        var addThrottleStub = sandbox.stub(subsegment, 'addThrottleFlag');

        fakeResponse.statusCode = 429;
        capturedHttp.request(httpOptions);
        fakeResponse.emitter.emit('end');

        setTimeout(function() {
          addThrottleStub.should.have.been.calledOnce;
          done();
        }, 50);
      });

      it('should check the cause of the http status code', function(done) {
        var utilsCodeStub = sandbox.stub(Utils, 'getCauseTypeFromHttpStatus');

        fakeResponse.statusCode = 500;
        capturedHttp.request(httpOptions);
        fakeResponse.emitter.emit('end');

        setTimeout(function() {
          utilsCodeStub.should.have.been.calledWith(fakeResponse.statusCode);
          done();
        }, 50);
      });
    });

    describe('when the "error" event fires', function () {
      var capturedHttp, error, fakeRequest, httpClient, req, sandbox;

      beforeEach(function() {
        sandbox = sinon.sandbox.create();

        httpClient = { request: function() {} };
        capturedHttp = captureHTTPs(httpClient);

        fakeRequest = buildFakeRequest();

        sandbox.stub(fakeRequest, 'setHeader');
        sandbox.stub(capturedHttp, '__request').returns(fakeRequest);
        error = {};

        req = capturedHttp.request(httpOptions);
        req._events = { error: { length: 2 }};
      });

      afterEach(function() {
        sandbox.restore();
      });

      it('should capture the request error', function(done) {
        fakeRequest.emitter.emit('error', error);

        setTimeout(function() {
          addRemoteDataStub.should.have.been.calledWith(req);
          closeStub.should.have.been.calledWithExactly(error);
          done();
        }, 50);
      });

      it('should capture the response error', function(done) {
        subsegment.http = { response: { status: 500 }};
        fakeRequest.emitter.emit('error', error);

        setTimeout(function() {
          closeStub.should.have.been.calledWithExactly(error, true);
          done();
        }, 50);
      });
    });
  });
});
