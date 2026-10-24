import type { ReactNode } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { PoweredByEther } from "./PoweredByEther";

export function ConfirmationScreen({
  hostName,
  hostAvatar,
  theme = "dark",
  flyerUrl,
  title,
  whenLabel,
  address,
  ticketCount,
  qrValue,
  subscribed,
  walletEnabled,
  onUpdates,
  onWallet,
  onCalendar,
  onShare,
  reminder,
}: {
  hostName: string;
  hostAvatar?: string | null;
  theme?: "light" | "dark";
  flyerUrl: string | null;
  title: string;
  whenLabel: string;
  address: string | null;
  ticketCount: number;
  qrValue: string | null;
  subscribed: boolean;
  walletEnabled: boolean;
  onUpdates: () => void;
  onWallet: () => void;
  onCalendar: () => void;
  onShare: () => void;
  reminder?: ReactNode;
}) {
  return (
    <div className={`${theme === "light" ? "light " : ""}min-h-screen bg-background px-4 py-6 text-foreground`}>
      <div className="flex items-center gap-3">
        {hostAvatar && <img src={hostAvatar} alt="" className="h-10 w-10 rounded-full object-cover" />}
        <p className="text-base font-medium">{hostName}</p>
      </div>
      <h1 className="ether-title mt-2 text-5xl">You're in.</h1>
      {flyerUrl && <img src={flyerUrl} alt="" className="mt-5 aspect-[4/5] w-full rounded-2xl object-cover" />}
      <div className="mt-5 space-y-1">
        <p className="text-xl">{title}</p>
        <p className="text-sm text-muted-foreground">{whenLabel}</p>
        {address && <p className="text-sm">{address}</p>}
        <p className="text-sm">{ticketCount} {ticketCount === 1 ? "ticket" : "tickets"}</p>
      </div>
      {qrValue && (
        <div className="mt-5 inline-flex rounded-2xl bg-white p-3">
          <QRCodeSVG value={qrValue} size={160} />
        </div>
      )}
      <div className="mt-5 grid gap-2">
        <Button variant="outline" className="rounded-full" onClick={onUpdates}>{subscribed ? "Subscribed" : "Get updates"}</Button>
        {walletEnabled && <Button variant="outline" className="rounded-full" onClick={onWallet}>Add to Apple Wallet</Button>}
        <Button variant="outline" className="rounded-full" onClick={onCalendar}>Add to calendar</Button>
      </div>
      <div className="mt-8 rounded-2xl border border-border/70 p-4">
        <p className="font-medium">More fun with friends</p>
        <p className="mt-1 text-sm text-muted-foreground">Share event</p>
        <Button className="mt-3 w-full rounded-full" onClick={onShare}>Share event</Button>
      </div>
      {reminder ? <div className="mt-4">{reminder}</div> : null}
      <PoweredByEther />
    </div>
  );
}
