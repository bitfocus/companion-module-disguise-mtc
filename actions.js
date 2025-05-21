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

const OPTION_TRANSPORT = {
	id: 'transport',
	type: 'textinput',
	label: 'Transport',
	default: '',
	tooltip: 'Transport to target, ex: "default".',
	useVariables: true,
};

const OPTION_TRACK = {
	id: 'track',
	type: 'textinput',
	label: 'Track',
	default: '',
	tooltip: 'Track to target, ex: "Track 1".',
	useVariables: true,
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

const OPTION_TRANSITION_TRACK = {
	type: 'textinput',
	label: 'Transition Track',
	id: 'transitionTrack',
	default: '',
	tooltip: 'Track for transition, ex: "transitions".',
	useVariables: true,
	isVisible: (options) => options.transitionType === true,
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

	// Check if it's an empty string or only whitespace after variable parsing.
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
		const logMessage = `Invalid cue format: "${cue}". Expected CUE (e.g., '1.1') or Timecode (e.g., '00:00:00:00'). Regex should have caught this.`;
		if (logger && typeof logger.log === 'function') {
			logger.log('error', logMessage);
		} else {
			console.error(logMessage);
		}
		return null;
	}
}

module.exports = function (self) {
	self.setActionDefinitions({
		go_to_cue: {
			name: 'Go to Cue / Timecode',
			options: [
				OPTION_PLAYMODE_LIMITED,
				OPTION_TRANSPORT,
				OPTION_TRACK,
				OPTION_LOCATION,
				OPTION_TRANSITION_TYPE,
				OPTION_TRANSITION_TIME,
				OPTION_TRANSITION_TRACK,
				OPTION_TRANSITION_SECTION,
			],
			callback: async (event) => {
				if (!self.socket || !self.socket.writable) {
					self.log('error', 'Socket not initialized or not writable. Cannot send command.');
					return;
				}

				const options = event.options;

				// Ensure options.xxx are treated as strings, default to empty string if undefined
				const parsedTransport = await self.parseVariablesInString(options.transport || '');
				const parsedTrack = await self.parseVariablesInString(options.track || '');
				const parsedLocation = await self.parseVariablesInString(options.location || '');


				// Validate required fields: Transport, Track, Location
				// Location is also validated by formatCue based on its regex
				if (parsedTransport === "") { // Check for empty string exactly
					self.log('error', 'Transport name cannot be empty. Command not sent.');
					return;
				}
				if (parsedTrack === "") { // Check for empty string exactly
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
					player: parsedTransport,
					track: parsedTrack,
					location: cueFormatted,
				};

				if (options.transitionType) { // User selected 'Use Track Transition'
					const parsedTransitionTrack = await self.parseVariablesInString(options.transitionTrack || '');
					const parsedTransitionSection = await self.parseVariablesInString(options.transitionSection || '');

					if (parsedTransitionTrack === "" || parsedTransitionSection === "") {
						self.log(
							'error',
							'Transition Track and Transition Section are required and cannot be empty when "Use Track Transition" is selected. Command not sent.'
						);
						return;
					}
					trackCommandPayload.transitionTrack = parsedTransitionTrack;
					trackCommandPayload.transitionSection = parsedTransitionSection;
				} else { // User selected timed transition or wants to omit it
					const parsedTransitionTime = await self.parseVariablesInString(options.transitionTime || '');

					if (parsedTransitionTime !== "") { // Only process if transitionTime is not empty
						const transitionTimeNumeric = parseFloat(parsedTransitionTime);
						// Ensure it's a non-negative number.
						if (isNaN(transitionTimeNumeric) || transitionTimeNumeric < 0) {
							self.log(
								'warn', // Changed to 'warn' as command will still be sent (without transition)
								`Invalid or negative Transition Time: "${parsedTransitionTime}". Must be a non-negative number. Command sent without timed transition.`
							);
							// Do not add 'transition' field if invalid, effectively omitting it
						} else {
							// Server expects a string for transition time if it's provided
							trackCommandPayload.transition = parsedTransitionTime; // Send as string
						}
					}
					// If parsedTransitionTime is empty, 'transition' field is not added to payload.
				}

				const commandToSend = {
					track_command: trackCommandPayload,
				};
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
				OPTION_TRANSPORT,
			],
			callback: async (event) => {
				if (!self.socket || !self.socket.writable) {
					self.log('error', 'Socket not initialized or not writable. Cannot send command.');
					return;
				}

				const options = event.options;
				const parsedTransport = await self.parseVariablesInString(options.transport || '');

				if (parsedTransport === "") { // Check for empty string exactly
					self.log('error', 'Transport name cannot be empty for "Transport Command". Command not sent.');
					return;
				}

				const playmode = options.playmode;

				const transportCommandPayload = {
					command: playmode,
					player: parsedTransport,
				};

				const commandToSend = {
					track_command: transportCommandPayload,
				};
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