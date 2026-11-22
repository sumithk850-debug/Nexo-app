import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sidebar = readFileSync("components/ChatSidebar.tsx", "utf8");
const profile = readFileSync("components/ProfilePanel.tsx", "utf8");
const page = readFileSync("app/page.tsx", "utf8");
const auth = readFileSync("lib/auth.ts", "utf8");

assert.ok(sidebar.includes('aria-controls="kyvorix-sidebar-more"'), "Sidebar More menu must be collapsible and accessible");
assert.ok(sidebar.includes("onOpenProfile"), "Sidebar must expose the Profile entry");
assert.ok(sidebar.includes('id="kyvorix-chat-history"'), "Chats shortcut must target chat history");
assert.ok(page.includes("<ProfilePanel"), "Chat page must render the Profile panel");
assert.ok(page.includes("onOpenProfile={() =>"), "Chat page must open Profile from the sidebar");
assert.ok(auth.includes("createdAt: data.user.created_at"), "Authenticated user must expose account creation date");
assert.ok(profile.includes('user?.email'), "Profile email must come from the authenticated user");
assert.ok(profile.includes("user?.createdAt"), "Profile join date must come from authenticated account data");
assert.ok(profile.includes('.order("created_at", { ascending: false })'), "Announcements must be shown in reverse chronological order");
assert.ok(!profile.includes('.eq("is_active", true)'), "Announcement archive must include inactive historical records");
assert.ok(profile.includes('item.is_active ? "Current" : "Archive"'), "Announcement archive must distinguish current and archived updates");
assert.ok(profile.includes("item.message"), "Announcement descriptions must be displayed in full");
console.log("Profile/sidebar/announcements checks passed.");
