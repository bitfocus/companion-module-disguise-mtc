export class DisguiseMTC {
	constructor(instance) {
		this.instance = instance
		this.playerListData = []
		this.trackListData = []
		this.cueListData = {}
		this.requestCounter = 0
		this.pendingRequests = {}
	}

	async sendCommand(command) {
		const sendBuf = Buffer.from(JSON.stringify(command) + '\n', 'latin1')

		this.instance.log('debug', 'sending to ' + this.instance.config.host + ': ' + sendBuf.toString())

		if (this.instance.socket !== undefined && this.instance.socket.isConnected) {
			this.instance.socket.send(sendBuf)
		} else {
			this.instance.log('debug', 'Socket not connected :(')
		}
	}


	handleDeviceResponse(response) {
		this.instance.log('debug', 'Parsing device response: ' + JSON.stringify(response))

		try {
			const requestId = response.request
			const queryType = this.pendingRequests[requestId]

			if (requestId !== undefined) {
				this.instance.log('debug', `Response for request ${requestId} (${queryType || 'unknown'})`)
				delete this.pendingRequests[requestId]
			}

			if (response.results && Array.isArray(response.results)) {
				if (queryType === 'playerList') {
					let incomingPlayerList = response.results.map(item => item.player)
					if (incomingPlayerList.length !== this.playerListData.length) {
						this.playerListData = incomingPlayerList
						this.instance.log('info', `Transports updated: ${JSON.stringify(this.playerListData)}`)
					}

					this.instance.initActions()
				}
				else if (queryType === 'trackList') {
					let incomingTrackList = response.results.map(item => item.track)
					if (incomingTrackList.length !== this.trackListData.length) {
						this.trackListData = incomingTrackList
						this.instance.log('info', `Track list updated: ${JSON.stringify(this.trackListData)}`)
					}

					this.instance.initActions()

					this.instance.refreshSectionLists()
				}

				// The "location" field contains the section name - this is from Disguise
				else if (queryType.startsWith('cueList:')) {
					const trackName = queryType.split(':')[1]

					const incomingSectionList = response.results
						.map(item => item.location)
						.filter(location => location && location.trim().length > 0)

					const existingSectionList = this.cueListData[trackName] || []

					if (incomingSectionList.length !== existingSectionList.length) {
						this.cueListData[trackName] = incomingSectionList
						this.instance.log('info', `Section list updated for ${trackName}: ${incomingSectionList.length} sections - ${JSON.stringify(incomingSectionList)}`)
					}
					this.instance.initActions()
				}
			}

		} catch (error) {
			this.instance.log('error', `Error parsing device response: ${error.message}`)
		}
	}


	async getPlayerList() {
		const requestId = this.requestCounter++
		this.pendingRequests[requestId] = 'playerList'
		const command = { request: requestId, query: { q: 'playerList' } }
		await this.sendCommand(command)
	}

	async getTrackList() {
		const requestId = this.requestCounter++
		this.pendingRequests[requestId] = 'trackList'
		const command = { request: requestId, query: { q: 'trackList' } }
		await this.sendCommand(command)
	}

	async getCueList(track) {
		const requestId = this.requestCounter++
		this.pendingRequests[requestId] = `cueList:${track}`
		const command = { request: requestId, query: { q: `cueList ${track}` } }
		await this.sendCommand(command)
	}

	getCachedPlayerList() {
		return this.playerListData
	}

	getCachedTrackList() {
		return this.trackListData
	}

	getCachedCueList(track) {
		return this.cueListData[track] || []
	}

	async sendGotoCueCommand(options) {
		const { player, command, track, target, useTimeCrossfade, time, useTrackCrossfade, transitionSection } = options

		// Parse target location (cue number or timecode)
		let location
		try {
			location = this.parseLocation(target)
		} catch (error) {
			this.instance.log('error', `Invalid target format: "${target}". ${error.message}`)
			return
		}

		// Build track_command structure
		const formattedCommand = {
			track_command: {
				player,
				command,
				track,
				location,
			},
		}

		// Add time-based crossfade if enabled
		if (useTimeCrossfade && time) {
			formattedCommand.track_command.transition = parseFloat(time)
		}

		// Add track section crossfade if enabled
		if (useTrackCrossfade && transitionSection) {
			const colonIndex = transitionSection.indexOf(':')

			if (colonIndex > 0) {
				// Split "Track Name: Section Name" format
				const transitionTrack = transitionSection.substring(0, colonIndex).trim()
				const transitionSectionName = transitionSection.substring(colonIndex + 1).trim()

				formattedCommand.track_command.transitionTrack = transitionTrack
				formattedCommand.track_command.transitionSection = transitionSectionName
			} else {
				// Fallback: treat the whole string as section name
				this.instance.log('warn', `Transition section format invalid: "${transitionSection}". Expected "Track: Section"`)
				formattedCommand.track_command.transitionSection = transitionSection
			}
		}

		await this.sendCommand(formattedCommand)
	}

	async sendTransportCommand(options) {
		const { player, command } = options

		const formattedCommand = {
			track_command: {
				player,
				command,
			},
		}

		await this.sendCommand(formattedCommand)
	}

	// Helper to parse location (cue or timecode)
	parseLocation(location) {
		const cueRegex = /^\d+(\.\d+){0,2}$/ // matches cue numbers like 1, 1.0, 1.0.0
		const timecodeRegex = /^\d{2}:\d{2}:\d{2}:\d{2}$/ // matches timecodes like 00:00:00:00

		if (cueRegex.test(location)) {
			return 'CUE ' + location
		} else if (timecodeRegex.test(location)) {
			return location
		} else {
			throw new Error('Expected CUE number (1, 1.2, or 1.2.3) or Timecode (00:00:00:00)')
		}
	}
}