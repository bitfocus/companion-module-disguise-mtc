import { Regex } from '@companion-module/base'

const REGEX_IP_OR_HOST =
	'/^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3})$|^((([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]).)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9-]*[A-Za-z0-9]))$/'

export const ConfigFields = [
	{
		type: 'static-text',
		id: 'info',
		label: 'Information',
		width: 12,
		value: `This module uses the JSON interface in the d3/disguise server to control multiple transports individually`,
	},
	{
		type: 'textinput',
		id: 'host',
		label: 'Target Host name or IP',
		width: 8,
		default: '127.0.0.1',
		regex: REGEX_IP_OR_HOST,
	},
	{
		type: 'textinput',
		id: 'port',
		label: 'Target Port',
		width: 4,
		default: 54321,
		regex: Regex.PORT,
	},
	// {
	// 	type: 'dropdown',
	// 	id: 'prot',
	// 	label: 'Connect with TCP / UDP',
	// 	default: 'tcp',
	// 	choices: [
	// 		{ id: 'tcp', label: 'TCP' },
	// 		{ id: 'udp', label: 'UDP' },
	// 	],
	// },
	// {
	// 	type: 'checkbox',
	// 	id: 'saveresponse',
	// 	label: 'Save TCP Response',
	// 	default: false,
	// 	isVisible: (configValues) => configValues.prot === 'tcp',
	// },
	// {
	// 	type: 'dropdown',
	// 	id: 'convertresponse',
	// 	label: 'Convert TCP Response Format',
	// 	default: 'none',
	// 	choices: [
	// 		{ id: 'none', label: 'No conversion' },
	// 		{ id: 'hex', label: 'To Hex' },
	// 		{ id: 'string', label: 'To String' },
	// 	],
	// 	isVisible: (configValues) => configValues.prot === 'tcp' && !!configValues.saveresponse,
	// },
]
