const PLAY_MODES = [
	{ id: 'play', label: 'Play' },
	{ id: 'playSection', label: 'Play Section' },
	{ id: 'loop', label: 'Loop Section' },
	{ id: 'stop', label: 'Stop' },
]

const ACTION_OPTIONS = [
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
		tooltip: 'Transport to target, ex: "default"',
		regex: '/.*/'
	},
	{
		type: 'textinput',
		label: 'Track',
		id: 'track',
		default: '',
		tooltip: 'Track to target, ex: "Track 1"',
		regex: '/.*/'
	},
	{
		type: 'textinput',
		label: 'Target',
		id: 'target',
		tooltip: 'Format as CUE number (\'1\', \'1.2\', or \'1.2.3\') or Timecode (\'00:00:00:00\').',
		default: '1.0.0',
		regex: '/^\\d+(\\.\\d+(\\.\\d+)?)?$|^\\d{2}:\\d{2}:\\d{2}:\\d{2}$/'
	},
	{
		type: 'checkbox',
		label: 'Use Time-based Crossfade',
		id: 'useTimeCrossfade',
		default: false
	},
	{
		type: 'textinput',
		label: 'Transition time (Seconds)',
		id: 'time',
		default: '1',
		regex: '/^\\d+(\\.\\d+)?$/',
		isVisible: (options) => options.useTimeCrossfade
	},
	{
		type: 'checkbox',
		label: 'Use Track Section Crossfade',
		id: 'useTrackCrossfade',
		default: false
	},
	{
		type: 'textinput',
		label: 'Transition Track',
		id: 'transitionTrack',
		default: '',
		regex: '/.*/',
		isVisible: (options) => options.useTrackCrossfade
	},
	{
		type: 'textinput',
		label: 'Transition Section',
		id: 'transitionSection',
		default: '',
		regex: '/.*/',
		isVisible: (options) => options.useTrackCrossfade
	}
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
			options: ACTION_OPTIONS,
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

				if (action.options.useTimeCrossfade) {
					formattedCommand.track_command.transition = parseFloat(
						await self.parseVariablesInString(action.options.time)
					)
				}

				if (action.options.useTrackCrossfade) {
					formattedCommand.track_command.transitionTrack = await self.parseVariablesInString(
						action.options.transitionTrack
					)
					formattedCommand.track_command.transitionSection = await self.parseVariablesInString(
						action.options.transitionSection
					)
				}

				sendCommand(self, formattedCommand)
			},
		},
		TransportCommand: {
			name: "Transport Command",
			options: ACTION_OPTIONS.slice(0,2),

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