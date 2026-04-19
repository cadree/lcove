import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, KeyRound, CheckCircle2, XCircle, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useCheckInAttendee, type CheckInResult } from "@/hooks/useEventCheckIn";
import { cn } from "@/lib/utils";

interface CheckInScannerProps {
  eventId: string;
}

const SCANNER_ID = "event-checkin-scanner-region";

export function CheckInScanner({ eventId }: CheckInScannerProps) {
  const [mode, setMode] = useState<"camera" | "manual">("camera");
  const [scanning, setScanning] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [lastResult, setLastResult] = useState<CheckInResult | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScanRef = useRef<{ code: string; at: number } | null>(null);
  const checkIn = useCheckInAttendee(eventId);

  const stopCamera = async () => {
    const s = scannerRef.current;
    if (!s) return;
    try {
      if (s.isScanning) await s.stop();
      await s.clear();
    } catch {}
    scannerRef.current = null;
    setScanning(false);
  };

  const startCamera = async () => {
    if (scannerRef.current) return;
    try {
      const html5 = new Html5Qrcode(SCANNER_ID, { verbose: false });
      scannerRef.current = html5;
      await html5.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        async (decoded) => {
          // Debounce duplicate scans within 2.5s
          const now = Date.now();
          if (lastScanRef.current && lastScanRef.current.code === decoded && now - lastScanRef.current.at < 2500) return;
          lastScanRef.current = { code: decoded, at: now };
          const result = await checkIn.mutateAsync({ qrCode: decoded, method: "qr" });
          setLastResult(result);
        },
        () => {
          // ignore frame-level decode errors
        }
      );
      setScanning(true);
    } catch (err: any) {
      setScanning(false);
      scannerRef.current = null;
      setLastResult({ success: false, error: err?.message || "camera_unavailable" });
    }
  };

  useEffect(() => {
    if (mode === "camera") {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    const result = await checkIn.mutateAsync({ qrCode: manualCode, method: "manual" });
    setLastResult(result);
    if (result.success) setManualCode("");
  };

  return (
    <div className="space-y-4">
      <Tabs value={mode} onValueChange={(v) => setMode(v as "camera" | "manual")}>
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="camera" className="gap-2">
            <Camera className="h-4 w-4" /> Camera
          </TabsTrigger>
          <TabsTrigger value="manual" className="gap-2">
            <KeyRound className="h-4 w-4" /> Manual
          </TabsTrigger>
        </TabsList>

        <TabsContent value="camera" className="mt-4 space-y-3">
          <div
            id={SCANNER_ID}
            className="w-full max-w-sm mx-auto aspect-square rounded-xl overflow-hidden bg-muted/30 border border-border/40"
          />
          <p className="text-xs text-center text-muted-foreground">
            {scanning ? "Point at attendee QR code" : "Starting camera…"}
          </p>
        </TabsContent>

        <TabsContent value="manual" className="mt-4">
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <Input
              placeholder="Paste QR code or ticket #"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              autoFocus
            />
            <Button type="submit" disabled={!manualCode.trim() || checkIn.isPending}>
              {checkIn.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Check In"}
            </Button>
          </form>
        </TabsContent>
      </Tabs>

      {lastResult && <ResultCard result={lastResult} />}
    </div>
  );
}

function ResultCard({ result }: { result: CheckInResult }) {
  const success = result.success;
  const isWarning = result.error === "already_checked_in";
  const Icon = success ? CheckCircle2 : isWarning ? AlertCircle : XCircle;
  const colorClass = success
    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600"
    : isWarning
    ? "border-amber-500/40 bg-amber-500/10 text-amber-600"
    : "border-destructive/40 bg-destructive/10 text-destructive";

  const errorLabels: Record<string, string> = {
    invalid_qr: "Invalid ticket",
    wrong_event: "Wrong event",
    not_authorized: "Not authorized",
    attendee_not_active: "Cancelled / refunded",
    already_checked_in: "Already checked in",
    not_authenticated: "Sign in required",
  };

  return (
    <Card className={cn("border-2", colorClass.split(" ").slice(0, 2).join(" "))}>
      <CardContent className="p-4 flex items-start gap-3">
        <Icon className={cn("h-6 w-6 shrink-0", colorClass.split(" ").slice(2).join(" "))} />
        <div className="flex-1 min-w-0">
          {result.attendee ? (
            <>
              <p className="font-semibold truncate">{result.attendee.name || "Attendee"}</p>
              <p className="text-xs text-muted-foreground truncate">
                {result.attendee.ticket_number}
                {result.attendee.tier_name && ` · ${result.attendee.tier_name}`}
              </p>
              {result.attendee.email && (
                <p className="text-xs text-muted-foreground truncate">{result.attendee.email}</p>
              )}
            </>
          ) : (
            <p className="font-semibold">{errorLabels[result.error || ""] || "Check-in failed"}</p>
          )}
          <Badge variant="outline" className={cn("mt-2 text-[10px]", colorClass)}>
            {success ? "Checked in" : errorLabels[result.error || ""] || result.error}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
