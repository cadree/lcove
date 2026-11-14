export interface ViewerPictureState {
  hasVideo: boolean;
  videoMuted: boolean;
  hasAudio: boolean;
}

export type ViewerPictureKind = "video" | "audio";

export type ViewerPictureEvent =
  | { type: "reset" }
  | { type: "subscribed"; kind: ViewerPictureKind; muted: boolean }
  | { type: "unsubscribed"; kind: ViewerPictureKind }
  | { type: "muted"; kind: ViewerPictureKind }
  | { type: "unmuted"; kind: ViewerPictureKind };

export const EMPTY_VIEWER_PICTURE: ViewerPictureState = {
  hasVideo: false,
  videoMuted: false,
  hasAudio: false,
};

export function reduceViewerPicture(state: ViewerPictureState, event: ViewerPictureEvent): ViewerPictureState {
  if (event.type === "reset") return EMPTY_VIEWER_PICTURE;
  if (event.kind === "audio") {
    if (event.type === "subscribed") return { ...state, hasAudio: true };
    if (event.type === "unsubscribed") return { ...state, hasAudio: false };
    return state;
  }
  switch (event.type) {
    case "subscribed":
      return { ...state, hasVideo: !event.muted, videoMuted: event.muted };
    case "unsubscribed":
      return { ...state, hasVideo: false, videoMuted: false };
    case "muted":
      return { ...state, hasVideo: false, videoMuted: true };
    case "unmuted":
      return { ...state, hasVideo: true, videoMuted: false };
    default:
      return state;
  }
}

type ViewerPhase = "connecting" | "waiting" | "watching" | "reconnecting" | "offline" | "not-configured";

/** Muted or missing video while the room is up. Audio can still be playing. */
export function hostCameraOff(state: ViewerPictureState, phase: ViewerPhase): boolean {
  if (phase === "connecting" || phase === "reconnecting" || phase === "offline" || phase === "not-configured") {
    return false;
  }
  if (state.videoMuted) return true;
  return state.hasAudio && !state.hasVideo;
}
