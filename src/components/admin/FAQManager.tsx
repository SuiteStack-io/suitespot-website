import { useEffect, useState } from 'react';
import { content } from '@/integrations/content/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  sequence_order: number;
  is_published: boolean;
}

type Draft = Omit<FAQItem, 'id'>;

const emptyDraft: Draft = {
  question: '',
  answer: '',
  sequence_order: 0,
  is_published: true,
};

export const FAQManager = () => {
  const { toast } = useToast();
  const [items, setItems] = useState<FAQItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [saving, setSaving] = useState(false);

  const fetchItems = async () => {
    setLoading(true);
    const { data, error } = await content
      .from('faq_items')
      .select('*')
      .order('sequence_order', { ascending: true });
    if (error) {
      toast({ title: 'Failed to load FAQ', description: error.message, variant: 'destructive' });
    } else {
      setItems(data as FAQItem[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setDraft({ ...emptyDraft, sequence_order: items.length });
    setOpen(true);
  };

  const openEdit = (item: FAQItem) => {
    setEditingId(item.id);
    const { id, ...rest } = item;
    setDraft(rest);
    setOpen(true);
  };

  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  const handleSave = async () => {
    if (!draft.question.trim() || !draft.answer.trim()) {
      toast({ title: 'Question and answer are required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const query = editingId
      ? content.from('faq_items').update(draft).eq('id', editingId)
      : content.from('faq_items').insert(draft);
    const { error } = await query;
    setSaving(false);
    if (error) {
      toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: editingId ? 'FAQ updated' : 'FAQ created' });
    setOpen(false);
    fetchItems();
  };

  const handleDelete = async (item: FAQItem) => {
    if (!window.confirm(`Delete this FAQ item?`)) return;
    const { error } = await content.from('faq_items').delete().eq('id', item.id);
    if (error) {
      toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'FAQ deleted' });
    fetchItems();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">FAQ items</h2>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          New item
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No FAQ items yet.</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <Card key={item.id} className="flex items-center gap-4 p-4">
              <span className="w-8 shrink-0 text-center text-sm text-muted-foreground">
                {item.sequence_order}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{item.question}</p>
                <p className="truncate text-sm text-muted-foreground">{item.answer}</p>
              </div>
              {!item.is_published && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  hidden
                </span>
              )}
              <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => handleDelete(item)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit FAQ' : 'New FAQ'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="question">Question *</Label>
              <Input
                id="question"
                value={draft.question}
                onChange={(e) => update({ question: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="answer">Answer *</Label>
              <Textarea
                id="answer"
                rows={5}
                value={draft.answer}
                onChange={(e) => update({ answer: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="order">Order</Label>
              <Input
                id="order"
                type="number"
                value={draft.sequence_order}
                onChange={(e) => update({ sequence_order: Number(e.target.value) })}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="published"
                checked={draft.is_published}
                onCheckedChange={(v) => update({ is_published: v === true })}
              />
              <Label htmlFor="published">Published (visible on the site)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingId ? 'Save changes' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
