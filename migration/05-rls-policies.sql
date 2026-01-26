-- ============================================
-- ETHER Migration: Row Level Security Policies
-- Target: waafzlorvnozeujjhvxu
-- Generated: 2026-01-26
-- ============================================

-- ============================================
-- ADMIN TABLES
-- ============================================

CREATE POLICY "Admins can create actions" ON admin_actions FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can view actions" ON admin_actions FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can create announcements" ON admin_announcements FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can view announcements" ON admin_announcements FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================
-- AI PROJECT MATCHES
-- ============================================

CREATE POLICY "System can create matches" ON ai_project_matches FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can view own matches" ON ai_project_matches FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can dismiss own matches" ON ai_project_matches FOR UPDATE USING (auth.uid() = user_id);

-- ============================================
-- APPOINTMENTS
-- ============================================

CREATE POLICY "Users can create own appointments" ON appointments FOR INSERT WITH CHECK (auth.uid() = owner_user_id);
CREATE POLICY "Users can view own appointments" ON appointments FOR SELECT USING (auth.uid() = owner_user_id);
CREATE POLICY "Users can update own appointments" ON appointments FOR UPDATE USING (auth.uid() = owner_user_id);
CREATE POLICY "Users can delete own appointments" ON appointments FOR DELETE USING (auth.uid() = owner_user_id);

CREATE POLICY "Team members can create team appointments" ON appointments FOR INSERT WITH CHECK ((team_id IS NOT NULL) AND is_team_member(team_id, auth.uid()));
CREATE POLICY "Team members can view team appointments" ON appointments FOR SELECT USING ((team_id IS NOT NULL) AND is_team_member(team_id, auth.uid()));
CREATE POLICY "Team members can update team appointments" ON appointments FOR UPDATE USING ((team_id IS NOT NULL) AND is_team_member(team_id, auth.uid()));
CREATE POLICY "Team members can delete team appointments" ON appointments FOR DELETE USING ((team_id IS NOT NULL) AND is_team_member(team_id, auth.uid()));

-- ============================================
-- BLOG POSTS
-- ============================================

CREATE POLICY "Users can create own blogs" ON blog_posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own blogs" ON blog_posts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Anyone can view published blogs" ON blog_posts FOR SELECT USING (is_published = true);
CREATE POLICY "Users can update own blogs" ON blog_posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own blogs" ON blog_posts FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- BOARDS
-- ============================================

CREATE POLICY "boards_insert_owner" ON boards FOR INSERT WITH CHECK (owner_user_id = auth.uid());
CREATE POLICY "boards_select_member" ON boards FOR SELECT USING ((owner_user_id = auth.uid()) OR is_board_member(id, auth.uid()));
CREATE POLICY "boards_update_owner" ON boards FOR UPDATE USING (owner_user_id = auth.uid());
CREATE POLICY "boards_delete_owner" ON boards FOR DELETE USING (owner_user_id = auth.uid());

CREATE POLICY "board_members_insert_owner_only" ON board_members FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM boards b WHERE b.id = board_members.board_id AND b.owner_user_id = auth.uid()));
CREATE POLICY "board_members_select_member" ON board_members FOR SELECT USING ((user_id = auth.uid()) OR is_board_member(board_id, auth.uid()));
CREATE POLICY "board_members_delete_owner_only" ON board_members FOR DELETE USING (EXISTS (SELECT 1 FROM boards b WHERE b.id = board_members.board_id AND b.owner_user_id = auth.uid()));

CREATE POLICY "items_insert_editor_or_owner" ON board_items FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM board_members bm WHERE bm.board_id = board_items.board_id AND bm.user_id = auth.uid() AND bm.role = ANY (ARRAY['owner', 'editor'])));
CREATE POLICY "items_select_member" ON board_items FOR SELECT USING (EXISTS (SELECT 1 FROM board_members bm WHERE bm.board_id = board_items.board_id AND bm.user_id = auth.uid()));
CREATE POLICY "items_update_editor_or_owner" ON board_items FOR UPDATE USING (EXISTS (SELECT 1 FROM board_members bm WHERE bm.board_id = board_items.board_id AND bm.user_id = auth.uid() AND bm.role = ANY (ARRAY['owner', 'editor'])));
CREATE POLICY "items_delete_editor_or_owner" ON board_items FOR DELETE USING (EXISTS (SELECT 1 FROM board_members bm WHERE bm.board_id = board_items.board_id AND bm.user_id = auth.uid() AND bm.role = ANY (ARRAY['owner', 'editor'])));

CREATE POLICY "comments_insert_member" ON board_item_comments FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "comments_select_member" ON board_item_comments FOR SELECT USING (EXISTS (SELECT 1 FROM board_items i JOIN board_members bm ON bm.board_id = i.board_id WHERE i.id = board_item_comments.board_item_id AND bm.user_id = auth.uid()));
CREATE POLICY "comments_delete_own" ON board_item_comments FOR DELETE USING (user_id = auth.uid());

-- ============================================
-- BOOK READING
-- ============================================

CREATE POLICY "Users can insert own bookmarks" ON book_bookmarks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own bookmarks" ON book_bookmarks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own bookmarks" ON book_bookmarks FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own highlights" ON book_highlights FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own highlights" ON book_highlights FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own highlights" ON book_highlights FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own highlights" ON book_highlights FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notes" ON book_notes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own notes" ON book_notes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notes" ON book_notes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own notes" ON book_notes FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reading progress" ON book_reading_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own reading progress" ON book_reading_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own reading progress" ON book_reading_progress FOR UPDATE USING (auth.uid() = user_id);

-- ============================================
-- BOOKING PAGES
-- ============================================

CREATE POLICY "Users can create booking pages" ON booking_pages FOR INSERT WITH CHECK (auth.uid() = owner_user_id);
CREATE POLICY "Users can view own booking pages" ON booking_pages FOR SELECT USING (auth.uid() = owner_user_id);
CREATE POLICY "Public can view active booking pages by slug" ON booking_pages FOR SELECT USING (is_active = true);
CREATE POLICY "Users can update own booking pages" ON booking_pages FOR UPDATE USING (auth.uid() = owner_user_id);
CREATE POLICY "Users can delete own booking pages" ON booking_pages FOR DELETE USING (auth.uid() = owner_user_id);

CREATE POLICY "Public can create booking requests for active pages" ON booking_requests FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM booking_pages WHERE booking_pages.id = booking_requests.booking_page_id AND booking_pages.is_active = true));
CREATE POLICY "Page owners can view their booking requests" ON booking_requests FOR SELECT USING (EXISTS (SELECT 1 FROM booking_pages WHERE booking_pages.id = booking_requests.booking_page_id AND booking_pages.owner_user_id = auth.uid()));
CREATE POLICY "Page owners can update booking requests" ON booking_requests FOR UPDATE USING (EXISTS (SELECT 1 FROM booking_pages WHERE booking_pages.id = booking_requests.booking_page_id AND booking_pages.owner_user_id = auth.uid()));

-- ============================================
-- BRAND PARTNERSHIPS
-- ============================================

CREATE POLICY "Anyone can view active brand partnerships" ON brand_partnerships FOR SELECT USING (is_active = true);

-- ============================================
-- CALENDAR
-- ============================================

CREATE POLICY "Users can create own reminders" ON calendar_reminders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own reminders" ON calendar_reminders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own reminders" ON calendar_reminders FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own calendar tasks" ON calendar_tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their own calendar tasks" ON calendar_tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own calendar tasks" ON calendar_tasks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own calendar tasks" ON calendar_tasks FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- COMMUNITY UPDATES
-- ============================================

CREATE POLICY "Admins can manage updates" ON community_updates FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anyone can view published updates" ON community_updates FOR SELECT USING (is_published = true);

-- ============================================
-- CONTACTS & PIPELINE
-- ============================================

CREATE POLICY "Users can create own contacts" ON contacts FOR INSERT WITH CHECK (auth.uid() = owner_user_id);
CREATE POLICY "Users can view own contacts" ON contacts FOR SELECT USING (auth.uid() = owner_user_id);
CREATE POLICY "Users can update own contacts" ON contacts FOR UPDATE USING (auth.uid() = owner_user_id);
CREATE POLICY "Users can delete own contacts" ON contacts FOR DELETE USING (auth.uid() = owner_user_id);

CREATE POLICY "Users can create their own contracts" ON contact_contracts FOR INSERT WITH CHECK (auth.uid() = owner_user_id);
CREATE POLICY "Users can view their own contracts" ON contact_contracts FOR SELECT USING (auth.uid() = owner_user_id);
CREATE POLICY "Anyone can view contracts by id for signing" ON contact_contracts FOR SELECT USING (true);
CREATE POLICY "Users can update their own contracts" ON contact_contracts FOR UPDATE USING (auth.uid() = owner_user_id);
CREATE POLICY "Anyone can update signature fields on contracts" ON contact_contracts FOR UPDATE USING (true) WITH CHECK ((client_signature_url IS NOT NULL) OR (client_signed_at IS NOT NULL));
CREATE POLICY "Users can delete their own contracts" ON contact_contracts FOR DELETE USING (auth.uid() = owner_user_id);

CREATE POLICY "Users can create invoices" ON contact_invoices FOR INSERT WITH CHECK (auth.uid() = owner_user_id);
CREATE POLICY "Users can view own invoices" ON contact_invoices FOR SELECT USING (auth.uid() = owner_user_id);
CREATE POLICY "Users can update own invoices" ON contact_invoices FOR UPDATE USING (auth.uid() = owner_user_id);
CREATE POLICY "Users can delete own invoices" ON contact_invoices FOR DELETE USING (auth.uid() = owner_user_id);

CREATE POLICY "Users can create contact media" ON contact_media FOR INSERT WITH CHECK (auth.uid() = owner_user_id);
CREATE POLICY "Users can view own contact media" ON contact_media FOR SELECT USING (auth.uid() = owner_user_id);
CREATE POLICY "Users can update own contact media" ON contact_media FOR UPDATE USING (auth.uid() = owner_user_id);
CREATE POLICY "Users can delete own contact media" ON contact_media FOR DELETE USING (auth.uid() = owner_user_id);

CREATE POLICY "Users can create quotes" ON contact_quotes FOR INSERT WITH CHECK (auth.uid() = owner_user_id);
CREATE POLICY "Users can view own quotes" ON contact_quotes FOR SELECT USING (auth.uid() = owner_user_id);
CREATE POLICY "Users can update own quotes" ON contact_quotes FOR UPDATE USING (auth.uid() = owner_user_id);
CREATE POLICY "Users can delete own quotes" ON contact_quotes FOR DELETE USING (auth.uid() = owner_user_id);

CREATE POLICY "Users can create own tasks" ON contact_tasks FOR INSERT WITH CHECK (auth.uid() = owner_user_id);
CREATE POLICY "Users can view own tasks" ON contact_tasks FOR SELECT USING (auth.uid() = owner_user_id);
CREATE POLICY "Users can update own tasks" ON contact_tasks FOR UPDATE USING (auth.uid() = owner_user_id);
CREATE POLICY "Users can delete own tasks" ON contact_tasks FOR DELETE USING (auth.uid() = owner_user_id);

CREATE POLICY "Users can create timeline for own contacts" ON contact_timeline FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM contacts WHERE contacts.id = contact_timeline.contact_id AND contacts.owner_user_id = auth.uid()));
CREATE POLICY "System can create timeline entries" ON contact_timeline FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can view timeline for own contacts" ON contact_timeline FOR SELECT USING (EXISTS (SELECT 1 FROM contacts WHERE contacts.id = contact_timeline.contact_id AND contacts.owner_user_id = auth.uid()));

-- ============================================
-- CONTENT & NETWORKS
-- ============================================

CREATE POLICY "Anyone can view genres" ON content_genres FOR SELECT USING (true);

CREATE POLICY "Users can submit content" ON content_submissions FOR INSERT WITH CHECK (auth.uid() = submitter_id);
CREATE POLICY "Users can view own submissions" ON content_submissions FOR SELECT USING (auth.uid() = submitter_id);
CREATE POLICY "Network owners can view submissions" ON content_submissions FOR SELECT USING (EXISTS (SELECT 1 FROM networks WHERE networks.id = content_submissions.network_id AND networks.owner_id = auth.uid()));
CREATE POLICY "Network owners can update submissions" ON content_submissions FOR UPDATE USING (EXISTS (SELECT 1 FROM networks WHERE networks.id = content_submissions.network_id AND networks.owner_id = auth.uid()));

-- ============================================
-- CONVERSATIONS & MESSAGES
-- ============================================

CREATE POLICY "Users can create conversations" ON conversations FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Participants can view conversations" ON conversations FOR SELECT USING (is_conversation_participant(id, auth.uid()));
CREATE POLICY "Creator can update conversation" ON conversations FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "Creator can delete conversation" ON conversations FOR DELETE USING (auth.uid() = created_by);

CREATE POLICY "Users can join conversations" ON conversation_participants FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Participants can view members" ON conversation_participants FOR SELECT USING (is_conversation_participant(conversation_id, auth.uid()));
CREATE POLICY "Users can update own participation" ON conversation_participants FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can leave conversations" ON conversation_participants FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Participants can send messages" ON messages FOR INSERT WITH CHECK (is_conversation_participant(conversation_id, auth.uid()) AND auth.uid() = sender_id);
CREATE POLICY "Participants can view messages" ON messages FOR SELECT USING (is_conversation_participant(conversation_id, auth.uid()));
CREATE POLICY "Senders can update own messages" ON messages FOR UPDATE USING (auth.uid() = sender_id);
CREATE POLICY "Senders can delete own messages" ON messages FOR DELETE USING (auth.uid() = sender_id);

CREATE POLICY "Users can create read receipts" ON message_read_receipts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Participants can view read receipts" ON message_read_receipts FOR SELECT USING (EXISTS (SELECT 1 FROM messages m WHERE m.id = message_read_receipts.message_id AND is_conversation_participant(m.conversation_id, auth.uid())));

CREATE POLICY "Users can update typing indicators" ON typing_indicators FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- CREATIVE ROLES & SKILLS
-- ============================================

CREATE POLICY "Anyone can view creative roles" ON creative_roles FOR SELECT USING (true);
CREATE POLICY "Anyone can view passions" ON passions FOR SELECT USING (true);
CREATE POLICY "Anyone can view skills" ON skills FOR SELECT USING (true);

CREATE POLICY "Users can manage own creative roles" ON user_creative_roles FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own passions" ON user_passions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own skills" ON user_skills FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- CREATOR APPLICATIONS & VERIFICATIONS
-- ============================================

CREATE POLICY "Anyone can submit creator application" ON creator_applications FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can view applications" ON creator_applications FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update applications" ON creator_applications FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can manage own creator roles" ON creator_roles FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can apply for verification" ON creator_verifications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own verification" ON creator_verifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage verifications" ON creator_verifications FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================
-- CREDITS & ENERGY
-- ============================================

CREATE POLICY "Users can view own credits" ON user_credits FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can manage credits" ON user_credits FOR ALL USING (true);

CREATE POLICY "Users can view own ledger" ON credit_ledger FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can create ledger entries" ON credit_ledger FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view own earning limits" ON credit_earning_limits FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can manage earning limits" ON credit_earning_limits FOR ALL USING (true);

CREATE POLICY "Users can view own contributions" ON credit_contributions FOR SELECT USING (auth.uid() = contributor_id);
CREATE POLICY "Users can create contributions" ON credit_contributions FOR INSERT WITH CHECK (auth.uid() = contributor_id);

CREATE POLICY "Users can view own energy" ON user_energy FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can manage energy" ON user_energy FOR ALL USING (true);

CREATE POLICY "Users can view own energy transactions" ON energy_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can create energy transactions" ON energy_transactions FOR INSERT WITH CHECK (true);

-- ============================================
-- EVENTS
-- ============================================

CREATE POLICY "Users can create events" ON events FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "Anyone can view public events" ON events FOR SELECT USING (is_public = true);
CREATE POLICY "Creators can view own events" ON events FOR SELECT USING (auth.uid() = creator_id);
CREATE POLICY "Creators can update own events" ON events FOR UPDATE USING (auth.uid() = creator_id);
CREATE POLICY "Creators can delete own events" ON events FOR DELETE USING (auth.uid() = creator_id);

CREATE POLICY "Users can RSVP" ON event_rsvps FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view RSVPs for public events" ON event_rsvps FOR SELECT USING (EXISTS (SELECT 1 FROM events WHERE events.id = event_rsvps.event_id AND events.is_public = true));
CREATE POLICY "Users can view own RSVPs" ON event_rsvps FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own RSVPs" ON event_rsvps FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own RSVPs" ON event_rsvps FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- FAVORITES & FRIENDS
-- ============================================

CREATE POLICY "Users can manage favorites" ON favorite_friends FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- FEATURED CREATORS
-- ============================================

CREATE POLICY "Anyone can view featured creators" ON featured_creators FOR SELECT USING (true);
CREATE POLICY "Admins can manage featured creators" ON featured_creators FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================
-- FUND & PAYOUTS
-- ============================================

CREATE POLICY "Admins can view distributions" ON fund_distributions FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can view own distributions" ON fund_distributions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can create distributions" ON fund_distributions FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can view escrow" ON escrow_holdings FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Contributors can view own escrow" ON escrow_holdings FOR SELECT USING (auth.uid() = contributor_id);
CREATE POLICY "System can manage escrow" ON escrow_holdings FOR ALL USING (true);

CREATE POLICY "Users can manage own payout methods" ON payout_methods FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own payouts" ON payouts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can create payouts" ON payouts FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can view treasury" ON platform_treasury FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "System can manage treasury" ON platform_treasury FOR ALL USING (true);

-- ============================================
-- GROUPS (EXPENSES & ITINERARIES)
-- ============================================

CREATE POLICY "Participants can create expenses" ON group_expenses FOR INSERT WITH CHECK (is_conversation_participant(conversation_id, auth.uid()));
CREATE POLICY "Participants can view expenses" ON group_expenses FOR SELECT USING (is_conversation_participant(conversation_id, auth.uid()));
CREATE POLICY "Creators can update expenses" ON group_expenses FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "Creators can delete expenses" ON group_expenses FOR DELETE USING (auth.uid() = created_by);

CREATE POLICY "Participants can manage contributions" ON group_expense_contributions FOR ALL USING (EXISTS (SELECT 1 FROM group_expenses ge WHERE ge.id = group_expense_contributions.expense_id AND is_conversation_participant(ge.conversation_id, auth.uid())));

CREATE POLICY "Participants can create itineraries" ON group_itineraries FOR INSERT WITH CHECK (is_conversation_participant(conversation_id, auth.uid()));
CREATE POLICY "Participants can view itineraries" ON group_itineraries FOR SELECT USING (is_conversation_participant(conversation_id, auth.uid()));
CREATE POLICY "Creators can update itineraries" ON group_itineraries FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "Creators can delete itineraries" ON group_itineraries FOR DELETE USING (auth.uid() = created_by);

CREATE POLICY "Participants can manage itinerary items" ON itinerary_items FOR ALL USING (EXISTS (SELECT 1 FROM group_itineraries gi WHERE gi.id = itinerary_items.itinerary_id AND is_conversation_participant(gi.conversation_id, auth.uid())));

-- ============================================
-- HOME PREFERENCES
-- ============================================

CREATE POLICY "Users can manage own home preferences" ON home_preferences FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own home usage" ON home_usage FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- LIVE STREAMS
-- ============================================

CREATE POLICY "Users can create streams" ON live_streams FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Anyone can view public streams" ON live_streams FOR SELECT USING (is_private = false);
CREATE POLICY "Users can view own streams" ON live_streams FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own streams" ON live_streams FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own streams" ON live_streams FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Anyone can react to streams" ON stream_reactions FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can view stream reactions" ON stream_reactions FOR SELECT USING (true);

CREATE POLICY "Users can tip streams" ON stream_tips FOR INSERT WITH CHECK (auth.uid() = tipper_id);
CREATE POLICY "Stream owners can view tips" ON stream_tips FOR SELECT USING (EXISTS (SELECT 1 FROM live_streams WHERE live_streams.id = stream_tips.stream_id AND live_streams.user_id = auth.uid()));
CREATE POLICY "Tippers can view own tips" ON stream_tips FOR SELECT USING (auth.uid() = tipper_id);

CREATE POLICY "Anyone can join streams" ON stream_viewers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Stream owners can view viewers" ON stream_viewers FOR SELECT USING (EXISTS (SELECT 1 FROM live_streams WHERE live_streams.id = stream_viewers.stream_id AND live_streams.user_id = auth.uid()));
CREATE POLICY "Users can update own viewer record" ON stream_viewers FOR UPDATE USING (auth.uid() = user_id);

-- ============================================
-- MEMBERSHIPS
-- ============================================

CREATE POLICY "Users can view own membership" ON memberships FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can manage memberships" ON memberships FOR ALL USING (true);

CREATE POLICY "Users can view own contributions" ON membership_contributions FOR SELECT USING (EXISTS (SELECT 1 FROM memberships WHERE memberships.id = membership_contributions.membership_id AND memberships.user_id = auth.uid()));

-- ============================================
-- MENU ITEMS (Chef)
-- ============================================

CREATE POLICY "Users can manage own menu items" ON menu_items FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Anyone can view available menu items" ON menu_items FOR SELECT USING (is_available = true);

-- ============================================
-- MUSIC PROFILES
-- ============================================

CREATE POLICY "Users can manage own music profile" ON music_profiles FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Anyone can view music profiles" ON music_profiles FOR SELECT USING (true);

-- ============================================
-- NETWORKS
-- ============================================

CREATE POLICY "Anyone can view public networks" ON networks FOR SELECT USING (is_public = true);
CREATE POLICY "Owners can manage networks" ON networks FOR ALL USING (auth.uid() = owner_id);

CREATE POLICY "Anyone can view published content" ON network_content FOR SELECT USING (is_published = true);
CREATE POLICY "Network owners can manage content" ON network_content FOR ALL USING (EXISTS (SELECT 1 FROM networks WHERE networks.id = network_content.network_id AND networks.owner_id = auth.uid()));

CREATE POLICY "Users can subscribe" ON network_subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own subscriptions" ON network_subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Network owners can view subscriptions" ON network_subscriptions FOR SELECT USING (EXISTS (SELECT 1 FROM networks WHERE networks.id = network_subscriptions.network_id AND networks.owner_id = auth.uid()));
CREATE POLICY "Users can manage own subscriptions" ON network_subscriptions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can cancel subscriptions" ON network_subscriptions FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- NEWSLETTER
-- ============================================

CREATE POLICY "Anyone can sign up" ON newsletter_signups FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can view signups" ON newsletter_signups FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================
-- NOTIFICATIONS
-- ============================================

CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "System can create notifications" ON notifications FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can manage own notification preferences" ON notification_preferences FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own push subscriptions" ON push_subscriptions FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- PARTNERS
-- ============================================

CREATE POLICY "Anyone can apply" ON partner_applications FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can manage applications" ON partner_applications FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view active partners" ON partners FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage partners" ON partners FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================
-- PERSONAL CALENDAR
-- ============================================

CREATE POLICY "Users can manage own calendar items" ON personal_calendar_items FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- PIPELINES
-- ============================================

CREATE POLICY "Users can manage own pipelines" ON pipelines FOR ALL USING (auth.uid() = owner_user_id);
CREATE POLICY "Users can manage own pipeline stages" ON pipeline_stages FOR ALL USING (auth.uid() = owner_user_id);
CREATE POLICY "Users can manage own pipeline items" ON pipeline_items FOR ALL USING (auth.uid() = owner_user_id);
CREATE POLICY "Users can manage own pipeline events" ON pipeline_events FOR ALL USING (auth.uid() = owner_user_id);

-- ============================================
-- PORTFOLIO
-- ============================================

CREATE POLICY "Users can manage own folders" ON portfolio_folders FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Anyone can view public folders" ON portfolio_folders FOR SELECT USING (is_public = true);

CREATE POLICY "Users can manage own items" ON portfolio_items FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Anyone can view items in public folders" ON portfolio_items FOR SELECT USING (EXISTS (SELECT 1 FROM portfolio_folders WHERE portfolio_folders.id = portfolio_items.folder_id AND portfolio_folders.is_public = true));

-- ============================================
-- POSTS & SOCIAL
-- ============================================

CREATE POLICY "Users can create posts" ON posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Anyone can view public posts" ON posts FOR SELECT USING (visibility = 'public');
CREATE POLICY "Users can view own posts" ON posts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own posts" ON posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own posts" ON posts FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can comment" ON post_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Anyone can view comments" ON post_comments FOR SELECT USING (true);
CREATE POLICY "Users can delete own comments" ON post_comments FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can like posts" ON post_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Anyone can view likes" ON post_likes FOR SELECT USING (true);
CREATE POLICY "Users can unlike" ON post_likes FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can react" ON post_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Anyone can view reactions" ON post_reactions FOR SELECT USING (true);
CREATE POLICY "Users can remove reactions" ON post_reactions FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can save posts" ON saved_posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view saved posts" ON saved_posts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can unsave" ON saved_posts FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- PROFILES
-- ============================================

CREATE POLICY "Anyone can view public profiles" ON profiles FOR SELECT USING (is_private = false AND access_status = 'active');
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all profiles" ON profiles FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update profiles" ON profiles FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can manage own customization" ON profile_customizations FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- PROJECTS
-- ============================================

CREATE POLICY "Users can create projects" ON projects FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Anyone can view public projects" ON projects FOR SELECT USING (visibility = 'public' AND status != 'draft');
CREATE POLICY "Users can view own projects" ON projects FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Users can update own projects" ON projects FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Users can delete own projects" ON projects FOR DELETE USING (auth.uid() = owner_id);

CREATE POLICY "Anyone can view roles for public projects" ON project_roles FOR SELECT USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_roles.project_id AND projects.visibility = 'public'));
CREATE POLICY "Owners can manage roles" ON project_roles FOR ALL USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_roles.project_id AND projects.owner_id = auth.uid()));

CREATE POLICY "Users can apply" ON project_applications FOR INSERT WITH CHECK (auth.uid() = applicant_id);
CREATE POLICY "Applicants can view own applications" ON project_applications FOR SELECT USING (auth.uid() = applicant_id);
CREATE POLICY "Owners can view applications" ON project_applications FOR SELECT USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_applications.project_id AND projects.owner_id = auth.uid()));
CREATE POLICY "Owners can update applications" ON project_applications FOR UPDATE USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_applications.project_id AND projects.owner_id = auth.uid()));

CREATE POLICY "Anyone can view milestones for public projects" ON project_milestones FOR SELECT USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_milestones.project_id AND projects.visibility = 'public'));
CREATE POLICY "Owners can manage milestones" ON project_milestones FOR ALL USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_milestones.project_id AND projects.owner_id = auth.uid()));

-- ============================================
-- QUESTIONNAIRE
-- ============================================

CREATE POLICY "Users can manage own responses" ON questionnaire_responses FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- RENTALS
-- ============================================

CREATE POLICY "Users can create inquiries" ON rental_inquiries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own inquiries" ON rental_inquiries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Item owners can view inquiries" ON rental_inquiries FOR SELECT USING (EXISTS (SELECT 1 FROM store_items si JOIN stores s ON si.store_id = s.id WHERE si.id = rental_inquiries.studio_item_id AND s.user_id = auth.uid()));
CREATE POLICY "Item owners can update inquiries" ON rental_inquiries FOR UPDATE USING (EXISTS (SELECT 1 FROM store_items si JOIN stores s ON si.store_id = s.id WHERE si.id = rental_inquiries.studio_item_id AND s.user_id = auth.uid()));

-- ============================================
-- REPUTATION
-- ============================================

CREATE POLICY "Anyone can view reputation scores" ON reputation_scores FOR SELECT USING (true);
CREATE POLICY "System can manage scores" ON reputation_scores FOR ALL USING (true);

-- ============================================
-- REVIEWS
-- ============================================

CREATE POLICY "Users can create reviews" ON platform_reviews FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Anyone can view approved reviews" ON platform_reviews FOR SELECT USING (is_approved = true);
CREATE POLICY "Admins can manage reviews" ON platform_reviews FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can create user reviews" ON user_reviews FOR INSERT WITH CHECK (auth.uid() = reviewer_id);
CREATE POLICY "Anyone can view user reviews" ON user_reviews FOR SELECT USING (true);

-- ============================================
-- STORES
-- ============================================

CREATE POLICY "Users can create store" ON stores FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Anyone can view active stores" ON stores FOR SELECT USING (is_active = true);
CREATE POLICY "Users can view own store" ON stores FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own store" ON stores FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Store owners can manage categories" ON store_item_categories FOR ALL USING (EXISTS (SELECT 1 FROM stores WHERE stores.id = store_item_categories.store_id AND stores.user_id = auth.uid()));
CREATE POLICY "Anyone can view categories" ON store_item_categories FOR SELECT USING (true);

CREATE POLICY "Store owners can manage items" ON store_items FOR ALL USING (EXISTS (SELECT 1 FROM stores WHERE stores.id = store_items.store_id AND stores.user_id = auth.uid()));
CREATE POLICY "Anyone can view available items" ON store_items FOR SELECT USING (is_available = true);

CREATE POLICY "Users can create orders" ON store_orders FOR INSERT WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY "Users can view own orders" ON store_orders FOR SELECT USING (auth.uid() = buyer_id);
CREATE POLICY "Store owners can view orders" ON store_orders FOR SELECT USING (EXISTS (SELECT 1 FROM store_items si JOIN stores s ON si.store_id = s.id WHERE si.id = store_orders.item_id AND s.user_id = auth.uid()));
CREATE POLICY "Store owners can update orders" ON store_orders FOR UPDATE USING (EXISTS (SELECT 1 FROM store_items si JOIN stores s ON si.store_id = s.id WHERE si.id = store_orders.item_id AND s.user_id = auth.uid()));

-- ============================================
-- STORIES
-- ============================================

CREATE POLICY "Users can create stories" ON stories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Anyone can view non-expired stories" ON stories FOR SELECT USING (expires_at > now());
CREATE POLICY "Users can delete own stories" ON stories FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can react to stories" ON story_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Story owners can view reactions" ON story_reactions FOR SELECT USING (EXISTS (SELECT 1 FROM stories WHERE stories.id = story_reactions.story_id AND stories.user_id = auth.uid()));

CREATE POLICY "Anyone can view stories" ON story_views FOR INSERT WITH CHECK (auth.uid() = viewer_id);
CREATE POLICY "Story owners can view views" ON story_views FOR SELECT USING (EXISTS (SELECT 1 FROM stories WHERE stories.id = story_views.story_id AND stories.user_id = auth.uid()));

-- ============================================
-- STUDIO BOOKINGS
-- ============================================

CREATE POLICY "Users can create bookings" ON studio_bookings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own bookings" ON studio_bookings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Item owners can view bookings" ON studio_bookings FOR SELECT USING (EXISTS (SELECT 1 FROM store_items si JOIN stores s ON si.store_id = s.id WHERE si.id = studio_bookings.item_id AND s.user_id = auth.uid()));
CREATE POLICY "Item owners can update bookings" ON studio_bookings FOR UPDATE USING (EXISTS (SELECT 1 FROM store_items si JOIN stores s ON si.store_id = s.id WHERE si.id = studio_bookings.item_id AND s.user_id = auth.uid()));

CREATE POLICY "Users can create reviews" ON studio_reviews FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Anyone can view reviews" ON studio_reviews FOR SELECT USING (true);

-- ============================================
-- TEAMS
-- ============================================

CREATE POLICY "Users can create teams" ON teams FOR INSERT WITH CHECK (auth.uid() = owner_user_id);
CREATE POLICY "Members can view teams" ON teams FOR SELECT USING (is_team_member(id, auth.uid()));
CREATE POLICY "Owners can update teams" ON teams FOR UPDATE USING (auth.uid() = owner_user_id);
CREATE POLICY "Owners can delete teams" ON teams FOR DELETE USING (auth.uid() = owner_user_id);

CREATE POLICY "Admins can add members" ON team_members FOR INSERT WITH CHECK (is_team_admin(team_id, auth.uid()));
CREATE POLICY "Members can view members" ON team_members FOR SELECT USING (is_team_member(team_id, auth.uid()));
CREATE POLICY "Admins can update members" ON team_members FOR UPDATE USING (is_team_admin(team_id, auth.uid()));
CREATE POLICY "Admins can remove members" ON team_members FOR DELETE USING (is_team_admin(team_id, auth.uid()));
CREATE POLICY "Users can leave teams" ON team_members FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- TRANSACTIONS
-- ============================================

CREATE POLICY "Users can view own transactions" ON transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can create transactions" ON transactions FOR INSERT WITH CHECK (true);

-- ============================================
-- TV CONTENT
-- ============================================

CREATE POLICY "Anyone can view seasons" ON tv_seasons FOR SELECT USING (EXISTS (SELECT 1 FROM network_content WHERE network_content.id = tv_seasons.content_id AND network_content.is_published = true));
CREATE POLICY "Network owners can manage seasons" ON tv_seasons FOR ALL USING (EXISTS (SELECT 1 FROM network_content nc JOIN networks n ON nc.network_id = n.id WHERE nc.id = tv_seasons.content_id AND n.owner_id = auth.uid()));

CREATE POLICY "Anyone can view episodes" ON tv_episodes FOR SELECT USING (EXISTS (SELECT 1 FROM tv_seasons ts JOIN network_content nc ON ts.content_id = nc.id WHERE ts.id = tv_episodes.season_id AND nc.is_published = true));
CREATE POLICY "Network owners can manage episodes" ON tv_episodes FOR ALL USING (EXISTS (SELECT 1 FROM tv_seasons ts JOIN network_content nc ON ts.content_id = nc.id JOIN networks n ON nc.network_id = n.id WHERE ts.id = tv_episodes.season_id AND n.owner_id = auth.uid()));

-- ============================================
-- USER BLOCKS
-- ============================================

CREATE POLICY "Users can block others" ON user_blocks FOR INSERT WITH CHECK (auth.uid() = blocker_id);
CREATE POLICY "Users can view own blocks" ON user_blocks FOR SELECT USING (auth.uid() = blocker_id);
CREATE POLICY "Users can unblock" ON user_blocks FOR DELETE USING (auth.uid() = blocker_id);

-- ============================================
-- USER ROLES (Admin)
-- ============================================

CREATE POLICY "Admins can manage roles" ON user_roles FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can view own roles" ON user_roles FOR SELECT USING (auth.uid() = user_id);

-- ============================================
-- WATCH HISTORY
-- ============================================

CREATE POLICY "Users can manage own watch history" ON watch_history FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- DANCE VIDEOS & DJ MIXES
-- ============================================

CREATE POLICY "Users can manage own dance videos" ON dance_videos FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Anyone can view dance videos" ON dance_videos FOR SELECT USING (true);

CREATE POLICY "Users can manage own dj mixes" ON dj_mixes FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Anyone can view dj mixes" ON dj_mixes FOR SELECT USING (true);
