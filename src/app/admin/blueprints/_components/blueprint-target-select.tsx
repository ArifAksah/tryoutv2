"use client";

import { useRouter } from "next/navigation";
import { SearchableSelect } from "../../categories/_components/searchable-select";
import { enableSubjectSupport } from "../actions";

type InstitutionRow = {
    id: string;
    code: string;
    name: string;
};

type SubjectRow = {
    id: string;
    name: string;
    slug: string;
};

type Props = {
    institutions: InstitutionRow[];
    availableSubjects: SubjectRow[];
    selectedId: string;
};

export function BlueprintTargetSelect({ institutions, availableSubjects, selectedId }: Props) {
    const router = useRouter();

    // Combine options
    const activeOptions = institutions.map((i) => ({
        id: i.id,
        name: `${i.code} · ${i.name}`,
        type: "Active",
        original: i,
    }));

    const subjectOptions = availableSubjects.map((s) => ({
        id: `subject-${s.slug}`, // special ID
        name: `+ Activate: ${s.name} (${s.slug.toUpperCase()})`,
        type: "New Subject",
        original: s,
    }));

    const allOptions = [...activeOptions, ...subjectOptions];

    const handleSelect = async (val: string) => {
        if (val.startsWith("subject-")) {
            // It's a subject activation
            const slug = val.replace("subject-", "");
            const subject = availableSubjects.find((s) => s.slug === slug);
            if (subject) {
                // Create FormData to simulate the action call
                const fd = new FormData();
                fd.append("code", subject.slug.toUpperCase());
                fd.append("name", subject.name);
                await enableSubjectSupport(fd);
                // The action redirects, so we just wait
            }
        } else {
            // It's an active institution
            router.push(`/admin/blueprints?institution=${val}`);
        }
    };

    return (
        <div className="w-full max-w-sm">
            <SearchableSelect
                options={allOptions}
                value={selectedId}
                onChange={handleSelect}
                placeholder="Cari Target Ujian / Subject..."
                className="w-full"
            />
        </div>
    );
}
