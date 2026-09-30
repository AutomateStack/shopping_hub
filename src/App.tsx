import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";
import { CookieConsent } from "@/components/CookieConsent";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { NewsletterPopup } from "@/components/NewsletterPopup";
import { RecentlySoldTicker } from "@/components/RecentlySoldTicker";
import { InstallPrompt } from "@/components/InstallPrompt";
import { CompareDrawer } from "@/components/product/CompareDrawer";
import { PriceDropWatcher } from "@/components/PriceDropWatcher";
import { ExitIntentOffer } from "@/components/ExitIntentOffer";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ScrollToTop } from "@/components/ScrollToTop";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PageViewTracker } from "@/components/PageViewTracker";
import { CommandPalette } from "@/components/CommandPalette";
import { ScrollProgress } from "@/components/ScrollProgress";

const Home = lazy(() => import("./pages/Home"));
const Products = lazy(() => import("./pages/Products"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const CategoryLanding = lazy(() => import("./pages/CategoryLanding"));
const Cart = lazy(() => import("./pages/Cart"));
const Checkout = lazy(() => import("./pages/Checkout"));
const Auth = lazy(() => import("./pages/Auth"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Admin = lazy(() => import("./pages/Admin"));
const AdminMarketplaceLinks = lazy(() => import("./pages/AdminMarketplaceLinks"));
const AdminWhatsAppCatalog = lazy(() => import("./pages/AdminWhatsAppCatalog"));
const Profile = lazy(() => import("./pages/Profile"));
const Orders = lazy(() => import("./pages/Orders"));
const Blog = lazy(() => import("./pages/Blog"));
const BlogPost = lazy(() => import("./pages/BlogPost"));
const OrderConfirmation = lazy(() => import("./pages/OrderConfirmation"));
const Wishlist = lazy(() => import("./pages/Wishlist"));
const ContactUs = lazy(() => import("./pages/ContactUs"));
const AboutUs = lazy(() => import("./pages/AboutUs"));
const TermsAndConditions = lazy(() => import("./pages/TermsAndConditions"));
const RefundsAndCancellations = lazy(() => import("./pages/RefundsAndCancellations"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const ShippingPolicy = lazy(() => import("./pages/ShippingPolicy"));
const NotFound = lazy(() => import("./pages/NotFound"));
const LuckyDraw = lazy(() => import("./pages/LuckyDraw"));
const Wallet = lazy(() => import("./pages/Wallet"));
const ContestRules = lazy(() => import("./pages/ContestRules"));
const Quiz = lazy(() => import("./pages/Quiz"));
const PlayQuiz = lazy(() => import("./pages/PlayQuiz"));
const QuizResult = lazy(() => import("./pages/QuizResult"));

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5 * 60 * 1000, gcTime: 15 * 60 * 1000, refetchOnWindowFocus: false, retry: 1 } },
});

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <a href="#main-content" className="skip-link">Skip to content</a>
          <PageViewTracker /><ScrollProgress /><CommandPalette />
          <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" /></div>}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/products" element={<Products />} />
              <Route path="/products/:id" element={<ProductDetail />} />
              <Route path="/shop/:slug" element={<CategoryLanding />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/admin" element={<ProtectedRoute requireAdmin><Admin /></ProtectedRoute>} />
              <Route path="/admin/whatsapp-catalog" element={<ProtectedRoute requireAdmin><AdminWhatsAppCatalog /></ProtectedRoute>} />
              <Route path="/admin/marketplace-links" element={<ProtectedRoute requireAdmin><AdminMarketplaceLinks /></ProtectedRoute>} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/blog" element={<Blog />} />
              <Route path="/blog/:slug" element={<BlogPost />} />
              <Route path="/order-confirmation/:orderId" element={<OrderConfirmation />} />
              <Route path="/wishlist" element={<Wishlist />} />
              <Route path="/about" element={<AboutUs />} />
              <Route path="/contact" element={<ContactUs />} />
              <Route path="/terms" element={<TermsAndConditions />} />
              <Route path="/refunds" element={<RefundsAndCancellations />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/shipping" element={<ShippingPolicy />} />
              <Route path="/lucky-draw" element={<LuckyDraw />} />
              <Route path="/lucky-draw/rules" element={<ContestRules />} />
              <Route path="/wallet" element={<Wallet />} />
              <Route path="/quiz" element={<Quiz />} />
              <Route path="/quiz/:quizId/play" element={<PlayQuiz />} />
              <Route path="/quiz/:quizId/result" element={<QuizResult />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
          <MobileBottomNav /><ScrollToTop />
        </BrowserRouter>
        <NewsletterPopup /><RecentlySoldTicker /><InstallPrompt /><CompareDrawer /><PriceDropWatcher /><CookieConsent /><ExitIntentOffer />
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);
export default App;
