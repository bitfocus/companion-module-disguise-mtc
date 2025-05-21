const { InstanceBase, Regex, runEntrypoint, InstanceStatus } = require('@companion-module/base');
const net = require('net');

const UpdateActions = require('./actions');

class ModuleInstance extends InstanceBase {
	constructor(internal) {
		super(internal);
		this.socket = null;
		this.config = {}; // Initialize config object
		this.isDestroyed = false; // Flag to track if the instance is in a destroyed state
	}

	async init(config) {
		this.config = config; // Store the initial config
		this.isDestroyed = false; // Reset destroyed flag

		// Define actions
		this.updateActions();

		// Set an initial status. The connection attempt will be triggered by configUpdated.
		// If host/port are not even in the initial config (e.g. truly empty, not even defaults),
		// then it's a BadConfig state. Otherwise, we wait for configUpdated.
		if (!this.config.host || !this.config.port) {
			this.updateStatus(InstanceStatus.BadConfig, 'Host or Port not configured. Please save configuration.');
			this.log('warn', 'Initial: Host or Port not configured. Please configure and save.');
		} else {
			// Host and Port are present (e.g. defaults).
			// We will let configUpdated handle the first connection attempt.
			this.updateStatus(InstanceStatus.Disconnected, 'Waiting for configuration to be applied.');
		}
	}

	async initSocket() {
		this.isDestroyed = false; // Reset destroyed flag for this connection attempt

		// Clean up existing socket if any (e.g., from a previous attempt or config update)
		if (this.socket) {
			this.socket.removeAllListeners();
			this.socket.destroy();
			this.socket = null;
		}

		const host = this.config.host;
		const port = parseInt(this.config.port, 10);

		if (!host || !port || port === 0) {
			this.updateStatus(InstanceStatus.BadConfig, 'Host or Port not configured properly for connection.');
			this.log('warn', 'Connection attempt aborted in initSocket: Host or Port not configured properly.');
			return false;
		}

		this.updateStatus(InstanceStatus.Connecting, `Connecting to ${host}:${port}`);

		return new Promise((resolve) => {
			this.socket = new net.Socket();
			this.socket.setTimeout(5000);

			this.socket.on('connect', () => {
				if (this.isDestroyed) { // Check if module was destroyed during connection attempt
					if (this.socket) { this.socket.destroy(); this.socket = null; }
					resolve(false); return;
				}
				this.log('info', `Connected to ${host}:${port}`);
				this.updateStatus(InstanceStatus.Ok);
				this.socket.setTimeout(0); // Clear the connection timeout
				resolve(true); // Connection successful
			});

			this.socket.on('timeout', () => {
				if (this.isDestroyed) {
					this.log('debug', 'Socket connection timeout event received after module destruction, ignoring.');
					resolve(false); return;
				}
				this.log('error', `Connection attempt timeout to ${host}:${port}`);
				this.updateStatus(InstanceStatus.ConnectionFailure, 'Connection Timeout');
				if (this.socket) {
					this.socket.destroy();
				}
				// this.socket will be set to null in 'close' handler
				resolve(false); // Connection failed
			});

			this.socket.on('error', (err) => {
				if (this.isDestroyed) {
					this.log('debug', `Socket error event received after module destruction: ${err.message}. Ignoring.`);
					resolve(false); return;
				}
				this.log('error', `Socket error: ${err.message} (Code: ${err.code})`);
				if (this.instanceOptions.status !== InstanceStatus.ConnectionFailure) {
					this.updateStatus(InstanceStatus.ConnectionFailure, err.code || 'Socket Error');
				}
				if (this.socket && !this.socket.destroyed) {
					this.socket.destroy();
				}
				// this.socket will be set to null in 'close' handler
				resolve(false); // Connection failed or an error occurred during connection attempt
			});

			this.socket.on('close', (hadError) => {
				if (this.isDestroyed) {
					this.log('debug', 'Socket close event received after module destruction, ignoring.');
					return;
				}
				this.log('warn', `Connection closed. Had error: ${hadError}`);
				this.socket = null; 
				try {
					const currentStatusInternal = this.instanceOptions.status;
					if (currentStatusInternal === InstanceStatus.Ok || currentStatusInternal === InstanceStatus.Connecting) {
						this.updateStatus(InstanceStatus.Disconnected, hadError ? 'Connection Closed with Error' : 'Connection Closed by Server/Network');
					}
				} catch (e) {
					this.log('error', `Critical error in 'close' handler while trying to update status: ${e.message}. Module might be unstable.`);
				}
			});

			this.socket.on('data', (data) => {
				if (this.isDestroyed) {
					this.log('debug', 'Socket data event received after module destruction, ignoring.');
					return;
				}
				this.log('debug', `Received data: ${data.toString().trim()}`);
			});

			this.log('info', `Attempting to connect to ${host}:${port}`);
			try {
				this.socket.connect(port, host);
			} catch (e) { // Catch synchronous errors from socket.connect() itself
				this.log('error', `Failed to initiate connection (synchronous error): ${e.message}`);
				this.updateStatus(InstanceStatus.ConnectionFailure, 'Connection Init Failed');
				if (this.socket) {
					this.socket.destroy();
				}
				this.socket = null;
				resolve(false); // Connection attempt failed
			}
		});
	}

	async destroy() {
		this.log('debug', 'Destroying module instance...');
		this.isDestroyed = true; // Set the flag to indicate the instance is being destroyed

		if (this.socket) {
			this.socket.removeAllListeners();
			this.socket.destroy();
			this.socket = null;
		}

		this.updateStatus(InstanceStatus.Disconnected, 'Module Destroyed');
		this.log('debug', 'Module instance destroyed.');
	}

	async configUpdated(config) {
		const oldHost = this.config.host; // Get current host/port before updating this.config
		const oldPort = this.config.port;
		let oldSocketState = this.socket ? (!this.socket.destroyed && this.socket.writable) : false;

		this.config = config; // Apply the new config passed by Companion

		// Update actions
		this.updateActions();

		let needsConnectionAttempt = false;

		// Determine if a connection attempt is needed:
		// 1. Config has valid host/port, AND EITHER
		//    a. Host or port actually changed, OR
		//    b. Socket doesn't exist or is not healthy (covers initial load, restart, or dropped connection)
		if (this.config.host && this.config.port) {
			if (this.config.host !== oldHost || this.config.port !== oldPort) {
				this.log('info', 'Host or Port configuration changed.');
				needsConnectionAttempt = true;
			} else if (!this.socket || this.socket.destroyed || !this.socket.writable) {
				// This condition handles the first call after init (socket is null),
				// or if the socket dropped for some reason and config is re-applied/saved.
				this.log('info', 'Socket is not present or not healthy; configuration appears valid.');
				needsConnectionAttempt = true;
			}
		}

		if (needsConnectionAttempt) {
			this.log('info', 'Configuration applied or updated, attempting to (re)initialize connection.');
			await this.initSocket(); // Attempt/Re-attempt connection
		} else if (!this.config.host || !this.config.port) {
			// Config is invalid (no host/port)
			this.updateStatus(InstanceStatus.BadConfig, 'Host or Port not configured.');
			this.log('warn', 'configUpdated: Host or Port not configured.');
			if (this.socket) { // Ensure any existing socket is closed if config becomes invalid
				this.socket.removeAllListeners();
				this.socket.destroy();
				this.socket = null;
			}
		}
		// If config is valid, unchanged, and socket is healthy, do nothing regarding connection.
	}

	getConfigFields() {
		return [
			{
				type: 'static-text',
				id: 'info',
				label: 'Information',
				width: 12,
				value: 'This module uses a Telnet-like interface to send JSON commands to the target device.',
			},
			{
				type: 'textinput',
				id: 'host',
				label: 'Target IP',
				width: 8,
				default: '192.168.0.10',
				regex: Regex.IP,
			},
			{
				type: 'textinput',
				id: 'port',
				label: 'Target Port',
				width: 4,
				default: '54321',
				regex: Regex.PORT,
			},
		];
	}

	updateActions() {
		UpdateActions(this);
	}
}

runEntrypoint(ModuleInstance, []);