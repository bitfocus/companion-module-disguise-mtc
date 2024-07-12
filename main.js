import { InstanceBase, InstanceStatus, runEntrypoint, TCPHelper } from '@companion-module/base'
import { ConfigFields } from './config.js'
import { getActionDefinitions } from './actions.js'

class DisguiseMultiTransport extends InstanceBase {
	async init(config) {
		this.config = config

		this.setActionDefinitions(getActionDefinitions(this))

		this.updateStatus(InstanceStatus.UnknownWarning)

		this.log(`debug`, 'Creating Disguise MTC instance')

		await this.configUpdated(config)
	}

	async configUpdated(config) {
		if (this.socket) {
			this.socket.destroy()
			delete this.socket
		}

		this.config = config

		this.init_tcp()
	}

	async destroy() {
		if (this.socket) {
			this.socket.destroy()
		} else {
			this.updateStatus(InstanceStatus.Disconnected)
		}
	}

	getConfigFields() {
		return ConfigFields
	}

	init_tcp() {
		if (this.socket) {
			this.socket.destroy()
			delete this.socket
		}

		this.updateStatus(InstanceStatus.Connecting)

		if (this.config.host) {
			this.socket = new TCPHelper(this.config.host, this.config.port)

			this.socket.on('status_change', (status, message) => {
				this.updateStatus(status, message)
				this.log('debug', 'Disguise MTC Status change: ' + status)
			})

			this.socket.on('error', (err) => {
				this.updateStatus(InstanceStatus.ConnectionFailure, err.message)
				this.log('error', 'Network error: ' + err.message)
			})

			this.socket.on('data', (data) => {
				this.log('debug', 'Received: ' + data.toString())
			})
		} else {
			this.updateStatus(InstanceStatus.BadConfig)
		}
	}
}

runEntrypoint(DisguiseMultiTransport, [])
