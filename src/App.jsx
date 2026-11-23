import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Mic,
  Headphones,
  Settings,
  Volume2,
  Sparkles,
  Send,
  ArrowLeft,
  Plus,
  Lightbulb,
  Square,
  RefreshCw,
  Languages,
  KeyRound,
  Trash2
} from 'lucide-react';

// Lista de modelos em ordem de prioridade: se o principal estiver congestionado, alterna automaticamente
const GEMINI_MODELS = ['gemini-3.8-flash', 'gemini-3.8-flash-lite', 'gemini-3-flash'];

const AVATARS = ['👩🏻', '👨🏻', '👧🏻', '👦🏻', '👵🏻', '👴🏻', '🧑🏽', '👩🏽', '🧔🏻', '🦊'];

const SCENARIOS = [
  {
    id: 'cafe',
    title: 'Cafeteria',
    emoji: '☕',
    desc: 'Pedir café, lanches e pagar a conta',
    role: 'a friendly barista at a cozy coffee shop in Seattle',
    starterEn: 'Hi there! Welcome to Cedar Coffee. What can I get started for you today?',
    starterPt: 'Olá! Bem-vindo ao Cedar Coffee. O que posso preparar para você hoje?'
  },
  {
    id: 'airport',
    title: 'Aeroporto e Imigração',
    emoji: '🛂',
    desc: 'Responder perguntas na chegada de viagem',
    role: 'a polite border control officer at JFK Airport',
    starterEn: 'Good morning. May I see your passport and tell me the purpose of your visit?',
    starterPt: 'Bom dia. Posso ver seu passaporte e saber o motivo da sua visita?'
  },
  {
    id: 'hotel',
    title: 'Check-in no Hotel',
    emoji: '🏨',
    desc: 'Confirmar reserva, Wi-Fi e café da manhã',
    role: 'a helpful hotel receptionist at a boutique hotel in London',
    starterEn: 'Welcome to The Grand Hotel! Do you have a reservation under your name?',
    starterPt: 'Bem-vindo ao The Grand Hotel! Você tem uma reserva em seu nome?'
  },
  {
    id: 'restaurant',
    title: 'Restaurante',
    emoji: '🍽️',
    desc: 'Escolher pratos, tirar dúvidas e pedir a conta',
    role: 'an attentive waiter at a casual American bistro',
    starterEn: 'Hello! Here are your menus. Can I start you off with something to drink?',
    starterPt: 'Olá! Aqui estão os cardápios. Posso começar trazendo algo para beber?'
  },
  {
    id: 'interview',
    title: 'Entrevista de Emprego',
    emoji: '💼',
    desc: 'Falar sobre experiência e pontos fortes',
    role: 'a supportive hiring manager conducting a friendly job interview',
    starterEn: 'Thanks for coming in today! To start, could you tell me a little bit about yourself?',
    starterPt: 'Obrigado por vir hoje! Para começar, você poderia me falar um pouco sobre você?'
  }
];

const PLACEMENT_QUESTIONS = [
  {
    step: 1,
    tag: 'Vocabulário Básico',
    question: 'Como você responderia naturalmente se alguém perguntasse: "How are you doing today?"',
    options: [
      { label: "I'm doing great, thanks! And you?", score: 1 },
      { label: 'My name is Carlos.', score: 0 },
      { label: 'It is three o’clock.', score: 0 }
    ]
  },
  {
    step: 2,
    tag: 'Estruturas do Dia a Dia',
    question: 'Qual frase está correta para contar o que você fez ontem?',
    options: [
      { label: 'Yesterday I go to the supermarket with my family.', score: 0 },
      { label: 'Yesterday I went to the supermarket with my family.', score: 2 },
      { label: 'Yesterday I going to the supermarket with my family.', score: 0 }
    ]
  },
  {
    step: 3,
    tag: 'Nível Intermediário',
    question: 'Complete a frase: "If I _____ more free time, I would travel around the world."',
    options: [
      { label: 'have', score: 0 },
      { label: 'had', score: 3 },
      { label: 'will have', score: 0 }
    ]
  },
  {
    step: 4,
    tag: 'Compreensão e Nuance',
    question: 'O que significa a expressão "Let’s call it a day" no final do expediente?',
    options: [
      { label: 'Vamos encerrar o trabalho por hoje.', score: 3 },
      { label: 'Precisamos fazer uma ligação importante.', score: 0 },
      { label: 'Amanhã será um dia muito ocupado.', score: 0 }
    ]
  }
];

function speakEnglish(text, rate = 1.0) {
  if (!('speechSynthesis' in window)) {
    alert('Seu navegador não suporta reprodução de áudio.');
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = rate;
  const voices = window.speechSynthesis.getVoices();
  const preferred =
    voices.find((v) => v.lang === 'en-US' && v.name.includes('Google')) ||
    voices.find((v) => v.lang.startsWith('en-US')) ||
    voices.find((v) => v.lang.startsWith('en'));
  if (preferred) utterance.voice = preferred;
  window.speechSynthesis.speak(utterance);
}

// Chama a API do Gemini com retentativas e alternância automática entre modelos
async function callGemini({ apiKey, contents, systemInstruction, jsonMode = false }) {
  const body = {
    contents,
    generationConfig: {
      temperature: 0.7,
      ...(jsonMode ? { responseMimeType: 'application/json' } : {})
    }
  };
  if (systemInstruction) {
    body.systemInstruction = {
      parts: [{ text: systemInstruction }]
    };
  }

  let lastErrorMsg = '';

  for (const model of GEMINI_MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

    for (let tentativa = 1; tentativa <= 2; tentativa++) {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (jsonMode) {
          const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          return JSON.parse(cleaned);
        }
        return text;
      }

      const errData = await res.json().catch(() => ({}));
      lastErrorMsg = errData?.error?.message || `Erro HTTP ${res.status}`;

      // Se o modelo não existir para esta chave (404), pula direto para o próximo modelo
      if (res.status === 404) {
        break;
      }

      // Se houver pico de demanda (503) ou limite temporário (429), aguarda 1.5s antes de tentar o próximo
      if (res.status === 503 || res.status === 429) {
        if (tentativa === 1) {
          await new Promise((resolve) => setTimeout(resolve, 1500));
          continue;
        }
        break; // Vai para o próximo modelo da lista
      }

      throw new Error(lastErrorMsg);
    }
  }

  throw new Error(
    'Os servidores gratuitos do Google estão com pico de acessos neste instante. Aguarde 15 segundos e tente novamente.'
  );
}

export default function App() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('family_en_api_key') || '');
  const [demoMode, setDemoMode] = useState(() => localStorage.getItem('family_en_demo_mode') === 'true');
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [keyInput, setKeyInput] = useState('');

  const [profiles, setProfiles] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('family_en_profiles') || '[]');
    } catch {
      return [];
    }
  });
  const [activeProfileId, setActiveProfileId] = useState(() => localStorage.getItem('family_en_active_id') || null);

  const [creatingProfile, setCreatingProfile] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAvatar, setNewAvatar] = useState('👩🏻');
  const [placementStep, setPlacementStep] = useState(0);
  const [placementAnswers, setPlacementAnswers] = useState([]);
  const [freeWriting, setFreeWriting] = useState('');
  const [evaluatingLevel, setEvaluatingLevel] = useState(false);

  const [activeTab, setActiveTab] = useState('roleplay');

  const activeProfile = profiles.find((p) => p.id === activeProfileId) || null;

  useEffect(() => {
    localStorage.setItem('family_en_profiles', JSON.stringify(profiles));
  }, [profiles]);

  useEffect(() => {
    if (activeProfileId) {
      localStorage.setItem('family_en_active_id', activeProfileId);
    } else {
      localStorage.removeItem('family_en_active_id');
    }
  }, [activeProfileId]);

  const isConfigured = Boolean(apiKey.trim()) || demoMode;

  const handleSaveApiKey = (e) => {
    e.preventDefault();
    const trimmed = keyInput.trim();
    if (!trimmed) return;
    localStorage.setItem('family_en_api_key', trimmed);
    localStorage.setItem('family_en_demo_mode', 'false');
    setApiKey(trimmed);
    setDemoMode(false);
    setShowKeyModal(false);
  };

  const handleEnableDemo = () => {
    localStorage.setItem('family_en_demo_mode', 'true');
    setDemoMode(true);
    setShowKeyModal(false);
  };

  const startNewProfileFlow = () => {
    setNewName('');
    setNewAvatar(AVATARS[profiles.length % AVATARS.length]);
    setPlacementStep(0);
    setPlacementAnswers([]);
    setFreeWriting('');
    setCreatingProfile(true);
  };

  const handleSelectPlacementOption = (stepIndex, option) => {
    const updated = [...placementAnswers];
    updated[stepIndex] = option;
    setPlacementAnswers(updated);
    setPlacementStep(stepIndex + 2);
  };

  const finishPlacementTest = async (skippedWriting = false) => {
    setEvaluatingLevel(true);
    const totalScore = placementAnswers.reduce((acc, item) => acc + (item?.score || 0), 0);
    const writtenText = skippedWriting ? '' : freeWriting.trim();

    let result = {
      nivel: 'Iniciante',
      cefr: 'A1',
      resumo_pt: 'Vamos começar com frases curtas, vocabulário essencial do dia a dia e bastante apoio em português!',
      diretriz_ia: 'Use simple, everyday English words and short sentences (A1/A2 level). Speak slowly and clearly.'
    };

    if (!demoMode && apiKey) {
      try {
        const prompt = `Avalie o nível de inglês deste aluno brasileiro com base nas respostas do teste inicial:
- Pontuação nas 4 questões objetivas (máximo 9 pontos): ${totalScore}/9
- Respostas objetivas: ${JSON.stringify(placementAnswers)}
- Frase livre escrita pelo aluno (passo 5): "${writtenText || '(Aluno pulou / ainda não escreve em inglês)'}"

Retorne APENAS um JSON válido com as chaves:
{
  "nivel": "Iniciante" | "Intermediário" | "Avançado",
  "cefr": "A1" | "A2" | "B1" | "B2" | "C1",
  "resumo_pt": "Mensagem acolhedora de 2 frases em português explicando o ponto de partida.",
  "diretriz_ia": "Instrução objetiva em inglês para calibrar o vocabulário e complexidade gramatical das próximas aulas."
}`;
        result = await callGemini({
          apiKey,
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          jsonMode: true
        });
      } catch {
        if (totalScore >= 7 && writtenText.length > 15) {
          result = {
            nivel: 'Avançado',
            cefr: 'B2/C1',
            resumo_pt: 'Ótimo domínio! Vamos praticar fluência natural, expressões idiomáticas e nuances.',
            diretriz_ia: 'Use natural, idiomatic English at B2/C1 level with varied structures.'
          };
        } else if (totalScore >= 4) {
          result = {
            nivel: 'Intermediário',
            cefr: 'B1',
            resumo_pt: 'Você já tem uma boa base! Vamos expandir seu vocabulário e ganhar segurança para conversar.',
            diretriz_ia: 'Use clear conversational English at B1 level, introducing useful phrasal verbs gently.'
          };
        }
      }
    } else {
      if (totalScore >= 7 && writtenText.length > 10) {
        result = {
          nivel: 'Avançado',
          cefr: 'B2',
          resumo_pt: 'Excelente base! Vamos treinar expressões naturais e conversas fluidas.',
          diretriz_ia: 'Use natural, idiomatic English at B2 level.'
        };
      } else if (totalScore >= 4) {
        result = {
          nivel: 'Intermediário',
          cefr: 'B1',
          resumo_pt: 'Você já entende bem o básico! Vamos ganhar agilidade e vocabulário.',
          diretriz_ia: 'Use clear B1 conversational English.'
        };
      }
    }

    const newProfile = {
      id: Date.now().toString(),
      name: newName.trim() || 'Estudante',
      avatar: newAvatar,
      ...result
    };

    setProfiles((prev) => [...prev, newProfile]);
    setActiveProfileId(newProfile.id);
    setEvaluatingLevel(false);
    setCreatingProfile(false);
  };

  const handleDeleteProfile = (id, e) => {
    e.stopPropagation();
    setProfiles((prev) => prev.filter((p) => p.id !== id));
    if (activeProfileId === id) setActiveProfileId(null);
  };

  if (!isConfigured) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-6 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-indigo-600 text-white rounded-2xl flex items-center justify-center mx-auto text-2xl font-extrabold shadow-lg shadow-indigo-200">
              EN
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Family English AI</h1>
            <p className="text-sm text-slate-600">
              Seu tutor pessoal de inglês com IA Gemini para toda a família.
            </p>
          </div>

          <form onSubmit={handleSaveApiKey} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                Chave da API do Google Gemini (Gratuita)
              </label>
              <div className="relative">
                <KeyRound className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="password"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder="Cole sua chave AIzaSy..."
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <p className="text-xs text-slate-500 mt-1.5">
                A chave fica salva apenas neste celular. Crie grátis em <strong>aistudio.google.com</strong>.
              </p>
            </div>

            <button
              type="submit"
              disabled={!keyInput.trim()}
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-semibold rounded-xl transition shadow-md"
            >
              Salvar Chave e Começar
            </button>
          </form>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-slate-200" />
            <span className="flex-shrink mx-3 text-xs text-slate-400">ou</span>
            <div className="flex-grow border-t border-slate-200" />
          </div>

          <button
            onClick={handleEnableDemo}
            className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl text-sm transition"
          >
            Testar sem chave agora (Modo Demonstração)
          </button>
        </div>
      </div>
    );
  }

  if (creatingProfile) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-6">
          <div className="flex items-center justify-between mb-5">
            <button
              onClick={() => (placementStep > 0 ? setPlacementStep(placementStep - 1) : setCreatingProfile(false))}
              className="p-2 -ml-2 text-slate-500 hover:text-slate-800 rounded-full"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex gap-1.5">
              {[0, 1, 2, 3, 4, 5].map((s) => (
                <div
                  key={s}
                  className={`h-1.5 w-6 rounded-full transition-all ${
                    s <= placementStep ? 'bg-indigo-600' : 'bg-slate-200'
                  }`}
                />
              ))}
            </div>
            <span className="text-xs font-semibold text-slate-400">{placementStep}/5</span>
          </div>

          {placementStep === 0 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Novo Perfil Familiar</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Em seguida faremos 5 perguntas rápidas para adaptar o app ao seu nível.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1.5">Nome</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex: Maria, João, Pedro..."
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-2">Escolha um Avatar</label>
                <div className="grid grid-cols-5 gap-2">
                  {AVATARS.map((av) => (
                    <button
                      key={av}
                      type="button"
                      onClick={() => setNewAvatar(av)}
                      className={`text-2xl py-2.5 rounded-xl border-2 transition ${
                        newAvatar === av
                          ? 'border-indigo-600 bg-indigo-50 scale-105'
                          : 'border-slate-100 bg-slate-50'
                      }`}
                    >
                      {av}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => setPlacementStep(1)}
                disabled={!newName.trim()}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-semibold rounded-xl transition"
              >
                Iniciar Avaliação Rápida
              </button>
            </div>
          )}

          {placementStep >= 1 && placementStep <= 4 && (
            <div className="space-y-4">
              <span className="inline-block px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-full">
                Passo {placementStep} de 5 • {PLACEMENT_QUESTIONS[placementStep - 1].tag}
              </span>
              <h3 className="text-lg font-bold text-slate-900 leading-snug">
                {PLACEMENT_QUESTIONS[placementStep - 1].question}
              </h3>

              <div className="space-y-2.5 pt-1">
                {PLACEMENT_QUESTIONS[placementStep - 1].options.map((opt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelectPlacementOption(placementStep - 1, opt)}
                    className="w-full text-left p-3.5 rounded-xl border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/50 text-sm font-medium text-slate-800 transition"
                  >
                    {opt.label}
                  </button>
                ))}
                <button
                  onClick={() =>
                    handleSelectPlacementOption(placementStep - 1, { label: 'Não sei ainda', score: 0 })
                  }
                  className="w-full text-center p-3 rounded-xl border border-dashed border-slate-300 text-xs font-medium text-slate-500 hover:bg-slate-50 transition"
                >
                  Não sei responder ainda (pular)
                </button>
              </div>
            </div>
          )}

          {placementStep === 5 && (
            <div className="space-y-4">
              <span className="inline-block px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-full">
                Passo 5 de 5 • Prática Livre
              </span>
              <h3 className="text-lg font-bold text-slate-900 leading-snug">
                Escreva 1 frase em inglês sobre você ou o que gosta de fazer:
              </h3>
              <textarea
                rows={3}
                value={freeWriting}
                onChange={(e) => setFreeWriting(e.target.value)}
                placeholder="Ex: I like watching movies with my family on weekends."
                className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />

              {evaluatingLevel ? (
                <div className="py-4 text-center text-sm font-medium text-indigo-600 animate-pulse">
                  Analisando seu perfil com IA Gemini...
                </div>
              ) : (
                <div className="space-y-2.5">
                  <button
                    onClick={() => finishPlacementTest(false)}
                    disabled={!freeWriting.trim()}
                    className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-semibold rounded-xl transition"
                  >
                    Concluir e Calibrar App
                  </button>
                  <button
                    onClick={() => finishPlacementTest(true)}
                    className="w-full py-3 text-xs font-medium text-slate-500 hover:text-slate-700"
                  >
                    Ainda não sei escrever em inglês (começar do zero)
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!activeProfile) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-900">Quem vai estudar agora?</h1>
              <p className="text-xs text-slate-500 mt-0.5">Cada pessoa tem seu nível e progresso salvos</p>
            </div>
            <button
              onClick={() => {
                setKeyInput(apiKey);
                setShowKeyModal(true);
              }}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-600"
              title="Configurar Chave API"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>

          {profiles.length === 0 ? (
            <div className="text-center py-8 px-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-3">
              <div className="text-4xl">👨‍👩‍👧‍👦</div>
              <p className="text-sm font-medium text-slate-700">Nenhum perfil criado ainda</p>
              <p className="text-xs text-slate-500">
                Crie um perfil para cada membro da família fazer o nivelamento inicial.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {profiles.map((prof) => (
                <div
                  key={prof.id}
                  onClick={() => setActiveProfileId(prof.id)}
                  className="flex items-center justify-between p-4 bg-slate-50 hover:bg-indigo-50/70 border border-slate-200 hover:border-indigo-300 rounded-2xl cursor-pointer transition"
                >
                  <div className="flex items-center gap-3.5">
                    <span className="text-3xl bg-white w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm">
                      {prof.avatar}
                    </span>
                    <div>
                      <h3 className="font-bold text-slate-900">{prof.name}</h3>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-xs font-semibold px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-md">
                          {prof.nivel} ({prof.cefr})
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDeleteProfile(prof.id, e)}
                    className="p-2 text-slate-400 hover:text-rose-600 rounded-lg"
                    title="Remover perfil"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={startNewProfileFlow}
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl flex items-center justify-center gap-2 shadow-md transition"
          >
            <Plus className="w-5 h-5" />
            Adicionar Membro da Família
          </button>

          {showKeyModal && (
            <KeySettingsModal
              keyInput={keyInput}
              setKeyInput={setKeyInput}
              onSave={handleSaveApiKey}
              onDemo={handleEnableDemo}
              onClose={() => setShowKeyModal(false)}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex justify-center">
      <div className="w-full max-w-md bg-white min-h-screen flex flex-col shadow-xl relative">
        <header className="px-4 py-3 bg-indigo-600 text-white flex items-center justify-between sticky top-0 z-20 shadow-sm">
          <button
            onClick={() => setActiveProfileId(null)}
            className="flex items-center gap-2.5 text-left hover:opacity-90"
          >
            <span className="text-2xl bg-white/15 w-9 h-9 rounded-xl flex items-center justify-center">
              {activeProfile.avatar}
            </span>
            <div>
              <div className="font-bold text-sm leading-tight flex items-center gap-1.5">
                {activeProfile.name}
                <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-white/20 rounded">
                  {activeProfile.nivel} • {activeProfile.cefr}
                </span>
              </div>
              <span className="text-[11px] text-indigo-100">Trocar perfil</span>
            </div>
          </button>

          <div className="flex items-center gap-1.5">
            {demoMode && (
              <span className="text-[10px] font-bold uppercase px-2 py-1 bg-amber-400 text-slate-900 rounded-full">
                Demo
              </span>
            )}
            <button
              onClick={() => {
                setKeyInput(apiKey);
                setShowKeyModal(true);
              }}
              className="p-2 hover:bg-white/15 rounded-full transition"
              title="Configurações da API"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </header>

        <main className="flex-1 flex flex-col overflow-hidden pb-20">
          {activeTab === 'roleplay' && (
            <RoleplayTab profile={activeProfile} apiKey={apiKey} demoMode={demoMode} />
          )}
          {activeTab === 'pronunciation' && (
            <PronunciationTab profile={activeProfile} apiKey={apiKey} demoMode={demoMode} />
          )}
          {activeTab === 'dictation' && (
            <DictationTab profile={activeProfile} apiKey={apiKey} demoMode={demoMode} />
          )}
        </main>

        <nav className="fixed bottom-0 w-full max-w-md bg-white border-t border-slate-200 px-2 py-2 pb-safe flex justify-around items-center z-20">
          <button
            onClick={() => setActiveTab('roleplay')}
            className={`flex flex-col items-center gap-1 px-4 py-1.5 rounded-xl transition ${
              activeTab === 'roleplay' ? 'text-indigo-600 bg-indigo-50 font-semibold' : 'text-slate-500'
            }`}
          >
            <MessageSquare className="w-5 h-5" />
            <span className="text-xs">Roleplay</span>
          </button>

          <button
            onClick={() => setActiveTab('pronunciation')}
            className={`flex flex-col items-center gap-1 px-4 py-1.5 rounded-xl transition ${
              activeTab === 'pronunciation' ? 'text-indigo-600 bg-indigo-50 font-semibold' : 'text-slate-500'
            }`}
          >
            <Mic className="w-5 h-5" />
            <span className="text-xs">Pronúncia</span>
          </button>

          <button
            onClick={() => setActiveTab('dictation')}
            className={`flex flex-col items-center gap-1 px-4 py-1.5 rounded-xl transition ${
              activeTab === 'dictation' ? 'text-indigo-600 bg-indigo-50 font-semibold' : 'text-slate-500'
            }`}
          >
            <Headphones className="w-5 h-5" />
            <span className="text-xs">Ditado</span>
          </button>
        </nav>

        {showKeyModal && (
          <KeySettingsModal
            keyInput={keyInput}
            setKeyInput={setKeyInput}
            onSave={handleSaveApiKey}
            onDemo={handleEnableDemo}
            onClose={() => setShowKeyModal(false)}
          />
        )}
      </div>
    </div>
  );
}

function KeySettingsModal({ keyInput, setKeyInput, onSave, onDemo, onClose }) {
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-sm bg-white rounded-3xl p-6 space-y-4 shadow-2xl">
        <h3 className="text-lg font-bold text-slate-900">Configurar Chave Gemini</h3>
        <p className="text-xs text-slate-500">
          Cole sua chave gratuita gerada no Google AI Studio (<strong>aistudio.google.com</strong>).
        </p>
        <form onSubmit={onSave} className="space-y-3">
          <input
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="AIzaSy..."
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={!keyInput.trim()}
            className="w-full py-2.5 bg-indigo-600 text-white font-semibold rounded-xl text-sm disabled:bg-slate-300"
          >
            Salvar Chave
          </button>
        </form>
        <div className="flex gap-2 pt-1">
          <button
            onClick={onDemo}
            className="flex-1 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-medium"
          >
            Usar Modo Demo
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-medium"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

function RoleplayTab({ profile, apiKey, demoMode }) {
  const [selectedScenario, setSelectedScenario] = useState(null);
  const [customTopic, setCustomTopic] = useState('');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loadingReply, setLoadingReply] = useState(false);
  const [translatedIds, setTranslatedIds] = useState({});

  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const [correctionData, setCorrectionData] = useState(null);
  const [loadingCorrection, setLoadingCorrection] = useState(false);
  const [exerciseAnswers, setExerciseAnswers] = useState({});

  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loadingReply]);

  const startScenario = (scenario) => {
    setSelectedScenario(scenario);
    setSuggestions([]);
    setTranslatedIds({});
    setMessages([
      {
        id: Date.now().toString(),
        sender: 'ai',
        en: scenario.starterEn,
        pt: scenario.starterPt
      }
    ]);
    speakEnglish(scenario.starterEn, profile.nivel === 'Iniciante' ? 0.85 : 1.0);
  };

  const startCustomScenario = (e) => {
    e.preventDefault();
    if (!customTopic.trim()) return;
    const topic = customTopic.trim();
    const customScen = {
      id: 'custom',
      title: topic,
      emoji: '✨',
      role: `a helpful conversation partner in the following situation: ${topic}`,
      starterEn: `Hello! Let's practice this situation: ${topic}. How would you like to start?`,
      starterPt: `Olá! Vamos praticar esta situação: ${topic}. Como você gostaria de começar?`
    };
    setSelectedScenario(customScen);
    setMessages([
      {
        id: Date.now().toString(),
        sender: 'ai',
        en: customScen.starterEn,
        pt: customScen.starterPt
      }
    ]);
  };

  const handleSendMessage = async (textToSend) => {
    const cleanText = (textToSend ?? input).trim();
    if (!cleanText || loadingReply) return;

    const userMsg = {
      id: Date.now().toString(),
      sender: 'user',
      en: cleanText
    };
    const updatedHistory = [...messages, userMsg];
    setMessages(updatedHistory);
    setInput('');
    setSuggestions([]);
    setLoadingReply(true);

    if (demoMode || !apiKey) {
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            sender: 'ai',
            en: 'That sounds great! Would you like anything else with that today?',
            pt: 'Isso parece ótimo! Você gostaria de mais alguma coisa hoje?'
          }
        ]);
        setLoadingReply(false);
      }, 700);
      return;
    }

    try {
      const historyText = updatedHistory
        .slice(-8)
        .map((m) => `${m.sender === 'user' ? 'Student' : 'Partner'}: ${m.en}`)
        .join('\n');

      const sysPrompt = `You are acting as ${selectedScenario.role}.
Student profile level: ${profile.nivel} (${profile.cefr}). ${profile.diretriz_ia}
Keep your reply natural, encouraging, and concise (1 to 2 short sentences) to keep the conversation flowing.
Respond ONLY with valid JSON:
{
  "reply_en": "Your natural English response",
  "reply_pt": "Natural Brazilian Portuguese translation of your response"
}`;

      const res = await callGemini({
        apiKey,
        systemInstruction: sysPrompt,
        contents: [{ role: 'user', parts: [{ text: `Conversation so far:\n${historyText}` }] }],
        jsonMode: true
      });

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'ai',
          en: res.reply_en,
          pt: res.reply_pt
        }
      ]);
      speakEnglish(res.reply_en, profile.nivel === 'Iniciante' ? 0.85 : 1.0);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'ai',
          en: 'Sorry, the server is busy right now. Could you send that again?',
          pt: err.message
        }
      ]);
    } finally {
      setLoadingReply(false);
    }
  };

  const handleGetSuggestions = async () => {
    if (loadingSuggestions) return;
    setLoadingSuggestions(true);
    const lastAiMsg = [...messages].reverse().find((m) => m.sender === 'ai')?.en || '';

    if (demoMode || !apiKey) {
      setSuggestions([
        { en: 'I would like a medium latte, please.', pt: 'Eu gostaria de um café com leite médio, por favor.' },
        { en: 'Can I also have a croissant?', pt: 'Posso pedir também um croissant?' }
      ]);
      setLoadingSuggestions(false);
      return;
    }

    try {
      const prompt = `Scenario: ${selectedScenario.title}.
Last message from partner: "${lastAiMsg}"
Student level: ${profile.nivel} (${profile.cefr}).
Give 3 short, natural reply options in English for the student, with Brazilian Portuguese translations.
Return ONLY JSON:
{
  "options": [
    { "en": "...", "pt": "..." }
  ]
}`;
      const res = await callGemini({
        apiKey,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        jsonMode: true
      });
      setSuggestions(res.options || []);
    } catch {
      setSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleSmartCorrection = async (sentence) => {
    setLoadingCorrection(true);
    setCorrectionData(null);
    setExerciseAnswers({});

    if (demoMode || !apiKey) {
      setTimeout(() => {
        setCorrectionData({
          frase_original: sentence,
          versao_natural: 'I would like a cup of coffee, please.',
          explicacao_pt:
            'Em inglês, usar "I would like..." soa muito mais educado e natural em pedidos do que "I want...".',
          exercicios: [
            {
              pergunta: 'Qual é a forma mais educada de pedir um chá em um café?',
              opcoes: ['I want a tea.', 'I would like a tea, please.', 'Give me tea.'],
              correta_index: 1,
              explicacao: '"I would like..." equivale ao nosso "Eu gostaria de...".'
            },
            {
              pergunta: 'Complete: "_____ I have the menu, please?"',
              opcoes: ['Could', 'Does', 'Am'],
              correta_index: 0,
              explicacao: '"Could I have..." é excelente para pedir itens com educação.'
            }
          ]
        });
        setLoadingCorrection(false);
      }, 600);
      return;
    }

    try {
      const prompt = `Você é um professor de inglês gentil para brasileiros.
Analise esta frase escrita pelo aluno (nível ${profile.nivel} - ${profile.cefr}) no cenário "${selectedScenario.title}":
Frase do aluno: "${sentence}"

Retorne APENAS um JSON válido com esta estrutura exata:
{
  "frase_original": "${sentence}",
  "versao_natural": "Como um falante nativo diria essa mesma ideia de forma natural",
  "explicacao_pt": "Explicação clara e amigável em português sobre o ajuste gramatical ou de vocabulário (ou elogio caso já esteja perfeita)",
  "exercicios": [
    {
      "pergunta": "Mini-exercício 1 em português/inglês focado nesse ponto",
      "opcoes": ["Opção A", "Opção B", "Opção C"],
      "correta_index": 0,
      "explicacao": "Breve explicação em português do porquê"
    },
    {
      "pergunta": "Mini-exercício 2 praticando a mesma estrutura",
      "opcoes": ["Opção A", "Opção B", "Opção C"],
      "correta_index": 1,
      "explicacao": "Breve explicação em português"
    }
  ]
}`;
      const res = await callGemini({
        apiKey,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        jsonMode: true
      });
      setCorrectionData(res);
    } catch (err) {
      alert(`Não foi possível analisar a frase: ${err.message}`);
    } finally {
      setLoadingCorrection(false);
    }
  };

  if (!selectedScenario) {
    return (
      <div className="p-4 space-y-5 overflow-y-auto">
        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4">
          <p className="text-xs font-semibold text-indigo-800">
            🎯 Calibrado para {profile.name} ({profile.nivel})
          </p>
          <p className="text-xs text-indigo-700 mt-1">{profile.resumo_pt}</p>
        </div>

        <div>
          <h2 className="text-base font-bold text-slate-900 mb-3">Escolha um cenário para conversar</h2>
          <div className="space-y-2.5">
            {SCENARIOS.map((sc) => (
              <button
                key={sc.id}
                onClick={() => startScenario(sc)}
                className="w-full flex items-center gap-3.5 p-3.5 bg-white border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/40 rounded-2xl text-left transition shadow-2xs"
              >
                <span className="text-2xl bg-slate-100 w-11 h-11 rounded-xl flex items-center justify-center">
                  {sc.emoji}
                </span>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">{sc.title}</h3>
                  <p className="text-xs text-slate-500">{sc.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={startCustomScenario} className="pt-2 space-y-2">
          <label className="block text-xs font-semibold uppercase text-slate-500">
            Ou crie qualquer situação livre
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={customTopic}
              onChange={(e) => setCustomTopic(e.target.value)}
              placeholder="Ex: Comprando ingressos no cinema..."
              className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={!customTopic.trim()}
              className="px-4 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl disabled:bg-slate-300"
            >
              Ir
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <button
          onClick={() => setSelectedScenario(null)}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-indigo-600"
        >
          <ArrowLeft className="w-4 h-4" />
          Cenários
        </button>
        <span className="text-xs font-bold text-slate-800">
          {selectedScenario.emoji} {selectedScenario.title}
        </span>
        <button
          onClick={handleGetSuggestions}
          className="flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full"
        >
          <Lightbulb className="w-3.5 h-3.5" />
          Ajuda
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col max-w-[85%] ${msg.sender === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'}`}
          >
            <div
              className={`px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-2xs ${
                msg.sender === 'user'
                  ? 'bg-indigo-600 text-white rounded-br-xs'
                  : 'bg-white border border-slate-200 text-slate-800 rounded-bl-xs'
              }`}
            >
              <p>{msg.en}</p>
              {msg.sender === 'ai' && translatedIds[msg.id] && msg.pt && (
                <p className="mt-2 pt-2 border-t border-slate-100 text-xs text-slate-500 italic">{msg.pt}</p>
              )}
            </div>

            {msg.sender === 'ai' ? (
              <div className="flex items-center gap-2 mt-1.5 px-1">
                <button
                  onClick={() => speakEnglish(msg.en, 1.0)}
                  className="flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-indigo-600"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  Ouvir
                </button>
                <button
                  onClick={() => speakEnglish(msg.en, 0.72)}
                  className="text-[11px] font-medium text-slate-500 hover:text-indigo-600"
                >
                  🐢 Devagar
                </button>
                {msg.pt && (
                  <button
                    onClick={() =>
                      setTranslatedIds((prev) => ({ ...prev, [msg.id]: !prev[msg.id] }))
                    }
                    className="flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-indigo-600"
                  >
                    <Languages className="w-3.5 h-3.5" />
                    {translatedIds[msg.id] ? 'Ocultar PT' : 'Traduzir'}
                  </button>
                )}
              </div>
            ) : (
              <button
                onClick={() => handleSmartCorrection(msg.en)}
                className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-full transition"
              >
                <Sparkles className="w-3 h-3" />
                Corrigir e Praticar
              </button>
            )}
          </div>
        ))}

        {loadingReply && (
          <div className="mr-auto bg-white border border-slate-200 px-4 py-2.5 rounded-2xl text-xs text-slate-500 animate-pulse">
            Digitando resposta em inglês...
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {(loadingSuggestions || suggestions.length > 0) && (
        <div className="px-3 py-2 bg-amber-50 border-t border-amber-200 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-800">💡 Ideias para você responder:</span>
            <button onClick={() => setSuggestions([])} className="text-[11px] text-amber-700">
              Fechar
            </button>
          </div>
          {loadingSuggestions ? (
            <p className="text-xs text-amber-700 animate-pulse">Gerando ideias para seu nível...</p>
          ) : (
            <div className="space-y-1.5">
              {suggestions.map((sug, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setInput(sug.en);
                    setSuggestions([]);
                  }}
                  className="w-full text-left p-2 bg-white rounded-xl border border-amber-200 hover:border-amber-400 transition"
                >
                  <p className="text-xs font-semibold text-slate-800">{sug.en}</p>
                  <p className="text-[11px] text-slate-500">{sug.pt}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="p-3 bg-white border-t border-slate-200 flex items-center gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escreva sua resposta em inglês..."
          className="flex-1 px-4 py-2.5 bg-slate-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          type="submit"
          disabled={!input.trim() || loadingReply}
          className="p-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-full transition"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>

      {(loadingCorrection || correctionData) && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-3 z-50">
          <div className="w-full max-w-md bg-white rounded-3xl p-5 max-h-[85vh] overflow-y-auto space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm">
                <Sparkles className="w-4 h-4" />
                Correção Inteligente & Prática
              </div>
              <button
                onClick={() => {
                  setCorrectionData(null);
                  setLoadingCorrection(false);
                }}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800"
              >
                Fechar
              </button>
            </div>

            {loadingCorrection ? (
              <div className="py-10 text-center text-sm text-indigo-600 font-medium animate-pulse">
                O professor está analisando sua frase e criando 2 exercícios...
              </div>
            ) : (
              correctionData && (
                <div className="space-y-4">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[10px] font-bold uppercase text-slate-400">Você escreveu</span>
                    <p className="text-sm text-slate-700 mt-0.5">{correctionData.frase_original}</p>
                  </div>

                  <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase text-emerald-700">
                        Como um nativo diria
                      </span>
                      <button
                        onClick={() => speakEnglish(correctionData.versao_natural, 0.95)}
                        className="text-emerald-700 hover:text-emerald-900"
                      >
                        <Volume2 className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-sm font-bold text-emerald-900 mt-1">
                      {correctionData.versao_natural}
                    </p>
                  </div>

                  <div className="text-xs text-slate-700 bg-indigo-50/70 p-3.5 rounded-xl leading-relaxed">
                    <strong className="text-indigo-900">💡 Dica do Professor: </strong>
                    {correctionData.explicacao_pt}
                  </div>

                  <div className="space-y-3 pt-1">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Fixe o aprendizado (2 mini-exercícios)
                    </h4>
                    {(correctionData.exercicios || []).map((ex, exIdx) => {
                      const chosen = exerciseAnswers[exIdx];
                      return (
                        <div key={exIdx} className="p-3.5 border border-slate-200 rounded-2xl space-y-2.5">
                          <p className="text-xs font-bold text-slate-800">
                            {exIdx + 1}. {ex.pergunta}
                          </p>
                          <div className="space-y-1.5">
                            {ex.opcoes.map((opt, optIdx) => {
                              let style = 'border-slate-200 bg-white text-slate-700';
                              if (chosen !== undefined) {
                                if (optIdx === ex.correta_index) {
                                  style = 'border-emerald-500 bg-emerald-50 text-emerald-900 font-semibold';
                                } else if (optIdx === chosen) {
                                  style = 'border-rose-400 bg-rose-50 text-rose-800';
                                }
                              }
                              return (
                                <button
                                  key={optIdx}
                                  onClick={() =>
                                    setExerciseAnswers((prev) => ({ ...prev, [exIdx]: optIdx }))
                                  }
                                  className={`w-full text-left px-3 py-2 rounded-xl border text-xs transition ${style}`}
                                >
                                  {opt}
                                </button>
                              );
                            })}
                          </div>
                          {chosen !== undefined && (
                            <p className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg">
                              {chosen === ex.correta_index ? '✅ Correto! ' : '❌ Quase! '}
                              {ex.explicacao}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PronunciationTab({ profile, apiKey, demoMode }) {
  const [target, setTarget] = useState({
    en: 'Could I have a bottle of water, please?',
    pt: 'Eu poderia pegar uma garrafa de água, por favor?',
    tip: 'Junte o som de "Could I" como "Cu-dai" e pronuncie "water" com som suave no T.'
  });
  const [loadingPhrase, setLoadingPhrase] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [analyzing, setAnalyzing] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  const generateNewPhrase = async () => {
    setLoadingPhrase(true);
    setFeedback(null);

    if (demoMode || !apiKey) {
      const samples = [
        {
          en: 'Thank you so much for your help today!',
          pt: 'Muito obrigado pela sua ajuda hoje!',
          tip: 'Coloque a ponta da língua suavemente entre os dentes no "Th" de Thank.'
        },
        {
          en: 'What time does the next train leave?',
          pt: 'A que horas parte o próximo trem?',
          tip: 'Pronuncie "does" como "dâz" e dê ênfase em "next train".'
        }
      ];
      setTarget(samples[Math.floor(Math.random() * samples.length)]);
      setLoadingPhrase(false);
      return;
    }

    try {
      const prompt = `Gere 1 frase útil em inglês para treino de pronúncia de um aluno brasileiro nível ${profile.nivel} (${profile.cefr}).
Retorne APENAS JSON:
{
  "en": "Frase em inglês",
  "pt": "Tradução em português",
  "tip": "Dica rápida em português de como pronunciar os sons mais difíceis dessa frase"
}`;
      const res = await callGemini({
        apiKey,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        jsonMode: true
      });
      setTarget(res);
    } catch (err) {
      alert(`Erro ao gerar frase: ${err.message}`);
    } finally {
      setLoadingPhrase(false);
    }
  };

  const startRecording = async () => {
    setFeedback(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      const recorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 32000
      });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mimeType });
        await analyzeAudioBlob(blob, mimeType);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      alert(
        'Não foi possível acessar o microfone. Verifique se você permitiu o uso do microfone no navegador e se o site está em HTTPS.'
      );
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const analyzeAudioBlob = async (blob, mimeType) => {
    setAnalyzing(true);

    if (demoMode || !apiKey) {
      setTimeout(() => {
        const words = target.en.replace(/[?.!,]/g, '').split(' ');
        setFeedback({
          nota: 88,
          palavras: words.map((w, i) => ({
            palavra: w,
            status: i === 2 ? 'ajuste' : 'ok'
          })),
          dica_pt:
            'Ótimo ritmo e clareza! Apenas suavize um pouco mais a vogal na terceira palavra para soar ainda mais natural.'
        });
        setAnalyzing(false);
      }, 900);
      return;
    }

    try {
      const base64Audio = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result;
          resolve(result.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const prompt = `Ouça o áudio gravado pelo aluno brasileiro (nível ${profile.nivel}) tentando ler a frase:
"${target.en}"

Avalie a pronúncia, clareza e entonação. Retorne APENAS um JSON válido:
{
  "nota": 85,
  "palavras": [
    { "palavra": "Could", "status": "ok" },
    { "palavra": "water", "status": "ajuste" }
  ],
  "dica_pt": "Feedback encorajador em português explicando o que ficou bom e como melhorar alguma palavra específica (ex: posição da língua ou som parecido em português)."
}`;

      const res = await callGemini({
        apiKey,
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: mimeType.split(';')[0],
                  data: base64Audio
                }
              }
            ]
          }
        ],
        jsonMode: true
      });
      setFeedback(res);
    } catch (err) {
      alert(`Aviso na análise de pronúncia: ${err.message}`);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="p-4 space-y-5 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900">Estúdio de Pronúncia</h2>
          <p className="text-xs text-slate-500">Ouça o modelo e grave sua voz para avaliação</p>
        </div>
        <button
          onClick={generateNewPhrase}
          disabled={loadingPhrase}
          className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 px-3 py-2 rounded-xl"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loadingPhrase ? 'animate-spin' : ''}`} />
          Nova Frase
        </button>
      </div>

      <div className="p-5 bg-gradient-to-br from-indigo-600 to-violet-600 text-white rounded-3xl shadow-md space-y-4">
        <p className="text-lg font-bold leading-snug">{target.en}</p>
        <p className="text-xs text-indigo-100">{target.pt}</p>

        <div className="flex gap-2 pt-1">
          <button
            onClick={() => speakEnglish(target.en, 1.0)}
            className="flex-1 py-2.5 bg-white/20 hover:bg-white/30 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5"
          >
            <Volume2 className="w-4 h-4" />
            Ouvir Normal
          </button>
          <button
            onClick={() => speakEnglish(target.en, 0.68)}
            className="flex-1 py-2.5 bg-white/20 hover:bg-white/30 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5"
          >
            🐢 Ouvir Devagar
          </button>
        </div>
      </div>

      <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900">
        <strong>💡 Dica antes de falar: </strong>
        {target.tip}
      </div>

      <div className="flex flex-col items-center py-3 space-y-3">
        {!isRecording ? (
          <button
            onClick={startRecording}
            disabled={analyzing}
            className="w-20 h-20 rounded-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white flex items-center justify-center shadow-lg shadow-indigo-200 transition active:scale-95"
          >
            <Mic className="w-8 h-8" />
          </button>
        ) : (
          <button
            onClick={stopRecording}
            className="w-20 h-20 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-lg shadow-rose-200 animate-pulse"
          >
            <Square className="w-7 h-7 fill-current" />
          </button>
        )}
        <span className="text-xs font-semibold text-slate-600">
          {isRecording
            ? `Gravando... 00:0${seconds} (Toque para parar)`
            : analyzing
            ? 'Analisando sua pronúncia...'
            : 'Toque no microfone e leia a frase acima'}
        </span>
      </div>

      {feedback && (
        <div className="p-4 bg-white border border-slate-200 rounded-3xl space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-500">Nota de Clareza</span>
            <span
              className={`text-lg font-extrabold px-3 py-0.5 rounded-full ${
                feedback.nota >= 80
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-amber-100 text-amber-700'
              }`}
            >
              {feedback.nota}%
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {(feedback.palavras || []).map((item, idx) => (
              <span
                key={idx}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                  item.status === 'ok'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-rose-100 text-rose-800 underline decoration-wavy'
                }`}
              >
                {item.palavra}
              </span>
            ))}
          </div>

          <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-xl leading-relaxed">
            {feedback.dica_pt}
          </p>
        </div>
      )}
    </div>
  );
}

function DictationTab({ profile, apiKey, demoMode }) {
  const [challenge, setChallenge] = useState({
    en: 'We are going to visit our grandparents this Sunday.',
    pt: 'Nós vamos visitar nossos avós neste domingo.'
  });
  const [userText, setUserText] = useState('');
  const [checked, setChecked] = useState(false);
  const [loadingNew, setLoadingNew] = useState(false);

  const loadNewChallenge = async () => {
    setLoadingNew(true);
    setUserText('');
    setChecked(false);

    if (demoMode || !apiKey) {
      const list = [
        {
          en: 'Please remember to bring your umbrella today.',
          pt: 'Por favor, lembre-se de trazer seu guarda-chuva hoje.'
        },
        {
          en: 'She always drinks coffee before starting work.',
          pt: 'Ela sempre toma café antes de começar a trabalhar.'
        }
      ];
      const chosen = list[Math.floor(Math.random() * list.length)];
      setChallenge(chosen);
      setLoadingNew(false);
      speakEnglish(chosen.en, 0.95);
      return;
    }

    try {
      const prompt = `Crie 1 frase inédita do cotidiano em inglês para exercício de ditado (listening) de um aluno brasileiro nível ${profile.nivel} (${profile.cefr}).
Retorne APENAS JSON:
{
  "en": "Frase em inglês",
  "pt": "Tradução em português"
}`;
      const res = await callGemini({
        apiKey,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        jsonMode: true
      });
      setChallenge(res);
      speakEnglish(res.en, 0.95);
    } catch (err) {
      alert(`Erro ao gerar ditado: ${err.message}`);
    } finally {
      setLoadingNew(false);
    }
  };

  const normalize = (str) =>
    str
      .toLowerCase()
      .replace(/[.,!?'"-]/g, '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);

  const expectedWords = normalize(challenge.en);
  const typedWords = normalize(userText);

  const comparison = expectedWords.map((word, idx) => ({
    expected: challenge.en.split(/\s+/)[idx] || word,
    matched: typedWords[idx] === word
  }));

  const accuracy =
    expectedWords.length > 0
      ? Math.round((comparison.filter((c) => c.matched).length / expectedWords.length) * 100)
      : 0;

  return (
    <div className="p-4 space-y-5 overflow-y-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900">Ditado Interativo</h2>
          <p className="text-xs text-slate-500">Ouça com atenção e escreva o que entendeu</p>
        </div>
        <button
          onClick={loadNewChallenge}
          disabled={loadingNew}
          className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 px-3 py-2 rounded-xl"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loadingNew ? 'animate-spin' : ''}`} />
          Nova Frase
        </button>
      </div>

      <div className="p-5 bg-slate-900 text-white rounded-3xl space-y-4 text-center">
        <div className="w-12 h-12 bg-indigo-500/20 text-indigo-300 rounded-2xl flex items-center justify-center mx-auto">
          <Headphones className="w-6 h-6" />
        </div>
        <p className="text-xs text-slate-300">
          O texto está oculto. Use os botões abaixo para ouvir quantas vezes precisar:
        </p>
        <div className="flex gap-2.5">
          <button
            onClick={() => speakEnglish(challenge.en, 1.0)}
            className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
          >
            <Volume2 className="w-4 h-4" />
            Ouvir Normal
          </button>
          <button
            onClick={() => speakEnglish(challenge.en, 0.68)}
            className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
          >
            🐢 Ouvir Devagar
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <textarea
          rows={3}
          value={userText}
          onChange={(e) => {
            setUserText(e.target.value);
            if (checked) setChecked(false);
          }}
          placeholder="Digite aqui a frase em inglês que você ouviu..."
          className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          onClick={() => setChecked(true)}
          disabled={!userText.trim()}
          className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-semibold rounded-xl transition"
        >
          Verificar Ditado
        </button>
      </div>

      {checked && (
        <div className="p-4 bg-white border border-slate-200 rounded-3xl space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-500">Precisão</span>
            <span
              className={`text-sm font-extrabold px-2.5 py-0.5 rounded-full ${
                accuracy >= 80 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
              }`}
            >
              {accuracy}% de acerto
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5 p-3 bg-slate-50 rounded-xl">
            {comparison.map((item, idx) => (
              <span
                key={idx}
                className={`px-2 py-0.5 rounded text-sm font-semibold ${
                  item.matched
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {item.expected}
              </span>
            ))}
          </div>

          <p className="text-xs text-slate-600">
            <strong>Tradução:</strong> {challenge.pt}
          </p>
        </div>
      )}
    </div>
  );
}
