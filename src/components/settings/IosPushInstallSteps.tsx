export function IosPushInstallSteps() {
  return (
    <div className="mt-2 space-y-2 text-sm text-foreground" data-testid="ios-push-steps">
      <p>iPhone Safari only sends push from the Home Screen app, on iOS 16.4 or later.</p>
      <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
        <li>Tap Share</li>
        <li>Tap Add to Home Screen</li>
        <li>Open Ether from your Home Screen</li>
        <li>Turn on push there</li>
      </ol>
    </div>
  );
}
