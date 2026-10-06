import SupportAssistantWidget from '../../pages/student/components/SupportAssistantWidget';
import {
  MENTOR_DITTO_GREETING,
  MENTOR_DITTO_KEYS,
  MENTOR_DITTO_PROMPTS,
  fetchMentorOpening,
  sendMentorChat,
} from '@/services/dittoChat';

export default function MentorAssistant() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Ditto</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Ask about your mentees. Type a question, or use the microphone to talk and hear the reply. Search history stays on this device.
      </p>
      <div className="tracker-support-page-card">
        <SupportAssistantWidget
          defaultOpen
          inline
          expanded
          allowSamples={false}
          sendMessage={sendMentorChat}
          greeting={MENTOR_DITTO_GREETING}
          prompts={MENTOR_DITTO_PROMPTS}
          storageKeys={MENTOR_DITTO_KEYS}
          subtitle="Caseload assistant"
          hint="Type a message, or tap the microphone to ask about your mentees."
          loadOpening={fetchMentorOpening}
        />
      </div>
    </div>
  );
}
