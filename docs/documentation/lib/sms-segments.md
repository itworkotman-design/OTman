# `lib/sms/segments.ts`

| Function | Description |
| --- | --- |
| `countSmsSegments` | Returns `{ characters, segments, unicode }` for a text. GSM-7 (æøå included) is 160/153 per segment, and extension characters such as `€` count twice. Any other character switches to UCS-2 at 70/67. GatewayAPI bills per segment. |
