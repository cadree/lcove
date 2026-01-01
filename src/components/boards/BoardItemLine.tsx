import { useState, useEffect } from "react";
import { Json } from "@/integrations/supabase/types";

interface LineContent {
  color?: string;
  thickness?: number;
}

interface BoardItemLineProps {
  content: Json;
  onChange: (content: Json) => void;
}

export function BoardItemLine({ content, onChange }: BoardItemLineProps) {
  const lineContent = content as LineContent;
  const [color, setColor] = useState(lineContent?.color || "#ffffff");
  const [thickness, setThickness] = useState(lineContent?.thickness || 2);

  useEffect(() => {
    const c = content as LineContent;
    setColor(c?.color || "#ffffff");
    setThickness(c?.thickness || 2);
  }, [content]);

  return (
    <div className="w-full h-full flex items-center justify-center p-1">
      <div 
        className="w-full rounded-full"
        style={{ 
          backgroundColor: color,
          height: `${Math.max(thickness, 2)}px`,
        }}
      />
    </div>
  );
}
