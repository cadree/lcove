/**
 * Surfaces switched off in the Nov 14 simplification. Each flag only hides UI;
 * no table, row, or route data is removed, so turning a flag back on restores
 * the surface as it was.
 */
export const features = {
  /** Profile "Blogs" tab and "Write a blog". Existing blog pages stay reachable at /blog/:id. */
  profileBlogs: false,
  /** Profile "Saved" tab. It was a static placeholder that never listed saved posts. */
  profileSavedTab: false,
  /** "Add film" form on profiles. Existing film links still show for profiles that have them. */
  profileFilmForm: false,
  /** Seeded "Example" stores and products in the Community Mall. */
  exampleContent: false,
} as const;

export type FeatureName = keyof typeof features;

export function featureOn(name: FeatureName): boolean {
  return features[name];
}
