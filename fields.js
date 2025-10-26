const PLAY_MODES = [
	{ id: 'play', label: 'Play' },
	{ id: 'playSection', label: 'Play Section' },
	{ id: 'loop', label: 'Loop Section' },
	{ id: 'stop', label: 'Stop' },
]

export const FIELDS = [
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
		tooltip: 'Broken in r30.8 and later',
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
		tooltip: 'Broken in r30.8 and later',
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