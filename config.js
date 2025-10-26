import { Regex } from '@companion-module/base'

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
		<strong>WARNING: Track fades are broken in r30.8 and later.</strong>
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
		label: 'IP address',
		width: 8,
		default: '127.0.0.1',
		regex: Regex.IP,
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
