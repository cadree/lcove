# Testing this release on your iPhone

Use ether-staging (`vjdrihmriufkameqngfg`), never your production account or real payments. Staging has separate users and data. This task prepared the local iOS project with staging assets. Do not run a generic rebuild with production environment variables before installing.

## Install locally

1. Connect and unlock your iPhone by USB. Choose **Trust** on the phone if asked.
2. Enable **Settings → Privacy & Security → Developer Mode** if Xcode requests it, then restart and confirm. Keep the phone unlocked.
3. Open `ios/App/App.xcodeproj` in Xcode. Select the **App** scheme and your connected iPhone.
4. In **Signing & Capabilities**, select the existing Ether team (`926NTNU4M7`) and use automatic signing. Keep the existing bundle ID `app.lovable.e07d9c457fd949f78f3cc7d5998be668`.
5. Press **Run**. Installing the staging build may replace the existing Ether app with the same bundle ID on that device. Confirm the Xcode log reports the staging project reference before entering credentials.

The saved unsigned archive proves compilation only. It cannot be installed or uploaded directly. This session found one Apple Development identity and no local Apple Distribution identity; automatic signing may obtain the required assets after the appropriate Apple account is signed in.

## Test in this order

Use two approved staging accounts (phone plus another phone/browser) and a separate new applicant. An admin must approve the two member accounts in staging. Do not give tester accounts admin privileges.

1. **Signup and application.** The Terms checkbox starts unchecked. Enter a name, email and password. Staging SMTP is configured; verify that the email includes a six-digit code, incorrect codes fail, and the right code opens onboarding. Choose a creative interest and city, accept the oath, and check the waiting screen says “A real person will review your application before you're let in.” Relaunch: the account stays pending. After an admin approves it, confirm the chosen city and creative interest appear on the profile.
2. **Explore.** Select a city, rotate/pinch the globe, switch to nearby, and swipe profiles. Check the bio/work previews and that hiding yourself removes you from discovery. Location sharing is optional; deny location permission and confirm city browsing still works.
3. **Connect and privacy.** A connects to B: no mutual chat yet. B connects to A: both receive one in-app connection notice; tapping it opens their DM. Reconnecting while already connected creates neither another chat nor another notice. Enable matches-only DMs and try a message from an unrelated third account. Test unmatch and block. With push permission granted and the recipient app backgrounded, verify the connection push arrives with the new wording. Actual push delivery still depends on staging APNs credentials and a signed device build.
4. **Creative features.** Credit a collaborator on work; accept the credit from their account. Set an “Open to” tag and find it through Explore. Complete a project and leave a vouch. Confirm profiles show vouches rather than old star reviews. Post an open call, apply from another account, then fill/close the role and check the listing updates.
5. **Travel.** Create/join a trip; open its group chat and budget. Add a $1,500 stay and $500 rental. With four members, each share should be $500. Record pledges and approve the current budget from every member. Budget/roster edits must reset approvals. Record a receipt within the agreed amount; each member confirms it. A dispute must prevent completion. No real money is collected and no booking is purchased by Ether.
6. **iPhone regression.** Open group creation with missing inputs and check the validation explains what is missing. Test Post/Story creation, music upload, profile layout controls, and numeric fields. Rotate through dialogs; verify the keyboard never hides the active input or submit button. Test the notch/home indicator, VoiceOver, reduced motion, denied permissions and an offline/reconnect cycle.

## TestFlight / App Store Connect

Finish the device smoke test first. No TestFlight upload or App Store submission was made by this task.

1. Sign in to the correct Apple account in Xcode **Settings → Accounts**. Confirm access to Ether's existing team and App Store Connect app.
2. Check the latest TestFlight build number; choose a new unused build number. Select a generic iOS device destination, then **Product → Archive** with signing enabled.
3. In Organizer, select the new **staging** archive, then **Distribute App → App Store Connect → Upload**. Do not select App Store submission or change production release settings.
4. After processing, open **App Store Connect → ETHER by LCOVE → TestFlight**, assign the build to your internal testing group and install it from TestFlight on the phone. Label the build notes “STAGING — separate test accounts, pledges only.” External testers may require Beta App Review.
5. Keep App Store submission separate from the authorized web release. Review App Privacy answers for user content, location, messages and financial/expense records before a future approved release.

Apple references: [Developer Mode](https://developer.apple.com/documentation/xcode/enabling-developer-mode-on-a-device), [internal TestFlight testers](https://developer.apple.com/help/app-store-connect/test-a-beta-version/add-internal-testers), [upload builds](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds/).
