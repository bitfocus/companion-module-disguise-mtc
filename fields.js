const PLAY_MODES = [
	{ id: 'play', label: 'Play' },
	{ id: 'playSection', label: 'Play Section' },
	{ id: 'loop', label: 'Loop Section' },
	{ id: 'stop', label: 'Stop' },
]


function getPlayerChoices(instance) {
	const players = instance.disguiseMTC.getCachedPlayerList()
	if (players.length === 0) {
		return [{ id: 'default', label: 'default (no data from device)' }]
	}
	const sorted = [...players].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
	return sorted.map(player => ({ id: player, label: player }))
}

function getTrackChoices(instance) {
	const tracks = instance.disguiseMTC.getCachedTrackList()
	if (tracks.length === 0) {
		return [{ id: '', label: '(no data from device)' }]
	}
	const sorted = [...tracks].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
	return sorted.map(track => ({ id: track, label: track }))
}

function getSectionChoices(instance) {
	const trackList = instance.disguiseMTC.getCachedTrackList()
	
	if (trackList.length === 0) {
		return [{ id: '', label: '(no tracks available)' }]
	}
	
	const allSections = []
	
	for (const track of trackList) {
		const sections = instance.disguiseMTC.getCachedCueList(track)
		sections.forEach(section => {
			const fullLabel = `${track}: ${section}`
			allSections.push({
				id: fullLabel,
				label: fullLabel
			})
		})
	}
	
	if (allSections.length === 0) {
		return [{ id: '', label: '(no sections available)' }]
	}
	
	allSections.sort((a, b) => a.label.toLowerCase().localeCompare(b.label.toLowerCase()))
	
	return allSections
}

export function getFieldDefinitions(instance) {
	const playerChoices = getPlayerChoices(instance)
	const trackChoices = getTrackChoices(instance)
	const sectionChoices = getSectionChoices(instance)
	
	return [
		{
			type: 'dropdown',
			label: 'Command',
			id: 'command',
			default: 'playSection',
			choices: PLAY_MODES
		},
		{
			type: 'dropdown',
			label: 'Transport (Player)',
			id: 'player',
			default: playerChoices[0]?.id || 'default',
			tooltip: 'Transport to target',
			choices: playerChoices,
			minChoicesForSearch: 5,
		},
		{
			type: 'dropdown',
			label: 'Track',
			id: 'track',
			default: trackChoices[0]?.id || '',
			tooltip: 'Track to target',
			choices: trackChoices,
			minChoicesForSearch: 5,
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
			default: false,
			isVisible: (options) => !options.useTrackCrossfade
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
			default: false,
			isVisible: (options) => !options.useTimeCrossfade
		},
		{
			type: 'dropdown',
			label: 'Transition Section',
			id: 'transitionSection',
			tooltip: 'Select track and section. Format: "Track Name: Section Name"',
			default: sectionChoices[0]?.label || '',
			choices: sectionChoices,
			minChoicesForSearch: 1,
			isVisible: (options) => options.useTrackCrossfade
		},
	]
}