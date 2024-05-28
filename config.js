import { Regex } from '@companion-module/base'

const REGEX_IP_OR_HOST =
	'/^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3})$|^((([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]).)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9-]*[A-Za-z0-9]))$/'

export const ConfigFields = [
	{
		type: 'static-text',
		id: 'info',
		label: 'Information',
		width: 12,
		value: `
		
		This module uses MultiTransport interface in disguise via JSON commands over the Telnet protocol.
		<br>
		<br>
		Setup
		<ul>
		<li>Create a new Multitransport Manager</li>
		<li>Assign transport(s) to Multitransport Manager</li>
		<li>Assign tracks to transports or use the automatic setlist</li>
		<li>In the Multitransport Manager add an event transport and set its listening port</li>
		</ul>
		`,
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
]
