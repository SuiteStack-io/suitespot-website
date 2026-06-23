import { useEffect, useMemo, useState } from 'react';
import { content } from '@/integrations/content/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { ImageUpload } from './ImageUpload';
import { Loader2, Plus, Star, Trash2 } from 'lucide-react';

interface RoomPhoto {
  id: string;
  room_type_name: string;
  photo_url: string;
  display_order: number;
  is_cover: boolean;
}

// The public Suites page matches photos to rooms by this exact name.
const KNOWN_ROOM_TYPES = [
  'Deluxe Suite',
  'Double Room with Terrace',
  'Family Suite',
  'Junior Suite',
  'Suite with Terrace',
];

const OTHER = '__other__';

// Storage paths must be ASCII-safe; the displayed room_type_name can have spaces.
const safeSegment = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'room';

export const RoomPhotosManager = () => {
  const { toast } = useToast();
  const [photos, setPhotos] = useState<RoomPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Add-dialog state
  const [typeChoice, setTypeChoice] = useState<string>(KNOWN_ROOM_TYPES[0]);
  const [customName, setCustomName] = useState('');
  const [displayOrder, setDisplayOrder] = useState(0);
  const [isCover, setIsCover] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  const roomTypeName = typeChoice === OTHER ? customName.trim() : typeChoice;

  const fetchPhotos = async () => {
    setLoading(true);
    const { data, error } = await content
      .from('room_type_photos')
      .select('id, room_type_name, photo_url, display_order, is_cover')
      .order('room_type_name', { ascending: true })
      .order('display_order', { ascending: true });
    if (error) {
      toast({ title: 'Failed to load photos', description: error.message, variant: 'destructive' });
    } else {
      setPhotos(data as RoomPhoto[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPhotos();
  }, []);

  // Names that already exist plus the known set, for the dropdown.
  const availableNames = useMemo(() => {
    const set = new Set([...KNOWN_ROOM_TYPES, ...photos.map((p) => p.room_type_name)]);
    return Array.from(set).sort();
  }, [photos]);

  const grouped = useMemo(() => {
    const map = new Map<string, RoomPhoto[]>();
    for (const p of photos) {
      if (!map.has(p.room_type_name)) map.set(p.room_type_name, []);
      map.get(p.room_type_name)!.push(p);
    }
    return Array.from(map.entries());
  }, [photos]);

  const openCreate = () => {
    setTypeChoice(availableNames[0] ?? KNOWN_ROOM_TYPES[0]);
    setCustomName('');
    setDisplayOrder(0);
    setIsCover(false);
    setPhotoUrl(null);
    setOpen(true);
  };

  // Ensure only one cover per room type.
  const enforceSingleCover = async (room_type: string, keepId: string) => {
    await content
      .from('room_type_photos')
      .update({ is_cover: false })
      .eq('room_type_name', room_type)
      .neq('id', keepId);
  };

  const handleSave = async () => {
    if (!roomTypeName) {
      toast({ title: 'Room type name is required', variant: 'destructive' });
      return;
    }
    if (!photoUrl) {
      toast({ title: 'Please upload a photo', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { data, error } = await content
      .from('room_type_photos')
      .insert({
        room_type_name: roomTypeName,
        photo_url: photoUrl,
        display_order: displayOrder,
        is_cover: isCover,
      })
      .select('id')
      .single();

    if (!error && isCover && data) {
      await enforceSingleCover(roomTypeName, data.id);
    }
    setSaving(false);

    if (error) {
      toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Photo added' });
    setOpen(false);
    fetchPhotos();
  };

  const handleSetCover = async (photo: RoomPhoto) => {
    const { error } = await content
      .from('room_type_photos')
      .update({ is_cover: true })
      .eq('id', photo.id);
    if (error) {
      toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
      return;
    }
    await enforceSingleCover(photo.room_type_name, photo.id);
    fetchPhotos();
  };

  const handleOrderChange = async (photo: RoomPhoto, display_order: number) => {
    const { error } = await content
      .from('room_type_photos')
      .update({ display_order })
      .eq('id', photo.id);
    if (error) {
      toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
      return;
    }
    fetchPhotos();
  };

  const handleDelete = async (photo: RoomPhoto) => {
    if (!window.confirm('Delete this photo?')) return;
    const { error } = await content.from('room_type_photos').delete().eq('id', photo.id);
    if (error) {
      toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Photo deleted' });
    fetchPhotos();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Room photos</h2>
          <p className="text-sm text-muted-foreground">
            Photos shown on the public Suites page, grouped by room type. One cover per type.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Add photo
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : grouped.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No room photos yet.</p>
      ) : (
        <div className="space-y-8">
          {grouped.map(([name, group]) => (
            <div key={name} className="space-y-3">
              <h3 className="font-medium">{name}</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {group.map((photo) => (
                  <Card key={photo.id} className="overflow-hidden">
                    <div className="relative">
                      <img
                        src={photo.photo_url}
                        alt=""
                        className="aspect-video w-full object-cover"
                      />
                      {photo.is_cover && (
                        <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                          <Star className="h-3 w-3 fill-current" />
                          Cover
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 p-3">
                      <Label htmlFor={`o-${photo.id}`} className="text-xs">
                        Order
                      </Label>
                      <Input
                        id={`o-${photo.id}`}
                        type="number"
                        defaultValue={photo.display_order}
                        className="h-8 w-16"
                        onBlur={(e) => {
                          const v = Number(e.target.value);
                          if (v !== photo.display_order) handleOrderChange(photo, v);
                        }}
                      />
                      {!photo.is_cover && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="ml-auto"
                          onClick={() => handleSetCover(photo)}
                        >
                          <Star className="h-4 w-4" />
                          Cover
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className={photo.is_cover ? 'ml-auto' : ''}
                        onClick={() => handleDelete(photo)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add room photo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Room type *</Label>
              <Select value={typeChoice} onValueChange={setTypeChoice}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableNames.map((n) => (
                    <SelectItem key={n} value={n}>
                      {n}
                    </SelectItem>
                  ))}
                  <SelectItem value={OTHER}>Other (type a new name)…</SelectItem>
                </SelectContent>
              </Select>
              {typeChoice === OTHER && (
                <Input
                  placeholder="New room type name"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                />
              )}
            </div>

            <div className="space-y-2">
              <Label>Photo *</Label>
              {roomTypeName ? (
                <ImageUpload
                  bucket="property-photos"
                  pathPrefix={`room-types/${safeSegment(roomTypeName)}`}
                  value={photoUrl}
                  onChange={setPhotoUrl}
                />
              ) : (
                <p className="text-sm text-muted-foreground">Choose a room type first.</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="display_order">Display order</Label>
                <Input
                  id="display_order"
                  type="number"
                  value={displayOrder}
                  onChange={(e) => setDisplayOrder(Number(e.target.value))}
                />
              </div>
              <div className="flex items-end gap-2 pb-2">
                <input
                  id="is_cover"
                  type="checkbox"
                  className="h-4 w-4"
                  checked={isCover}
                  onChange={(e) => setIsCover(e.target.checked)}
                />
                <Label htmlFor="is_cover">Cover photo</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Add photo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
