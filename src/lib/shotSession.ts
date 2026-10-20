/** Local screenshot session. Dev builds only. Production replaces DEV with false. */
export const SHOT_USER_ID = "00000000-0000-4000-8000-0000000000aa";

export function shotSessionEnabled(): boolean {
  return import.meta.env.DEV === true && typeof localStorage !== "undefined" && localStorage.getItem("ether-shot-user") === "1";
}

/** Dev screenshots of a signed-in archive with no stories, posts, or presence. */
export function shotContentThin(): boolean {
  return shotSessionEnabled() && localStorage.getItem("ether-shot-thin") === "1";
}

export const shotProfile = {
  id: SHOT_USER_ID,
  user_id: SHOT_USER_ID,
  display_name: "Maya Torres",
  city: "Charlotte, NC",
  city_display: "Charlotte, NC",
  city_key: "charlotte-nc",
  bio: "Portrait and street.",
  avatar_url: null,
  passion_seriousness: 3,
  access_level: "level_1" as const,
  onboarding_completed: true,
  created_at: "2026-10-01T00:00:00.000Z",
  updated_at: "2026-10-01T00:00:00.000Z",
  mindset_level: 1,
  onboarding_level: null,
  access_status: "active" as const,
  onboarding_score: null,
  passed_exam: false,
  show_only_to_passed_exam: false,
  phone: null,
  social_links: null,
};

const friend = (id: string, name: string) => ({
  user_id: id,
  display_name: name,
  avatar_url: null,
  city: "Charlotte, NC",
  city_display: "Charlotte, NC",
});

export const shotPeople = [
  friend("00000000-0000-4000-8000-0000000000b1", "Jordan Reyes"),
  friend("00000000-0000-4000-8000-0000000000b2", "Cadre Wallace"),
  friend("00000000-0000-4000-8000-0000000000b3", "Kofi Mensah"),
];

export const shotFavoriteIds = shotPeople.slice(0, 2).map((person) => person.user_id);

export function shotPosts() {
  return [
    {
      id: "0412aaaa-0000-4000-8000-000000000041",
      user_id: shotPeople[0].user_id,
      content: "Golden hour on Trade St. Looking to the west.",
      media_url: "/nuance/dynasty-denim.png",
      media_type: "photo" as const,
      post_type: "regular" as const,
      created_at: "2026-10-19T15:00:00.000Z",
      profile: shotPeople[0],
      reactions: [],
      user_reaction: null,
    },
  ];
}

export function shotStories() {
  const stories = shotPeople.map((person, index) => ({
    id: `story-${index}`,
    user_id: person.user_id,
    media_url: "/nuance/dynasty-denim.png",
    media_type: "photo" as const,
    is_live: index === 2,
    created_at: "2026-10-19T15:00:00.000Z",
    expires_at: "2099-01-01T00:00:00.000Z",
    profile: { display_name: person.display_name, avatar_url: null },
    has_viewed: false,
  }));
  const grouped: Record<string, typeof stories> = {};
  for (const story of stories) {
    grouped[story.user_id] = [story];
  }
  return { stories, grouped };
}

export function shotConversations(userId: string) {
  const now = "2026-10-19T16:00:00.000Z";
  const direct = (id: string, person: (typeof shotPeople)[number], preview: string) => ({
    id,
    type: "direct" as const,
    name: null,
    avatar_url: null,
    created_by: userId,
    created_at: now,
    updated_at: now,
    project_id: null,
    parent_conversation_id: null,
    project: null,
    participants: [
      { user_id: userId, joined_at: now, last_read_at: now, is_muted: false, project_role_name: null, profile: shotProfile },
      {
        user_id: person.user_id,
        joined_at: now,
        last_read_at: now,
        is_muted: false,
        project_role_name: null,
        profile: { display_name: person.display_name, avatar_url: null },
      },
    ],
    last_message: { content: preview, media_type: null, created_at: now, sender_id: person.user_id },
    unread_count: 0,
    is_muted: false,
    oversight: false,
  });
  return [
    direct("conv-cadre", shotPeople[1], "See you after the mixer."),
    {
      ...direct("conv-jordan", shotPeople[0], "Call sheet is in the project chat."),
      type: "group" as const,
      name: "Open Studio",
      project_id: "proj-1",
      project: {
        id: "proj-1",
        title: "Open Studio",
        description: null,
        cover_image_url: null,
        status: "open",
        timeline_start: null,
        timeline_end: null,
      },
    },
    direct(
      "conv-kofi",
      shotPeople[2],
      'ether-card:{"kind":"reel","id":"0412aaaa-0000-4000-8000-000000000041","userId":"0412bbbb-0000-4000-8000-0000000000b1","title":"Kofi","href":"/profile/0412bbbb-0000-4000-8000-0000000000b1"}',
    ),
  ];
}

export function shotOnline(userId: string): boolean {
  if (shotContentThin()) return false;
  return shotFavoriteIds.includes(userId);
}
