import { useEffect, useState } from 'react';
import { content } from '@/integrations/content/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ImageUpload } from './ImageUpload';
import { Loader2, Trash2 } from 'lucide-react';

interface SlideImage {
  id: string;
  image_url: string;
  sequence_order: number;
}

interface SlideshowManagerProps {
  title: string;
  /** Content-project table: 'slideshow_images' | 'our_story_slideshow'. */
  table: string;
  /** Public storage bucket: 'slideshow' | 'our-story-slideshow'. */
  bucket: string;
  /** Object path prefix inside the bucket. */
  pathPrefix: string;
}

export const SlideshowManager = ({ title, table, bucket, pathPrefix }: SlideshowManagerProps) => {
  const { toast } = useToast();
  const [images, setImages] = useState<SlideImage[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchImages = async () => {
    setLoading(true);
    const { data, error } = await content
      .from(table)
      .select('id, image_url, sequence_order')
      .order('sequence_order', { ascending: true });
    if (error) {
      toast({ title: 'Failed to load images', description: error.message, variant: 'destructive' });
    } else {
      setImages(data as SlideImage[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchImages();
  }, [table]);

  const handleAdd = async (url: string | null) => {
    if (!url) return;
    const nextOrder = images.length ? Math.max(...images.map((i) => i.sequence_order)) + 1 : 0;
    const { error } = await content.from(table).insert({ image_url: url, sequence_order: nextOrder });
    if (error) {
      toast({ title: 'Add failed', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Image added' });
    fetchImages();
  };

  const handleOrderChange = async (image: SlideImage, sequence_order: number) => {
    const { error } = await content.from(table).update({ sequence_order }).eq('id', image.id);
    if (error) {
      toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
      return;
    }
    fetchImages();
  };

  const handleDelete = async (image: SlideImage) => {
    if (!window.confirm('Delete this slide?')) return;
    const { error } = await content.from(table).delete().eq('id', image.id);
    if (error) {
      toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Slide deleted' });
    fetchImages();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">
          Slides display in ascending order. Upload a new image to add a slide.
        </p>
      </div>

      <Card className="space-y-2 p-4">
        <Label>Add a slide</Label>
        <ImageUpload bucket={bucket} pathPrefix={pathPrefix} value={null} onChange={handleAdd} />
      </Card>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : images.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No slides yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {images.map((image) => (
            <Card key={image.id} className="overflow-hidden">
              <img src={image.image_url} alt="" className="aspect-video w-full object-cover" />
              <div className="flex items-center gap-3 p-3">
                <div className="flex items-center gap-2">
                  <Label htmlFor={`order-${image.id}`} className="text-xs">
                    Order
                  </Label>
                  <Input
                    id={`order-${image.id}`}
                    type="number"
                    defaultValue={image.sequence_order}
                    className="h-8 w-20"
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (v !== image.sequence_order) handleOrderChange(image, v);
                    }}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="ml-auto"
                  onClick={() => handleDelete(image)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
