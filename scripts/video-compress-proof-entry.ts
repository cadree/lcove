import { prepareStorageBody } from "../src/lib/prepareStorageUpload";

type ProofResult = {
  before: number;
  after: number;
  type: string;
  contentType?: string;
  width: number;
  height: number;
  maxProgress: number;
  sameObjectWhenSmall: boolean;
};

declare global {
  interface Window {
    runProof: (file: File) => Promise<ProofResult>;
  }
}

window.runProof = async (file: File) => {
  const tiny = new File([new Uint8Array(32)], "tiny.mp4", { type: "video/mp4" });
  const kept = await prepareStorageBody(tiny);

  let maxProgress = 0;
  const prepared = await prepareStorageBody(file, (ratio) => {
    if (ratio > maxProgress) maxProgress = ratio;
  });

  const url = URL.createObjectURL(prepared.body);
  const video = document.createElement("video");
  video.preload = "metadata";
  video.src = url;
  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("compressed file did not decode"));
  });

  return {
    before: file.size,
    after: prepared.body.size,
    type: prepared.body.type,
    contentType: prepared.contentType,
    width: video.videoWidth,
    height: video.videoHeight,
    maxProgress,
    sameObjectWhenSmall: kept.body === tiny,
  };
};
