// Full listening access (including a subscription or a free release) does not
// grant a file download. Only a completed, positive-value track purchase does.
export function canDownloadMusic(track, purchase, userId) {
  return !!userId && !!track?.allow_downloads && track.access_type !== "free"
    && purchase?.track_id === track.id
    && purchase?.buyer_user_id === userId
    && purchase?.payment_status === "paid"
    && Number(purchase?.amount_cents) > 0;
}
