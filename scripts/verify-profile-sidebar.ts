import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sidebar = readFileSync("components/ChatSidebar.tsx", "utf8");
const profile = readFileSync("components/ProfilePanel.tsx", "utf8");
const page = readFileSync("app/page.tsx", "utf8");
const auth = readFileSync("lib/auth.ts", "utf8");

assert.ok(sidebar.includes('aria-controls="kyvorix-sidebar-more"'), "Sidebar More menu must be collapsible and accessible");
assert.ok(sidebar.includes("onOpenProfile"), "Sidebar must expose the Profile entry");
assert.ok(sidebar.includes("onToggleCoderMode(); onClose();"), "Primary Coder Agent shortcut must activate coder mode and close the mobile sidebar");
assert.ok(sidebar.includes('href="/news"'), "Primary Daily News shortcut must navigate to the existing news page");
assert.ok(sidebar.indexOf("Coder Agent") < sidebar.indexOf("More"), "Coder Agent must appear in the primary sidebar before More");
assert.ok(sidebar.indexOf('href="/news"') < sidebar.indexOf("More"), "Daily News must appear in the primary sidebar before More");
assert.ok(!sidebar.includes(">Chats</button>") && !sidebar.includes(">Search</button>"), "Chats and Search must not remain as primary sidebar shortcuts");
for (const feature of ["Kyvorix Coder Agent", "Deep Research", "Daily News", "Integrations", "Mission Agent", "Prompt Library", "About Kyvorix"]) {
  assert.ok(sidebar.includes(feature), `Existing navigation feature must remain available: ${feature}`);
}
assert.ok(sidebar.includes("onClose();"), "Secondary navigation actions must close the mobile sidebar after selection");
assert.ok(page.includes("<ProfilePanel"), "Chat page must render the Profile panel");
assert.ok(page.includes("onOpenProfile={() =>"), "Chat page must open Profile from the sidebar");
assert.ok(auth.includes("createdAt: data.user.created_at"), "Authenticated user must expose account creation date");
assert.ok(profile.includes('user?.email'), "Profile email must come from the authenticated user");
assert.ok(profile.includes("user?.createdAt"), "Profile join date must come from authenticated account data");
assert.ok(profile.includes('.order("created_at", { ascending: false })'), "Announcements must be shown in reverse chronological order");
assert.ok(!profile.includes('.eq("is_active", true)'), "Announcement archive must include inactive historical records");
assert.ok(profile.includes('item.is_active ? "Current" : "Archive"'), "Announcement archive must distinguish current and archived updates");
assert.ok(profile.includes("item.message"), "Announcement descriptions must be displayed in full");
assert.ok(profile.includes('event.key === "Escape"'), "Profile dialog must close with Escape");
assert.ok(profile.includes('document.body.style.overflow = "hidden"'), "Profile dialog must prevent background scrolling while open");
assert.ok(profile.includes("autoFocus"), "Profile dialog must move keyboard focus into the dialog");
console.log("Profile/sidebar/announcements checks passed.");
