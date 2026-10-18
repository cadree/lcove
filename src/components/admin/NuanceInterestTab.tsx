import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { nuanceInterestToCsv, useNuanceInterestList } from "@/hooks/useNuanceInterest";

export function NuanceInterestTab() {
  const { data, isLoading, isError } = useNuanceInterestList();
  const rows = data ?? [];

  const downloadCsv = () => {
    const csv = nuanceInterestToCsv(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "nuance-interest.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {rows.length} {rows.length === 1 ? "signup" : "signups"}
        </p>
        <Button
          variant="outline"
          className="gap-2"
          onClick={downloadCsv}
          disabled={rows.length === 0}
        >
          <Download className="h-4 w-4" />
          Download CSV
        </Button>
      </div>

      {isError ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            The interest list could not be loaded. Apply the nuance_interest migration, then refresh.
          </CardContent>
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            No one has joined yet.
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-xl border border-border/40 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>email</TableHead>
                <TableHead>item</TableHead>
                <TableHead>created_at</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={`${row.email}-${row.item}`}>
                  <TableCell className="font-mono text-xs">{row.email}</TableCell>
                  <TableCell className="font-mono text-xs">{row.item}</TableCell>
                  <TableCell className="font-mono text-xs whitespace-nowrap">{row.created_at}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
