import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("screen copy and controls", () => {
  it("does not limit profile music to three formats", () => {
    const music = source("components/profile/ProfileMusicSourceSelector.tsx");
    const exclusive = source("components/music/ExclusiveMusicSection.tsx");
    assert.equal(music.includes("MP3, WAV, or M4A"), false);
    assert.equal(exclusive.includes("MP3, WAV, FLAC"), false);
    assert.match(music, /AUDIO_UPLOAD_SUBTITLE/);
    assert.match(exclusive, /AUDIO_UPLOAD_REJECTED/);
  });

  it("does not tell a locked account that Ether is gone", () => {
    const locked = source("pages/Locked.tsx");
    assert.equal(/no longer available/i.test(locked), false);
    assert.match(locked, /can't open Ether/);
    assert.match(locked, /Go home/);
  });

  it("names cinema and partners for Ether", () => {
    assert.equal(source("pages/Cinema.tsx").includes("LC Cinema"), false);
    assert.equal(source("pages/Partners.tsx").includes("LC members"), false);
    assert.equal(source("components/partners/PartnerApplicationDialog.tsx").includes("LC members"), false);
    assert.equal(source("components/cinema/CreateNetworkDialog.tsx").includes("Click to upload"), false);
    assert.equal(source("components/cinema/AddContentDialog.tsx").includes("Click to upload"), false);
    assert.match(source("components/navigation/ToolsSheet.tsx"), /Studio/);
    assert.equal(source("components/navigation/ToolsSheet.tsx").includes(">Tools<"), false);
  });

  it("keeps the story favorite control outside the story button", () => {
    const avatar = source("components/stories/StoryAvatar.tsx");
    const storyButton = avatar.indexOf("View ${displayName}'s story");
    const favorite = avatar.indexOf("onToggleFavorite &&");
    const close = avatar.indexOf("</button>", storyButton);
    assert.ok(storyButton > 0);
    assert.ok(close > storyButton);
    assert.ok(favorite > close);
  });

  it("keeps the chat menu outside the conversation button", () => {
    const list = source("components/messages/ConversationList.tsx");
    assert.equal(list.includes("<motion.button"), false);
    assert.match(list, /<DropdownMenu>/);
  });
});
