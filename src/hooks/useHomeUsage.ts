import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { homeItems, type HomeItem } from "@/config/homeItems";

interface UsageData {
  item_id: string;
  click_count: number;
  last_clicked_at: string;
  is_pinned: boolean;
}

interface HomePreferences {
  auto_reorder: boolean;
  recent_visits: string[];
}

interface ScoredItem extends HomeItem {
  score: number;
  isPinned: boolean;
  clickCount: number;
}

const STORAGE_KEY = "home_usage";
const PREFS_KEY = "home_preferences";
const MAX_RECENT = 6;
const RECENCY_BONUS_HOURS = 24;

// Calculate score: click_count + recency bonus
function calculateScore(clickCount: number, lastClickedAt: string): number {
  const hoursSinceClick = (Date.now() - new Date(lastClickedAt).getTime()) / (1000 * 60 * 60);
  const recencyBonus = hoursSinceClick < RECENCY_BONUS_HOURS ? (RECENCY_BONUS_HOURS - hoursSinceClick) / RECENCY_BONUS_HOURS * 2 : 0;
  return clickCount + recencyBonus;
}

export function useHomeUsage() {
  const { user } = useAuth();
  const [usageData, setUsageData] = useState<Record<string, UsageData>>({});
  const [preferences, setPreferences] = useState<HomePreferences>({
    auto_reorder: true,
    recent_visits: [],
  });
  const [loading, setLoading] = useState(true);

  // Load data from localStorage or Supabase
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      
      if (user) {
        // Try to load from Supabase
        const [usageResult, prefsResult] = await Promise.all([
          supabase.from("home_usage").select("*").eq("user_id", user.id),
          supabase.from("home_preferences").select("*").eq("user_id", user.id).single(),
        ]);

        if (usageResult.data && usageResult.data.length > 0) {
          const usage: Record<string, UsageData> = {};
          usageResult.data.forEach((row) => {
            usage[row.item_id] = {
              item_id: row.item_id,
              click_count: row.click_count,
              last_clicked_at: row.last_clicked_at,
              is_pinned: row.is_pinned,
            };
          });
          setUsageData(usage);
        } else {
          // Fallback to localStorage
          const stored = localStorage.getItem(STORAGE_KEY);
          if (stored) setUsageData(JSON.parse(stored));
        }

        if (prefsResult.data) {
          setPreferences({
            auto_reorder: prefsResult.data.auto_reorder,
            recent_visits: (prefsResult.data.recent_visits as string[]) || [],
          });
        } else {
          const stored = localStorage.getItem(PREFS_KEY);
          if (stored) setPreferences(JSON.parse(stored));
        }
      } else {
        // Guest: use localStorage
        const storedUsage = localStorage.getItem(STORAGE_KEY);
        const storedPrefs = localStorage.getItem(PREFS_KEY);
        if (storedUsage) setUsageData(JSON.parse(storedUsage));
        if (storedPrefs) setPreferences(JSON.parse(storedPrefs));
      }
      
      setLoading(false);
    }

    loadData();
  }, [user]);

  // Track a click on a home item
  const trackClick = useCallback(async (itemId: string) => {
    const now = new Date().toISOString();
    
    setUsageData((prev) => {
      const existing = prev[itemId];
      const updated = {
        ...prev,
        [itemId]: {
          item_id: itemId,
          click_count: (existing?.click_count || 0) + 1,
          last_clicked_at: now,
          is_pinned: existing?.is_pinned || false,
        },
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });

    // Update recent visits
    setPreferences((prev) => {
      const newRecent = [itemId, ...prev.recent_visits.filter((id) => id !== itemId)].slice(0, MAX_RECENT);
      const updated = { ...prev, recent_visits: newRecent };
      localStorage.setItem(PREFS_KEY, JSON.stringify(updated));
      return updated;
    });

    // Sync to Supabase if logged in
    if (user) {
      const existing = usageData[itemId];
      await supabase.from("home_usage").upsert({
        user_id: user.id,
        item_id: itemId,
        click_count: (existing?.click_count || 0) + 1,
        last_clicked_at: now,
        is_pinned: existing?.is_pinned || false,
      }, { onConflict: "user_id,item_id" });

      const newRecent = [itemId, ...preferences.recent_visits.filter((id) => id !== itemId)].slice(0, MAX_RECENT);
      await supabase.from("home_preferences").upsert({
        user_id: user.id,
        auto_reorder: preferences.auto_reorder,
        recent_visits: newRecent,
      }, { onConflict: "user_id" });
    }
  }, [user, usageData, preferences]);

  // Toggle pin status
  const togglePin = useCallback(async (itemId: string) => {
    setUsageData((prev) => {
      const existing = prev[itemId];
      const updated = {
        ...prev,
        [itemId]: {
          item_id: itemId,
          click_count: existing?.click_count || 0,
          last_clicked_at: existing?.last_clicked_at || new Date().toISOString(),
          is_pinned: !existing?.is_pinned,
        },
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });

    if (user) {
      const existing = usageData[itemId];
      await supabase.from("home_usage").upsert({
        user_id: user.id,
        item_id: itemId,
        click_count: existing?.click_count || 0,
        last_clicked_at: existing?.last_clicked_at || new Date().toISOString(),
        is_pinned: !existing?.is_pinned,
      }, { onConflict: "user_id,item_id" });
    }
  }, [user, usageData]);

  // Toggle auto-reorder
  const toggleAutoReorder = useCallback(async () => {
    setPreferences((prev) => {
      const updated = { ...prev, auto_reorder: !prev.auto_reorder };
      localStorage.setItem(PREFS_KEY, JSON.stringify(updated));
      return updated;
    });

    if (user) {
      await supabase.from("home_preferences").upsert({
        user_id: user.id,
        auto_reorder: !preferences.auto_reorder,
        recent_visits: preferences.recent_visits,
      }, { onConflict: "user_id" });
    }
  }, [user, preferences]);

  // Reset all personalization
  const resetPersonalization = useCallback(async () => {
    setUsageData({});
    setPreferences({ auto_reorder: true, recent_visits: [] });
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(PREFS_KEY);

    if (user) {
      await Promise.all([
        supabase.from("home_usage").delete().eq("user_id", user.id),
        supabase.from("home_preferences").delete().eq("user_id", user.id),
      ]);
    }
  }, [user]);

  // Get scored and sorted items
  const scoredItems = useMemo((): ScoredItem[] => {
    return homeItems.map((item) => {
      const usage = usageData[item.id];
      return {
        ...item,
        score: usage ? calculateScore(usage.click_count, usage.last_clicked_at) : 0,
        isPinned: usage?.is_pinned || false,
        clickCount: usage?.click_count || 0,
      };
    });
  }, [usageData]);

  // Get pinned items
  const pinnedItems = useMemo(() => {
    return scoredItems.filter((item) => item.isPinned).sort((a, b) => b.score - a.score);
  }, [scoredItems]);

  // Get most used items (top 4, excluding pinned)
  const mostUsedItems = useMemo(() => {
    if (!preferences.auto_reorder) return [];
    return scoredItems
      .filter((item) => !item.isPinned && item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);
  }, [scoredItems, preferences.auto_reorder]);

  // Get recent items
  const recentItems = useMemo(() => {
    return preferences.recent_visits
      .map((id) => scoredItems.find((item) => item.id === id))
      .filter((item): item is ScoredItem => !!item)
      .slice(0, MAX_RECENT);
  }, [preferences.recent_visits, scoredItems]);

  return {
    loading,
    usageData,
    preferences,
    scoredItems,
    pinnedItems,
    mostUsedItems,
    recentItems,
    trackClick,
    togglePin,
    toggleAutoReorder,
    resetPersonalization,
  };
}
