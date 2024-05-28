const CHOICES_END = [
	{ id: '', label: 'None' },
	{ id: '\n', label: 'LF - \\n (Common UNIX/Mac)' },
	{ id: '\r\n', label: 'CRLF - \\r\\n (Common Windows)' },
	{ id: '\r', label: "CR - \\r (1970's RS232 terminal)" },
	{ id: '\x00', label: 'NULL - \\x00 (Can happen)' },
	{ id: '\n\r', label: 'LFCR - \\n\\r (Just stupid)' },
]

const PLAY_MODES = [
	{ id: 'play', label: 'Play' },
	{ id: 'playSection', label: 'Play Section' },
	{ id: 'loop', label: 'Loop Section' },
	{ id: 'stop', label: 'Stop' },
]

function sendCommand(self, formattedCommand) {
	const sendBuf = Buffer.from(JSON.stringify(formattedCommand) + '\n', 'latin1')

	self.log('debug', 'sending to ' + self.config.host + ': ' + sendBuf.toString())

	if (self.socket !== undefined && self.socket.isConnected) {
		self.socket.send(sendBuf)
	} else {
		self.log('debug', 'Socket not connected :(')
	}
}

export function getActionDefinitions(self) {
	return {
		GotoCue: {
			name: "Go To Cue",
			options: [
				{
					type: 'dropdown',
					label: 'Command',
					id: 'command',
					default: 'playSection',
					choices: PLAY_MODES
				},
				{
					type: 'textinput',
					label: 'Player (Transport manager)',
					id: 'player',
					default: '',
					regex: '/.*/'
				},
				{
					type: 'textinput',
					label: 'Track (Track name)',
					id: 'track',
					default: '',
					regex: '/.*/'
				},
				{
					type: 'textinput',
					label: 'CUE',
					id: 'cue',
					default: '1.0.0',
					regex: '/^\\d+(\\.\\d+(\\.\\d+)?)?$/'
				}
			],
			callback: async (action) => {
				const player = await self.parseVariablesInString(action.options.player)
				const command = await self.parseVariablesInString(action.options.command)
				const track = await self.parseVariablesInString(action.options.track)
				const location = await self.parseVariablesInString("CUE " + action.options.cue)
	
				const formattedCommand = {
					track_command: {
						player,
						command,
						track,
						location,
					},
				}
	
				sendCommand(self, formattedCommand)
			},
		},
		GotoCueXFTime: {
			name: "Go To Cue: Crossfade (Time)",
			options: [
				{
					type: 'dropdown',
					label: 'Command',
					id: 'command',
					default: 'playSection',
					choices: PLAY_MODES
				},
				{
					type: 'textinput',
					label: 'Player (Transport manager)',
					id: 'player',
					default: '',
					regex: '/.*/'
				},
				{
					type: 'textinput',
					label: 'Track (Track name)',
					id: 'track',
					default: '',
					regex: '/.*/'
				},
				{
					type: 'textinput',
					label: 'Transition time (Seconds)',
					id: 'time',
					default: '0',
					regex: '/^\\d+(\\.\\d+)?$/', // positive float
				},
				{
					type: 'textinput',
					label: 'CUE',
					id: 'cue',
					default: '1.0.0',
					regex: '/^\\d+(\\.\\d+(\\.\\d+)?)?$/'
				}
			],
			callback: async (action) => {
				const player = await self.parseVariablesInString(action.options.player)
				const command = await self.parseVariablesInString(action.options.command)
				const track = await self.parseVariablesInString(action.options.track)
				const location = await self.parseVariablesInString("CUE " + action.options.cue)
				const transition = parseFloat(await self.parseVariablesInString(action.options.time))
	
				const formattedCommand = {
					track_command: {
						player,
						command,
						track,
						location,
						transition,
					},
				}
	
				sendCommand(self, formattedCommand)
			},
		},
		GotoCueXFTrackSection: {
			name: "Go To Cue: Crossfade (Track Section)",
			options: [
				{
					type: 'dropdown',
					label: 'Command',
					id: 'command',
					default: 'playSection',
					choices: PLAY_MODES
				},
				{
					type: 'textinput',
					label: 'Player (Transport manager)',
					id: 'player',
					default: '',
					regex: '/.*/'
				},
				{
					type: 'textinput',
					label: 'Track (Track name)',
					id: 'track',
					default: '',
					regex: '/.*/'
				},
				{
					type: 'textinput',
					label: 'Transition Track',
					id: 'transitionTrack',
					default: '',
					regex: '/.*/'
				},
				{
					type: 'textinput',
					label: 'Transition Section',
					id: 'transitionSection',
					default: '',
					regex: '/.*/'
				},
				{
					type: 'textinput',
					label: 'CUE',
					id: 'cue',
					default: '1.0.0',
					regex: '/^\\d+(\\.\\d+(\\.\\d+)?)?$/'
				}
			],
			callback: async (action) => {
				const player = await self.parseVariablesInString(action.options.player)
				const command = await self.parseVariablesInString(action.options.command)
				const track = await self.parseVariablesInString(action.options.track)
				const location = await self.parseVariablesInString("CUE " + action.options.cue)
				const transitionTrack = await self.parseVariablesInString(action.options.transitionTrack)
				const transitionSection = await self.parseVariablesInString(action.options.transitionSection)

				const formattedCommand = {
					track_command: {
						player,
						command,
						track,
						location,
						transitionTrack,
						transitionSection
					},
				}

				sendCommand(self, formattedCommand)
			},
		},
		TransportCommand: {
			name: "Transport Command",
			options: [
				{
					type: 'dropdown',
					label: 'Command',
					id: 'command',
					default: 'playSection',
					choices: PLAY_MODES
				},
				{
					type: 'textinput',
					label: 'Player (Transport manager)',
					id: 'player',
					default: '',
					regex: '/.*/'
				},
			],
			callback: async (action) => {
				const player = await self.parseVariablesInString(action.options.player)
				const command = await self.parseVariablesInString(action.options.command)

				const formattedCommand = {
					track_command: {
						player,
						command,
					},
				}

				sendCommand(self, formattedCommand)
			},
		},
	}
}