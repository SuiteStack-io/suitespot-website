import { useEffect, useState } from 'react';
import { content } from '@/integrations/content/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { ImageUpload } from './ImageUpload';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';

interface BlogPost {
  id: string;
  h1_title: string;
  h2_subtitle: string | null;
  slug: string;
  content: string | null;
  excerpt: string | null;
  featured_image_url: string | null;
  meta_title: string | null;
  meta_description: string | null;
  status: string;
  published_at: string | null;
}

type Draft = Omit<BlogPost, 'id'>;

const emptyDraft: Draft = {
  h1_title: '',
  h2_subtitle: '',
  slug: '',
  content: '',
  excerpt: '',
  featured_image_url: null,
  meta_title: '',
  meta_description: '',
  status: 'draft',
  published_at: null,
};

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

// Convert an ISO timestamp <-> the value a datetime-local input expects.
const toLocalInput = (iso: string | null) => (iso ? iso.slice(0, 16) : '');
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);

export const BlogManager = () => {
  const { toast } = useToast();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [slugTouched, setSlugTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchPosts = async () => {
    setLoading(true);
    const { data, error } = await content
      .from('blog_posts')
      .select('*')
      .order('published_at', { ascending: false, nullsFirst: false });
    if (error) {
      toast({ title: 'Failed to load posts', description: error.message, variant: 'destructive' });
    } else {
      setPosts(data as BlogPost[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setDraft(emptyDraft);
    setSlugTouched(false);
    setOpen(true);
  };

  const openEdit = (post: BlogPost) => {
    setEditingId(post.id);
    const { id, ...rest } = post;
    setDraft({ ...emptyDraft, ...rest });
    setSlugTouched(true);
    setOpen(true);
  };

  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  const handleTitleChange = (h1_title: string) => {
    update({ h1_title, ...(slugTouched ? {} : { slug: slugify(h1_title) }) });
  };

  const handleSave = async () => {
    if (!draft.h1_title.trim() || !draft.slug.trim()) {
      toast({ title: 'Title and slug are required', variant: 'destructive' });
      return;
    }
    setSaving(true);

    // Auto-stamp published_at the first time a post goes live.
    const published_at =
      draft.status === 'published' && !draft.published_at
        ? new Date().toISOString()
        : draft.published_at;

    const payload = { ...draft, published_at };

    const query = editingId
      ? content.from('blog_posts').update(payload).eq('id', editingId)
      : content.from('blog_posts').insert(payload);
    const { error } = await query;
    setSaving(false);

    if (error) {
      toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: editingId ? 'Post updated' : 'Post created' });
    setOpen(false);
    fetchPosts();
  };

  const handleDelete = async (post: BlogPost) => {
    if (!window.confirm(`Delete “${post.h1_title}”? This cannot be undone.`)) return;
    const { error } = await content.from('blog_posts').delete().eq('id', post.id);
    if (error) {
      toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Post deleted' });
    fetchPosts();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Blog posts</h2>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          New post
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : posts.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No posts yet.</p>
      ) : (
        <div className="space-y-2">
          {posts.map((post) => (
            <Card key={post.id} className="flex items-center gap-4 p-4">
              {post.featured_image_url ? (
                <img
                  src={post.featured_image_url}
                  alt=""
                  className="h-14 w-20 shrink-0 rounded object-cover"
                />
              ) : (
                <div className="h-14 w-20 shrink-0 rounded bg-muted" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{post.h1_title}</p>
                <p className="truncate text-sm text-muted-foreground">/blog/{post.slug}</p>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  post.status === 'published'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {post.status}
              </span>
              <Button variant="ghost" size="icon" onClick={() => openEdit(post)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => handleDelete(post)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit post' : 'New post'}</DialogTitle>
            <DialogDescription>
              Content supports markdown: <code>## H2</code>, <code>### H3</code>,{' '}
              <code>**bold**</code>, <code>*italic*</code>, <code>- bullet</code>, numbered lists,
              and <code>[link](url)</code>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="h1">Title (H1) *</Label>
              <Input
                id="h1"
                value={draft.h1_title}
                onChange={(e) => handleTitleChange(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="h2">Subtitle (H2)</Label>
              <Input
                id="h2"
                value={draft.h2_subtitle ?? ''}
                onChange={(e) => update({ h2_subtitle: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Slug *</Label>
              <Input
                id="slug"
                value={draft.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  update({ slug: slugify(e.target.value) });
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Featured image</Label>
              <ImageUpload
                bucket="property-photos"
                pathPrefix="blog"
                value={draft.featured_image_url}
                onChange={(url) => update({ featured_image_url: url })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="excerpt">Excerpt</Label>
              <Textarea
                id="excerpt"
                rows={2}
                value={draft.excerpt ?? ''}
                onChange={(e) => update({ excerpt: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="content">Content (markdown)</Label>
              <Textarea
                id="content"
                rows={12}
                className="font-mono text-sm"
                value={draft.content ?? ''}
                onChange={(e) => update({ content: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="meta_title">Meta title</Label>
                <Input
                  id="meta_title"
                  value={draft.meta_title ?? ''}
                  onChange={(e) => update({ meta_title: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="published_at">Published date</Label>
                <Input
                  id="published_at"
                  type="datetime-local"
                  value={toLocalInput(draft.published_at)}
                  onChange={(e) => update({ published_at: fromLocalInput(e.target.value) })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="meta_description">Meta description</Label>
              <Textarea
                id="meta_description"
                rows={2}
                value={draft.meta_description ?? ''}
                onChange={(e) => update({ meta_description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={draft.status} onValueChange={(v) => update({ status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingId ? 'Save changes' : 'Create post'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
