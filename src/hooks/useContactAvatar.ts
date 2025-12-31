import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useContactAvatar() {
  const { user } = useAuth();
  const [isUploading, setIsUploading] = useState(false);

  const uploadAvatar = async (file: File, pipelineItemId: string): Promise<string> => {
    if (!user) throw new Error("Not authenticated");
    
    setIsUploading(true);
    
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${pipelineItemId}-${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('contact-avatars')
        .upload(fileName, file, { upsert: true });
      
      if (uploadError) throw uploadError;
      
      const { data: urlData } = supabase.storage
        .from('contact-avatars')
        .getPublicUrl(fileName);
      
      return urlData.publicUrl;
    } finally {
      setIsUploading(false);
    }
  };

  return {
    uploadAvatar,
    isUploading,
  };
}
