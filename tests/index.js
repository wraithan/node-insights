/* global beforeEach, describe, it */
'use strict';

var expect = require('chai').expect;
var Insights = require('../index.js');
var nock = require('nock');
var rewire = require('rewire');

describe('node-insights', function(){

  var config;

  beforeEach(function(){
    config = {
      insertKey: "xyz",
      queryKey: "abc",
      accountId: "123456",
      timerInterval: 500,
      maxPending: 5,
      defaultEventType: 'test-data'
    };
  });

  it('should throw an Error if no accountId is supplied', function(){
    expect(function(){
      new Insights({
        insertKey: "xyz"
      });
    }).to.throw(Error);
  });

  it('should not throw an Error', function(){
    expect(function(){
      new Insights(config);
    }).to.not.throw(Error);

  });

  it('should have the method start', function(){
    var insights = new Insights(config);
    expect(insights).to.respondTo('start');
  });

  it('should have the method stop', function(){
    var insights = new Insights(config);
    expect(insights).to.respondTo('stop');
  });

  it('should have the method send', function(){
    var insights = new Insights(config);
    expect(insights).to.respondTo('send');
  });

  it('should have the method add', function(){
    var insights = new Insights(config);
    expect(insights).to.respondTo('add');
  });

  it('should send data that is added', function(){
    var insights = new Insights(config);
    var scope = nock(Insights.collectorBaseURL).post('/v1/accounts/123456/events').reply(200, { });
    insights.add({
      'apples': 42
    });
    insights.send();
    setTimeout(function(){
      expect(scope.isDone()).to.be.true;
    }, 1000);
  });

  it('should throw an Error if no insertKey is supplied when adding data', function(){
    var insights = new Insights({
      accountId: "<YOUR ACCOUNT ID>",
    });

    expect(function(){
      insights.add({"bogosity":true});
    }).to.throw(Error);
  });

  it('should send flattened data', function(done){
    var body;
    var scope = nock(Insights.collectorBaseURL)
                  .post('/v1/accounts/123456/events')
                  .reply(200, function(uri, reqBody){
                    body = reqBody;
                    return body;
                  });
    var insights = new Insights(config);
    insights.add({
      'purchase': {
        "account":3,
        "amount":259.54
      }
    }, 'purchase');
    insights.send();
    setTimeout(function(){
      expect(scope.isDone()).to.be.true;
      expect(body).to.eql('[{"eventType":"purchase","purchase.account":3,"purchase.amount":259.54}]');
      done();
    }, 1000);
  });

  it('should send flattened array data', function(done){
    var body;
    var scope = nock(Insights.collectorBaseURL)
                  .post('/v1/accounts/123456/events')
                  .reply(200, function(uri, reqBody){
                    body = reqBody;
                    return body;
                  });
    var insights = new Insights(config);
    insights.add({
      'randomWords': [ "card", "bean", "chair", "box" ]
      });
    insights.send();
    setTimeout(function(){
      expect(scope.isDone()).to.be.true;
      expect(body).to.eql('[{"eventType":"test-data","randomWords.0":"card","randomWords.1":"bean","randomWords.2":"chair","randomWords.3":"box"}]');
      done();
    }, 1000);
  });


  it('should be stoppable', function(){
    var scope = nock(Insights.collectorBaseURL).post('/v1/accounts/123456/events').reply(200, { });
    var insights = new Insights(config);
    insights.add({
      'apples': 42
    });
    insights.stop();
    setTimeout(function(){
      expect(scope.isDone()).to.be.false;
    }, 1000);
  });

  it('should automatically send data that exceeds maxPending', function(){
    var scope = nock(Insights.collectorBaseURL).post('/v1/accounts/123456/events').reply(200, { });
    config.timerInterval = 100000;
    var insights = new Insights(config);
    insights.add({
      'apples': 42
    });
    insights.add({
      'happy': true
    });
    insights.add({
      'bananas': 10
    });
    insights.add({
      'today': new Date()
    });
    insights.add({
      'oranges': 50
    });
    //this one exceeds maxPending and will force send
    insights.add({
      'chickens': 2
    });
    setTimeout(function(){
      expect(scope.isDone()).to.be.true;
    }, 1000);
  });

  it('should have the method query', function(){
    var insights = new Insights(config);
    expect(insights).to.respondTo('query');
  });

  it('should throw an Error if no queryKey is supplied when querying data', function(){
    var insights = new Insights({
      accountId: "<YOUR ACCOUNT ID>",
    });

    expect(function(){
      insights.query("bogosity");
    }).to.throw(Error);
  });

  it('should send a query request', function(done){
    var query = "SELECT count(*) from " + config.defaultEventType;
    var testResponseBody = {'test':true};
    var scope = nock(Insights.queryBaseURL)
                  .get('/v1/accounts/123456/query?nrql=' + encodeURI(query))
                  .reply(200, testResponseBody);
    var insights = new Insights(config);
    insights.query(query, function(err, body) {
      expect(scope.isDone()).to.be.true;
      expect(body).to.eql(testResponseBody);
      done();
    });

  });


  it('can handle consecutive adds', function(done){
    var requestCount = 0;
    var mockRequest = function(options, callback){
      expect(options.body.length).to.equal(5);
      setTimeout(function(){
        requestCount++;
        if(requestCount == 4){
          setTimeout(function(){
            expect(requestCount).to.equal(4);
            done();
          }, 200);
        }
        callback(null, {
          statusCode: 200
        }, 'mock');
      }, 10);
    };
    var Insights = rewire('../index.js');

    Insights.__set__("request", mockRequest);

    var insights = new Insights({
      insertKey: "xyz",
      url: "https://insights-collector.newrelic.com/v1/accounts/123456/events",
      accountId: "90210",
      timerInterval: 1000000000,
      maxPending: 5
    });

    for(var i = 0; i < 20; i++){
      insights.add({name: 'test'}, 'testing');
    }
  });

  it('should have more tests');
});
