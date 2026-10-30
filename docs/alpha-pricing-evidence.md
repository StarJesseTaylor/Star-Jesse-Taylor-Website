# Destination pricing mapping, 2026-10-28

GB/CY mappings retain the authenticated account inspection from October 26.
The following mappings are supported by Twilio's published sender-category
tables, not a claim that we fetched these account payloads manually:

| Destination | Numeric category equivalent to alpha | Published USD per segment |
| --- | --- | --- |
| GR | International Numbers | 0.0657 |
| HR | International Numbers | 0.1379 |
| IT | Mobile Numbers | 0.0927 |
| IL | Mobile Numbers | 0.2575 |

Sources reviewed October 28:
https://www.twilio.com/en-us/sms/pricing/gr
https://www.twilio.com/en-us/sms/pricing/hr
https://www.twilio.com/en-us/sms/pricing/it
https://www.twilio.com/en-us/sms/pricing/il

The application must still obtain authenticated USD pricing at runtime. It
selects the highest price across matching carriers/categories, applies its
existing fee allowance and 10% buffer, and multiplies by SMS segments before
budget reservation. Empty, invalid, unavailable or non-USD prices still fail
closed. Unknown alpha countries do not inherit these numeric mappings.

No launch flags, geographic permissions, consent, eligibility, spending caps
or opt-out handling are changed by this pricing correction. Belgium already
uses numeric pricing and needs separate live diagnosis. This does not prove
delivery or impose an account-wide Twilio invoice ceiling.

## Correction from reported production diagnostics, October 29

Claude relayed message_log budget holds for GR and HR showing
`types=local,mobile`. This diagnostic lists the number_type values present in
the authenticated runtime response. The published heading International
Numbers does not translate to an international API row for this account.
GR and HR therefore admit alphanumeric, local and mobile rows, retaining
the published floors above. This is reported production evidence, not a new
direct API inspection by this editing session. Offline regressions cover
each observed type, highest carrier selection and floors. Actual successful
delivery still requires production confirmation.
