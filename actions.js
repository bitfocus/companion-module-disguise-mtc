import { getFieldDefinitions } from './fields.js'

export function getActions(instance) {
	const fields = getFieldDefinitions(instance)
	
	return {
		GotoCue: {
			name: "Go To Cue",
			options: fields,
			callback: async (action) => {
				await instance.disguiseMTC.sendGotoCueCommand(action.options)
			},
		},
		TransportCommand: {
			name: "Transport Command",
			options: fields.slice(0, 2),
			callback: async (action) => {
				await instance.disguiseMTC.sendTransportCommand(action.options)
			},
		},
	}
}