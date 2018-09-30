var tcp = require('../../tcp');
var instance_skel = require('../../instance_skel');
var debug;
var log;


function instance(system, id, config) {
	var self = this;

	// Request id counter
	self.request_id = 0;

	// super-constructor
	instance_skel.apply(this, arguments);

	self.actions(); // export actions

	return self;
}

instance.prototype.updateConfig = function(config) {
	var self = this;

	self.config = config;
	self.init_tcp();
};

instance.prototype.init = function() {
	var self = this;

	debug = self.debug;
	log = self.log;

	self.init_tcp();
};

instance.prototype.init_tcp = function() {
	var self = this;
	var receivebuffer = '';

	if (self.socket !== undefined) {
		self.socket.destroy();
		delete self.socket;
	}

	if (self.config.port === undefined) {
		self.config.port = 54321;
	}

	if (self.config.host) {
		self.socket = new tcp(self.config.host, self.config.port);

		self.socket.on('status_change', function (status, message) {
			self.status(status, message);
		});

		self.socket.on('error', function (err) {
			debug("Network error", err);
			self.log('error',"Network error: " + err.message);
		});

		self.socket.on('connect', function () {
			debug("Connected");
		});

		// separate buffered stream into lines with responses
		self.socket.on('data', function (chunk) {
			var i = 0, line = '', offset = 0;
			receivebuffer += chunk;
			while ( (i = receivebuffer.indexOf('\n', offset)) !== -1) {
				line = receivebuffer.substr(offset, i - offset);
				offset = i + 1;
				self.socket.emit('receiveline', line.toString());
			}
			receivebuffer = receivebuffer.substr(offset);
		});

		self.socket.on('receiveline', function (line) {
			debug("Received line from d3:", line);
			try {
				var response = JSON.parse(line);
				console.log(response);
				if (response.request === -1) {
					debug('d3 says request error:', response.status);
				}
			} catch(e) {
				debug('error parsing json response from d3', e);
			}
		});

	}
};

// Return config fields for web config
instance.prototype.config_fields = function () {
	var self = this;

	return [
		{
			type: 'text',
			id: 'info',
			width: 12,
			label: 'Information',
			value: 'This module uses the JSON interface in the d3/disguise server to control multiple transports individually'
		},
		{
			type: 'textinput',
			id: 'host',
			label: 'd3 IP',
			width: 6,
			default: '192.168.0.2',
			regex: self.REGEX_IP
		},
		{
			type: 'textinput',
			id: 'port',
			label: 'd3 Multi Transport Port',
			width: 6,
			default: '54321',
			regex: self.REGEX_PORT
		}

	]
};

// When module gets deleted
instance.prototype.destroy = function() {
	var self = this;

	if (self.socket !== undefined) {
		self.socket.destroy();
	}

	debug("destroy", self.id);;
};

instance.prototype.actions = function(system) {
	var self = this;
	self.system.emit('instance_actions', self.id, {
		'timecode': {
			label: 'Track Command w/timecode',
			options: [
				{
					type:  'dropdown',
					label: 'Command',
					id:    'command',
					default: 'playSection',
					choices: [
						{ id: 'play',  label: 'Play' },
						{ id: 'playSection', label: 'Play Section' },
						{ id: 'stop',  label: 'Stop' },
						{ id: 'pause', label: 'Pause' },
					]
				},
				{
					type:  'textinput',
					label: 'Player (Transport Manager)',
					id:    'player',
					default: '',
					regex: self.REGEX_SOMETHING
				},
				{
					type:  'textinput',
					label: 'Transition time (secs)',
					id:    'player',
					default: '',
					regex: self.REGEX_FLOAT_OR_INT
				},
				{
					type: 'textinput',
					label: 'Location (optional)',
					id: 'location',
					default: '00:00:00:00',
					regex: self.REGEX_TIMECODE
				}
			]
		},
		'notimecode': {
			label: 'Track Command',
			options: [

				{
					type: 'dropdown',
					label: 'Command',
					id: 'command',
					default: 'play',
					choices: [
						{ id: 'play',  label: 'Play' },
						{ id: 'playSection', label: 'Play Section' },
						{ id: 'loop',  label: 'Loop section' },
						{ id: 'stop',  label: 'Stop' },
					]
				},

				{
					type: 'textinput',
					label: 'Player/transport name',
					id: 'player',
					default: '',
					regex: self.REGEX_SOMETHING
				},

				{
					type: 'textinput',
					label: 'Transition time (secs)',
					id: 'transition',
					default: '0',
					regex: self.REGEX_FLOAT_OR_INT
				},

			]
		}
	});
}

instance.prototype.action = function(action) {
	var self = this;
	console.log("Sending some action", action);

	var cmd = action.action;

	cmd +="test\n";

	if (cmd !== undefined) {

		debug('sending tcp',cmd,"to",self.config.host);


		var track_command = {};

		if (action.action == 'notimecode') {
			track_command = {
				"command": action.options.command,
				"player": action.options.player,
				"transition": action.options.transiton
			};
		}
		else if (action.action == 'timecode') {
			track_command = {
				"location": action.options.location,
				"command": action.options.command,
				"player": action.options.player,
				"transition": action.options.transiton
			};
		}

		var command = {
			"request":self.request_id++,
			"track_command":track_command
		};

		var cmd = JSON.stringify(command) + "\n";

		if (self.socket !== undefined && self.socket.connected) {
			self.socket.send(cmd);
		} else {
			debug('Socket not connected :(');
		}

	}
};

instance_skel.extendedBy(instance);
exports = module.exports = instance;
