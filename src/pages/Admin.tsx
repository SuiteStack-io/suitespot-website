import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { content } from '@/integrations/content/client';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, LogOut } from 'lucide-react';
import { AdminLogin } from '@/components/admin/AdminLogin';
import { BlogManager } from '@/components/admin/BlogManager';
import { FAQManager } from '@/components/admin/FAQManager';
import { SlideshowManager } from '@/components/admin/SlideshowManager';
import { RoomPhotosManager } from '@/components/admin/RoomPhotosManager';

const Admin = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    content.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = content.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session) {
    return <AdminLogin />;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <h1 className="font-playfair text-xl font-semibold text-foreground">
            SuiteSpot Content Admin
          </h1>
          <p className="text-sm text-muted-foreground">{session.user.email}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => content.auth.signOut()}>
          <LogOut className="h-4 w-4" />
          Log out
        </Button>
      </header>

      <main className="container mx-auto max-w-6xl px-6 py-8">
        <Tabs defaultValue="blog">
          <TabsList className="flex h-auto flex-wrap justify-start">
            <TabsTrigger value="blog">Blog</TabsTrigger>
            <TabsTrigger value="faq">FAQ</TabsTrigger>
            <TabsTrigger value="hero">Hero Slideshow</TabsTrigger>
            <TabsTrigger value="our-story">Our Story Slideshow</TabsTrigger>
            <TabsTrigger value="rooms">Room Photos</TabsTrigger>
          </TabsList>

          <TabsContent value="blog" className="mt-6">
            <BlogManager />
          </TabsContent>
          <TabsContent value="faq" className="mt-6">
            <FAQManager />
          </TabsContent>
          <TabsContent value="hero" className="mt-6">
            <SlideshowManager
              title="Homepage Hero Slideshow"
              table="slideshow_images"
              bucket="slideshow"
              pathPrefix="hero"
            />
          </TabsContent>
          <TabsContent value="our-story" className="mt-6">
            <SlideshowManager
              title="Our Story Slideshow"
              table="our_story_slideshow"
              bucket="our-story-slideshow"
              pathPrefix="our-story"
            />
          </TabsContent>
          <TabsContent value="rooms" className="mt-6">
            <RoomPhotosManager />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Admin;
