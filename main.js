const { InstanceBase, Regex, runEntrypoint, InstanceStatus } = require('@companion-module/base');
const net = require('net'); // Node.js's native TCP networking module

const UpdateActions = require('./actions');

const INITIAL_CONNECT_TIMEOUT = 2000; // ms, for the very first connection attempt (2 seconds)
const RETRY_CONNECT_TIMEOUT = 5000;   // ms, for subsequent reconnection attempts (5 seconds)
const RETRY_DELAY = 5000;             // ms, time to wait before attempting to reconnect (5 seconds)

class ModuleInstance extends InstanceBase {
	constructor(internal) {
		super(internal);
		this.socket = null;
		this.config = {}; // Initialize config object
		this.isDestroyed = false; // Flag to track if the instance is in a destroyed state
		this.retryTimer = null; // Timer for automatic reconnection attempts
		this.currentConnectionAttempt = null; // To manage the promise of the current initSocket call
	}

	async init(config) {
		this.config = config; // Store the initial config
		this.isDestroyed = false; // Reset destroyed flag on initialization
		this.clearRetryTimer(); // Clear any existing retry timers on init

		this.updateActions(); // Define actions.

		// Attempt to connect if host and port are present in the config
		if (this.config.host && this.config.port) {
			this.log('info', 'Initial configuration present, attempting to connect...');
			// Don't set status to Connecting here, initSocket will do it.
			await this.initSocket(true); // Pass true for 'isInitialAttempt'
		} else {
			this.updateStatus(InstanceStatus.BadConfig, 'Host or Port not configured. Please save configuration.');
			this.log('warn', 'Initial: Host or Port not configured. Please configure and save.');
		}
	}

	/**
	 * Clears the current retry timer if it exists.
	 */
	clearRetryTimer() {
		if (this.retryTimer) {
			clearTimeout(this.retryTimer);
			this.retryTimer = null;
			this.log('debug', 'Retry timer cleared.');
		}
	}

	/**
	 * Starts a timer to attempt reconnection after RETRY_DELAY.
	 */
	startRetryTimer() {
		this.clearRetryTimer(); // Ensure no other retry timers are running

		if (this.isDestroyed) {
			this.log('debug', 'Module is destroyed, not starting retry timer.');
			return;
		}
		if (!this.config.host || !this.config.port) {
			this.log('warn', 'Cannot start retry timer: Host or Port not configured.');
			this.updateStatus(InstanceStatus.BadConfig, 'Host or Port not configured.');
			return;
		}

		this.log('info', `Will attempt to reconnect in ${RETRY_DELAY / 1000} seconds.`);
		this.retryTimer = setTimeout(async () => {
			if (this.isDestroyed) return; // Check again before running
			this.log('info', 'Retrying connection...');
			// Don't set status to Connecting here, initSocket will do it.
			await this.initSocket(false); // Pass false for 'isInitialAttempt'
		}, RETRY_DELAY);
	}

	/**
	 * Initializes the Telnet socket connection.
	 * @param {boolean} isInitialAttempt - True if this is the first attempt on module init, false for retries/updates.
	 * @returns {Promise<boolean>} Resolves to true on successful connection, false otherwise.
	 */
	async initSocket(isInitialAttempt = false) {
		// If another connection attempt is already in progress, don't start a new one.
		// This can happen if configUpdated is called while a retry is scheduled or running.
		if (this.currentConnectionAttempt) {
			this.log('debug', 'Connection attempt already in progress. Aborting new attempt.');
			return this.currentConnectionAttempt; // Return the existing promise
		}

		this.isDestroyed = false;
		this.clearRetryTimer(); // Stop retries if we are manually initiating a connection

		// Clean up existing socket if any
		if (this.socket) {
			this.log('debug', 'Destroying existing socket before creating a new one.');
			this.socket.removeAllListeners();
			this.socket.destroy();
			this.socket = null;
		}

		const host = this.config.host;
		const port = parseInt(this.config.port, 10);

		if (!host || !port || port === 0) {
			this.updateStatus(InstanceStatus.BadConfig, 'Host or Port not configured properly for connection.');
			this.log('warn', 'Connection attempt aborted in initSocket: Host or Port not configured properly.');
			this.currentConnectionAttempt = null; // Clear the attempt flag
			return false;
		}

		this.updateStatus(InstanceStatus.Connecting, `Connecting to ${host}:${port}...`);
		this.log('info', `Attempting to connect to ${host}:${port} (Attempt type: ${isInitialAttempt ? 'Initial' : 'Retry/Update'}).`);

		this.currentConnectionAttempt = new Promise((resolve) => {
			const socket = new net.Socket();
			this.socket = socket; // Assign to instance property immediately for access in handlers

			// Use a shorter timeout for the very first attempt, longer for retries
			const connectTimeout = isInitialAttempt ? INITIAL_CONNECT_TIMEOUT : RETRY_CONNECT_TIMEOUT;
			socket.setTimeout(connectTimeout);

			socket.on('connect', () => {
				if (this.isDestroyed || this.socket !== socket) { // Check if socket is still the current one
					if (socket && !socket.destroyed) socket.destroy();
					if (this.socket === socket) this.socket = null; // Only nullify if it's the one we were working with
					resolve(false); return;
				}
				this.log('info', `Successfully connected to ${host}:${port}.`);
				this.updateStatus(InstanceStatus.Ok);
				socket.setTimeout(0); // Clear the connection timeout
				this.clearRetryTimer(); // Connection successful, stop retrying
				resolve(true);
			});

			socket.on('timeout', () => { // Triggered if .connect() takes too long
				if (this.isDestroyed || this.socket !== socket) {
					if (socket && !socket.destroyed) socket.destroy();
					if (this.socket === socket) this.socket = null;
					resolve(false); return;
				}
				this.log('error', `Connection attempt to ${host}:${port} timed out after ${connectTimeout / 1000}s.`);
				// Status will be updated by 'close' or 'error' handler if socket is destroyed
				if (socket && !socket.destroyed) {
					socket.destroy(); // This will trigger the 'close' event
				}
				// The promise is resolved in the 'close' or 'error' handler for this socket instance
			});

			socket.on('error', (err) => {
				if (this.isDestroyed || this.socket !== socket) {
					if (socket && !socket.destroyed) socket.destroy();
					if (this.socket === socket) this.socket = null;
					resolve(false); return;
				}
				this.log('error', `Socket error for ${host}:${port}: ${err.message} (Code: ${err.code})`);
				// Status update and retry will be handled by 'close' event if socket is destroyed
				if (socket && !socket.destroyed) {
					socket.destroy(); // This will trigger the 'close' event
				}
				// The promise is resolved in the 'close' or 'error' handler for this socket instance
			});

			socket.on('close', (hadError) => {
				// Check if this 'close' event is for the socket we are currently managing in this promise
				if (this.socket !== socket && this.socket !== null) { // If this.socket is null, then this might be the one closing
					this.log('debug', 'Close event for an old/stale socket instance, ignoring for current promise.');
					if (socket && !socket.destroyed) socket.destroy(); // Ensure this old socket is fully gone
					return;
				}
				if (this.isDestroyed) {
					this.log('debug', 'Socket closed after module destruction.');
					if (this.socket === socket) this.socket = null;
					resolve(false); return;
				}

				this.log('warn', `Connection to ${host}:${port} closed. Had error: ${hadError}`);
				if (this.socket === socket) { // Only nullify if it's the current active socket
					this.socket = null;
				}

				// If the connection was never established (still connecting) or was OK, then update status and attempt retry
				const currentStatus = this.instanceOptions.status;
				if (currentStatus === InstanceStatus.Connecting || currentStatus === InstanceStatus.Ok) {
					this.updateStatus(InstanceStatus.ConnectionFailure, hadError ? 'Connection Lost with Error' : 'Connection Closed');
				}
				
				this.startRetryTimer(); // Attempt to reconnect
				resolve(false); // Connection attempt ultimately failed or connection was lost
			});

			socket.on('data', (data) => {
				if (this.isDestroyed || this.socket !== socket) { return; }
				this.log('debug', `Received data: ${data.toString().trim()}`);
			});

			try {
				socket.connect({ host: host, port: port });
			} catch (e) {
				this.log('error', `Failed to initiate connection (synchronous error): ${e.message}`);
				this.updateStatus(InstanceStatus.ConnectionFailure, 'Connection Init Failed');
				if (this.socket === socket) this.socket = null; // Ensure cleanup if this was the one
				if (socket && !socket.destroyed) socket.destroy(); // This should trigger 'close'
				// startRetryTimer will be called from 'close'
				resolve(false);
			}
		});

		try {
			const result = await this.currentConnectionAttempt;
			return result;
		} finally {
			this.currentConnectionAttempt = null; // Clear the flag once the attempt is complete
		}
	}

	async destroy() {
		this.log('debug', 'Destroying module instance...');
		this.isDestroyed = true;
		this.clearRetryTimer(); // Stop any pending reconnection attempts

		if (this.socket) {
			this.socket.removeAllListeners();
			this.socket.destroy(); // This should trigger 'close' but isDestroyed flag will prevent retry
			this.socket = null;
		}
		this.currentConnectionAttempt = null; // Clear any pending connection promise

		this.updateStatus(InstanceStatus.Disconnected, 'Module Destroyed');
		this.log('debug', 'Module instance destroyed.');
	}

	async configUpdated(config) {
		const oldHost = this.config.host;
		const oldPort = this.config.port;
		
		this.config = config; // Apply the new config
		this.updateActions(); // Update actions based on new config if necessary
		
		// If config changed in a way that requires a new connection, or if socket is bad
		if (this.config.host && this.config.port) {
			if (this.config.host !== oldHost || 
			    this.config.port !== oldPort || 
			    !this.socket || 
			    this.socket.destroyed || 
			    !this.socket.writable) {
				
				this.log('info', 'Configuration updated or socket state requires reconnection, attempting to re-initialize connection.');
				// this.updateStatus(InstanceStatus.Connecting, 'Applying configuration...'); // initSocket will set this
				this.clearRetryTimer(); // Stop previous retries, new attempt will be made by initSocket
				await this.initSocket(false); // Pass false for 'isInitialAttempt'
			}
		} else {
			// New config is invalid (no host/port)
			this.updateStatus(InstanceStatus.BadConfig, 'Host or Port not configured.');
			this.log('warn', 'configUpdated: Host or Port not configured. Closing existing connection if any.');
			this.clearRetryTimer();
			if (this.socket) {
				this.socket.removeAllListeners();
				this.socket.destroy();
				this.socket = null;
			}
		}
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