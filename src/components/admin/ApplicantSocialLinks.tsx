import {
  applicantSocialLabel,
  applicantSocialUrl,
  onExternalHttpUrlClick,
} from "@/lib/applicantLinks";

export function ApplicantSocialLinks({
  links,
  emptyText,
}: {
  links: Record<string, string | undefined> | null | undefined;
  emptyText?: string;
}) {
  const entries = Object.entries(links ?? {}).filter(([, value]) => !!value?.trim());
  if (entries.length === 0) {
    return emptyText ? <p className="text-sm text-muted-foreground">{emptyText}</p> : null;
  }
  return (
    <div className="space-y-2">
      {entries.map(([key, value]) => {
        const url = applicantSocialUrl(key, value ?? "");
        return (
          <div key={key} className="min-w-0">
            <p className="text-xs text-muted-foreground">{applicantSocialLabel(key)}</p>
            {url ? (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="applicant-social-link"
                className="block break-all text-sm text-primary underline"
                onClick={(event) => onExternalHttpUrlClick(url, event)}
              >
                {value}
              </a>
            ) : (
              <p className="break-all text-sm">{value}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
