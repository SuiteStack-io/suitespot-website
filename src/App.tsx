import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { PropertyProvider } from "@/lib/propertyContext";
import PublicHome from "./pages/PublicHome";
import BookingFlow from "./pages/BookingFlow";
import BookingConfirmation from "./pages/BookingConfirmation";
import IconiaZamalek from "./pages/IconiaZamalek";
import About from "./pages/About";
import Locations from "./pages/Locations";
import Suites from "./pages/Suites";
import Wellness from "./pages/Wellness";
import Experiences from "./pages/Experiences";
import Nearby from "./pages/Nearby";
import Blog from "./pages/Blog";
import BlogPost from "./pages/BlogPost";
import FAQ from "./pages/FAQ";

// Content admin is code-split so it never bloats the public bundle.
const Admin = lazy(() => import("./pages/Admin"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <PropertyProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<PublicHome />} />
          <Route path="/book" element={<BookingFlow />} />
          <Route path="/booking-confirmation" element={<BookingConfirmation />} />
          <Route path="/iconia-zamalek" element={<IconiaZamalek />} />
          <Route path="/about" element={<About />} />
          <Route path="/locations" element={<Locations />} />
          <Route path="/suites" element={<Suites />} />
          <Route path="/wellness" element={<Wellness />} />
          <Route path="/experiences" element={<Experiences />} />
          <Route path="/nearby" element={<Nearby />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/blog/:slug" element={<BlogPost />} />
          <Route path="/faq" element={<FAQ />} />
          <Route
            path="/admin"
            element={
              <Suspense
                fallback={
                  <div className="flex min-h-screen items-center justify-center bg-background">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                }
              >
                <Admin />
              </Suspense>
            }
          />
        </Routes>
      </BrowserRouter>
    </PropertyProvider>
  </QueryClientProvider>
);

export default App;
