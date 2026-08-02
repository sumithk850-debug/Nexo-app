"use client";

import { useState, useEffect } from "react";
import { FolderGit2, Check, RefreshCw } from "lucide-react";

interface Repo {
  id: number;
  name: string;
  fullName: string;
  private: boolean;
  defaultBranch: string;
  updatedAt: string;
}

export function RepoSelector({ userId }: { userId: string }) {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState<string | null>(null);

  useEffect(() => {
    loadRepos();
  }, [userId]);

  async function loadRepos() {
    setLoading(true);
    try {
      const res = await fetch(`/api/github/repos?userId=${userId}`);
      const data = await res.json();
      if (data.repos) {
        setRepos(data.repos);
        setSelectedRepo(data.selectedRepo ?? null);
      }
    } catch {
      // fail silently, empty list shown
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectRepo(repoFullName: string) {
    setSwitching(repoFullName);
    try {
      await fetch("/api/github/repos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, repoFullName }),
      });
      setSelectedRepo(repoFullName);
    } finally {
      setSwitching(null);
    }
  }

  if (loading) {
    return <p className="mt-2 text-xs text-ink-faint">Loading your repositories…</p>;
  }

  if (repos.length === 0) {
    return (
      <p className="mt-2 text-xs text-ink-faint">
        No repositories found on your GitHub account.
      </p>
    );
  }

  return (
    <div className="mt-2 space-y-1">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs text-ink-muted">Select the repo Craft V3 can work on:</p>
        <button
          onClick={loadRepos}
          className="text-ink-faint hover:text-ink"
          aria-label="Refresh repositories"
        >
          <RefreshCw className="h-3 w-3" />
        </button>
      </div>

      <div className="max-h-64 space-y-1 overflow-y-auto">
        {repos.map((repo) => {
          const isSelected = selectedRepo === repo.fullName;
          const isSwitching = switching === repo.fullName;
          return (
            <button
              key={repo.id}
              onClick={() => handleSelectRepo(repo.fullName)}
              disabled={isSwitching}
              className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left transition ${
                isSelected
                  ? "border-cyan bg-cyan/10"
                  : "border-edge bg-void hover:border-cyan/30"
              }`}
            >
              <div className="flex min-w-0 items-center gap-2">
                <FolderGit2 className="h-3.5 w-3.5 flex-shrink-0 text-ink-faint" />
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-ink">{repo.name}</p>
                  <p className="truncate text-[10px] text-ink-faint">
                    {repo.private ? "Private" : "Public"} · {repo.defaultBranch}
                  </p>
                </div>
              </div>
              {isSelected && (
                <Check className="h-4 w-4 flex-shrink-0 text-cyan" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
