import { supabase } from "@/integrations/supabase/client";
import { encodeShareCard, type ShareCard } from "@/lib/shareCard";

export async function sendChatShare(input: {
  conversationId: string;
  senderId: string;
  card: ShareCard;
  note?: string;
}) {
  const note = input.note?.trim();
  const content = [note, encodeShareCard(input.card)].filter(Boolean).join("\n");
  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: input.conversationId,
      sender_id: input.senderId,
      content,
    })
    .select("id")
    .single();
  if (error) throw error;

  supabase.functions.invoke("notify-chat-message", {
    body: { conversation_id: input.conversationId, message_id: data.id },
  }).catch((err) => {
    console.error("Chat notification failed", err);
  });

  return data;
}
