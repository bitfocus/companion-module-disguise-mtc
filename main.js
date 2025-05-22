const { InstanceBase, Regex, runEntrypoint, InstanceStatus } = require('@companion-module/base');
const net = require('net'); // Node.js's native TCP networking module

const UpdateActions = require('./actions');

const INITIAL_CONNECT_TIMEOUT = 2000; // ms, for the very first connection attempt (2 seconds)
const RETRY_CONNECT_TIMEOUT = 5000;   // ms, for subsequent reconnection attempts (5 seconds)
const RETRY_DELAY = 5000;             // ms, time to wait before attempting to reconnect (5 seconds)
const DEFAULT_POLLING_INTERVAL = 5000; // ms, default for polling player/track lists (5 seconds)

class ModuleInstance extends InstanceBase {
	constructor(internal) {
		super(internal);
		this.socket = null;
		this.config = {}; // Initialize config object
		this.isDestroyed = false; // Flag to track if the instance is in a destroyed state
		this.retryTimer = null; // Timer for automatic reconnection attempts
		this.currentConnectionAttempt = null; // To manage the promise of the current initSocket call

		this.pollingTimer = null; // Timer for polling player/track lists
		this.playerList = [];     // Stores { id: 'name', label: 'name' }
		this.trackList = [];      // Stores { id: 'name', label: 'name' }
		this.incompleteData = ''; // Buffer for incomplete JSON data
	}

	async init(config) {
		this.config = config; // Store the initial config
		this.isDestroyed = false; // Reset destroyed flag on initialization
		this.clearRetryTimer(); // Clear any existing retry timers on init
		this.stopPolling(); // Clear polling on init

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

		if (this.isDestroyed || !this.config.host || !this.config.port) return;

		this.log('info', `Will attempt to reconnect in ${RETRY_DELAY / 1000} seconds.`);
		this.retryTimer = setTimeout(async () => {
			if (this.isDestroyed) return; // Check again before runnin
			this.log('info', 'Retrying connection...');
			// Don't set status to Connecting here, initSocket will do it.
			await this.initSocket(false); // Pass false for 'isInitialAttempt'
		}, RETRY_DELAY);
	}

	/**
	 * Starts periodic polling for player and track lists.
	 */
	startPolling() {
		this.stopPolling(); // Clear existing timer before starting a new one

		// Get interval from config, convert seconds to milliseconds, or use default
		// Ensure config.pollingInterval is treated as seconds
		const intervalSeconds = this.config.pollingInterval !== undefined ? Number(this.config.pollingInterval) : (DEFAULT_POLLING_INTERVAL / 1000);
		const intervalMilliseconds = intervalSeconds * 1000;
		
		// If interval is 0 or less, polling is disabled.
		if (intervalMilliseconds <= 0) {
			this.log('info', 'Polling is disabled (interval set to 0 seconds or less).');
			return; // Do not start the timer
		}

		if (this.isDestroyed || !this.socket || !this.socket.writable) {
			this.log('debug', 'Cannot start polling: Module destroyed or socket not writable.');
			return; 
		}

		this.log('debug', `Starting polling every ${intervalMilliseconds / 1000} seconds.`);
		
		// Perform initial poll immediately
		this.performPoll(); 

		// Set up the interval
		this.pollingTimer = setInterval(() => {
			this.performPoll();
		}, intervalMilliseconds);
	}

	/**
	 * Performs a single poll request for player and track lists.
	 */
	performPoll() {
		if (this.socket && this.socket.writable && !this.isDestroyed) {
			try {
				this.log('debug', 'Polling for player list...');
				this.socket.write('{"query":{"q":"playerList"}}\n');
				this.log('debug', 'Polling for track list...');
				this.socket.write('{"query":{"q":"trackList"}}\n');
			} catch (e) {
				this.log('error', `Error during polling send: ${e.message}`);
			}
		} else {
			this.log('debug', 'Socket not writable or module destroyed, skipping current poll cycle.');
			// If socket is not writable, the main socket error/close handlers should trigger reconnection logic,
			// which in turn will call stopPolling() and try to restart polling on successful reconnect.
		}
	}


	/**
	 * Stops periodic polling.
	 */
	stopPolling() {
		if (this.pollingTimer) {
			clearInterval(this.pollingTimer);
			this.pollingTimer = null;
			this.log('debug', 'Polling stopped.');
		}
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
		this.stopPolling(); 

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
		this.incompleteData = '';

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
				this.startPolling(); // Start polling on successful connection
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
				if (socket && !socket.destroyed) socket.destroy(); // This will trigger the 'close' event
			});

			socket.on('error', (err) => {
				if (this.isDestroyed || this.socket !== socket) {
					if (socket && !socket.destroyed) socket.destroy();
					if (this.socket === socket) this.socket = null;
					resolve(false); return;
				}
				this.log('error', `Socket error for ${host}:${port}: ${err.message} (Code: ${err.code})`);
				// Status update and retry will be handled by 'close' event if socket is destroyed
				if (socket && !socket.destroyed) socket.destroy(); // This will trigger the 'close' event
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
				if (this.socket === socket) this.socket = null; // Only nullify if it's the current active socket

				this.stopPolling(); // Stop polling when connection is lost

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
				this.incompleteData += data.toString();
				let boundary;
				while ((boundary = this.incompleteData.indexOf('\n')) !== -1) {
					const message = this.incompleteData.substring(0, boundary);
					this.incompleteData = this.incompleteData.substring(boundary + 1);
					this.processData(message);
				}
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
	
	processData(jsonDataString) {
		this.log('debug', `Received complete message: ${jsonDataString}`);
		try {
			const response = JSON.parse(jsonDataString);
			if (response && response.status === 'OK' && response.results) {
				let listUpdated = false;
				if (response.results.length > 0 && response.results[0].hasOwnProperty('player')) {
					this.log('debug', 'Processing playerList response.');
					const newPlayerList = response.results.map(item => ({
						id: item.player,
						label: item.player,
					}));
					// Check if the list actually changed to avoid unnecessary action updates
					if (JSON.stringify(this.playerList) !== JSON.stringify(newPlayerList)) {
						this.playerList = newPlayerList;
						listUpdated = true;
					}
					this.log('info', `Player list updated: ${this.playerList.length} players.`);
				}
				else if (response.results.length > 0 && response.results[0].hasOwnProperty('track')) {
					this.log('debug', 'Processing trackList response.');
					const newTrackList = response.results.map(item => ({
						id: item.track,
						label: item.track,
					}));
					if (JSON.stringify(this.trackList) !== JSON.stringify(newTrackList)) {
						this.trackList = newTrackList;
						listUpdated = true;
					}
					this.log('info', `Track list updated: ${this.trackList.length} tracks.`);
				}

				if (listUpdated) {
					this.updateActions(); // Re-initialize actions to update dropdowns
				}

			} else if (response && response.status !== 'OK') {
				this.log('warn', `Received non-OK status from server: ${jsonDataString}`);
			}
		} catch (e) {
			this.log('error', `Error parsing JSON response: ${e.message}. Data: ${jsonDataString}`);
		}
	}

	async destroy() {
		this.log('debug', 'Destroying module instance...');
		this.isDestroyed = true;
		this.clearRetryTimer(); // Stop any pending reconnection attempts
		this.stopPolling();

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
		const oldPollingInterval = this.config.pollingInterval; // Save old polling interval
		
		this.config = config; // Apply the new config

		let needsConnectionRestart = false;
		let needsPollingRestart = false;

		if (this.config.pollingInterval !== oldPollingInterval) {
			this.log('info', 'Polling interval changed.');
			needsPollingRestart = true; // Restart polling with new interval
		}

		if (this.config.host && this.config.port) {
			if (this.config.host !== oldHost || 
			    this.config.port !== oldPort || 
			    (!this.socket || this.socket.destroyed || !this.socket.writable)) { // Connect if connection details changed or socket is bad
				
				this.log('info', 'Configuration updated or socket state requires reconnection, attempting to re-initialize connection.');
				needsConnectionRestart = true;
			}
		} else { // Config is now invalid for connection
			this.updateStatus(InstanceStatus.BadConfig, 'Host or Port not configured.');
			this.log('warn', 'configUpdated: Host or Port not configured. Closing existing connection and stopping polling.');
			this.clearRetryTimer();
			this.stopPolling();
			if (this.socket) {
				this.socket.removeAllListeners();
				this.socket.destroy();
				this.socket = null;
			}
		}

		if (needsConnectionRestart) {
			this.clearRetryTimer(); // Stop previous retries
			await this.initSocket(false); // This will also call startPolling on success
		} else if (needsPollingRestart && this.socket && this.socket.writable && !this.isDestroyed) {
			// If only polling interval changed and we are connected, just restart polling
			this.startPolling();
		} else if (Number(this.config.pollingInterval) <= 0) {
            // If polling interval is set to 0, explicitly stop polling.
            this.stopPolling();
        }

		this.updateActions();
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
			{
				type: 'number',
				id: 'pollingInterval',
				label: 'Polling Interval (seconds)',
				width: 6,
				default: 5,
				min: 0,
				max: 3600,
				tooltip: 'Set to 0 to disable polling for player/track lists. Otherwise, interval in seconds.',
			}
		];
	}

	updateActions() {
		UpdateActions(this);
	}
}

runEntrypoint(ModuleInstance, []);