import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Trash2, Star, FolderInput, X, Link2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

interface Props {
  selectedIds: string[];
  categories: string[];
  onClear: () => void;
}

export function BulkProductActions({ selectedIds, categories, onClear }: Props) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [bulkCategory, setBulkCategory] = useState<string>("");
  const [linksOpen, setLinksOpen] = useState(false);
  const [amazonUrl, setAmazonUrl] = useState("");
  const [meeshoUrl, setMeeshoUrl] = useState("");
  const [whatsappUrl, setWhatsappUrl] = useState("");

  const { data: selectedProducts } = useQuery({
    queryKey: ["admin-marketplace-products", selectedIds],
    enabled: linksOpen && selectedIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, amazon_url, meesho_url, whatsapp_url")
        .in("id", selectedIds);
      if (error) throw error;
      return data || [];
    },
  });

  const openLinks = () => {
    const first = selectedProducts?.[0];
    setAmazonUrl(first?.amazon_url || "");
    setMeeshoUrl(first?.meesho_url || "");
    setWhatsappUrl(first?.whatsapp_url || "");
    setLinksOpen(true);
  };

  const saveLinks = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("products")
        .update({
          amazon_url: amazonUrl.trim() || null,
          meesho_url: meeshoUrl.trim() || null,
          whatsapp_url: whatsappUrl.trim() || null,
        })
        .in("id", selectedIds);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      queryClient.invalidateQueries({ queryKey: ["product"] });
      toast({ title: `Marketplace links saved for ${selectedIds.length} product${selectedIds.length === 1 ? "" : "s"}` });
      setLinksOpen(false);
    },
    onError: (e: any) => toast({ title: "Failed to save marketplace links", description: e.message, variant: "destructive" }),
  });

  const bulkUpdate = useMutation({
    mutationFn: async (patch: { featured?: boolean; category?: string }) => {
      const { error } = await supabase.from("products").update(patch).in("id", selectedIds);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      toast({ title: `Updated ${selectedIds.length} products` });
      onClear();
    },
    onError: (e: any) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  const bulkDelete = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("products").delete().in("id", selectedIds);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      toast({ title: `Deleted ${selectedIds.length} products` });
      onClear();
    },
    onError: (e: any) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  if (selectedIds.length === 0) return null;

  return (
    <div className="sticky top-14 z-30 flex flex-wrap items-center gap-2 p-3 bg-primary/10 border border-primary/20 rounded-lg">
      <Badge variant="default" className="text-sm">{selectedIds.length} selected</Badge>
      <Dialog open={linksOpen} onOpenChange={setLinksOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline" onClick={openLinks}>
            <Link2 className="h-4 w-4 mr-1" /> Marketplace Links
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Marketplace Links</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Add the Amazon, Meesho and WhatsApp links for the selected product{selectedIds.length === 1 ? "" : "s"}. Blank fields remove the corresponding button.
            </p>
            {selectedProducts?.length === 1 && <p className="text-sm font-medium">{selectedProducts[0].name}</p>}
            {selectedIds.length > 1 && <p className="text-sm font-medium">These links will be applied to all {selectedIds.length} selected products.</p>}
            <div className="space-y-2">
              <Label htmlFor="amazon-url">Amazon product URL</Label>
              <Input id="amazon-url" value={amazonUrl} onChange={(e) => setAmazonUrl(e.target.value)} placeholder="https://www.amazon.in/..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="meesho-url">Meesho product URL</Label>
              <Input id="meesho-url" value={meeshoUrl} onChange={(e) => setMeeshoUrl(e.target.value)} placeholder="https://www.meesho.com/..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="whatsapp-url">WhatsApp order URL</Label>
              <Input id="whatsapp-url" value={whatsappUrl} onChange={(e) => setWhatsappUrl(e.target.value)} placeholder="https://wa.me/..." />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setLinksOpen(false)}>Cancel</Button>
              <Button onClick={() => saveLinks.mutate()} disabled={saveLinks.isPending}>
                {saveLinks.isPending ? "Saving..." : "Save Links"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Button size="sm" variant="outline" onClick={() => bulkUpdate.mutate({ featured: true })} disabled={bulkUpdate.isPending}>
        <Star className="h-4 w-4 mr-1" /> Feature
      </Button>
      <Button size="sm" variant="outline" onClick={() => bulkUpdate.mutate({ featured: false })} disabled={bulkUpdate.isPending}>Unfeature</Button>
      <div className="flex items-center gap-1">
        <Select value={bulkCategory} onValueChange={setBulkCategory}>
          <SelectTrigger className="h-9 w-44"><SelectValue placeholder="Move to category..." /></SelectTrigger>
          <SelectContent>{categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>
        <Button size="sm" variant="outline" disabled={!bulkCategory || bulkUpdate.isPending} onClick={() => bulkUpdate.mutate({ category: bulkCategory })}><FolderInput className="h-4 w-4" /></Button>
      </div>
      <Button size="sm" variant="destructive" onClick={() => { if (confirm(`Delete ${selectedIds.length} products? This cannot be undone.`)) bulkDelete.mutate(); }} disabled={bulkDelete.isPending}>
        <Trash2 className="h-4 w-4 mr-1" /> Delete
      </Button>
      <Button size="sm" variant="ghost" onClick={onClear} className="ml-auto"><X className="h-4 w-4 mr-1" /> Clear</Button>
    </div>
  );
}
