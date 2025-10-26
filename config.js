import { Regex } from '@companion-module/base'

export const ConfigFields = [
	{
		type: 'static-text',
		id: 'info',
		label: 'Information',
		width: 12,
		value: `
		
		This module uses MultiTransport interface in disguise via JSON commands over the Telnet protocol.
		<br><br>
		<strong>WARNING:
		<br>
		Time-based fades broken in r30.8 and later.
		<br>
		Track section fades are broken in Disguise.</strong>
		<br><br>
		Remember to create a new Multitransport Manager!
		<br><br>
		`,
	},
	{
		type: 'textinput',
		id: 'host',
		label: 'Target IP Address',
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
	{
		type: 'number',
		id: 'pollInterval',
		label: 'Data Polling Interval (ms)',
		tooltip: 'How often to refresh player and track lists from the device. Set to 0 to disable automatic polling.',
		width: 12,
		default: 5000,
		min: 0,
		max: 60000,
	},
]
