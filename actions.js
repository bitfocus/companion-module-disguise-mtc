// Define available play modes for dropdown selection
const PLAY_MODES = [
	{ id: 'play', label: 'Play' },
	{ id: 'playSection', label: 'Play Section' },
	{ id: 'loop', label: 'Loop Section' },
	{ id: 'stop', label: 'Stop' },
];

// Define a subset of play modes for the 'go_to_cue' action
const GO_TO_CUE_PLAY_MODES = PLAY_MODES.slice(0, 3); // Takes 'play', 'playSection', 'loop'

// Common individual option definitions that can be reused
const OPTION_PLAYMODE_FULL = {
	id: 'playmode',
	type: 'dropdown',
	label: 'Play Mode',
	default: 'playSection',
	choices: PLAY_MODES, // All play modes
};

const OPTION_PLAYMODE_LIMITED = {
	id: 'playmode',
	type: 'dropdown',
	label: 'Play Mode',
	default: 'playSection',
	choices: GO_TO_CUE_PLAY_MODES, // Limited play modes
};

const OPTION_LOCATION = {
	id: 'location',
	type: 'textinput',
	label: 'Cue / Timecode',
	default: '1.1',
	tooltip: "Format as CUE number ('1', '1.2', or '1.2.3') or Timecode ('00:00:00:00').",
	regex: '/^(\\d+(\\.\\d{1,}(\\.\\d{1,})?)?|\\d{2}:\\d{2}:\\d{2}:\\d{2})$/', // Validates format, not emptiness here directly
	useVariables: true,
};

const OPTION_TRANSITION_TYPE = {
	id: 'transitionType',
	type: 'checkbox',
	label: 'Use Track Transition',
	default: false,
	tooltip: 'Use a specific track and section for the transition instead of a timed transition.',
};

const OPTION_TRANSITION_TIME = {
	id: 'transitionTime',
	type: 'textinput',
	label: 'Transition Time (Seconds)',
	default: '0',
	tooltip: 'Duration of the transition in seconds.',
	regex: '/^(?:\\d+\\.?\\d*|\\.\\d+)$/', 
	useVariables: true,
	isVisible: (options) => !options.transitionType,
};

const OPTION_TRANSITION_SECTION = {
	type: 'textinput',
	label: 'Transition Section',
	id: 'transitionSection',
	default: '',
	tooltip: 'Section on transition track, ex: "woosh" or "1.1".',
	useVariables: true,
	isVisible: (options) => options.transitionType === true,
};

/**
 * Helper function to format a CUE number or Timecode string.
 * @param {string} cue - The cue string.
 * @param {object} logger - The logger instance.
 * @returns {string|null} The formatted cue string or null if invalid.
 */
function formatCue(cue, logger) {
	const timecodeRegex = /^\d{2}:\d{2}:\d{2}:\d{2}$/;
	const cueNumberRegex = /^\d+(\.\d+(\.\d+)?)?$/;

	// Check if it's an empty string or only whitespace after variable parsing
	if (cue.trim() === "") {
		const logMessage = `Cue/Timecode cannot be an empty string or contain only whitespace. Received: '${cue}'`;
		if (logger && typeof logger.log === 'function') {
			logger.log('error', logMessage);
		} else {
			console.error(logMessage);
		}
		return null;
	}

	// This function provides final validation of content and formatting.
	if (timecodeRegex.test(cue)) {
		return cue;
	} else if (cueNumberRegex.test(cue)) {
		return `CUE ${cue}`;
	} else {
		const logMessage = `Invalid cue format: "${cue}". Expected CUE (e.g., '1.1') or Timecode (e.g., '00:00:00:00').`;
		if (logger && typeof logger.log === 'function') {
			logger.log('error', logMessage);
		} else {
			console.error(logMessage);
		}
		return null;
	}
}

module.exports = function (self) {
	
	// Dynamically create transport options based on fetched list
	const dynamicOptionTransport = {
		id: 'transport',
		type: 'dropdown',
		label: 'Transport (Player)',
		default: (self.playerList && self.playerList.length > 0) ? self.playerList[0].id : '',
		choices: (self.playerList && self.playerList.length > 0) ? self.playerList : [{ id: '', label: 'No transports loaded' }],
		tooltip: 'Select a target transport. List is updated by polling.',
	};

	// Dynamically create track options based on fetched list
	const dynamicOptionTrack = {
		id: 'track',
		type: 'dropdown',
		label: 'Track',
		default: (self.trackList && self.trackList.length > 0) ? self.trackList[0].id : '',
		choices: (self.trackList && self.trackList.length > 0) ? self.trackList : [{ id: '', label: 'No tracks loaded' }],
		tooltip: 'Select a target track. List is updated by polling.', 
	};

	// Dynamically create transition track options based on fetched list
	const dynamicOptionTransitionTrack = {
		id: 'transitionTrack',
		type: 'dropdown',
		label: 'Transition Track',
		default: (self.trackList && self.trackList.length > 0) ? self.trackList[0].id : '', // Default to first available track or empty
		choices: (self.trackList && self.trackList.length > 0) ? self.trackList : [{ id: '', label: 'No tracks loaded' }],
		tooltip: 'Select a transition track. List is updated by polling.',
		isVisible: (options) => options.transitionType === true, // Keep visibility condition
	};


	self.setActionDefinitions({
		go_to_cue: {
			name: 'Go to Cue / Timecode',
			options: [
				OPTION_PLAYMODE_LIMITED,
				dynamicOptionTransport,     // Use dynamic transport options
				dynamicOptionTrack,         // Use dynamic track options
				OPTION_LOCATION,
				OPTION_TRANSITION_TYPE,
				OPTION_TRANSITION_TIME,
				dynamicOptionTransitionTrack, // Use dynamic transition track options
				OPTION_TRANSITION_SECTION,
			],
			callback: async (event) => {
				if (!self.socket || !self.socket.writable) {
					self.log('error', 'Socket not initialized or not writable. Cannot send command.');
					return;
				}
				const options = event.options;
				const currentTransport = options.transport; 
				const currentTrack = options.track;

				const parsedLocation = await self.parseVariablesInString(options.location || '');

				if (currentTransport === "") { // Check for empty string exactly
					self.log('error', 'Transport name cannot be empty. Command not sent.');
					return;
				}
				if (currentTrack === "") { // Check for empty string exactly
					self.log('error', 'Track name cannot be empty for "Go to Cue" action. Command not sent.');
					return;
				}
				
				const cueFormatted = formatCue(parsedLocation, self);
				if (cueFormatted === null) {
					// formatCue already logs an error
					return;
				}

				const playmode = options.playmode;
				const trackCommandPayload = {
					command: playmode,
					player: currentTransport,
					track: currentTrack,
					location: cueFormatted,
				};

				if (options.transitionType) { // User selected 'Use Track Transition'
					// Value from dropdown for transitionTrack
					const currentTransitionTrack = options.transitionTrack;; 
					const parsedTransitionSection = await self.parseVariablesInString(options.transitionSection || '');
					
					if (currentTransitionTrack === "") { // Check if a track was selected/provided
						self.log('error', 'Transition Track is required and cannot be empty when "Use Track Transition" is selected. Command not sent.');
						return;
					}
					if (parsedTransitionSection === "") { // Section is also typically required
						self.log('error', 'Transition Section is required and cannot be empty when "Use Track Transition" is selected. Command not sent.');
						return;
					}

					trackCommandPayload.transitionTrack = currentTransitionTrack;
					trackCommandPayload.transitionSection = parsedTransitionSection;
				} else { // User selected timed transition or wants to omit it
					const parsedTransitionTime = await self.parseVariablesInString(options.transitionTime || '');
					if (parsedTransitionTime !== "") { // Only process if transitionTime is not empty
						const transitionTimeNumeric = parseFloat(parsedTransitionTime);
						// Ensure it's a non-negative number.
						if (isNaN(transitionTimeNumeric) || transitionTimeNumeric < 0) {
							self.log('warn', `Invalid or negative Transition Time: "${parsedTransitionTime}". Sent without timed transition.`);
						} else {
							trackCommandPayload.transition = parsedTransitionTime; // Send as string
						}
					}
				}

				const commandToSend = { track_command: trackCommandPayload };
				const message = JSON.stringify(commandToSend);
				self.log('debug', `Sending command: ${message}`);
				try {
					self.socket.write(message + '\n');
				} catch (err) {
					self.log('error', `Failed to send command: ${err.message}`);
				}
			},
		},
		transport_command: {
			name: 'Transport Command',
			options: [
				OPTION_PLAYMODE_FULL,
				dynamicOptionTransport,
			],
			callback: async (event) => {
				if (!self.socket || !self.socket.writable) {
					self.log('error', 'Socket not initialized or not writable. Cannot send command.');
					return;
				}
				const options = event.options;
				const currentTransport = options.transport;

				if (currentTransport === "") { // Check for empty string exactly
					self.log('error', 'Transport name cannot be empty for "Transport Command". Command not sent.');
					return;
				}

				const playmode = options.playmode;
				const transportCommandPayload = {
					command: playmode,
					player: currentTransport,
				};

				const commandToSend = { track_command: transportCommandPayload, };
				const message = JSON.stringify(commandToSend);
				self.log('debug', `Sending command: ${message}`);
				try {
					self.socket.write(message + '\n');
				} catch (err) {
					self.log('error', `Failed to send command: ${err.message}`);
				}
			},
		},
	});
};