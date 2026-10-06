import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bot, History, Mic, MicOff, Send, Volume2, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import {
  apiGet,
  cancelDittoAction,
  confirmDittoAction,
  editDittoAction,
  getUid,
  sendChat,
} from '../../../services/studentV1Api';
import {
  DITTO_GREETING,
  QUICK_PROMPTS,
  SAMPLE_MESSAGES,
  STORAGE_KEYS,
  formatHistoryStamp,
  formatMessageTime,
  loadSearchHistory,
  loadStoredMessages,
  persistSearchHistory,
  saveStoredMessages,
} from './supportAssistantData';
import '../../../assets/css/tracker-support-assistant.css';

function ActionCard({ proposal, onChange }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({});
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const fields = Array.isArray(proposal?.fields) ? proposal.fields : [];
  const settled = proposal?.status === 'done' || proposal?.status === 'cancelled';

  const startEdit = () => {
    const next = {};
    fields.forEach((field) => {
      next[field.key] = field.value;
    });
    setDraft(next);
    setEditing(true);
    setError('');
  };

  const saveEdit = async () => {
    setBusy('Saving');
    setError('');
    try {
      const next = await editDittoAction(proposal.id, draft);
      onChange(next);
      setEditing(false);
    } catch (err) {
      setError(err?.message || 'That action could not be updated.');
    } finally {
      setBusy('');
    }
  };

  const confirm = async () => {
    setBusy('Executing');
    setError('');
    try {
      const data = await confirmDittoAction(proposal.id);
      onChange({
        ...(data.proposal || proposal),
        status: data.status || (data.ok ? 'done' : 'pending'),
        result: data.message || '',
        qr_value: data.qr_value || '',
        doneAt: data.ok ? formatMessageTime(new Date()) : '',
      });
      if (!data.ok) setError(data.message || 'That action could not be completed.');
    } catch (err) {
      setError(err?.message || 'That action could not be completed.');
    } finally {
      setBusy('');
    }
  };

  const cancel = async () => {
    setBusy('Cancelling');
    setError('');
    try {
      await cancelDittoAction(proposal.id);
      onChange({ ...proposal, status: 'cancelled' });
    } catch (err) {
      setError(err?.message || 'That action could not be cancelled.');
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="tracker-action-card">
      <p className="tracker-action-title">{proposal.title || 'Review this action'}</p>
      {editing ? (
        <div className="tracker-action-fields">
          {fields.map((field) => (
            <label key={field.key}>
              <span>{field.label}</span>
              <input value={draft[field.key] || ''} onChange={(event) => setDraft((current) => ({ ...current, [field.key]: event.target.value }))} />
            </label>
          ))}
        </div>
      ) : (
        <dl className="tracker-action-fields">
          {fields.map((field) => (
            <div key={field.key}>
              <dt>{field.label}</dt>
              <dd>{field.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {proposal.status === 'done' ? (
        <p className="tracker-action-done">
          Done{proposal.doneAt ? ` at ${proposal.doneAt}` : ''}. {proposal.result || ''}
        </p>
      ) : null}
      {proposal.status === 'cancelled' ? <p className="tracker-action-muted">Cancelled.</p> : null}
      {proposal.qr_value && proposal.status === 'done' ? (
        <div className="tracker-action-qr">
          <QRCodeSVG value={proposal.qr_value} size={148} />
          <span>Show this code at the door.</span>
        </div>
      ) : null}
      {error ? <p className="tracker-action-error">{error}</p> : null}
      {busy ? <p className="tracker-action-muted">{busy}</p> : null}
      {!settled && !busy ? (
        <div className="tracker-action-buttons">
          {editing ? (
            <button type="button" onClick={saveEdit}>Save</button>
          ) : (
            <button type="button" onClick={startEdit}>Edit</button>
          )}
          <button type="button" onClick={cancel}>Cancel</button>
          {!editing ? (
            <button type="button" className="tracker-action-confirm" onClick={confirm}>Confirm</button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function BubbleText({ text }) {
  const blocks = String(text || '').split(/\n{2,}/).filter((block) => block.trim());
  if (blocks.length <= 1) return text;
  return blocks.map((block, index) => <p key={index}>{block.trim()}</p>);
}

function getSpeechRecognition() {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function speechChunks(text) {
  const plain = String(text || '').replace(/\s+/g, ' ').trim();
  if (!plain) return [];
  const parts = plain.split(/(?<=[.!?])\s+/).filter(Boolean);
  return parts.length ? parts : [plain];
}

function pickVoice(voices) {
  const list = voices || [];
  return (
    list.find((voice) => voice.lang === 'en-IN')
    || list.find((voice) => /^en-GB/i.test(voice.lang) && /female/i.test(voice.name))
    || list.find((voice) => voice.lang === 'en-GB')
    || list.find((voice) => /^en/i.test(voice.lang))
    || null
  );
}

export default function SupportAssistantWidget({
  defaultOpen = false,
  inline = false,
  expanded = false,
  sendMessage = null,
  greeting = DITTO_GREETING,
  prompts = QUICK_PROMPTS,
  storageKeys = STORAGE_KEYS,
  subtitle = 'Mentor assistant',
  hint = '',
  allowSamples = true,
  loadOpening = null,
}) {
  const [open, setOpen] = useState(defaultOpen || inline);
  const [historyOpen, setHistoryOpen] = useState(false);
  const allowSample = allowSamples && sessionStorage.getItem('sample_content') === '1';
  const [messages, setMessages] = useState(() => loadStoredMessages(allowSample, storageKeys) || (allowSample ? SAMPLE_MESSAGES : [greeting]));
  const [searchHistory, setSearchHistory] = useState(() => loadSearchHistory(allowSample, storageKeys));
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [sending, setSending] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceHint, setVoiceHint] = useState('');
  const recognitionRef = useRef(null);
  const messagesEndRef = useRef(null);
  const voiceModeRef = useRef(false);
  const sendingRef = useRef(false);
  const transcriptRef = useRef('');
  const speakTokenRef = useRef(0);
  const voiceLoopRef = useRef(0);
  const silenceTimerRef = useRef(0);
  const ignoreEndRef = useRef(false);
  const keptTranscriptRef = useRef('');
  const liveBoxRef = useRef(null);
  const initialMessagesRef = useRef(messages);
  const voicesRef = useRef([]);
  const speechSupported = Boolean(getSpeechRecognition());
  const canSpeak = typeof window !== 'undefined' && Boolean(window.speechSynthesis);

  useEffect(() => {
    saveStoredMessages(messages, storageKeys);
  }, [messages, storageKeys]);

  useEffect(() => {
    if (!loadOpening) return undefined;
    if (initialMessagesRef.current.some((item) => item.proposal || item.opening)) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const note = await loadOpening();
        if (cancelled || !note?.text) return;
        setMessages((current) => {
          if (current.some((item) => item.proposal || item.opening)) return current;
          return [
            ...current,
            {
              role: 'bot',
              text: note.text,
              at: formatMessageTime(new Date()),
              proposal: note.proposal,
              opening: true,
            },
          ];
        });
      } catch {
        /* the chat still works if the opening note is unavailable */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadOpening]);

  useEffect(() => {
    if (!allowSamples) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiGet('/api/v1/students/me/onboarding');
        if (cancelled) return;
        sessionStorage.setItem('sample_content', data.sample_content ? '1' : '0');
        if (data.sample_content) {
          setMessages((current) => (current.length ? current : SAMPLE_MESSAGES));
          setSearchHistory((current) => (current.length ? current : loadSearchHistory(true)));
        }
      } catch {
        /* chat still works without the sample flag */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [allowSamples]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  useEffect(() => {
    const synth = window.speechSynthesis;
    if (!synth) return undefined;
    const loadVoices = () => {
      voicesRef.current = synth.getVoices();
    };
    loadVoices();
    synth.addEventListener('voiceschanged', loadVoices);
    return () => {
      synth.removeEventListener('voiceschanged', loadVoices);
      synth.cancel();
      recognitionRef.current?.stop?.();
    };
  }, []);

  const pushHistory = useCallback((query) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setSearchHistory((prev) => {
      const next = [
        {
          id: `h-${Date.now()}`,
          query: trimmed,
          at: formatHistoryStamp(new Date()),
        },
        ...prev.filter((h) => h.query.toLowerCase() !== trimmed.toLowerCase()),
      ].slice(0, 20);
      persistSearchHistory(next, storageKeys);
      return next;
    });
  }, [storageKeys]);

  const submitMessage = useCallback(async (text) => {
    const trimmed = text.trim();
    if (!trimmed || sendingRef.current) return '';
    const at = formatMessageTime(new Date());
    setInput('');
    pushHistory(trimmed);
    const botAt = formatMessageTime(new Date());
    setMessages((m) => [...m, { role: 'user', text: trimmed, at }, { role: 'bot', text: '', at: botAt, pending: true }]);
    sendingRef.current = true;
    setSending(true);
    let spoken = '';
    try {
      const res = sendMessage
        ? await sendMessage(trimmed, sessionId, (delta) => {
          setMessages((m) => {
            const next = [...m];
            const last = next[next.length - 1];
            if (last && last.role === 'bot') {
              next[next.length - 1] = { ...last, text: `${last.text || ''}${delta}`, pending: true };
            }
            return next;
          });
        })
        : await (async () => {
          const uid = await getUid();
          return sendChat(uid, trimmed, sessionId, (delta) => {
            setMessages((m) => {
              const next = [...m];
              const last = next[next.length - 1];
              if (last && last.role === 'bot') {
                next[next.length - 1] = { ...last, text: `${last.text || ''}${delta}`, pending: true };
              }
              return next;
            });
          });
        })();
      spoken = res.reply || '';
      setSessionId(res.session_id);
      setMessages((m) => {
        const next = [...m];
        const last = next[next.length - 1];
        if (last && last.role === 'bot') {
          spoken = last.text || res.reply || '';
          next[next.length - 1] = { ...last, text: spoken, pending: false, proposal: res.proposal || null };
        }
        return next;
      });
    } catch (err) {
      spoken = err?.message?.includes('session')
        ? 'Your session timed out, so that reply did not come through. Sign in again and ask me once more.'
        : 'Sorry, I could not reach the assistant. Check your connection and try again.';
      setMessages((m) => {
        const next = [...m];
        const last = next[next.length - 1];
        if (last && last.role === 'bot') {
          next[next.length - 1] = { ...last, text: last.text || spoken, pending: false };
          return next;
        }
        return [...m, { role: 'bot', text: spoken, at: formatMessageTime(new Date()) }];
      });
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
    return spoken;
  }, [pushHistory, sendMessage, sessionId]);

  const onSend = () => submitMessage(input);

  const onHistorySelect = (query) => {
    setInput(query);
    setVoiceHint(`Loaded: “${query}” — press Send or Enter`);
  };

  const clearHistory = () => {
    setSearchHistory([]);
    persistSearchHistory([], storageKeys);
  };

  const stopSpeaking = useCallback(() => {
    speakTokenRef.current += 1;
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  }, []);

  const speakAloud = useCallback((text) => {
    const chunks = speechChunks(text);
    const token = speakTokenRef.current + 1;
    speakTokenRef.current = token;
    return new Promise((resolve) => {
      const synth = window.speechSynthesis;
      if (!synth || !chunks.length) {
        resolve();
        return;
      }
      synth.cancel();
      setSpeaking(true);
      let index = 0;
      const finish = () => {
        if (speakTokenRef.current === token) setSpeaking(false);
        resolve();
      };
      const next = () => {
        if (speakTokenRef.current !== token || index >= chunks.length) {
          finish();
          return;
        }
        const utter = new SpeechSynthesisUtterance(chunks[index]);
        index += 1;
        utter.lang = 'en-IN';
        utter.rate = 1;
        const voice = pickVoice(voicesRef.current.length ? voicesRef.current : synth.getVoices());
        if (voice) utter.voice = voice;
        utter.onend = next;
        utter.onerror = next;
        synth.speak(utter);
      };
      next();
    });
  }, []);

  const startVoiceListen = useCallback(() => {
    const SR = getSpeechRecognition();
    if (!SR) {
      setVoiceHint('Voice chat needs Chrome or Edge.');
      voiceModeRef.current = false;
      setVoiceMode(false);
      return;
    }
    if (sendingRef.current) return;
    const recognition = new SR();
    recognition.lang = 'en-IN';
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    const showHeard = (heard) => {
      const shown = heard.replace(/\s+/g, ' ').trim();
      transcriptRef.current = shown;
      setInput(shown);
    };

    recognition.onstart = () => {
      setListening(true);
      setVoiceHint(transcriptRef.current ? 'Still listening…' : 'Listening… go ahead');
    };

    recognition.onresult = (event) => {
      let finalText = '';
      let interim = '';
      for (let i = 0; i < event.results.length; i += 1) {
        const piece = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += `${piece} `;
        else interim += piece;
      }
      const earlier = keptTranscriptRef.current ? `${keptTranscriptRef.current} ` : '';
      showHeard(`${earlier}${finalText}${interim}`);
      window.clearTimeout(silenceTimerRef.current);
      if (!finalText.trim() && !interim.trim()) return;
      silenceTimerRef.current = window.setTimeout(() => {
        const said = transcriptRef.current.trim();
        if (!said || !voiceModeRef.current || sendingRef.current) return;
        ignoreEndRef.current = true;
        keptTranscriptRef.current = '';
        transcriptRef.current = '';
        setInput('');
        try {
          recognition.stop();
        } catch {
          /* already stopped */
        }
        setVoiceHint('Ditto is thinking…');
        const loop = voiceLoopRef.current;
        submitMessage(said).then(async (reply) => {
          if (!voiceModeRef.current || voiceLoopRef.current !== loop) return;
          if (reply) {
            setVoiceHint('Ditto is speaking…');
            await speakAloud(reply);
          }
          if (voiceModeRef.current && voiceLoopRef.current === loop) startVoiceListen();
        });
      }, 1600);
    };

    recognition.onerror = (event) => {
      if (event.error === 'not-allowed') {
        setVoiceHint('Allow the microphone to talk with Ditto.');
        voiceModeRef.current = false;
        setVoiceMode(false);
        return;
      }
      if (event.error === 'aborted' || event.error === 'no-speech') return;
      setVoiceHint('Still listening…');
    };

    recognition.onend = () => {
      setListening(false);
      if (ignoreEndRef.current) {
        ignoreEndRef.current = false;
        return;
      }
      window.clearTimeout(silenceTimerRef.current);
      if (!voiceModeRef.current || sendingRef.current) return;
      keptTranscriptRef.current = transcriptRef.current;
      window.setTimeout(() => {
        if (voiceModeRef.current && !sendingRef.current) startVoiceListen();
      }, 250);
    };

    try {
      recognition.start();
    } catch {
      window.setTimeout(() => {
        if (!voiceModeRef.current || sendingRef.current) return;
        try {
          recognition.start();
        } catch {
          setVoiceHint('Microphone is busy. Voice chat is still on.');
        }
      }, 400);
    }
  }, [speakAloud, submitMessage]);

  const stopVoiceChat = useCallback(() => {
    voiceModeRef.current = false;
    voiceLoopRef.current += 1;
    ignoreEndRef.current = true;
    window.clearTimeout(silenceTimerRef.current);
    keptTranscriptRef.current = '';
    transcriptRef.current = '';
    setVoiceMode(false);
    recognitionRef.current?.stop?.();
    stopSpeaking();
    setListening(false);
    setInput('');
    setVoiceHint('');
  }, [stopSpeaking]);

  const toggleVoiceChat = useCallback(() => {
    if (voiceModeRef.current) {
      stopVoiceChat();
      return;
    }
    if (!speechSupported) {
      setVoiceHint('Voice chat needs Chrome or Edge.');
      return;
    }
    voiceModeRef.current = true;
    voiceLoopRef.current += 1;
    setVoiceMode(true);
    setVoiceHint('Voice chat is on. Speak when you are ready.');
    if (window.speechSynthesis) {
      const primer = new SpeechSynthesisUtterance(' ');
      primer.volume = 0;
      window.speechSynthesis.speak(primer);
    }
    startVoiceListen();
  }, [speechSupported, startVoiceListen, stopVoiceChat]);

  const dictate = useCallback(() => {
    const SR = getSpeechRecognition();
    if (!SR) {
      setVoiceHint('Voice input needs Chrome or Edge.');
      return;
    }
    if (listening) {
      recognitionRef.current?.stop?.();
      setListening(false);
      return;
    }
    stopSpeaking();
    const recognition = new SR();
    recognition.lang = 'en-IN';
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;
    recognition.onstart = () => {
      setListening(true);
      setVoiceHint('Listening… I’ll put it in the message box');
    };
    recognition.onresult = (event) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        transcript += event.results[i][0].transcript;
      }
      setInput(transcript.trim());
    };
    recognition.onerror = (event) => {
      setListening(false);
      setVoiceHint(event.error === 'not-allowed'
        ? 'Allow the microphone, then try again.'
        : 'Could not capture audio.');
    };
    recognition.onend = () => {
      setListening(false);
      setVoiceHint('Edit it if you need to, then press Send.');
    };
    try {
      recognition.start();
    } catch {
      setVoiceHint('Microphone is busy. Try again in a moment.');
      setListening(false);
    }
  }, [listening, stopSpeaking]);

  const replayReply = useCallback((text) => {
    if (speaking && !voiceModeRef.current) {
      stopSpeaking();
      return;
    }
    const loop = voiceLoopRef.current + 1;
    voiceLoopRef.current = loop;
    recognitionRef.current?.stop?.();
    setListening(false);
    setVoiceHint('Playing Ditto’s reply…');
    speakAloud(text).then(() => {
      if (voiceModeRef.current && voiceLoopRef.current === loop) {
        startVoiceListen();
        return;
      }
      setVoiceHint('');
    });
  }, [speakAloud, speaking, startVoiceListen, stopSpeaking]);

  useEffect(() => {
    if (!open && !inline) stopVoiceChat();
  }, [inline, open, stopVoiceChat]);

  useEffect(() => {
    if (!voiceMode || !liveBoxRef.current) return;
    liveBoxRef.current.scrollTop = liveBoxRef.current.scrollHeight;
  }, [input, voiceMode]);

  const panelClass = [
    'tracker-support-panel',
    inline ? 'inline' : '',
    expanded ? 'expanded' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const historyClass = `tracker-support-history${historyOpen ? ' open' : ''}`;

  return (
    <>
      {!inline && (
        <button
          type="button"
          className="tracker-support-fab"
          aria-label={open ? 'Close Ditto' : 'Open Ditto'}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <Bot size={26} strokeWidth={1.8} />
        </button>
      )}
      {(open || inline) && (
        <div className={panelClass}>
          <div className="tracker-support-header">
            <div className="tracker-support-header-title">
              <Bot size={22} strokeWidth={2} aria-hidden />
              <span className="tracker-support-header-name">
                Ditto
                <small>{subtitle}</small>
              </span>
            </div>
            <div className="tracker-support-header-actions">
              <button
                type="button"
                className={`tracker-support-icon-btn${historyOpen ? ' active' : ''}`}
                aria-label="Toggle search history"
                aria-pressed={historyOpen}
                onClick={() => setHistoryOpen((h) => !h)}
              >
                <History size={18} />
              </button>
              {!inline && (
                <button
                  type="button"
                  className="tracker-support-icon-btn"
                  aria-label="Close"
                  onClick={() => setOpen(false)}
                >
                  <X size={20} />
                </button>
              )}
            </div>
          </div>

          <div className="tracker-support-body">
            <aside className={historyClass} aria-label="Search history">
              <div className="tracker-support-history-head">
                <span>Search history</span>
                {searchHistory.length > 0 && (
                  <button type="button" className="tracker-support-history-clear" onClick={clearHistory}>
                    Clear
                  </button>
                )}
              </div>
              <div className="tracker-support-history-list">
                {searchHistory.length === 0 && (
                  <p style={{ fontSize: 12, color: '#64748b', padding: '8px 10px' }}>
                    Your questions will appear here.
                  </p>
                )}
                {searchHistory.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="tracker-support-history-item"
                    onClick={() => onHistorySelect(item.query)}
                  >
                    <strong>{item.query}</strong>
                    <small>{item.at}</small>
                  </button>
                ))}
              </div>
            </aside>

            <div className="tracker-support-main">
              <div className="tracker-support-messages" role="log" aria-live="polite">
                {messages.map((m, i) => (
                  <div key={`${m.role}-${i}-${m.at}`} className={`tracker-support-msg ${m.role}`}>
                    <div className="tracker-support-msg-bubble">
                      {m.pending && !m.text ? '…' : <BubbleText text={m.text} />}
                      {m.proposal ? (
                        <ActionCard
                          proposal={m.proposal}
                          onChange={(next) => {
                            setMessages((rows) => rows.map((item, index) => (
                              index === i ? { ...item, proposal: next } : item
                            )));
                          }}
                        />
                      ) : null}
                      {m.role === 'bot' && m.text && !m.pending && canSpeak && (
                        <button
                          type="button"
                          className="tracker-support-speak"
                          aria-label={speaking ? 'Stop speaking' : 'Play this reply'}
                          onClick={() => replayReply(m.text)}
                        >
                          <Volume2 size={14} />
                        </button>
                      )}
                    </div>
                    {m.at ? (
                      <div className="tracker-support-msg-meta">
                        <span className="tracker-support-msg-time">{m.at}</span>
                      </div>
                    ) : null}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              <div className="tracker-support-quick">
                {prompts.map((prompt) => (
                  <button key={prompt} type="button" onClick={() => submitMessage(prompt)}>
                    {prompt}
                  </button>
                ))}
              </div>

              <div className="tracker-support-footer">
                <div className={`tracker-support-voice-hint${listening || voiceMode ? ' listening' : ''}`}>
                  {voiceHint || hint || (speechSupported
                    ? 'Type a message, or tap the microphone to talk with Ditto.'
                    : 'Ask Ditto about your progress, or pick a prompt below.')}
                </div>
                {voiceMode && (
                  <textarea
                    ref={liveBoxRef}
                    className="tracker-support-live"
                    readOnly
                    rows={4}
                    value={input}
                    placeholder="Your words show here as you speak…"
                    aria-label="What you are saying"
                  />
                )}
                <div className="tracker-support-input-row">
                  {!voiceMode && (
                    <input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Message Ditto…"
                      aria-label="Message"
                      disabled={sending}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          onSend();
                        }
                      }}
                    />
                  )}
                  <button
                    type="button"
                    className={`tracker-support-mic${voiceMode ? ' active' : ''}${speaking ? ' speaking' : ''}${listening ? ' listening' : ''}`}
                    aria-pressed={voiceMode}
                    aria-label={voiceMode ? 'End voice chat' : 'Talk with Ditto'}
                    title={voiceMode ? 'End voice chat' : 'Talk with Ditto'}
                    disabled={!speechSupported || sending}
                    onClick={toggleVoiceChat}
                  >
                    {voiceMode || listening ? <MicOff size={18} /> : <Mic size={18} />}
                  </button>
                  <button
                    type="button"
                    className="tracker-support-send"
                    aria-label="Send"
                    onClick={onSend}
                    disabled={sending || voiceMode || !input.trim()}
                  >
                    <Send size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
