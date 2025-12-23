"use client";

import { useState } from "react";
import { saveBlueprintSchema } from "../actions";

type CategoryNode = {
    id: string;
    name: string;
    slug: string;
    children: CategoryNode[];
};

type BlueprintMap = Record<string, { count: number; passing: number | null }>;

type Props = {
    institutionId: string;
    rootCategory: CategoryNode;
    initialBlueprints: BlueprintMap;
};

function SchemaRow({
    node,
    depth,
    values,
    onChange,
}: {
    node: CategoryNode;
    depth: number;
    values: BlueprintMap;
    onChange: (id: string, field: "count" | "passing", val: number | null) => void;
}) {
    const current = values[node.id] || { count: 0, passing: null };
    const hasChildren = node.children.length > 0;

    return (
        <>
            <div className={`grid grid-cols-[1fr_100px_100px] gap-4 py-2 border-b border-slate-100 items-center hover:bg-slate-50 ${depth === 0 ? "font-semibold bg-slate-50/50" : ""}`}>
                <div style={{ paddingLeft: `${depth * 24}px` }} className="text-sm text-slate-700 truncate">
                    <span className="mr-2 text-slate-400">{hasChildren ? (depth === 0 ? "📂" : "📁") : "📄"}</span>
                    {node.name} <span className="text-xs text-slate-400">({node.slug})</span>
                </div>
                <div>
                    <input
                        type="number"
                        min={0}
                        value={current.count || ""}
                        onChange={(e) => onChange(node.id, "count", e.target.value ? parseInt(e.target.value) : 0)}
                        placeholder="-"
                        className={`w-full px-2 py-1 text-sm border rounded outline-none focus:border-sky-500 text-center ${current.count > 0 ? "border-sky-300 bg-sky-50 font-medium" : "border-slate-200"}`}
                    />
                </div>
                <div>
                    <input
                        type="number"
                        min={0}
                        value={current.passing ?? ""}
                        onChange={(e) => onChange(node.id, "passing", e.target.value ? parseInt(e.target.value) : null)}
                        placeholder="-"
                        className="w-full px-2 py-1 text-sm border border-slate-200 rounded outline-none focus:border-sky-500 text-center"
                    />
                </div>
            </div>
            {node.children.map(child => (
                <SchemaRow key={child.id} node={child} depth={depth + 1} values={values} onChange={onChange} />
            ))}
        </>
    );
}

export function BlueprintSchemaEditor({ institutionId, rootCategory, initialBlueprints }: Props) {
    const [values, setValues] = useState<BlueprintMap>(initialBlueprints);
    const [isSaving, setIsSaving] = useState(false);

    // Calculate total questions
    const totalQuestions = Object.values(values).reduce((sum, v) => sum + (v.count || 0), 0);
    const activeCount = Object.values(values).filter(v => (v.count || 0) > 0).length;

    const handleChange = (id: string, field: "count" | "passing", val: number | null) => {
        setValues(prev => ({
            ...prev,
            [id]: { ...prev[id], [field]: val }
        }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            // Convert map to array for server action
            const entries = Object.entries(values)
                .filter(([_, v]) => (v.count || 0) > 0) // Only save rows with active questions
                .map(([categoryId, v]) => ({
                    category_id: categoryId,
                    question_count: v.count,
                    passing_grade: v.passing
                }));

            const fd = new FormData();
            fd.append("institution_id", institutionId);
            fd.append("schema_json", JSON.stringify(entries));

            await saveBlueprintSchema(fd);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="border rounded-lg bg-white">
            <div className="flex items-center justify-between px-4 py-3 border-b bg-slate-50/50">
                <div>
                    <h3 className="text-sm font-semibold text-slate-800">Schema Configuration</h3>
                    <p className="text-xs text-slate-500">Edit total soal & passing grade per kategori.</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <p className="text-xs text-slate-500">Total Soal</p>
                        <p className="text-sm font-bold text-slate-900">{totalQuestions}</p>
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                    >
                        {isSaving ? "Saving..." : "Save Schema"}
                    </button>
                </div>
            </div>

            <div className="p-4">
                {/* Header */}
                <div className="grid grid-cols-[1fr_100px_100px] gap-4 pb-2 mb-2 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <div className="pl-2">Kategori</div>
                    <div className="text-center">Jml Soal</div>
                    <div className="text-center">Passing</div>
                </div>

                <div className="max-h-[600px] overflow-y-auto">
                    <SchemaRow node={rootCategory} depth={0} values={values} onChange={handleChange} />
                </div>
            </div>
        </div>
    );
}
