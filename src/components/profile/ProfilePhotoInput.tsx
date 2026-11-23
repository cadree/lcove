import { forwardRef } from "react";

interface ProfilePhotoInputProps {
  onFile: (file: File) => void;
  disabled?: boolean;
  id?: string;
}

/**
 * Opens the system picker. On iPhone this offers the camera and the photo
 * library because capture is left unset.
 */
export const ProfilePhotoInput = forwardRef<HTMLInputElement, ProfilePhotoInputProps>(
  function ProfilePhotoInput({ onFile, disabled, id }, ref) {
    return (
      <input
        id={id}
        ref={ref}
        type="file"
        accept="image/*"
        className="sr-only"
        disabled={disabled}
        aria-label="Add a profile photo"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onFile(file);
        }}
      />
    );
  },
);
