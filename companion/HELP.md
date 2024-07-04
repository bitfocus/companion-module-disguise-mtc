# Disguise Multi Event Transport Control
For more details on the protocol, visit `https://help.disguise.one/en/Content/Configuring/Transports/Multi-Transport.htm`

Disguise provides a way to gather key information on the status of a Disguise session whilst also providing some basic timeline control.

All commands are formatted in JSON and sent over the telnet protocol.

## Setup
1. Create a new Multitransport Manager
2. Assign transport(s) to Multitransport Manager
3. Assign tracks to transports or use the automatic setlist
4. In the Multitransport Manager add an event transport and set its listening port