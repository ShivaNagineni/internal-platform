import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  BookOpen,
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  Loader2,
  Calendar,
  User,
  FileText,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FolderOpen,
  File,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn, getInitials } from "@/lib/utils";
import type { ADOWikiPage, WikiDocument, WikiDocumentCreate, WikiDocumentUpdate } from "@/types";
import {
  useADOWikiPages,
  useADOWikiPageContent,
  useWikiDocuments,
  useWikiCategories,
  useCreateWikiDocument,
  useUpdateWikiDocument,
  useDeleteWikiDocument,
} from "@/hooks/useWiki";
import { useCurrentUser } from "@/hooks/useUsers";
import ConfirmDialog from "@/components/ConfirmDialog";

// ─── Simple markdown renderer ─────────────────────────────────────────────────

function inlineMarkdown(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[([^\]]+)\]\([^)]+\))/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*"))
      return <em key={i}>{part.slice(1, -1)}</em>;
    if (part.startsWith("`") && part.endsWith("`"))
      return <code key={i} className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-xs font-mono text-rose-600 dark:text-rose-400">{part.slice(1, -1)}</code>;
    if (/^\[.+\]\(.+\)$/.test(part)) {
      const m = part.match(/^\[(.+)\]\((.+)\)$/);
      if (m) return <a key={i} href={m[2]} target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 underline">{m[1]}</a>;
    }
    return part;
  });
}

function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("### ")) {
      nodes.push(<h3 key={i} className="text-base font-semibold text-slate-800 dark:text-slate-200 mt-4 mb-1">{inlineMarkdown(line.slice(4))}</h3>);
    } else if (line.startsWith("## ")) {
      nodes.push(<h2 key={i} className="text-lg font-semibold text-slate-900 dark:text-white mt-5 mb-1 border-b border-slate-100 dark:border-slate-800 pb-1">{inlineMarkdown(line.slice(3))}</h2>);
    } else if (line.startsWith("# ")) {
      nodes.push(<h1 key={i} className="text-xl font-bold text-slate-900 dark:text-white mt-5 mb-2">{inlineMarkdown(line.slice(2))}</h1>);
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      const items: string[] = [];
      while (i < lines.length && (lines[i].startsWith("- ") || lines[i].startsWith("* "))) {
        items.push(lines[i].slice(2));
        i++;
      }
      nodes.push(<ul key={i} className="list-disc list-inside space-y-0.5 my-2 text-slate-700 dark:text-slate-300 text-sm">{items.map((it, j) => <li key={j}>{inlineMarkdown(it)}</li>)}</ul>);
      continue;
    } else if (/^\d+\. /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) { items.push(lines[i].replace(/^\d+\. /, "")); i++; }
      nodes.push(<ol key={i} className="list-decimal list-inside space-y-0.5 my-2 text-slate-700 dark:text-slate-300 text-sm">{items.map((it, j) => <li key={j}>{inlineMarkdown(it)}</li>)}</ol>);
      continue;
    } else if (line.startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) { codeLines.push(lines[i]); i++; }
      nodes.push(<pre key={i} className="bg-slate-100 dark:bg-slate-800 rounded-lg p-3 my-3 text-xs overflow-x-auto text-slate-700 dark:text-slate-300 font-mono">{codeLines.join("\n")}</pre>);
    } else if (line.startsWith("---") || line.startsWith("***")) {
      nodes.push(<hr key={i} className="border-slate-200 dark:border-slate-700 my-4" />);
    } else if (line.trim() === "") {
      nodes.push(<div key={i} className="h-2" />);
    } else {
      nodes.push(<p key={i} className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{inlineMarkdown(line)}</p>);
    }
    i++;
  }
  return nodes;
}

// ─── ADO Wiki tree helpers ────────────────────────────────────────────────────

interface TreeNode {
  title: string;
  path: string;
  page?: ADOWikiPage;
  children: TreeNode[];
}

function buildTree(pages: ADOWikiPage[]): TreeNode[] {
  const root: TreeNode = { title: "", path: "", children: [] };
  for (const page of pages) {
    const parts = page.path.split("/").filter(Boolean);
    let node = root;
    for (let i = 0; i < parts.length; i++) {
      const existing = node.children.find((c) => c.title === parts[i]);
      if (existing) {
        node = existing;
      } else {
        const newNode: TreeNode = { title: parts[i], path: "/" + parts.slice(0, i + 1).join("/"), children: [] };
        node.children.push(newNode);
        node = newNode;
      }
    }
    node.page = page;
  }
  return root.children;
}

function TreeNodeRow({
  node,
  depth,
  selectedPath,
  onSelect,
}: {
  node: TreeNode;
  depth: number;
  selectedPath: string;
  onSelect: (page: ADOWikiPage) => void;
}) {
  const [open, setOpen] = useState(depth === 0);
  const hasChildren = node.children.length > 0;
  const isSelected = node.page?.path === selectedPath;

  return (
    <div>
      <button
        onClick={() => {
          if (node.page) onSelect(node.page);
          if (hasChildren) setOpen((o) => !o);
        }}
        className={cn(
          "w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-left text-sm transition-colors group",
          isSelected
            ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300"
            : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
        )}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
      >
        {hasChildren ? (
          open ? <ChevronDown className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
        ) : (
          <File className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
        )}
        <span className="truncate text-xs font-medium">{node.title}</span>
      </button>
      {hasChildren && open && (
        <div>
          {node.children.map((child) => (
            <TreeNodeRow key={child.path} node={child} depth={depth + 1} selectedPath={selectedPath} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── ADO Wiki content viewer ──────────────────────────────────────────────────

function ADOPageViewer({ page }: { page: ADOWikiPage }) {
  const { data: content, isLoading } = useADOWikiPageContent(
    page.project, page.wiki_id, page.path, true
  );
  const s = useCurrentUser().data;
  const adoUrl = `https://dev.azure.com/TekYantra/${encodeURIComponent(page.project)}/_wiki/wikis/${page.wiki_id}?pagePath=${encodeURIComponent(page.path)}`;

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Page header */}
      <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{page.title}</h2>
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
            <span>{page.project}</span>
            <span>·</span>
            <span className="font-mono">{page.path}</span>
          </div>
        </div>
        <a
          href={adoUrl}
          target="_blank"
          rel="noreferrer"
          className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Open in ADO
        </a>
      </div>
      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
          </div>
        ) : content ? (
          <div className="max-w-3xl">{renderMarkdown(content)}</div>
        ) : (
          <p className="text-sm text-slate-400 py-8 text-center">No content</p>
        )}
      </div>
    </div>
  );
}

// ─── ADO Wiki Tab ─────────────────────────────────────────────────────────────

function ADOWikiTab() {
  const { data: pages = [], isLoading } = useADOWikiPages();
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("ALL");
  const [selectedPage, setSelectedPage] = useState<ADOWikiPage | null>(null);

  const projects = Array.from(new Set(pages.map((p) => p.project))).sort();

  const filtered = pages.filter((p) => {
    if (projectFilter !== "ALL" && p.project !== projectFilter) return false;
    if (search) return p.title.toLowerCase().includes(search.toLowerCase()) || p.path.toLowerCase().includes(search.toLowerCase());
    return true;
  });

  const tree = buildTree(filtered.filter((p) => !search && projectFilter === "ALL" ? true : true));
  const projectTrees: Record<string, TreeNode[]> = {};
  for (const proj of (projectFilter === "ALL" ? projects : [projectFilter])) {
    projectTrees[proj] = buildTree(filtered.filter((p) => p.project === proj));
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
        <span className="ml-2 text-sm text-slate-500">Loading wiki pages…</span>
      </div>
    );
  }

  return (
    <div className="flex gap-0 h-[calc(100vh-220px)] border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
      {/* Sidebar */}
      <div className="w-72 flex-shrink-0 border-r border-slate-100 dark:border-slate-800 flex flex-col">
        {/* Sidebar filters */}
        <div className="p-3 space-y-2 border-b border-slate-100 dark:border-slate-800">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search pages…"
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
          </div>
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="w-full px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
          >
            <option value="ALL">All Projects</option>
            {projects.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        {/* Tree */}
        <div className="flex-1 overflow-y-auto p-2 space-y-3">
          {search ? (
            /* Flat search results */
            filtered.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">No pages found</p>
            ) : (
              filtered.map((page) => (
                <button
                  key={page.path + page.project}
                  onClick={() => setSelectedPage(page)}
                  className={cn(
                    "w-full flex flex-col items-start px-2 py-1.5 rounded-lg text-left text-xs transition-colors",
                    selectedPage?.path === page.path && selectedPage?.project === page.project
                      ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300"
                      : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  )}
                >
                  <span className="font-medium truncate w-full">{page.title}</span>
                  <span className="text-[10px] text-slate-400 truncate w-full">{page.project} · {page.path}</span>
                </button>
              ))
            )
          ) : (
            /* Tree view */
            Object.entries(projectTrees).map(([proj, nodes]) => (
              <div key={proj}>
                <div className="flex items-center gap-1.5 px-2 py-1 mb-1">
                  <FolderOpen className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide truncate">{proj}</span>
                </div>
                {nodes.map((node) => (
                  <TreeNodeRow
                    key={node.path}
                    node={node}
                    depth={0}
                    selectedPath={selectedPage?.path ?? ""}
                    onSelect={setSelectedPage}
                  />
                ))}
              </div>
            ))
          )}
        </div>

        {/* Count */}
        <div className="px-3 py-2 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400">
          {filtered.length} page{filtered.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Content panel */}
      {selectedPage ? (
        <ADOPageViewer page={selectedPage} />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-3 text-slate-400">
          <BookOpen className="w-10 h-10 opacity-30" />
          <p className="text-sm">Select a page from the tree to read it</p>
        </div>
      )}
    </div>
  );
}

// ─── Internal Docs ────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  General: "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300",
  Engineering: "bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300",
  Product: "bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300",
  Process: "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300",
  Design: "bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300",
  Infrastructure: "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300",
  Security: "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300",
  Onboarding: "bg-cyan-100 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300",
};
function categoryStyle(cat: string) { return CATEGORY_COLORS[cat] ?? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"; }

const PRESET_CATEGORIES = ["General", "Engineering", "Product", "Process", "Design", "Infrastructure", "Security", "Onboarding"];

function WikiFormModal({ open, onOpenChange, doc, onSubmit, isLoading }: {
  open: boolean; onOpenChange: (v: boolean) => void; doc?: WikiDocument | null;
  onSubmit: (data: WikiDocumentCreate | WikiDocumentUpdate) => Promise<void>; isLoading: boolean;
}) {
  const isEdit = Boolean(doc);
  const [title, setTitle] = useState(doc?.title ?? "");
  const [content, setContent] = useState(doc?.content ?? "");
  const [category, setCategory] = useState(doc?.category ?? "General");
  const [customCategory, setCustomCategory] = useState("");
  const [tagsInput, setTagsInput] = useState(doc?.tags.join(", ") ?? "");
  const effectiveCategory = category === "__custom__" ? customCategory : category;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    const tags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);
    await onSubmit({ title: title.trim(), content: content.trim(), category: effectiveCategory || "General", tags });
    onOpenChange(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
            <Dialog.Title className="text-base font-semibold text-slate-900 dark:text-white">{isEdit ? "Edit Document" : "New Internal Document"}</Dialog.Title>
            <Dialog.Close className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"><X className="w-4 h-4" /></Dialog.Close>
          </div>
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Title <span className="text-rose-500">*</span></label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Document title…" className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Category</label>
                <select value={PRESET_CATEGORIES.includes(category) ? category : "__custom__"} onChange={(e) => setCategory(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400">
                  {PRESET_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  <option value="__custom__">Custom…</option>
                </select>
                {category === "__custom__" && <input value={customCategory} onChange={(e) => setCustomCategory(e.target.value)} placeholder="Category name…" className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400" />}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Tags</label>
                <input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="tag1, tag2…" className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Content <span className="text-rose-500">*</span> <span className="normal-case font-normal text-slate-400 ml-1">Markdown supported</span></label>
              <textarea value={content} onChange={(e) => setContent(e.target.value)} required rows={14} placeholder="Write your document content here…" className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none font-mono" />
            </div>
            <div className="flex gap-3 pt-1">
              <Dialog.Close asChild><button type="button" className="flex-1 px-4 py-2.5 text-sm font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Cancel</button></Dialog.Close>
              <button type="submit" disabled={isLoading || !title.trim() || !content.trim()} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-60">
                {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                {isEdit ? "Save Changes" : "Publish"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function WikiViewModal({ doc, onClose, onEdit, onDelete, canEdit }: {
  doc: WikiDocument | null; onClose: () => void;
  onEdit: (d: WikiDocument) => void; onDelete: (d: WikiDocument) => void; canEdit: (d: WikiDocument) => boolean;
}) {
  return (
    <Dialog.Root open={Boolean(doc)} onOpenChange={(v) => { if (!v) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-2xl max-h-[85vh] flex flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          {doc && (
            <>
              <div className="flex items-start justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
                <div className="space-y-1 flex-1 min-w-0 pr-4">
                  <Dialog.Title className="text-lg font-semibold text-slate-900 dark:text-white leading-tight">{doc.title}</Dialog.Title>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className={cn("px-2 py-0.5 rounded-full font-medium", categoryStyle(doc.category))}>{doc.category}</span>
                    <span className="flex items-center gap-1"><User className="w-3 h-3" />{doc.author_name}</span>
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDistanceToNow(new Date(doc.updated_at), { addSuffix: true })}</span>
                  </div>
                  {doc.tags.length > 0 && <div className="flex flex-wrap gap-1 pt-0.5">{doc.tags.map((t) => <span key={t} className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full">#{t}</span>)}</div>}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {canEdit(doc) && (<>
                    <button onClick={() => { onClose(); onEdit(doc); }} className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => { onClose(); onDelete(doc); }} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </>)}
                  <Dialog.Close className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"><X className="w-4 h-4" /></Dialog.Close>
                </div>
              </div>
              <div className="overflow-y-auto p-6 flex-1">{renderMarkdown(doc.content)}</div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function InternalDocsTab() {
  const { data: currentUser } = useCurrentUser();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [formOpen, setFormOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<WikiDocument | null>(null);
  const [viewingDoc, setViewingDoc] = useState<WikiDocument | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WikiDocument | null>(null);

  const { data: docs = [], isLoading } = useWikiDocuments(search || undefined, categoryFilter !== "ALL" ? categoryFilter : undefined);
  const { data: categories = [] } = useWikiCategories();
  const createDoc = useCreateWikiDocument();
  const updateDoc = useUpdateWikiDocument();
  const deleteDoc = useDeleteWikiDocument();

  const isManagerPlus = currentUser && ["MANAGER", "ADMIN", "OWNER"].includes(currentUser.role);
  function canEdit(doc: WikiDocument) { return !!(currentUser && (doc.author_email === currentUser.email || isManagerPlus)); }

  async function handleFormSubmit(data: WikiDocumentCreate | WikiDocumentUpdate) {
    if (editingDoc) await updateDoc.mutateAsync({ id: editingDoc.id, payload: data as WikiDocumentUpdate });
    else await createDoc.mutateAsync(data as WikiDocumentCreate);
  }

  const allCategories = Array.from(new Set([...categories, ...docs.map((d) => d.category)])).sort();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search documents…" className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800/60 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
        </div>
        {allCategories.length > 0 && (
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800/60 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400">
            <option value="ALL">All Categories</option>
            {allCategories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <button onClick={() => { setEditingDoc(null); setFormOpen(true); }} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-colors">
          <Plus className="w-4 h-4" /> New Document
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></div>
      ) : docs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center"><FileText className="w-7 h-7 text-slate-400" /></div>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{search || categoryFilter !== "ALL" ? "No documents match your filters" : "No internal documents yet"}</p>
          {!search && categoryFilter === "ALL" && <button onClick={() => setFormOpen(true)} className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">Create the first document</button>}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {docs.map((doc) => {
            const excerpt = doc.content.replace(/#+\s/g, "").replace(/[*`]/g, "").slice(0, 120);
            return (
              <button key={doc.id} onClick={() => setViewingDoc(doc)} className="w-full text-left bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 hover:border-indigo-200 dark:hover:border-indigo-800 hover:shadow-md transition-all space-y-3 group">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors leading-snug line-clamp-2">{doc.title}</h3>
                  <span className={cn("flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full", categoryStyle(doc.category))}>{doc.category}</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-3 leading-relaxed">{excerpt}{doc.content.length > 120 ? "…" : ""}</p>
                {doc.tags.length > 0 && <div className="flex flex-wrap gap-1">{doc.tags.slice(0, 4).map((t) => <span key={t} className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full">#{t}</span>)}</div>}
                <div className="flex items-center gap-3 text-[11px] text-slate-400 pt-1 border-t border-slate-50 dark:border-slate-800">
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center flex-shrink-0"><span className="text-white text-[7px] font-semibold">{getInitials(doc.author_name)}</span></div>
                    <span>{doc.author_name}</span>
                  </div>
                  <span className="ml-auto">{formatDistanceToNow(new Date(doc.updated_at), { addSuffix: true })}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {formOpen && (
        <WikiFormModal open={formOpen} onOpenChange={(v) => { setFormOpen(v); if (!v) setEditingDoc(null); }} doc={editingDoc} onSubmit={handleFormSubmit} isLoading={createDoc.isPending || updateDoc.isPending} />
      )}
      <WikiViewModal doc={viewingDoc} onClose={() => setViewingDoc(null)} onEdit={(d) => { setEditingDoc(d); setFormOpen(true); }} onDelete={setDeleteTarget} canEdit={canEdit} />
      <ConfirmDialog open={Boolean(deleteTarget)} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }} title="Delete Document" description={`Delete "${deleteTarget?.title}"? This cannot be undone.`} confirmLabel="Delete" variant="danger" onConfirm={async () => { if (deleteTarget) { await deleteDoc.mutateAsync(deleteTarget.id); setDeleteTarget(null); } }} />
    </div>
  );
}

// ─── Main Wiki Page ───────────────────────────────────────────────────────────

type Tab = "ado" | "internal";

export default function WikiPage() {
  const [tab, setTab] = useState<Tab>("ado");

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <BookOpen className="w-6 h-6 text-indigo-500" />
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Wiki</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Team knowledge base and documentation</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-fit">
        {([["ado", "ADO Wiki"], ["internal", "Internal Docs"]] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-lg transition-colors",
              tab === key
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "ado" ? <ADOWikiTab /> : <InternalDocsTab />}
    </div>
  );
}
