# Event confirmation SMS

SMS is off. Ether does not create a Twilio account, or any other SMS account, from this repo.

`supabase/functions/_shared/sms-provider.mjs` is the only sender. `resolveSmsProvider` returns `{ enabled: false, name: "disabled" }` unless all of the following are already set in the function environment:

- `SMS_PROVIDER` = `twilio`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`

Any other value, including an empty `SMS_PROVIDER`, stays disabled even if Twilio secrets exist for other notifications.

A buyer can check the optional consent box on checkout (“text me updates from {host}”). That choice is stored on the order. A message is sent only when the provider is enabled and the box was checked. There is no card charge for SMS inside Ether. Turning the provider on is a paid-account decision for Cadre.
