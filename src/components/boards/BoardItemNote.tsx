import { useState, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Json } from "@/integrations/supabase/types";

interface NoteContent {
  text?: string;
}

interface BoardItemNoteProps {
  content: Json;
  onChange: (content: Json) => void;
  isSelected: boolean;
}

export function BoardItemNote({ content, onChange, isSelected }: BoardItemNoteProps) {
  const noteContent = content as NoteContent;
  const [text, setText] = useState(noteContent?.text || "");

  useEffect(() => {
    setText((content as NoteContent)?.text || "");
  }, [content]);

  const handleBlur = () => {
    if (text !== noteContent?.text) {
      onChange({ text } as unknown as Json);
    }
  };

  return (
    <div className="p-3 h-full">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={handleBlur}
        placeholder="Write a note..."
        className="min-h-[120px] h-full w-full resize-none border-none bg-transparent p-0 m-0 focus-visible:ring-0 text-[#44403c] text-sm placeholder:text-[#a8a29e] leading-relaxed"
        style={{ textIndent: 0, paddingLeft: 0 }}
      />
    </div>
  );
}
