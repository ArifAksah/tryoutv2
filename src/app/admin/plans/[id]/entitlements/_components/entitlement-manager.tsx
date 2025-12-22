"use client";

import { useState } from "react";
import { toggleEntitlement } from "../actions";

type Package = {
    id: string;
    title: string;
    slug: string;
    is_active: boolean;
};

type Entitlement = {
    plan_id: string;
    target_id: string;
    entitlement_type: string;
};

type Props = {
    planId: string;
    allPackages: Package[];
    existingEntitlements: Entitlement[];
};

export function EntitlementManager({ planId, allPackages, existingEntitlements }: Props) {
    // Keep local state for optimistic UI updates (optional but good for UX)
    // For now we rely on server revalidation which is fast enough

    const isEntitled = (pkgId: string) => existingEntitlements.some(e => e.target_id === pkgId);

    const handleToggle = async (pkgId: string, checked: boolean) => {
        await toggleEntitlement(planId, pkgId, checked);
    };

    return (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
                <h3 className="font-bold text-slate-800">Akses Tryout Paket</h3>
                <p className="text-xs text-slate-500">Centang paket yang termasuk dalam langganan ini.</p>
            </div>
            <div className="divide-y divide-slate-100">
                {allPackages.map(pkg => {
                    const checked = isEntitled(pkg.id);
                    return (
                        <label key={pkg.id} className="flex items-center justify-between px-5 py-4 hover:bg-slate-50 cursor-pointer transition">
                            <div>
                                <div className="font-semibold text-slate-900">{pkg.title}</div>
                                <div className="text-xs text-slate-500">Slug: {pkg.slug} • {pkg.is_active ? 'Active' : 'Inactive'}</div>
                            </div>
                            <input
                                type="checkbox"
                                className="h-5 w-5 rounded border-slate-300 bg-slate-100 text-indigo-600 focus:ring-indigo-500"
                                checked={checked}
                                onChange={(e) => handleToggle(pkg.id, e.target.checked)}
                            />
                        </label>
                    );
                })}
                {allPackages.length === 0 && (
                    <div className="px-5 py-8 text-center text-sm text-slate-500">
                        Belum ada Exam Package yang dibuat.
                    </div>
                )}
            </div>
        </div>
    );
}
