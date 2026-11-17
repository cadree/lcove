import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("pending applications require review links and queue one admin email", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE anon;
      CREATE ROLE authenticated;
      CREATE ROLE service_role;
      CREATE TABLE public.profiles (
        user_id uuid PRIMARY KEY,
        display_name text,
        city text,
        city_display text,
        access_status text DEFAULT 'pending',
        onboarding_completed boolean NOT NULL DEFAULT false,
        social_links jsonb DEFAULT '{}'::jsonb
      );
      CREATE TABLE public.test_email_queue (
        queue text NOT NULL,
        payload jsonb NOT NULL
      );
      CREATE SCHEMA pgmq;
      CREATE FUNCTION pgmq.send(queue_name text, payload jsonb)
      RETURNS bigint LANGUAGE plpgsql AS $$
      BEGIN
        INSERT INTO public.test_email_queue VALUES(queue_name, payload);
        RETURN 1;
      END $$;
    `);
    await db.exec(await readFile("supabase/migrations/20261116103000_onboarding_review_links_email.sql", "utf8"));

    const first = "00000000-0000-4000-8000-000000000101";
    const second = "00000000-0000-4000-8000-000000000102";
    await db.query("INSERT INTO profiles(user_id,display_name,city) VALUES($1,'Ada','Charlotte'),($2,'Lou','Atlanta')", [first, second]);

    await assert.rejects(
      db.query("UPDATE profiles SET onboarding_completed=true WHERE user_id=$1", [first]),
      /social media or website link is required/,
    );
    await assert.rejects(
      db.query("UPDATE profiles SET onboarding_completed=true,social_links=$2::jsonb WHERE user_id=$1",
        [first, JSON.stringify({ social_profile: "javascript:alert(1)" })]),
      /valid public URL/,
    );

    const count = async () => (await db.query("SELECT COUNT(*)::int AS total FROM test_email_queue")).rows[0].total;
    assert.equal(await count(), 0);

    await db.query(
      "UPDATE profiles SET onboarding_completed=true, social_links=$2::jsonb WHERE user_id=$1",
      [first, JSON.stringify({ social_profile: "https://instagram.com/ada" })],
    );
    assert.equal(await count(), 1);
    let queued = (await db.query(
      "SELECT queue, payload->>'to' AS recipient, payload->>'subject' AS subject, payload->>'text' AS text FROM test_email_queue",
    )).rows[0];
    assert.equal(queued.queue, "transactional_emails");
    assert.equal(queued.recipient, "etherbylcove@gmail.com");
    assert.match(queued.subject, /New ETHER application/);
    assert.match(queued.text, /https:\/\/instagram.com\/ada/);
    assert.match(queued.text, /admin\/onboarding/);

    await db.query("UPDATE profiles SET display_name='Ada New' WHERE user_id=$1", [first]);
    assert.equal(await count(), 1, "ordinary profile changes must not notify again");

    await db.query(
      "UPDATE profiles SET onboarding_completed=true,social_links=$2::jsonb WHERE user_id=$1",
      [second, JSON.stringify({ website: "https://portfolio.example.com/" })],
    );
    assert.equal(await count(), 2);
    queued = (await db.query("SELECT payload->>'text' AS text FROM test_email_queue ORDER BY payload->>'text' DESC LIMIT 1")).rows[0];
    assert.ok(queued);

    // Existing completed members are not retroactively blocked if they lack links.
    await db.query("UPDATE profiles SET social_links='{}',display_name='Established' WHERE user_id=$1", [first]);
    assert.equal(await count(), 2);
  } finally {
    await db.close();
  }
});
