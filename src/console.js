const console_stamp = require( 'console-stamp' );

console_stamp( console, {
	format: ':startColour :date(yyyy-mm-dd HH:MM:ss.l) :label :msg :endColour',
	tokens: {
		startColour:( args ) => {
			const colourMapping = {
				'error': 31, // Red
				'warn': 33, // Yellow
			}
			const colourCode = colourMapping[args.method] || 0; // Default to white
			return `\x1b[${colourCode}m`;
		},
		endColour:( args ) => {
			return '\x1b[0m'; // Clears formatting to default
		},
	},
	extend: {
		debug: 5, // By default console-stamp sets debug and log to be the same level.  This moves debug down a step.
	},
	level: 'log',
} );