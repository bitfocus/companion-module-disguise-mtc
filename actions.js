import { FIELDS } from './fields.js'

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
			options: FIELDS,
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
			options: FIELDS.slice(0,2),

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