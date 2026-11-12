# iPhone testing and App Store resubmission

Updated November 10, 2026. This supersedes conflicting historical instructions in ios-release.md. PR #86 remains unmerged. Do not submit a staging-backed archive as the public App Store release.

## Current state

- PR #86 is open and ready; its GitHub CI passed.
- Xcode 26.2 compiled an unsigned Release archive successfully after Capacitor sync and a clean package-resolution retry. Sync also registered the existing Share plugin in the Swift package manifest.
- The local web assets are now built for **ether-staging**, project `vjdrihmriufkameqngfg`, not production. No server.url is configured.
- Staging was ACTIVE_HEALTHY when checked. A read-only REST probe confirmed `store_items.is_digital` is absent. The `process-email-queue` and `purchase-store-item` functions are not installed there. Those features cannot be validated end-to-end yet.
- No production DB change, merge, function deployment, signed upload, or App Store submission was performed.

## Backend prerequisite (before full phone testing)

In Supabase, select **ether-staging**, reference `vjdrihmriufkameqngfg`. Do not select ether-prod (`aykopqinnnssxdhxqruo`).

1. In SQL Editor, review and run the entire file `supabase/migrations/20261105120000_content_report_alerts.sql`, then the entire file `supabase/migrations/20261105121000_store_item_digital_classification.sql`. If an existing queue/table/function is absent, stop and resolve that prerequisite; do not replay the whole production schema blindly. The moderation trigger state was not queried directly.
2. Verify a monitored test admin has the admin role. The queue worker needs a separately authorized staging deployment and its existing Resend/internal-secret configuration; see apple-fixes-verification.md. The purchase function also needs a staging deployment before checkout testing. Keep payment-provider credentials in test mode for staging. Never copy production payment keys into staging.
3. Create/label disposable listings: physical item, digital item, unclassified item, and real studio rental. Digital and unclassified purchase controls must be absent on native iOS; physical/rental controls should remain available.
4. Report test content and confirm the admin receives the email. Check `email_send_log` and the transactional dead-letter queue. A queued report alone does not prove email delivery.

These are deployment/database steps; the earlier no-deploy instruction remains in force. The SQL files are prepared, but were not applied automatically.

## Get the updated app onto your iPhone

The previously installed App Store/TestFlight build will not contain this unmerged branch automatically.

### Directly from this Mac

1. Connect and unlock the iPhone, and accept Trust This Computer if prompted.
2. Open `ios/App/App.xcodeproj` from the **lcove-apple-fixes** checkout, not the separate Desktop/lcove checkout.
3. Select scheme **App** and your physical iPhone as the run destination.
4. Select App target → Signing & Capabilities. Choose your existing team `926NTNU4M7` and use automatic signing. Preserve bundle ID `app.lovable.e07d9c457fd949f78f3cc7d5998be668`.
5. If Xcode asks, enable Settings → Privacy & Security → Developer Mode on the phone, restart, and confirm. Then click Run in Xcode. The unsigned archive produced here cannot itself be installed; Xcode must sign the device build.
6. If signing fails, capture the exact Xcode error. Do not change the bundle ID or delete existing signing identities to get past it.

### Through TestFlight

A signed build must first be uploaded. App Store Connect → your app → TestFlight → Internal Testing: select/create an internal group, add the processed build and your eligible App Store Connect user. Accept the invitation in TestFlight on your phone and install that specific build. This is an alternative to direct Xcode Run, not a step completed here.

## Phone test checklist

Use disposable staging accounts and test content. Record iPhone model, iOS version, app version/build, and pass/fail. Screen-record failures with taps and keyboard visible.

1. **Signup:** open Join. Terms must begin unticked and Join disabled. Tick Terms; Join becomes available. Open Terms and Privacy links. Use a fresh staging account to verify signup.
2. **Group chat:** Messages → new message → Group Chat. Tap Create with no selections: missing people/name must be explained. Select one person: it must ask for one more. Select two and add a name: create the group and send a test message. Search for someone outside the first results page. Verify an unmatched search shows an empty message.
3. **Create menu:** test Post and Story; the composer stays open when the menu closes. Store item opens My Store/add item (or setup if needed); Board, Collective and Cinema open their create flows. Mall → Studios shows the Studios tab.
4. **Keyboard:** Profile → Customize → Music → Album Name, project role/deliverable fields, Add Contact and Invite Audience. Focus the lowest field, type, dismiss/reopen the keyboard and scroll. Fields and Save/Create controls must remain reachable. Repeat after returning from background. The app is portrait-only; do not expect landscape support.
5. **Safe areas:** Profile → Edit Layout, fullscreen video, Store and project details. Cancel/Save/close controls must be below the notch/status bar and bottom actions above the home indicator.
6. **Numbers:** clear a project Slots field, enter 12, then tap elsewhere: it stays 12. Enter 0: slots clamp to 1 on blur. Test membership minimum and contract notice days (0 is allowed for notice days). No field should snap back mid-entry.
7. **Layout:** use the size menu and visibility switch without dragging the row. Drag only using the grip. Save, close and reopen; verify order/size/visibility persist.
8. **Music:** upload a real audio file or add a supported music link. Profile Music should enable. Upload HEIC cover artwork from Photos. Tap **Save Changes**, close customization, reload the profile and reopen the app. Verify song and artwork persist. Closing without saving is intentionally not a publish action.
9. **Safety:** report disposable content, block its author, verify blocking takes effect, and confirm the admin receives the report. Using a disposable account only, verify Settings account deletion. Do not delete your main account.
10. **Links and purchases:** exercise project links from Calendar/Event Detail and messaging links from attendees/collectives. Verify the correct record opens. Test physical checkout only with staging/test payment credentials; confirm digital/unclassified purchases cannot be started in the native app, including direct product links.

Also reproduce group creation at iPad width. The build remains iPhone-only, but review compatibility and wide browser layouts still matter.

## App Store Connect, after device tests pass

1. Open the existing **ETHER by LCOVE** app (Apple ID `6758372010`). Confirm the app record matches the bundle ID above. Do not create a second app.
2. Check the actual rejected version and latest uploaded build. The checkout says version **1.0.1**, build **2**; this is not proof that build 2 is still unused. Choose an unused higher build number before uploading.
3. For the release candidate, rebuild with the intended production public-client settings only after the production migrations/functions are deliberately rolled out. Run the web build and `npx cap sync ios` again. Never upload the local staging or dummy-configured archive as the public release.
4. Xcode: choose a generic iOS device destination, Product → Archive. Organizer → Validate App, then Distribute App → App Store Connect → Upload. Use your signing team. Do not select an internal-only distribution if this same build is intended for App Review.
5. Wait for processing; select the new build on the rejected version's page. Complete any export-compliance questions truthfully. The plist sets non-exempt encryption false; confirm the final app uses only exempt encryption before relying on that declaration.
6. App Privacy: reconcile answers with the actual app/backend and archive privacy report. The manifest declares linked account/contact/city/identifier/content/purchase/interaction/CRM/profile data, app functionality, and no tracking. The manifest does not automatically complete App Store Connect's privacy questionnaire.
7. Verify public privacy/support URLs work without login, age rating reflects messaging and user-generated content, and screenshots match the new build. Follow the sizes currently shown by App Store Connect and Apple's specification page. Browser QA images in this PR are not App Store marketing screenshots. This target is iPhone-only; disregard the old guide's claim that it targets iPhone and iPad.
8. App Review Information: provide a working reviewer account that bypasses waitlist barriers, with two discoverable test contacts and access to relevant features. Enter credentials directly in App Store Connect, not GitHub. Include exact steps below after verifying them.
9. In App Review, respond to the rejection explaining the tested changes. Attach a short device recording if it clarifies group creation. Select the replacement build, add the corrected version to review and submit the updated submission. The precise action varies with the current rejection/submission status.
10. Select manual release if you want to control publication after approval. No upload, submission or release has been performed by this chat.

## Review-notes draft — use only after verifying every claim

“Build [VERSION/BUILD] addresses Guidelines 2.1(a) and 1.2. To create a group: sign in using the review credentials, open Messages, start a new message, choose Group Chat, select [TEST CONTACT 1] and [TEST CONTACT 2], enter a group name, and tap Create Group. Missing inputs now produce explicit guidance and controls remain accessible above the keyboard.

New accounts must explicitly accept our Terms/EULA. The Terms explain our zero-tolerance policy, reporting/blocking tools and 24-hour moderation response. Reports notify our monitored admin inbox; we verified delivery and moderation using test content. [INSERT VERIFIED REPORT/BLOCK STEPS.] Digital store purchases are unavailable in this iOS build. [ADD ANY NEEDED ACCESS NOTES.]”

Do not send this paragraph until report delivery and device behavior have actually been verified.

## Apple references

- Internal testers: https://developer.apple.com/help/app-store-connect/test-a-beta-version/add-internal-testers
- Submission statuses: https://developer.apple.com/help/app-store-connect/reference/app-information/app-and-submission-statuses
- Screenshot specifications: https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications
- Distribution: https://developer.apple.com/documentation/Xcode/distributing-your-app-for-beta-testing-and-releases
