import { useState, useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import { Json } from "@/integrations/supabase/types";

interface TodoItem {
  text: string;
  done: boolean;
}

interface TodoContent {
  items?: TodoItem[];
}

interface BoardItemTodoProps {
  content: Json;
  onChange: (content: Json) => void;
}

export function BoardItemTodo({ content, onChange }: BoardItemTodoProps) {
  const todoContent = content as TodoContent;
  const [items, setItems] = useState<TodoItem[]>(todoContent?.items || [{ text: "", done: false }]);

  useEffect(() => {
    setItems((content as TodoContent)?.items || [{ text: "", done: false }]);
  }, [content]);

  const updateItems = (newItems: TodoItem[]) => {
    setItems(newItems);
    onChange({ items: newItems } as unknown as Json);
  };

  const handleToggle = (index: number) => {
    const newItems = [...items];
    newItems[index].done = !newItems[index].done;
    updateItems(newItems);
  };

  const handleTextChange = (index: number, text: string) => {
    const newItems = [...items];
    newItems[index].text = text;
    setItems(newItems);
  };

  const handleTextBlur = () => {
    onChange({ items } as unknown as Json);
  };

  const addItem = () => {
    updateItems([...items, { text: "", done: false }]);
  };

  const removeItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    updateItems(newItems.length ? newItems : [{ text: "", done: false }]);
  };

  return (
    <div className="p-3 space-y-2">
      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
        Todo List
      </h4>
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2 group">
          <Checkbox
            checked={item.done}
            onCheckedChange={() => handleToggle(index)}
          />
          <Input
            value={item.text}
            onChange={(e) => handleTextChange(index, e.target.value)}
            onBlur={handleTextBlur}
            placeholder="Add item..."
            className={`flex-1 h-7 text-sm border-none bg-transparent p-0 focus-visible:ring-0 text-foreground placeholder:text-muted-foreground/50 ${
              item.done ? "line-through text-muted-foreground" : ""
            }`}
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => removeItem(index)}
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      ))}
      <Button
        variant="ghost"
        size="sm"
        className="w-full h-7 text-xs"
        onClick={addItem}
      >
        <Plus className="w-3 h-3 mr-1" />
        Add Item
      </Button>
    </div>
  );
}
