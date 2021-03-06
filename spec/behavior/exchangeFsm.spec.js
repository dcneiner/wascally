var should = require( 'should' );
var sinon = require( 'sinon' );
var _ = require( 'lodash' );
var when = require( 'when' );
var exchangeFsm = require( '../../src/exchangeFsm' );
var noOp = function() {};
var emitter = require( './emitter' );

function channelFn( options ) {
	var channel = {
		name: options.name,
		type: options.type,
		channel: emitter(),
		define: noOp,
		destroy: noOp,
		publish: noOp
	};
	var channelMock = sinon.mock( channel );

	return {
		mock: channelMock,
		factory: function() {
			return channel;
		}
	};
}

describe( 'Exchange FSM', function() {

	describe( 'when initialization fails', function() {
		var connection, topology, exchange, channelMock, options, error;

		before( function( done ) {
			options = { name: 'test', type: 'test' };
			connection = emitter();
			connection.addExchange = noOp;
			topology = emitter();

			var ch = channelFn( options );
			channelMock = ch.mock;
			channelMock
				.expects( 'define' )
				.once()
				.returns( when.reject( new Error( 'nope' ) ) );

			exchange = exchangeFsm( options, connection, topology, ch.factory );
			exchange.on( 'failed', function( err ) {
				error = err;
				done();
			} );
		} );

		it( 'should have failed with an error', function() {
			error.toString().should.equal( 'Error: nope' );
		} );

		it( 'should be in failed state', function() {
			exchange.state.should.equal( 'failed' );
		} );

		describe( 'when publishing in failed state', function() {
			before( function( done ) {
				exchange.publish( {} )
					.then( function() {
						done();
					} )
					.then( null, function( err ) {
						error = err;
						done();
					} );
			} );

			it( 'should reject publish with an error', function() {
				error.toString().should.equal( 'Error: nope' );
			} );
		} );

		describe( 'when checking in failed state', function() {
			before( function( done ) {
				exchange.check()
					.then( function() {
						done();
					} )
					.then( null, function( err ) {
						error = err;
						done();
					} );
			} );

			it( 'should reject check with an error', function() {
				error.toString().should.equal( 'Error: nope' );
			} );
		} );
	} );

	describe( 'when initializing succeeds', function() {
		var connection, topology, exchange, ch, channelMock, options, error;

		before( function( done ) {
			options = { name: 'test', type: 'test' };
			connection = emitter();
			connection.addExchange = noOp;
			topology = emitter();

			ch = channelFn( options );
			channelMock = ch.mock;
			channelMock
				.expects( 'define' )
				.once()
				.returns( when.resolve() );

			exchange = exchangeFsm( options, connection, topology, ch.factory );
			exchange.on( 'failed', function( err ) {
				error = err;
				done();
			} );
			exchange.on( 'defined', function() {
				done();
			} );
		} );

		it( 'should not have failed', function() {
			should.not.exist( error );
		} );

		it( 'should be in ready state', function() {
			exchange.state.should.equal( 'ready' );
		} );

		describe( 'when publishing in ready state', function() {
			before( function( done ) {
				channelMock
					.expects( 'publish' )
					.once()
					.returns( when( true ) );

				exchange.publish( {} )
					.then( function() {
						done();
					} )
					.then( null, function( err ) {
						error = err;
						done();
					} );
			} );

			it( 'should resolve publish without error', function() {
				should.not.exist( error );
			} );
		} );

		describe( 'when checking in ready state', function() {
			before( function( done ) {
				exchange.check()
					.then( function() {
						done();
					} )
					.then( null, function( err ) {
						error = err;
						done();
					} );
			} );

			it( 'should resolve check without error', function() {
				should.not.exist( error );
			} );
		} );

		describe( 'when channel is released', function() {

			before( function( done ) {
				channelMock
					.expects( 'define' )
					.once()
					.returns( when.resolve() );

				exchange.on( 'failed', function( err ) {
					error = err;
					done();
				} );
				exchange.on( 'defined', function() {
					done();
				} );

				ch.factory().channel.raise( 'released' );
			} );

			it( 'should reinitialize without error', function() {
				should.not.exist( error );
			} );
		} );

		describe( 'when destroying', function() {

			before( function( done ) {
				exchange.published.add( {} );
				exchange.published.add( {} );
				exchange.published.add( {} );

				channelMock
					.expects( 'destroy' )
					.once()
					.returns( when.resolve() );

				exchange.destroy()
					.then( function() {
						done();
					} );
			} );

			it( 'should remove handlers from topology and connection', function() {
				_.flatten( _.values( connection.handlers ) ).length.should.equal( 0 );
				_.flatten( _.values( topology.handlers ) ).length.should.equal( 0 );
			} );

			it( 'should release channel instance', function() {
				should.not.exist( exchange.channel );
			} );

			describe( 'when publishing to a destroyed channel', function() {

				before( function( done ) {
					channelMock
						.expects( 'define' )
						.once()
						.returns( when.resolve() );

					channelMock
						.expects( 'publish' )
						.exactly( 4 )
						.returns( when.resolve() );

					exchange.on( 'defined', function() {
						topology.raise( 'bindings-completed' );
					} );

					exchange.publish( {} )
						.then( function() {
							done();
						} );
				} );

				it( 'should republish previous messages', function() {} );
			} );
		} );

		after( function() {
			connection.reset();
			topology.reset();
			channelMock.restore();
		} );
	} );
} );
