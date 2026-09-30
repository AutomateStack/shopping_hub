import { LayoutDashboard, Package, ShoppingCart, FileText, Users, Tag, AlertTriangle, Settings, LogOut, Gift, Brain, FolderTree, Mail, Bell, BarChart3, MessageCircleQuestion, Link2, MessageCircle } from "lucide-react";
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar } from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import { useLocation, useNavigate } from "react-router-dom";

const menuItems = [
  { title: "Dashboard", value: "dashboard", icon: LayoutDashboard },
  { title: "Analytics", value: "analytics", icon: BarChart3 },
  { title: "Products", value: "products", icon: Package },
  { title: "WhatsApp Catalog", value: "whatsapp-catalog", icon: MessageCircle },
  { title: "Marketplace Links", value: "marketplace-links", icon: Link2 },
  { title: "Categories", value: "categories", icon: FolderTree },
  { title: "Orders", value: "orders", icon: ShoppingCart },
  { title: "Customers", value: "customers", icon: Users },
  { title: "Coupons", value: "coupons", icon: Tag },
  { title: "Inventory Alerts", value: "inventory", icon: AlertTriangle },
  { title: "Stock Alerts", value: "stock-alerts", icon: Bell },
  { title: "Campaigns", value: "campaigns", icon: Mail },
  { title: "Lucky Draw", value: "luckydraw", icon: Gift },
  { title: "Quizzes", value: "quizzes", icon: Brain },
  { title: "Product Q&A", value: "questions", icon: MessageCircleQuestion },
  { title: "Blog", value: "blog", icon: FileText },
];

interface AdminSidebarProps { activeTab: string; onTabChange: (tab: string) => void; }

export function AdminSidebar({ activeTab, onTabChange }: AdminSidebarProps) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const navigate = useNavigate();
  const location = useLocation();
  const onMarketplaceRoute = location.pathname === "/admin/marketplace-links";
  const onWhatsAppCatalogRoute = location.pathname === "/admin/whatsapp-catalog";

  const handleNavigation = (value: string) => {
    if (value === "marketplace-links") {
      navigate("/admin/marketplace-links");
      return;
    }
    if (value === "whatsapp-catalog") {
      navigate("/admin/whatsapp-catalog");
      return;
    }

    if (onMarketplaceRoute || onWhatsAppCatalogRoute) {
      window.location.assign(`/admin?tab=${encodeURIComponent(value)}`);
      return;
    }

    onTabChange(value);
  };

  const handleSignOut = async () => { await supabase.auth.signOut(); navigate("/"); };

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="p-4"><div className="flex items-center gap-2"><div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center"><Package className="h-4 w-4 text-primary-foreground" /></div>{!collapsed && <div><h2 className="font-bold text-sm">ShopHub</h2><p className="text-xs text-muted-foreground">Admin Panel</p></div>}</div></SidebarHeader>
      <SidebarContent><SidebarGroup><SidebarGroupLabel>Management</SidebarGroupLabel><SidebarGroupContent><SidebarMenu>{menuItems.map((item) => <SidebarMenuItem key={item.value}><SidebarMenuButton onClick={() => handleNavigation(item.value)} isActive={activeTab === item.value || (item.value === "marketplace-links" && onMarketplaceRoute) || (item.value === "whatsapp-catalog" && onWhatsAppCatalogRoute)} tooltip={item.title}><item.icon className="h-4 w-4" />{!collapsed && <span>{item.title}</span>}</SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu></SidebarGroupContent></SidebarGroup></SidebarContent>
      <SidebarFooter className="p-3"><SidebarMenu><SidebarMenuItem><SidebarMenuButton onClick={() => navigate("/")} tooltip="Back to Store"><Settings className="h-4 w-4" />{!collapsed && <span>Back to Store</span>}</SidebarMenuButton></SidebarMenuItem><SidebarMenuItem><SidebarMenuButton onClick={handleSignOut} tooltip="Sign Out"><LogOut className="h-4 w-4" />{!collapsed && <span>Sign Out</span>}</SidebarMenuButton></SidebarMenuItem></SidebarMenu></SidebarFooter>
    </Sidebar>
  );
}
