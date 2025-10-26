import { InstanceBase, InstanceStatus, runEntrypoint, TCPHelper } from '@companion-module/base'
import { ConfigFields } from './config.js'
import { getActions } from './actions.js'
import { upgradeScripts } from './upgrade.js'
import { DisguiseMTC } from './disguiseMTC.js'

class DisguiseMultiTransport extends InstanceBase {
	constructor(internal) {
		super(internal)
		this.disguiseMTC = new DisguiseMTC(this)
		this.receiveBuffer = ''
		this.pollTimer = null
	}

	async init(config) {
		this.log('info', 'Module initializing...')
		this.config = config

		this.initActions()

		this.init_tcp()
	}

	async configUpdated(config) {
		this.log('info', 'Config updated - reconnecting...')
		
		if (this.socket) {
			this.log('debug', 'Destroying existing socket')
			this.socket.destroy()
			delete this.socket
		}

		this.config = config

		this.initActions()

		this.stopPolling()

		this.init_tcp()
	}

	async destroy() {
		this.stopPolling()
		
		if (this.socket) {
			this.socket.destroy()
		} else {
			this.updateStatus(InstanceStatus.Disconnected)
		}
	}

	getConfigFields() {
		return ConfigFields
	}

	initActions() {
		this.setActionDefinitions(getActions(this))
	}

	async refreshMTCData() {
		this.log('debug', 'Requesting device data')

		if (this.socket && this.socket.isConnected) {
			await this.disguiseMTC.getPlayerList()
			await this.disguiseMTC.getTrackList()
		}
	}

	async refreshSectionLists() {
		const tracks = this.disguiseMTC.getCachedTrackList()
		
		if (tracks.length > 0) {
			this.log('debug', `Requesting section lists for ${tracks.length} tracks`)
			for (const track of tracks) {
				await this.disguiseMTC.getCueList(track)
			}
		}
	}

	startPolling() {
		this.stopPolling()

		const pollInterval = this.config.pollInterval || 5000 // Default 5 seconds

		if (pollInterval > 0) {
			this.log('debug', `Starting data polling every ${pollInterval}ms`)
			this.pollTimer = setInterval(() => {
				this.refreshMTCData()
			}, pollInterval)
		}
	}

	stopPolling() {
		if (this.pollTimer) {
			clearInterval(this.pollTimer)
			this.pollTimer = null
			this.log('debug', 'Stopped data polling')
		}
	}

	init_tcp() {
		if (this.socket) {
			this.socket.destroy()
			delete this.socket
		}

		this.receiveBuffer = ''

		this.updateStatus(InstanceStatus.Connecting)

		if (this.config.host) {
			this.log('info', `Connecting to ${this.config.host}:${this.config.port}`)
			this.socket = new TCPHelper(this.config.host, this.config.port)

		this.socket.on('status_change', (status, message) => {
			this.updateStatus(status, message)
			
			if (status === InstanceStatus.Ok) {
				this.refreshMTCData()
				this.startPolling()
			}
		})

			this.socket.on('error', (err) => {
				this.updateStatus(InstanceStatus.ConnectionFailure, err.message)
				this.log('error', 'Network error: ' + err.message)
			})

		this.socket.on('data', (data) => {
			this.receiveBuffer += data.toString()

			const lines = this.receiveBuffer.split('\n')
			
			this.receiveBuffer = lines.pop() || ''

			for (const line of lines) {
				if (line.trim().length === 0) continue
				const jsonResponse = JSON.parse(line)
				this.disguiseMTC.handleDeviceResponse(jsonResponse)
			}
		})
		} else {
			this.updateStatus(InstanceStatus.BadConfig)
		}
	}
}

runEntrypoint(DisguiseMultiTransport, upgradeScripts)
