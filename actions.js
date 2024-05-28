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

function parseLocationRegex(location) {
	const cueRegex = /^\d+(\.\d+){0,2}$/ // matches cue numbers like 1, 1.0, 1.0.0
	const timecodeRegex = /^\d{2}:\d{2}:\d{2}:\d{2}$/ // matches timecodes like 00:00:00:00

	if (cueRegex.test(location)) {
		return 'CUE ' + location
	} else if (timecodeRegex.test(location)) {
		return location
	} else {
		throw new Error('Invalid target format: ' + location)
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
					label: 'Transport',
					id: 'player',
					default: '',
					regex: '/.*/'
				},
				{
					type: 'textinput',
					label: 'Track',
					id: 'track',
					default: '',
					regex: '/.*/'
				},
				{
					type: 'textinput',
					label: 'Target',
					id: 'target',
					tooltip: 'Format as CUE number (\'1\', \'1.2\', or \'1.2.3\') or Timecode (\'00:00:00:00\').',
					default: '1.0.0',
					regex: '/^\\d+(\\.\\d+(\\.\\d+)?)?$|^\\d{2}:\\d{2}:\\d{2}:\\d{2}$/'
				}
			],
			callback: async (action) => {
				const player = await self.parseVariablesInString(action.options.player)
				const command = await self.parseVariablesInString(action.options.command)
				const track = await self.parseVariablesInString(action.options.track)
				let location

				try {
					location = await parseLocationRegex(action.options.target)
				} catch (error) {
					self.log('error', error.message)
					return
				}
	
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
					label: 'Transport',
					id: 'player',
					default: '',
					regex: '/.*/'
				},
				{
					type: 'textinput',
					label: 'Track',
					id: 'track',
					default: '',
					regex: '/.*/'
				},
				{
					type: 'textinput',
					label: 'Transition time (Seconds)',
					id: 'time',
					default: '1',
					regex: '/^\\d+(\\.\\d+)?$/', // positive float
				},
				{
					type: 'textinput',
					label: 'Target',
					id: 'target',
					default: '1.0.0',
					tooltip: 'Format as CUE number (\'1\', \'1.2\', or \'1.2.3\') or Timecode (\'00:00:00:00\').',
					regex: '/^\\d+(\\.\\d+(\\.\\d+)?)?$|^\\d{2}:\\d{2}:\\d{2}:\\d{2}$/'
				}
			],
			callback: async (action) => {
				const player = await self.parseVariablesInString(action.options.player)
				const command = await self.parseVariablesInString(action.options.command)
				const track = await self.parseVariablesInString(action.options.track)
				const transition = parseFloat(await self.parseVariablesInString(action.options.time))
				let location

				try {
					location = await parseLocationRegex(action.options.target)
				} catch (error) {
					self.log('error', error.message)
					return
				}
	
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
					label: 'Transport',
					id: 'player',
					default: '',
					regex: '/.*/'
				},
				{
					type: 'textinput',
					label: 'Track',
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
					label: 'Target',
					id: 'target',
					default: '1.0.0',
					tooltip: 'Format as CUE number (\'1\', \'1.2\', or \'1.2.3\') or Timecode (\'00:00:00:00\').',
					regex: '/^\\d+(\\.\\d+(\\.\\d+)?)?$|^\\d{2}:\\d{2}:\\d{2}:\\d{2}$/'
				}
			],
			callback: async (action) => {
				const player = await self.parseVariablesInString(action.options.player)
				const command = await self.parseVariablesInString(action.options.command)
				const track = await self.parseVariablesInString(action.options.track)
				const transitionTrack = await self.parseVariablesInString(action.options.transitionTrack)
				const transitionSection = await self.parseVariablesInString(action.options.transitionSection)
				let location

				try {
					location = await parseLocationRegex(action.options.target)
				} catch (error) {
					self.log('error', error.message)
					return
				}

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