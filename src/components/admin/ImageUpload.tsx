import { useRef, useState } from 'react';
import { content } from '@/integrations/content/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload, X } from 'lucide-react';

interface ImageUploadProps {
  /** Storage bucket name (must be one of the public content buckets). */
  bucket: string;
  /**
   * Path prefix inside the bucket. The final object path becomes
   * `${pathPrefix}/<timestamp>-<rand>.<ext>`. Pass without a trailing slash.
   */
  pathPrefix: string;
  /** Current public URL (if an image is already set). */
  value: string | null;
  /** Called with the new public URL after a successful upload, or null when cleared. */
  onChange: (url: string | null) => void;
}

/**
 * Uploads an image to a public content bucket and returns its public URL.
 * Requires an authenticated session (RLS allows `authenticated` to write).
 */
export const ImageUpload = ({ bucket, pathPrefix, value, onChange }: ImageUploadProps) => {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${pathPrefix}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await content.storage.from(bucket).upload(path, file, { upsert: false });
      if (error) throw error;
      const { data } = content.storage.from(bucket).getPublicUrl(path);
      onChange(data.publicUrl);
    } catch (err: any) {
      toast({
        title: 'Upload failed',
        description: err.message ?? 'Could not upload the image.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      {value ? (
        <div className="relative w-full max-w-xs">
          <img
            src={value}
            alt="Preview"
            className="w-full rounded-md border border-border object-cover aspect-video"
          />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute -right-2 -top-2 rounded-full bg-destructive p-1 text-destructive-foreground shadow"
            aria-label="Remove image"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="flex h-32 w-full max-w-xs items-center justify-center rounded-md border border-dashed border-border bg-muted/30 text-sm text-muted-foreground">
          No image
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Upload className="h-4 w-4" />
        )}
        {value ? 'Replace image' : 'Upload image'}
      </Button>
    </div>
  );
};
