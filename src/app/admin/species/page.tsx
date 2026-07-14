'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Plus, Search, Edit2, Link2, Merge, Eye, ChevronRight,
  X, Save, Check, AlertTriangle, FileText, Image, ShoppingBag, Tag
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  adminFetchSpeciesList,
  adminCreateSpecies,
  adminUpdateSpecies,
  adminLinkAssetToSpecies,
  adminLinkDocumentToSpecies,
  adminLinkProductToSpecies,
  adminAddSpeciesName,
  adminDeleteSpeciesName,
  fetchSpeciesNames,
  type EncSpecies,
  type EncSpeciesName,
} from '@/lib/supabase/encyclopediaQueries';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';


const CATEGORIES = ['Fish', 'Crustaceans', 'Cephalopods', 'Molluscs', 'Aquaculture'];
const VALIDATION_STATUSES = ['draft', 'suggested', 'unverified', 'under_review', 'verified', 'rejected', 'disputed', 'obsolete', 'archived'];
const NAME_TYPES = ['commercial', 'common', 'local', 'scientific_synonym', 'marketplace', 'historical'];
const LANG_CODES = ['en', 'fr', 'es', 'pt', 'de', 'it', 'nl', 'ar', 'zh', 'ja', 'ru', 'ko'];

type AdminTab = 'list' | 'create' | 'edit' | 'names' | 'link';

interface SpeciesFormData {
  common_name: string;
  scientific_name: string;
  genus: string;
  family: string;
  order_name: string;
  category: string;
  fao_alpha3_code: string;
  fao_areas: string;
  description: string;
  habitat: string;
  habitat_depth: string;
  world_distribution: string;
  fishing_methods: string;
  aquaculture_methods: string;
  commercial_forms: string;
  presentations: string;
  conservation_methods: string;
  possible_certifications: string;
  packaging_notes: string;
  validation_status: string;
  is_validated: boolean;
  is_public: boolean;
  seo_title: string;
  seo_description: string;
  seo_keywords: string;
}

const EMPTY_FORM: SpeciesFormData = {
  common_name: '', scientific_name: '', genus: '', family: '', order_name: '',
  category: '', fao_alpha3_code: '', fao_areas: '', description: '',
  habitat: '', habitat_depth: '', world_distribution: '',
  fishing_methods: '', aquaculture_methods: '', commercial_forms: '',
  presentations: '', conservation_methods: '', possible_certifications: '',
  packaging_notes: '', validation_status: 'unverified',
  is_validated: false, is_public: true,
  seo_title: '', seo_description: '', seo_keywords: '',
};

function speciesFormToPayload(form: SpeciesFormData): Partial<EncSpecies> {
  const toArray = (s: string) => s.split(',').map(x => x.trim()).filter(Boolean);
  const slug = form.common_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return {
    common_name: form.common_name,
    scientific_name: form.scientific_name,
    genus: form.genus || null,
    family: form.family || null,
    order_name: form.order_name || null,
    category: form.category || null,
    fao_alpha3_code: form.fao_alpha3_code || null,
    fao_areas: form.fao_areas ? toArray(form.fao_areas) : null,
    description: form.description || null,
    habitat: form.habitat || null,
    habitat_depth: form.habitat_depth || null,
    world_distribution: form.world_distribution || null,
    fishing_methods: form.fishing_methods ? toArray(form.fishing_methods) : null,
    aquaculture_methods: form.aquaculture_methods ? toArray(form.aquaculture_methods) : null,
    commercial_forms: form.commercial_forms ? toArray(form.commercial_forms) : null,
    presentations: form.presentations ? toArray(form.presentations) : null,
    conservation_methods: form.conservation_methods ? toArray(form.conservation_methods) : null,
    possible_certifications: form.possible_certifications ? toArray(form.possible_certifications) : null,
    packaging_notes: form.packaging_notes || null,
    validation_status: form.validation_status || 'unverified',
    is_validated: form.is_validated,
    is_public: form.is_public,
    seo_title: form.seo_title || null,
    seo_description: form.seo_description || null,
    seo_keywords: form.seo_keywords ? toArray(form.seo_keywords) : null,
    slug,
  };
}

function speciesToForm(sp: EncSpecies): SpeciesFormData {
  const toStr = (arr: string[] | null) => arr?.join(', ') || '';
  return {
    common_name: sp.common_name,
    scientific_name: sp.scientific_name,
    genus: sp.genus || '',
    family: sp.family || '',
    order_name: sp.order_name || '',
    category: sp.category || '',
    fao_alpha3_code: sp.fao_alpha3_code || '',
    fao_areas: toStr(sp.fao_areas),
    description: sp.description || '',
    habitat: sp.habitat || '',
    habitat_depth: sp.habitat_depth || '',
    world_distribution: sp.world_distribution || '',
    fishing_methods: toStr(sp.fishing_methods),
    aquaculture_methods: toStr(sp.aquaculture_methods),
    commercial_forms: toStr(sp.commercial_forms),
    presentations: toStr(sp.presentations),
    conservation_methods: toStr(sp.conservation_methods),
    possible_certifications: toStr(sp.possible_certifications),
    packaging_notes: sp.packaging_notes || '',
    validation_status: sp.validation_status || 'unverified',
    is_validated: sp.is_validated,
    is_public: sp.is_public ?? true,
    seo_title: sp.seo_title || '',
    seo_description: sp.seo_description || '',
    seo_keywords: toStr(sp.seo_keywords),
  };
}

// ---- Form Field ----
function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  );
}

function Input({ value, onChange, placeholder = '', type = 'text', disabled = false }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string; disabled?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:border-secondary/60 transition-colors disabled:opacity-50"
    />
  );
}

function Textarea({ value, onChange, placeholder = '', rows = 3 }: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:border-secondary/60 transition-colors resize-none"
    />
  );
}

function Select({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:border-secondary/60 transition-colors"
    >
      <option value="">— Select —</option>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

// ---- Species Form ----
function SpeciesForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial: SpeciesFormData;
  onSave: (data: SpeciesFormData) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<SpeciesFormData>(initial);
  const set = (key: keyof SpeciesFormData) => (val: string | boolean) =>
    setForm((f) => ({ ...f, [key]: val }));

  return (
    <div className="space-y-6">
      {/* Taxonomy */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4 pb-2 border-b border-border">Taxonomy & Identity</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Common Name *">
            <Input value={form.common_name} onChange={set('common_name')} placeholder="e.g. Atlantic Salmon" />
          </Field>
          <Field label="Scientific Name *">
            <Input value={form.scientific_name} onChange={set('scientific_name')} placeholder="e.g. Salmo salar" />
          </Field>
          <Field label="Genus">
            <Input value={form.genus} onChange={set('genus')} placeholder="e.g. Salmo" />
          </Field>
          <Field label="Family">
            <Input value={form.family} onChange={set('family')} placeholder="e.g. Salmonidae" />
          </Field>
          <Field label="Order">
            <Input value={form.order_name} onChange={set('order_name')} placeholder="e.g. Salmoniformes" />
          </Field>
          <Field label="Category">
            <Select
              value={form.category}
              onChange={set('category')}
              options={CATEGORIES.map((c) => ({ value: c, label: c }))}
            />
          </Field>
          <Field label="FAO Alpha-3 Code">
            <Input value={form.fao_alpha3_code} onChange={set('fao_alpha3_code')} placeholder="e.g. SAL" />
          </Field>
          <Field label="FAO Areas" hint="Comma-separated, e.g. 27, 21, 18">
            <Input value={form.fao_areas} onChange={set('fao_areas')} placeholder="27, 21" />
          </Field>
        </div>
      </div>

      {/* Description */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4 pb-2 border-b border-border">Description</h3>
        <Field label="General Description">
          <Textarea value={form.description} onChange={set('description')} placeholder="General description of the species…" rows={4} />
        </Field>
      </div>

      {/* Habitat */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4 pb-2 border-b border-border">Habitat & Distribution</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Habitat">
            <Input value={form.habitat} onChange={set('habitat')} placeholder="e.g. Pelagic, coastal, freshwater" />
          </Field>
          <Field label="Depth Range">
            <Input value={form.habitat_depth} onChange={set('habitat_depth')} placeholder="e.g. 0–200m" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="World Distribution">
              <Textarea value={form.world_distribution} onChange={set('world_distribution')} placeholder="Geographic distribution…" rows={2} />
            </Field>
          </div>
        </div>
      </div>

      {/* Fishing */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4 pb-2 border-b border-border">Fishing & Aquaculture</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Fishing Methods" hint="Comma-separated">
            <Input value={form.fishing_methods} onChange={set('fishing_methods')} placeholder="Trawl, Longline, Purse seine" />
          </Field>
          <Field label="Aquaculture Methods" hint="Comma-separated">
            <Input value={form.aquaculture_methods} onChange={set('aquaculture_methods')} placeholder="Net pen, Pond, RAS" />
          </Field>
        </div>
      </div>

      {/* Commercial */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4 pb-2 border-b border-border">Commercial Information</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Commercial Forms" hint="Comma-separated">
            <Input value={form.commercial_forms} onChange={set('commercial_forms')} placeholder="Whole, Fillet, HGT, IQF, Steak" />
          </Field>
          <Field label="Presentations" hint="Comma-separated">
            <Input value={form.presentations} onChange={set('presentations')} placeholder="Fresh, Frozen, Smoked" />
          </Field>
          <Field label="Conservation Methods" hint="Comma-separated">
            <Input value={form.conservation_methods} onChange={set('conservation_methods')} placeholder="Chilled, Frozen, Salted" />
          </Field>
          <Field label="Possible Certifications" hint="Comma-separated">
            <Input value={form.possible_certifications} onChange={set('possible_certifications')} placeholder="MSC, ASC, HACCP, Halal" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Packaging Notes">
              <Input value={form.packaging_notes} onChange={set('packaging_notes')} placeholder="Packaging notes…" />
            </Field>
          </div>
        </div>
      </div>

      {/* Status */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4 pb-2 border-b border-border">Status & Visibility</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Validation Status">
            <Select
              value={form.validation_status}
              onChange={set('validation_status')}
              options={VALIDATION_STATUSES.map((s) => ({ value: s, label: s.replace('_', ' ') }))}
            />
          </Field>
          <div className="flex flex-col gap-3 pt-5">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_validated}
                onChange={(e) => set('is_validated')(e.target.checked)}
                className="w-4 h-4 accent-secondary"
              />
              <span className="text-sm text-foreground">Verified / Validated</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_public}
                onChange={(e) => set('is_public')(e.target.checked)}
                className="w-4 h-4 accent-secondary"
              />
              <span className="text-sm text-foreground">Public (visible in encyclopedia)</span>
            </label>
          </div>
        </div>
      </div>

      {/* SEO */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4 pb-2 border-b border-border">SEO</h3>
        <div className="space-y-4">
          <Field label="SEO Title" hint="Leave blank to auto-generate">
            <Input value={form.seo_title} onChange={set('seo_title')} placeholder="Auto-generated if empty" />
          </Field>
          <Field label="Meta Description" hint="Leave blank to auto-generate">
            <Textarea value={form.seo_description} onChange={set('seo_description')} placeholder="Auto-generated if empty" rows={2} />
          </Field>
          <Field label="SEO Keywords" hint="Comma-separated">
            <Input value={form.seo_keywords} onChange={set('seo_keywords')} placeholder="salmon, atlantic salmon, salmo salar" />
          </Field>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => onSave(form)}
          disabled={saving || !form.common_name || !form.scientific_name}
          className="flex items-center gap-2 px-5 py-2.5 bg-secondary text-white rounded-xl text-sm font-semibold hover:bg-secondary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Save size={14} />
          )}
          {saving ? 'Saving…' : 'Save Species'}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2.5 bg-muted text-foreground rounded-xl text-sm font-medium hover:bg-border transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ---- Names Manager ----
function NamesManager({ species, onClose }: { species: EncSpecies; onClose: () => void }) {
  const [names, setNames] = useState<EncSpeciesName[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState({ name: '', language_code: 'en', name_type: 'common', region: '', is_preferred: false });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSpeciesNames(species.id).then((n) => { setNames(n); setLoading(false); });
  }, [species.id]);

  const handleAdd = async () => {
    if (!newName.name) return;
    setSaving(true);
    const result = await adminAddSpeciesName({
      species_id: species.id,
      name: newName.name,
      language_code: newName.language_code,
      name_type: newName.name_type,
      region: newName.region || null,
      country_id: null,
      is_preferred: newName.is_preferred,
      status: 'under_review',
    });
    if (result) setNames((prev) => [...prev, result]);
    setNewName({ name: '', language_code: 'en', name_type: 'common', region: '', is_preferred: false });
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    await adminDeleteSpeciesName(id);
    setNames((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">Names for: {species.common_name}</h3>
        <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground"><X size={14} /></button>
      </div>

      {/* Add new name */}
      <div className="bg-muted/50 rounded-lg p-4 mb-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Add Name</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          <input
            type="text"
            value={newName.name}
            onChange={(e) => setNewName((n) => ({ ...n, name: e.target.value }))}
            placeholder="Name"
            className="px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:border-secondary/60"
          />
          <select
            value={newName.language_code}
            onChange={(e) => setNewName((n) => ({ ...n, language_code: e.target.value }))}
            className="px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:border-secondary/60"
          >
            {LANG_CODES.map((l) => <option key={l} value={l}>{l.toUpperCase()}</option>)}
          </select>
          <select
            value={newName.name_type}
            onChange={(e) => setNewName((n) => ({ ...n, name_type: e.target.value }))}
            className="px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:border-secondary/60"
          >
            {NAME_TYPES.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
          </select>
          <input
            type="text"
            value={newName.region}
            onChange={(e) => setNewName((n) => ({ ...n, region: e.target.value }))}
            placeholder="Region (optional)"
            className="px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:border-secondary/60"
          />
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={newName.is_preferred}
              onChange={(e) => setNewName((n) => ({ ...n, is_preferred: e.target.checked }))}
              className="w-3.5 h-3.5 accent-secondary"
            />
            Preferred name
          </label>
          <button
            onClick={handleAdd}
            disabled={saving || !newName.name}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary text-white rounded-lg text-xs font-semibold disabled:opacity-50 transition-colors"
          >
            <Plus size={12} /> Add
          </button>
        </div>
      </div>

      {/* Names list */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-10 bg-muted rounded-lg animate-pulse" />)}
        </div>
      ) : names.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">No names added yet.</p>
      ) : (
        <div className="space-y-2">
          {names.map((n) => (
            <div key={n.id} className="flex items-center justify-between gap-3 px-3 py-2.5 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-xs font-mono-data bg-muted px-1.5 py-0.5 rounded text-muted-foreground shrink-0">{n.language_code.toUpperCase()}</span>
                <span className="text-sm font-medium text-foreground truncate">{n.name}</span>
                {n.region && <span className="text-xs text-muted-foreground">({n.region})</span>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{n.name_type.replace('_', ' ')}</span>
                {n.is_preferred && <span className="text-xs bg-secondary/10 text-secondary px-2 py-0.5 rounded-full">Preferred</span>}
                <button
                  onClick={() => handleDelete(n.id)}
                  className="p-1 hover:bg-red-50 hover:text-red-600 rounded text-muted-foreground transition-colors"
                >
                  <X size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Link Manager ----
function LinkManager({ species, onClose }: { species: EncSpecies; onClose: () => void }) {
  const [assetId, setAssetId] = useState('');
  const [documentId, setDocumentId] = useState('');
  const [productId, setProductId] = useState('');
  const [status, setStatus] = useState<Record<string, 'idle' | 'saving' | 'done' | 'error'>>({});

  const link = async (type: 'asset' | 'document' | 'product', id: string) => {
    if (!id.trim()) return;
    setStatus((s) => ({ ...s, [type]: 'saving' }));
    let ok = false;
    if (type === 'asset') ok = await adminLinkAssetToSpecies(species.id, id.trim());
    if (type === 'document') ok = await adminLinkDocumentToSpecies(species.id, id.trim());
    if (type === 'product') ok = await adminLinkProductToSpecies(species.id, id.trim());
    setStatus((s) => ({ ...s, [type]: ok ? 'done' : 'error' }));
    if (ok) {
      if (type === 'asset') setAssetId('');
      if (type === 'document') setDocumentId('');
      if (type === 'product') setProductId('');
    }
  };

  const LinkRow = ({ label, icon: Icon, value, onChange, type }: {
    label: string; icon: React.ElementType; value: string; onChange: (v: string) => void; type: 'asset' | 'document' | 'product';
  }) => (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 w-32 shrink-0">
        <Icon size={14} className="text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">{label}</span>
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Paste UUID…"
        className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm font-mono-data outline-none focus:border-secondary/60"
      />
      <button
        onClick={() => link(type, value)}
        disabled={!value || status[type] === 'saving'}
        className="flex items-center gap-1.5 px-3 py-2 bg-secondary text-white rounded-lg text-xs font-semibold disabled:opacity-50 transition-colors"
      >
        {status[type] === 'saving' ? <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" /> :
         status[type] === 'done' ? <Check size={12} /> :
         status[type] === 'error' ? <AlertTriangle size={12} /> :
         <Link2 size={12} />}
        Link
      </button>
      {status[type] === 'done' && <span className="text-xs text-green-600 font-medium">Linked!</span>}
      {status[type] === 'error' && <span className="text-xs text-red-600 font-medium">Error</span>}
    </div>
  );

  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">Link to: {species.common_name}</h3>
        <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground"><X size={14} /></button>
      </div>
      <div className="space-y-4">
        <LinkRow label="Photo/Asset" icon={Image} value={assetId} onChange={setAssetId} type="asset" />
        <LinkRow label="Document" icon={FileText} value={documentId} onChange={setDocumentId} type="document" />
        <LinkRow label="Product" icon={ShoppingBag} value={productId} onChange={setProductId} type="product" />
      </div>
      <p className="text-xs text-muted-foreground mt-4 bg-muted/50 rounded-lg px-3 py-2">
        Paste the UUID of the asset, document, or product you want to link to this species.
      </p>
    </div>
  );
}

// ---- Main Page ----
export default function AdminSpeciesPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  const [species, setSpecies] = useState<EncSpecies[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [fetching, setFetching] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [activeTab, setActiveTab] = useState<AdminTab>('list');
  const [editingSpecies, setEditingSpecies] = useState<EncSpecies | null>(null);
  const [managingNames, setManagingNames] = useState<EncSpecies | null>(null);
  const [linkingSpecies, setLinkingSpecies] = useState<EncSpecies | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  useEffect(() => {
    if (!loading && !user) router.replace('/auth?next=/admin/species');
    if (!loading && profile && !['reviewer', 'administrator', 'super_admin'].includes(profile.role)) {
      router.replace('/account');
    }
  }, [user, profile, loading, router]);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    if (!profile || !['reviewer', 'administrator', 'super_admin'].includes(profile.role)) return;
    setFetching(true);
    const result = await adminFetchSpeciesList({
      page, pageSize: 25, search: debouncedSearch,
      category: categoryFilter || undefined,
      validationStatus: statusFilter || undefined,
    });
    setSpecies(result.data);
    setTotal(result.total);
    setFetching(false);
  }, [page, debouncedSearch, categoryFilter, statusFilter, profile]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (form: SpeciesFormData) => {
    setSaving(true);
    const payload = speciesFormToPayload(form);
    const result = await adminCreateSpecies(payload);
    setSaving(false);
    if (result) {
      setSaveMsg('Species created successfully!');
      setActiveTab('list');
      load();
      setTimeout(() => setSaveMsg(''), 3000);
    }
  };

  const handleUpdate = async (form: SpeciesFormData) => {
    if (!editingSpecies) return;
    setSaving(true);
    const payload = speciesFormToPayload(form);
    const result = await adminUpdateSpecies(editingSpecies.id, payload);
    setSaving(false);
    if (result) {
      setSaveMsg('Species updated successfully!');
      setActiveTab('list');
      setEditingSpecies(null);
      load();
      setTimeout(() => setSaveMsg(''), 3000);
    }
  };

  if (loading || !user || !profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-border border-t-secondary rounded-full animate-spin" />
      </div>
    );
  }

  const totalPages = Math.ceil(total / 25);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-screen-2xl mx-auto px-4 lg:px-8 xl:px-10 2xl:px-16 pt-24 pb-16">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-6">
          <Link href="/admin" className="hover:text-foreground transition-colors">Admin</Link>
          <ChevronRight size={12} />
          <span className="text-foreground font-medium">Species Encyclopedia</span>
        </nav>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-foreground">Species Encyclopedia</h1>
            <p className="text-sm text-muted-foreground">{total} total species — Phase 7 Admin</p>
          </div>
          <div className="flex items-center gap-2">
            {saveMsg && (
              <span className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-lg">
                <Check size={12} /> {saveMsg}
              </span>
            )}
            {activeTab === 'list' && (
              <button
                onClick={() => { setEditingSpecies(null); setActiveTab('create'); }}
                className="flex items-center gap-2 px-4 py-2 bg-secondary text-white rounded-xl text-sm font-semibold hover:bg-secondary/90 transition-colors"
              >
                <Plus size={14} /> New Species
              </button>
            )}
            {activeTab !== 'list' && (
              <button
                onClick={() => { setActiveTab('list'); setEditingSpecies(null); setManagingNames(null); setLinkingSpecies(null); }}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft size={14} /> Back to list
              </button>
            )}
          </div>
        </div>

        {/* Create form */}
        {activeTab === 'create' && (
          <div>
            <h2 className="text-base font-semibold text-foreground mb-4">Create New Species</h2>
            <SpeciesForm
              initial={EMPTY_FORM}
              onSave={handleCreate}
              onCancel={() => setActiveTab('list')}
              saving={saving}
            />
          </div>
        )}

        {/* Edit form */}
        {activeTab === 'edit' && editingSpecies && (
          <div>
            <h2 className="text-base font-semibold text-foreground mb-4">Edit: {editingSpecies.common_name}</h2>
            <SpeciesForm
              initial={speciesToForm(editingSpecies)}
              onSave={handleUpdate}
              onCancel={() => { setActiveTab('list'); setEditingSpecies(null); }}
              saving={saving}
            />
          </div>
        )}

        {/* Names manager */}
        {activeTab === 'names' && managingNames && (
          <NamesManager
            species={managingNames}
            onClose={() => { setActiveTab('list'); setManagingNames(null); }}
          />
        )}

        {/* Link manager */}
        {activeTab === 'link' && linkingSpecies && (
          <LinkManager
            species={linkingSpecies}
            onClose={() => { setActiveTab('list'); setLinkingSpecies(null); }}
          />
        )}

        {/* Species list */}
        {activeTab === 'list' && (
          <>
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="relative flex-1 max-w-sm">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search species…"
                  className="w-full pl-9 pr-4 py-2 bg-card border border-border rounded-xl text-sm outline-none focus:border-secondary/60 transition-colors"
                />
              </div>
              <select
                value={categoryFilter}
                onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
                className="px-3 py-2 bg-card border border-border rounded-xl text-sm outline-none focus:border-secondary/60"
              >
                <option value="">All categories</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                className="px-3 py-2 bg-card border border-border rounded-xl text-sm outline-none focus:border-secondary/60"
              >
                <option value="">All statuses</option>
                {VALIDATION_STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
            </div>

            {/* Table */}
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Common Name</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Scientific Name</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Family</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden xl:table-cell">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Validated</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {fetching ? (
                    Array.from({ length: 10 }).map((_, i) => (
                      <tr key={`skel-${i}`} className="border-b border-border">
                        <td className="px-4 py-3"><div className="h-4 bg-muted rounded animate-pulse w-3/4" /></td>
                        <td className="px-4 py-3 hidden md:table-cell"><div className="h-4 bg-muted rounded animate-pulse w-1/2" /></td>
                        <td className="px-4 py-3 hidden lg:table-cell"><div className="h-4 bg-muted rounded animate-pulse w-1/3" /></td>
                        <td className="px-4 py-3 hidden xl:table-cell"><div className="h-4 bg-muted rounded animate-pulse w-16" /></td>
                        <td className="px-4 py-3"><div className="h-4 bg-muted rounded animate-pulse w-12" /></td>
                        <td className="px-4 py-3"><div className="h-4 bg-muted rounded animate-pulse w-24 ml-auto" /></td>
                      </tr>
                    ))
                  ) : species.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground text-sm">No species found</td>
                    </tr>
                  ) : (
                    species.map((sp) => (
                      <tr key={sp.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <span className="font-medium text-foreground">{sp.common_name}</span>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-muted-foreground font-mono-data italic text-xs">{sp.scientific_name}</td>
                        <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground text-xs">{sp.family || '—'}</td>
                        <td className="px-4 py-3 hidden xl:table-cell">
                          {sp.validation_status && (
                            <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                              {sp.validation_status.replace('_', ' ')}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sp.is_validated ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                            {sp.is_validated ? 'Yes' : 'No'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Link
                              href={`/species/${sp.slug}`}
                              target="_blank"
                              className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                              title="View public page"
                            >
                              <Eye size={13} />
                            </Link>
                            <button
                              onClick={() => { setEditingSpecies(sp); setActiveTab('edit'); }}
                              className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                              title="Edit species"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() => { setManagingNames(sp); setActiveTab('names'); }}
                              className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                              title="Manage names"
                            >
                              <Tag size={13} />
                            </button>
                            <button
                              onClick={() => { setLinkingSpecies(sp); setActiveTab('link'); }}
                              className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                              title="Link media/products"
                            >
                              <Link2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                  <p className="text-xs text-muted-foreground">Page {page} of {totalPages} — {total} total</p>
                  <div className="flex gap-2">
                    <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 text-xs border border-border rounded-lg disabled:opacity-50 hover:bg-muted transition-colors">Previous</button>
                    <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1.5 text-xs border border-border rounded-lg disabled:opacity-50 hover:bg-muted transition-colors">Next</button>
                  </div>
                </div>
              )}
            </div>

            {/* Merge note */}
            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
              <Merge size={16} className="text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-amber-800">Duplicate Merge</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  To merge duplicate species, edit the primary species and update its slug to match the duplicate, then delete the duplicate entry. Full merge workflow will be available in a future update.
                </p>
              </div>
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
