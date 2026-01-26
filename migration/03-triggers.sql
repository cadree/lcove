-- ============================================
-- ETHER Migration: Triggers
-- Target: waafzlorvnozeujjhvxu
-- Generated: 2026-01-26
-- ============================================

-- ============================================
-- AUTH TRIGGER (create profile on new user)
-- Run this in the Supabase Dashboard SQL Editor
-- ============================================

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- UPDATED_AT TRIGGERS
-- ============================================

CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_blog_posts_updated_at
  BEFORE UPDATE ON blog_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_boards_updated_at
  BEFORE UPDATE ON boards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_board_items_updated_at
  BEFORE UPDATE ON board_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_book_notes_updated_at
  BEFORE UPDATE ON book_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_book_reading_progress_updated_at
  BEFORE UPDATE ON book_reading_progress
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_booking_pages_updated_at
  BEFORE UPDATE ON booking_pages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_brand_partnerships_updated_at
  BEFORE UPDATE ON brand_partnerships
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_community_updates_updated_at
  BEFORE UPDATE ON community_updates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contact_contracts_updated_at
  BEFORE UPDATE ON contact_contracts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contact_invoices_updated_at
  BEFORE UPDATE ON contact_invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contact_quotes_updated_at
  BEFORE UPDATE ON contact_quotes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_creator_verifications_updated_at
  BEFORE UPDATE ON creator_verifications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_group_itineraries_updated_at
  BEFORE UPDATE ON group_itineraries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_home_preferences_updated_at
  BEFORE UPDATE ON home_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_live_streams_updated_at
  BEFORE UPDATE ON live_streams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_memberships_updated_at
  BEFORE UPDATE ON memberships
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_messages_updated_at
  BEFORE UPDATE ON messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_music_profiles_updated_at
  BEFORE UPDATE ON music_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_networks_updated_at
  BEFORE UPDATE ON networks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_network_content_updated_at
  BEFORE UPDATE ON network_content
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_network_subscriptions_updated_at
  BEFORE UPDATE ON network_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_preferences_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_partners_updated_at
  BEFORE UPDATE ON partners
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payout_methods_updated_at
  BEFORE UPDATE ON payout_methods
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_personal_calendar_items_updated_at
  BEFORE UPDATE ON personal_calendar_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pipelines_updated_at
  BEFORE UPDATE ON pipelines
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pipeline_stages_updated_at
  BEFORE UPDATE ON pipeline_stages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pipeline_items_updated_at
  BEFORE UPDATE ON pipeline_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_portfolio_folders_updated_at
  BEFORE UPDATE ON portfolio_folders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_posts_updated_at
  BEFORE UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profile_customizations_updated_at
  BEFORE UPDATE ON profile_customizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_questionnaire_responses_updated_at
  BEFORE UPDATE ON questionnaire_responses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reputation_scores_updated_at
  BEFORE UPDATE ON reputation_scores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stores_updated_at
  BEFORE UPDATE ON stores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_store_items_updated_at
  BEFORE UPDATE ON store_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON teams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_credits_updated_at
  BEFORE UPDATE ON user_credits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_energy_updated_at
  BEFORE UPDATE ON user_energy
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- BUSINESS LOGIC TRIGGERS
-- ============================================

-- Update conversation timestamp when message is created
CREATE TRIGGER on_message_created
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION update_conversation_timestamp();

-- Handle project application acceptance
CREATE TRIGGER on_application_status_change
  BEFORE UPDATE ON project_applications
  FOR EACH ROW EXECUTE FUNCTION handle_application_accepted();

-- Update credits when ledger entry is created
CREATE TRIGGER on_credit_ledger_insert
  AFTER INSERT ON credit_ledger
  FOR EACH ROW EXECUTE FUNCTION update_user_credits_dual();

-- Validate credit balances before update
CREATE TRIGGER validate_credit_balances_trigger
  BEFORE UPDATE ON user_credits
  FOR EACH ROW EXECUTE FUNCTION validate_credit_balances();

-- Validate profile completion before update
CREATE TRIGGER on_profile_update_validate
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION validate_profile_completion();

-- Grant genesis credits when profile is approved (access_status changes to 'active')
CREATE TRIGGER on_profile_approved
  AFTER UPDATE OF access_status ON profiles
  FOR EACH ROW
  WHEN (OLD.access_status IS DISTINCT FROM 'active' AND NEW.access_status = 'active')
  EXECUTE FUNCTION grant_genesis_credits();

-- Update reputation when review is created
CREATE TRIGGER on_review_created
  AFTER INSERT ON user_reviews
  FOR EACH ROW EXECUTE FUNCTION update_reputation_from_review();

-- Create notification preferences for new profile
CREATE TRIGGER on_profile_created_notification_prefs
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION create_notification_preferences_for_new_user();
