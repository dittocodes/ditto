import React from 'react';
import SupportAssistantWidget from '../../components/SupportAssistantWidget';

/** Full-page Support Assistant (Phase 12). */
export default function ChatPage() {
  return (
    <div className="tracker-support-page">
      <h1 className="tracker-page-title">Ditto</h1>
      <p className="tracker-page-sub">
        Your mentor assistant. Type a question, or use Voice to talk and hear the reply. Search history stays on this device.
      </p>
      <div className="tracker-support-page-card">
        <SupportAssistantWidget defaultOpen inline expanded />
      </div>
    </div>
  );
}
