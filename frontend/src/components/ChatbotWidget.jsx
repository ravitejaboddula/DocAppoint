import React, { useEffect, useRef, useState } from 'react';

const CHATBOT_API_URL = import.meta.env.VITE_CHATBOT_URL || 'https://docappoint-backend-aeuz.onrender.com';

// ─── Local symptom → specialist mapping (used when backend is unavailable) ───
const SYMPTOM_MAP = [
  { keywords: ['chest pain', 'chest', 'heart', 'palpitation', 'cardiac', 'angina', 'heart attack'], specialist: 'Cardiologist', diseases: ['Angina', 'Hypertension', 'Myocardial Infarction'] },
  { keywords: ['joint', 'knee', 'bone', 'arthritis', 'fracture', 'ligament', 'back pain', 'spine', 'shoulder', 'wrist'], specialist: 'Orthopedic Surgeon', diseases: ['Osteoarthritis', 'Ligament Tear', 'Fracture'] },
  { keywords: ['headache', 'migraine', 'brain', 'seizure', 'epilepsy', 'memory', 'stroke', 'numbness', 'dizziness'], specialist: 'Neurologist', diseases: ['Migraine', 'Tension Headache', 'Vertigo'] },
  { keywords: ['skin', 'rash', 'acne', 'eczema', 'psoriasis', 'itching', 'allergy', 'hives', 'blisters'], specialist: 'Dermatologist', diseases: ['Eczema', 'Psoriasis', 'Urticaria'] },
  { keywords: ['stomach', 'abdomen', 'gut', 'bowel', 'constipation', 'diarrhea', 'vomiting', 'nausea', 'ibs', 'gastric', 'ulcer', 'liver'], specialist: 'Gastroenterologist', diseases: ['Gastritis', 'IBS', 'GERD'] },
  { keywords: ['breathing', 'breathless', 'cough', 'lung', 'asthma', 'copd', 'pneumonia', 'wheezing', 'chest tightness', 'shortness of breath'], specialist: 'Pulmonologist', diseases: ['Asthma', 'Bronchitis', 'Pneumonia'] },
  { keywords: ['ear', 'nose', 'throat', 'ent', 'sinusitis', 'tonsil', 'snoring', 'hearing', 'nasal', 'sore throat'], specialist: 'ENT Specialist', diseases: ['Sinusitis', 'Tonsillitis', 'Otitis Media'] },
  { keywords: ['anxiety', 'depression', 'mental', 'stress', 'panic', 'sleep', 'insomnia', 'mood', 'bipolar'], specialist: 'Psychiatrist', diseases: ['Anxiety Disorder', 'Depression', 'Insomnia'] },
  { keywords: ['eye', 'vision', 'blur', 'cataract', 'glaucoma', 'retina', 'spectacles'], specialist: 'Ophthalmologist', diseases: ['Myopia', 'Cataract', 'Conjunctivitis'] },
  { keywords: ['child', 'baby', 'infant', 'pediatric', 'vaccination', 'growth', 'kid'], specialist: 'Paediatrician', diseases: ['Viral Fever', 'Malnutrition', 'Childhood Asthma'] },
  { keywords: ['urine', 'kidney', 'urinary', 'prostate', 'bladder', 'uti', 'nephr'], specialist: 'Urologist', diseases: ['UTI', 'Kidney Stones', 'Prostatitis'] },
  { keywords: ['period', 'menstrual', 'pregnancy', 'gynaecology', 'ovarian', 'uterus', 'vaginal', 'pcos', 'pcod', 'menopause'], specialist: 'Gynaecologist', diseases: ['PCOS', 'Dysmenorrhoea', 'Menorrhagia'] },
  { keywords: ['diabetes', 'thyroid', 'hormone', 'endocr', 'sugar', 'insulin'], specialist: 'Endocrinologist', diseases: ['Type 2 Diabetes', 'Hypothyroidism', 'Hyperthyroidism'] },
  { keywords: ['cancer', 'tumor', 'oncology', 'chemo', 'radiation', 'carcinoma'], specialist: 'Oncologist', diseases: ['Malignant Neoplasm', 'Lymphoma', 'Carcinoma'] },
  { keywords: ['fever', 'cold', 'flu', 'viral', 'infection', 'fatigue', 'weakness', 'body ache', 'malaria', 'dengue', 'typhoid'], specialist: 'General Physician', diseases: ['Viral Fever', 'Influenza', 'Malaria'] },
];

function detectSpecialist(symptoms) {
  const lower = symptoms.toLowerCase();
  for (const entry of SYMPTOM_MAP) {
    if (entry.keywords.some((kw) => lower.includes(kw))) {
      const disease = entry.diseases[Math.floor(Math.random() * entry.diseases.length)];
      return { specialist: entry.specialist, disease };
    }
  }
  return { specialist: 'General Physician', disease: 'Unspecified Condition' };
}

const presetMessages = [
  {
    from: 'bot',
    text: "👋 Hi! I'm your AI Health Assistant. Tell me your symptoms and I'll help you find the right doctor.",
  },
];

function ChatbotWidget({ hospitals = [] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState(presetMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastSpecialist, setLastSpecialist] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    const handleExternalOpen = () => {
      setIsOpen(true);
      setMessages(presetMessages);
      setInput('');
      setIsLoading(false);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('docapoint-open-symptom-chat', handleExternalOpen);
      return () => {
        window.removeEventListener('docapoint-open-symptom-chat', handleExternalOpen);
      };
    }
    return undefined;
  }, []);

  const buildSummaryText = (symptoms, diseasePrediction, recommendedSpecialist) =>
    `**Symptoms detected:** ${symptoms}\n\n**Possible Condition:** ${diseasePrediction}\n\n**Recommended Doctor:** ${recommendedSpecialist}\n\n📍 **Next:** Would you like me to find hospitals with **${recommendedSpecialist}** doctors near you?`;

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const clearCommands = ['clear', 'reset', 'new chat', 'new', 'open new', 'start over', 'fresh'];
    if (clearCommands.includes(trimmed.toLowerCase())) {
      setMessages(presetMessages);
      setInput('');
      setLastSpecialist(null);
      return;
    }

    // Check for greetings
    const greetingKeywords = ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening', 'greetings', 'howdy'];
    const isGreeting = greetingKeywords.some((kw) => trimmed.toLowerCase().includes(kw));

    if (isGreeting) {
      const greetingResponse = "Hello! 👋 Welcome to DocApoint. I'm here to help you find the right doctor based on your symptoms. Please describe what symptoms you're experiencing, and I'll guide you to the appropriate specialist.";
      const userMessage = { from: 'user', text: trimmed };
      setMessages((prev) => [...prev, userMessage, { from: 'bot', text: greetingResponse }]);
      setInput('');
      return;
    }

    const hospitalKeywords = ['yes', 'hospitals', 'hospital', 'nearby', 'near me', 'find hospitals', 'show hospitals', 'where can i find', 'doctor near me'];
    const isAskingForHospitals = hospitalKeywords.some((kw) => trimmed.toLowerCase().includes(kw));

    if (isAskingForHospitals && lastSpecialist) {
      const matchingHospitals = hospitals
        .filter((hospital) =>
          (hospital.doctors || []).some((doctor) => doctor.specialization === lastSpecialist),
        )
        .slice(0, 3);

      let hospitalMessage = '';
      if (matchingHospitals.length > 0) {
        const hospitalLines = matchingHospitals.map((hospital) => {
          const city = hospital.city || 'City';
          // Find the matching doctor for this specialty
          const matchingDoctor = (hospital.doctors || []).find(
            (d) => d.specialization === lastSpecialist,
          );
          let availLabel = '';
          if (matchingDoctor && matchingDoctor.availableDays) {
            const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            // Find the next available date from today
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            let nextDate = null;
            for (let i = 1; i <= 14; i++) {
              const candidate = new Date(today);
              candidate.setDate(today.getDate() + i);
              if (matchingDoctor.availableDays.includes(candidate.getDay())) {
                nextDate = candidate;
                break;
              }
            }
            if (nextDate) {
              const diffDays = Math.round((nextDate - today) / (1000 * 60 * 60 * 24));
              const dayLabel = dayNames[nextDate.getDay()];
              const workingDays = matchingDoctor.availableDays.map((d) => dayNames[d]).join(', ');
              availLabel = diffDays === 1
                ? `Tomorrow · Available: ${workingDays}`
                : `Next: ${dayLabel} · Available: ${workingDays}`;
            } else {
              availLabel = hospital.availableSlotsLabel || 'Slots available';
            }
          } else {
            availLabel = hospital.availableSlotsLabel || 'Slots available';
          }
          return `  • ${hospital.name} (${city}) – ${availLabel}`;
        });
        hospitalMessage = `🏥 **Hospitals with ${lastSpecialist} doctors:**\n${hospitalLines.join('\n')}`;
      } else {
        hospitalMessage = `🏥 No hospitals with ${lastSpecialist} doctors found in our current list. Please call our support for assistance.`;
      }

      const userMessage = { from: 'user', text: trimmed };
      setMessages((prev) => [...prev, userMessage, { from: 'bot', text: hospitalMessage }]);
      setInput('');
      return;
    }

    const userMessage = { from: 'user', text: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    let resolved = null;

    try {
      const response = await fetch(`${CHATBOT_API_URL}/api/chatbot/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symptoms: trimmed }),
        signal: AbortSignal.timeout(8000),
      });

      if (response.ok) {
        const data = await response.json();
        const diseasePrediction = data.diseasePrediction || '';
        const recommendedSpecialist = data.recommendedSpecialist || '';
        const advice = data.advice || '';

        // Check if backend returned a proper result (not the fallback "Unable to determine")
        const isFallback =
          !diseasePrediction ||
          diseasePrediction === 'Unable to determine' ||
          !recommendedSpecialist ||
          recommendedSpecialist === 'General Physician';

        if (!isFallback) {
          resolved = {
            disease: diseasePrediction,
            specialist: recommendedSpecialist,
          };
        }
      }
    } catch {
      // Backend unreachable — will use local fallback below
    }

    // If backend didn't give a good answer, use local symptom mapping
    if (!resolved) {
      const { specialist, disease } = detectSpecialist(trimmed);
      resolved = { disease, specialist };
    }

    setLastSpecialist(resolved.specialist);
    const summaryText = buildSummaryText(trimmed, resolved.disease, resolved.specialist);
    setMessages((current) => [...current, { from: 'bot', text: summaryText }]);
    setIsLoading(false);
  };

  const handleKeyDown = (event) => {
    if (
      (event.key === 'Enter' || event.code === 'Enter' || event.keyCode === 13) &&
      !event.shiftKey
    ) {
      event.preventDefault();
      event.stopPropagation();
      handleSend();
    }
  };

  // Simple markdown-like bold renderer
  const renderText = (text) => {
    return text.split('\n').map((line, i) => {
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      return (
        <span key={i}>
          {parts.map((part, j) =>
            part.startsWith('**') && part.endsWith('**') ? (
              <strong key={j}>{part.slice(2, -2)}</strong>
            ) : (
              part
            ),
          )}
          {i < text.split('\n').length - 1 && <br />}
        </span>
      );
    });
  };

  return (
    <div className="fixed bottom-4 right-4 z-30 flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      {isOpen && (
        <div className="flex h-[32rem] w-[min(100vw-1rem,26rem)] flex-col rounded-3xl border border-sky-500/40 bg-slate-900/95 p-4 shadow-2xl shadow-sky-500/30 backdrop-blur-xl">
          <div className="mb-3 flex items-center justify-between border-b border-slate-700/80 pb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-emerald-500 shadow-lg">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2v-2.26A6.98 6.98 0 0 1 5 9a7 7 0 0 1 7-7z" />
                  <path d="M9 21h6" />
                </svg>
              </div>
              <div>
                <p className="text-lg font-bold text-white drop-shadow-sm">AI Health Assistant</p>
                <p className="text-xs text-sky-300">Powered by DocApoint AI</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setMessages(presetMessages);
                setInput('');
                setIsLoading(false);
              }}
              className="rounded-full border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-sky-500 hover:text-sky-300 transition-colors"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto pr-1">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.from === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${message.from === 'user'
                    ? 'bg-sky-500 text-white font-medium'
                    : 'bg-slate-800 text-slate-100 border border-slate-700'
                    }`}
                >
                  {message.from === 'bot' ? renderText(message.text) : message.text}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="rounded-2xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs text-slate-400">
                  <span className="animate-pulse">Analyzing symptoms…</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form
            className="mt-3 flex items-end gap-2 rounded-xl border border-slate-600 bg-slate-800 px-3 py-2"
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
          >
            <input
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe your symptoms…"
              className="max-h-20 flex-1 bg-transparent text-xs text-white placeholder:text-slate-500 focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-full bg-sky-500 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-400 disabled:opacity-40 transition-colors"
              disabled={!input.trim() || isLoading}
            >
              {isLoading ? '…' : 'Send'}
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className={`relative flex h-14 w-14 items-center justify-center rounded-full border border-sky-500/50 bg-gradient-to-br from-sky-600 to-emerald-600 text-white shadow-xl shadow-sky-500/50 transition-all hover:scale-110 hover:shadow-2xl hover:shadow-sky-500/60 ${isLoading ? 'animate-pulse' : ''}`}
        aria-label="Open AI doctor triage assistant"
      >
        <span className="absolute right-1 top-1 h-3 w-3 rounded-full border-2 border-slate-950 bg-emerald-400 animate-pulse" />
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-7 w-7"
        >
          <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2v-2.26A6.98 6.98 0 0 1 5 9a7 7 0 0 1 7-7z" />
          <path d="M9 21h6" />
          <circle cx="9" cy="9" r="1" />
          <circle cx="15" cy="9" r="1" />
          <path d="M10 14a2 2 0 0 0 4 0" />
        </svg>
      </button>
    </div>
  );
}

export default ChatbotWidget;
