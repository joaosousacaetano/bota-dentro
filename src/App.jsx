import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import emailjs from '@emailjs/browser';
import {
  Gift, Search, CheckCircle2, ExternalLink, Lock, Unlock, Plus,
  Trash2, Edit3, Mail, Copy, Check, Sparkles, PartyPopper,
  Calendar, Heart, X, AlertCircle, Send, Users, RefreshCw, Database
} from 'lucide-react';
import { INITIAL_GIFTS } from './initialGifts';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const EMAILJS_SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID || '';
const EMAILJS_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID || '';
const EMAILJS_PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY || '';
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || 'najorecebe';

const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

const CATEGORIES = ['Todos', 'Cozinha', 'Casa & Decoração', 'Organização & Limpeza', 'Ferramentas'];

export default function App() {
  const [gifts, setGifts] = useState([]);
  const [settings, setSettings] = useState({
    id: 'main',
    pix_key: 'Chave Pix ainda não configurada (configure no Admin)',
    pix_name: 'João & Nathalia',
    pix_messages: []
  });
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modais convidado
  const [activeGift, setActiveGift] = useState(null);
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestNote, setGuestNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState(null);

  // Pix
  const [copiedPix, setCopiedPix] = useState(false);
  const [showPixModal, setShowPixModal] = useState(false);
  const [pixSenderName, setPixSenderName] = useState('');
  const [pixSenderMessage, setPixSenderMessage] = useState('');
  const [pixSentSuccess, setPixSentSuccess] = useState(false);

  // Admin
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminTab, setAdminTab] = useState('gifts');
  const [editingGift, setEditingGift] = useState(null);
  const [seeding, setSeeding] = useState(false);

  const loadData = async () => {
    setLoading(true);
    if (!supabase) {
      const savedGifts = localStorage.getItem('bota_dentro_gifts_v1');
      const savedSettings = localStorage.getItem('bota_dentro_settings_v1');
      setGifts(savedGifts ? JSON.parse(savedGifts) : INITIAL_GIFTS);
      if (savedSettings) setSettings(JSON.parse(savedSettings));
      setLoading(false);
      return;
    }

    try {
      const { data: giftsData, error: giftsError } = await supabase
        .from('gifts')
        .select('*')
        .order('created_at', { ascending: true });

      if (giftsError) throw giftsError;

      if (!giftsData || giftsData.length === 0) {
        await seedDatabase();
      } else {
        setGifts(giftsData);
      }

      const { data: settingsData } = await supabase
        .from('settings')
        .select('*')
        .eq('id', 'main')
        .single();

      if (settingsData) {
        setSettings(settingsData);
      } else {
        const defaultSettings = {
          id: 'main',
          pix_key: 'Chave Pix (edite no Admin)',
          pix_name: 'João & Nathalia',
          pix_messages: []
        };
        await supabase.from('settings').upsert(defaultSettings);
        setSettings(defaultSettings);
      }
    } catch (err) {
      console.error('Erro ao carregar dados do Supabase:', err);
      setGifts(INITIAL_GIFTS);
    } finally {
      setLoading(false);
    }
  };

  const seedDatabase = async () => {
    if (!supabase) return;
    setSeeding(true);
    try {
      const { error } = await supabase.from('gifts').upsert(INITIAL_GIFTS);
      if (error) throw error;
      const { data } = await supabase
        .from('gifts')
        .select('*')
        .order('created_at', { ascending: true });
      if (data) setGifts(data);
    } catch (err) {
      console.error('Erro ao popular lista inicial:', err);
      alert('Erro ao enviar os 37 itens para o Supabase. Verifique as políticas RLS das tabelas.');
    } finally {
      setSeeding(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const persistLocal = (nextGifts, nextSettings = settings) => {
    localStorage.setItem('bota_dentro_gifts_v1', JSON.stringify(nextGifts));
    localStorage.setItem('bota_dentro_settings_v1', JSON.stringify(nextSettings));
  };

  const stats = useMemo(() => {
    const totalSlots = gifts.reduce((acc, g) => acc + (g.quantity || 1), 0);
    const claimedSlots = gifts.reduce((acc, g) => acc + (g.claims?.length || 0), 0);
    const percent = totalSlots > 0 ? Math.round((claimedSlots / totalSlots) * 100) : 0;
    return { totalSlots, claimedSlots, availableSlots: totalSlots - claimedSlots, percent };
  }, [gifts]);

  const filteredGifts = useMemo(() => {
    return gifts.filter((gift) => {
      const claimedCount = gift.claims?.length || 0;
      const maxQty = gift.quantity || 1;
      const isAvailable = claimedCount < maxQty;

      if (selectedCategory !== 'Todos' && gift.category !== selectedCategory) return false;
      if (statusFilter === 'available' && !isAvailable) return false;
      if (statusFilter === 'claimed' && isAvailable) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = gift.title.toLowerCase().includes(q);
        const matchDesc = (gift.description || '').toLowerCase().includes(q);
        if (!matchTitle && !matchDesc) return false;
      }
      return true;
    });
  }, [gifts, selectedCategory, statusFilter, searchQuery]);

  const handleCopyPix = () => {
    navigator.clipboard.writeText(settings.pix_key);
    setCopiedPix(true);
    setTimeout(() => setCopiedPix(false), 3000);
  };

  const handleClaimGift = async (e) => {
    e.preventDefault();
    if (!activeGift || !guestName.trim() || !guestEmail.trim()) return;
    setSubmitting(true);

    try {
      let currentGift = activeGift;

      if (supabase) {
        const { data: freshGift, error: fetchErr } = await supabase
          .from('gifts')
          .select('*')
          .eq('id', activeGift.id)
          .single();
        if (fetchErr) throw fetchErr;
        currentGift = freshGift;
      }

      const currentClaims = currentGift.claims || [];
      const maxQty = currentGift.quantity || 1;

      if (currentClaims.length >= maxQty) {
        alert('Opa! Alguém acabou de escolher esse presente segundos atrás. Escolha outro da lista!');
        await loadData();
        setActiveGift(null);
        setSubmitting(false);
        return;
      }

      const newClaim = {
        id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
        name: guestName.trim(),
        email: guestEmail.trim(),
        note: guestNote.trim(),
        claimedAt: new Date().toISOString()
      };

      const updatedClaims = [...currentClaims, newClaim];

      if (supabase) {
        const { error: updateErr } = await supabase
          .from('gifts')
          .update({ claims: updatedClaims })
          .eq('id', currentGift.id);
        if (updateErr) throw updateErr;
      }

      const nextGifts = gifts.map((g) =>
        g.id === currentGift.id ? { ...g, claims: updatedClaims } : g
      );
      setGifts(nextGifts);
      if (!supabase) persistLocal(nextGifts);

      let emailSent = false;
      if (EMAILJS_SERVICE_ID && EMAILJS_TEMPLATE_ID && EMAILJS_PUBLIC_KEY) {
        try {
          await emailjs.send(
            EMAILJS_SERVICE_ID,
            EMAILJS_TEMPLATE_ID,
            {
              to_name: newClaim.name,
              to_email: newClaim.email,
              gift_title: currentGift.title,
              gift_description: currentGift.description || 'Sem observações adicionais.',
              gift_link: currentGift.buy_link || 'Sem link específico — fique à vontade para escolher o modelo!'
            },
            EMAILJS_PUBLIC_KEY
          );
          emailSent = true;
        } catch (emailErr) {
          console.error('Erro ao disparar e-mail via EmailJS:', emailErr);
        }
      }

      setConfirmationResult({
        gift: currentGift,
        claim: newClaim,
        emailSent
      });
      setActiveGift(null);
      setGuestName('');
      setGuestEmail('');
      setGuestNote('');
    } catch (err) {
      console.error('Erro ao confirmar presente:', err);
      alert('Não foi possível confirmar agora. Tente novamente em instantes.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSavePixMessage = async (e) => {
    e.preventDefault();
    if (!pixSenderName.trim()) return;
    const newMsg = {
      id: String(Date.now()),
      name: pixSenderName.trim(),
      message: pixSenderMessage.trim() || 'Mandou um Pix pra ajudar na casa nova! 🥂',
      createdAt: new Date().toISOString()
    };
    const nextSettings = {
      ...settings,
      pix_messages: [newMsg, ...(settings.pix_messages || [])]
    };
    setSettings(nextSettings);
    if (supabase) {
      await supabase.from('settings').upsert(nextSettings);
    } else {
      persistLocal(gifts, nextSettings);
    }
    setPixSentSuccess(true);
    setPixSenderName('');
    setPixSenderMessage('');
    setTimeout(() => {
      setPixSentSuccess(false);
      setShowPixModal(false);
    }, 2000);
  };

  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (passwordInput === ADMIN_PASSWORD) {
      setIsAdmin(true);
      setShowAdminLogin(false);
      setPasswordInput('');
      setPasswordError('');
    } else {
      setPasswordError('Senha incorreta!');
    }
  };

  const handleRemoveClaim = async (giftId, claimId) => {
    if (!window.confirm('Tem certeza que deseja desmarcar essa escolha e liberar o presente novamente?')) return;
    const target = gifts.find((g) => g.id === giftId);
    if (!target) return;
    const updatedClaims = (target.claims || []).filter((c) => c.id !== claimId);

    if (supabase) {
      await supabase.from('gifts').update({ claims: updatedClaims }).eq('id', giftId);
    }
    const nextGifts = gifts.map((g) => (g.id === giftId ? { ...g, claims: updatedClaims } : g));
    setGifts(nextGifts);
    if (!supabase) persistLocal(nextGifts);
  };

  const handleSaveGiftForm = async (e) => {
    e.preventDefault();
    if (!editingGift?.title?.trim()) return;

    const isNew = !editingGift.id;
    const giftObj = {
      id: isNew ? `gift-${Date.now()}` : editingGift.id,
      title: editingGift.title.trim(),
      category: editingGift.category || 'Cozinha',
      description: editingGift.description || '',
      image: editingGift.image || 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80',
      buy_link: editingGift.buy_link || '',
      quantity: Math.max(1, Number(editingGift.quantity) || 1),
      claims: editingGift.claims || []
    };

    if (supabase) {
      await supabase.from('gifts').upsert(giftObj);
    }

    const nextGifts = isNew
      ? [...gifts, giftObj]
      : gifts.map((g) => (g.id === giftObj.id ? giftObj : g));

    setGifts(nextGifts);
    if (!supabase) persistLocal(nextGifts);
    setEditingGift(null);
  };

  const handleDeleteGift = async (giftId) => {
    if (!window.confirm('Excluir este item permanentemente da lista?')) return;
    if (supabase) {
      await supabase.from('gifts').delete().eq('id', giftId);
    }
    const nextGifts = gifts.filter((g) => g.id !== giftId);
    setGifts(nextGifts);
    if (!supabase) persistLocal(nextGifts);
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    if (supabase) {
      await supabase.from('settings').upsert(settings);
    } else {
      persistLocal(gifts, settings);
    }
    alert('Configurações do Pix salvas com sucesso!');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-orange-50/40 to-stone-100 text-stone-800">
      {/* HEADER FESTIVO */}
      <header className="relative overflow-hidden bg-gradient-to-br from-amber-600 via-orange-600 to-rose-600 text-white shadow-lg">
        <div className="max-w-6xl mx-auto px-4 py-10 sm:py-14 relative z-10">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <span className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-semibold tracking-wide">
              <Calendar className="w-4 h-4" />
              12 de Dezembro de 2026
            </span>

            <button
              onClick={() => (isAdmin ? setIsAdmin(false) : setShowAdminLogin(true))}
              className="inline-flex items-center gap-1.5 bg-black/25 hover:bg-black/40 transition px-3.5 py-1.5 rounded-full text-xs font-medium"
            >
              {isAdmin ? <Unlock className="w-3.5 h-3.5 text-emerald-300" /> : <Lock className="w-3.5 h-3.5" />}
              {isAdmin ? 'Sair do Modo Anfitrião' : 'Área dos Anfitriões'}
            </button>
          </div>

          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 text-amber-200 font-bold text-sm uppercase tracking-wider mb-2">
              <PartyPopper className="w-5 h-5" />
              Chá de Casa Nova
            </div>
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight mb-4">
              Bota Dentro João & Nathalia 🥂🏡
            </h1>
            <p className="text-base sm:text-lg text-amber-50/95 leading-relaxed">
              Já estamos morando juntos há dois meses e agora chegou a hora oficial de comemorar com vocês!
              Se quiser nos ajudar a completar os cantinhos da casa, escolha um item abaixo (ou mande um Pix pra fortalecer a operação).
            </p>
          </div>

          {/* BARRA DE PROGRESSO */}
          <div className="mt-8 bg-white/15 backdrop-blur-md rounded-2xl p-4 sm:p-5 max-w-2xl border border-white/20">
            <div className="flex items-center justify-between text-sm font-semibold mb-2">
              <span>Progresso da nossa casa</span>
              <span>{stats.claimedSlots} de {stats.totalSlots} presentes garantidos ({stats.percent}%)</span>
            </div>
            <div className="w-full h-3 bg-black/25 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-300 to-emerald-300 rounded-full transition-all duration-500"
                style={{ width: `${stats.percent}%` }}
              />
            </div>
          </div>
        </div>
      </header>

      {/* PAINEL ADMIN */}
      {isAdmin && (
        <section className="max-w-6xl mx-auto px-4 mt-8">
          <div className="bg-white rounded-3xl shadow-xl border-2 border-amber-400 p-6">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-stone-200">
              <div>
                <h2 className="text-xl font-extrabold text-stone-900 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-500" />
                  Painel dos Anfitriões (João & Nathalia)
                </h2>
                <p className="text-xs text-stone-500 mt-0.5 flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5" />
                  Status do Banco: {supabase ? (
                    <span className="text-emerald-600 font-semibold">Conectado ao Supabase (Online em tempo real)</span>
                  ) : (
                    <span className="text-amber-600 font-semibold">Modo Local (Configure as variáveis VITE_SUPABASE no deploy)</span>
                  )}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setAdminTab('gifts')}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
                    adminTab === 'gifts' ? 'bg-amber-600 text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                  }`}
                >
                  Gerenciar Presentes ({gifts.length})
                </button>
                <button
                  onClick={() => setAdminTab('claims')}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
                    adminTab === 'claims' ? 'bg-amber-600 text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                  }`}
                >
                  Quem Escolheu ({stats.claimedSlots})
                </button>
                <button
                  onClick={() => setAdminTab('settings')}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
                    adminTab === 'settings' ? 'bg-amber-600 text-white' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                  }`}
                >
                  Chave Pix & Config
                </button>
              </div>
            </div>

            {/* ABA 1: GERENCIAR PRESENTES */}
            {adminTab === 'gifts' && (
              <div className="mt-6">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                  <button
                    onClick={() =>
                      setEditingGift({
                        title: '',
                        category: 'Cozinha',
                        description: '',
                        image: '',
                        buy_link: '',
                        quantity: 1,
                        claims: []
                      })
                    }
                    className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm transition"
                  >
                    <Plus className="w-4 h-4" /> Adicionar Novo Presente
                  </button>

                  {supabase && (
                    <button
                      onClick={seedDatabase}
                      disabled={seeding}
                      className="inline-flex items-center gap-2 bg-stone-100 hover:bg-stone-200 text-stone-700 px-3.5 py-2 rounded-xl text-xs font-semibold transition"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${seeding ? 'animate-spin' : ''}`} />
                      Restaurar/Sincronizar os 37 Itens Base
                    </button>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-stone-200 text-stone-500 text-xs uppercase">
                        <th className="py-3 px-2">Presente</th>
                        <th className="py-3 px-2">Categoria</th>
                        <th className="py-3 px-2">Qtd</th>
                        <th className="py-3 px-2">Link Compra</th>
                        <th className="py-3 px-2 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {gifts.map((g) => (
                        <tr key={g.id} className="hover:bg-amber-50/50">
                          <td className="py-3 px-2 font-semibold text-stone-800">{g.title}</td>
                          <td className="py-3 px-2 text-stone-500 text-xs">{g.category}</td>
                          <td className="py-3 px-2">
                            <span className="px-2 py-0.5 rounded-full bg-stone-100 text-xs font-bold">
                              {g.claims?.length || 0}/{g.quantity || 1}
                            </span>
                          </td>
                          <td className="py-3 px-2">
                            {g.buy_link ? (
                              <a href={g.buy_link} target="_blank" rel="noreferrer" className="text-emerald-600 underline text-xs font-medium">
                                Link cadastrado
                              </a>
                            ) : (
                              <span className="text-amber-600 text-xs">Sem link ainda</span>
                            )}
                          </td>
                          <td className="py-3 px-2 text-right space-x-2">
                            <button
                              onClick={() => setEditingGift({ ...g })}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-100 text-amber-800 hover:bg-amber-200 text-xs font-semibold"
                            >
                              <Edit3 className="w-3.5 h-3.5" /> Editar / Link
                            </button>
                            <button
                              onClick={() => handleDeleteGift(g.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-100 text-rose-700 hover:bg-rose-200 text-xs font-semibold"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ABA 2: QUEM ESCOLHEU */}
            {adminTab === 'claims' && (
              <div className="mt-6 space-y-4">
                {stats.claimedSlots === 0 ? (
                  <p className="text-stone-500 text-sm py-6 text-center">Nenhum presente foi escolhido ainda.</p>
                ) : (
                  gifts
                    .filter((g) => g.claims && g.claims.length > 0)
                    .map((g) => (
                      <div key={g.id} className="p-4 rounded-2xl bg-stone-50 border border-stone-200">
                        <div className="font-bold text-stone-900 mb-2">
                          {g.title} <span className="text-xs font-normal text-stone-500">({g.claims.length}/{g.quantity || 1} escolhido)</span>
                        </div>
                        <div className="space-y-2">
                          {g.claims.map((c) => (
                            <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 bg-white p-3 rounded-xl border border-stone-200 text-sm">
                              <div>
                                <span className="font-bold text-stone-800">{c.name}</span> — <span className="text-stone-600">{c.email}</span>
                                {c.note && <p className="text-xs text-stone-500 italic mt-0.5">"{c.note}"</p>}
                              </div>
                              <button
                                onClick={() => handleRemoveClaim(g.id, c.id)}
                                className="px-3 py-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-700 text-xs font-bold transition"
                              >
                                Desmarcar / Liberar
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                )}
              </div>
            )}

            {/* ABA 3: CHAVE PIX */}
            {adminTab === 'settings' && (
              <form onSubmit={handleSaveSettings} className="mt-6 max-w-lg space-y-4">
                <div>
                  <label className="block text-sm font-bold text-stone-700 mb-1">Chave Pix (CPF, E-mail, Celular ou Aleatória)</label>
                  <input
                    type="text"
                    value={settings.pix_key}
                    onChange={(e) => setSettings({ ...settings, pix_key: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-stone-300 focus:ring-2 focus:ring-amber-500 outline-none"
                    placeholder="Ex: joaoenathalia@email.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-stone-700 mb-1">Nome do Titular / Banco (para conferência)</label>
                  <input
                    type="text"
                    value={settings.pix_name}
                    onChange={(e) => setSettings({ ...settings, pix_name: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-stone-300 focus:ring-2 focus:ring-amber-500 outline-none"
                    placeholder="Ex: João Silva - Nubank"
                  />
                </div>
                <button
                  type="submit"
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-6 py-2.5 rounded-xl transition"
                >
                  Salvar Chave Pix
                </button>
              </form>
            )}
          </div>
        </section>
      )}

      {/* BANNER OPERAÇÃO PIX ILIMITADO */}
      <section className="max-w-6xl mx-auto px-4 mt-8">
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-3xl p-6 sm:p-8 text-white shadow-lg flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-1.5 bg-white/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3">
              <Heart className="w-3.5 h-3.5 fill-current" /> Opção Livre & Ilimitada
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold mb-2">
              Operação Pix da Casa Nova 💸✨
            </h2>
            <p className="text-emerald-50 text-sm sm:text-base leading-relaxed">
              Os itens da lista acabaram ou você prefere a praticidade de mandar qualquer valor pra gente escolher por aqui? Manda um Pix sem limite de cota!
            </p>
          </div>

          <div className="w-full lg:w-auto bg-white/15 backdrop-blur-md border border-white/25 rounded-2xl p-4 sm:p-5 flex flex-col gap-3 min-w-[290px]">
            <div className="text-xs text-emerald-100 font-medium">
              Titular: <strong className="text-white">{settings.pix_name}</strong>
            </div>
            <div className="flex items-center justify-between gap-2 bg-black/25 px-3.5 py-2.5 rounded-xl">
              <code className="text-sm font-mono truncate max-w-[210px]">{settings.pix_key}</code>
              <button
                onClick={handleCopyPix}
                className="inline-flex items-center gap-1 bg-white text-emerald-800 hover:bg-emerald-50 px-3 py-1.5 rounded-lg text-xs font-extrabold transition shrink-0"
              >
                {copiedPix ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedPix ? 'Copiado!' : 'Copiar'}
              </button>
            </div>
            <button
              onClick={() => setShowPixModal(true)}
              className="text-xs text-center text-emerald-100 hover:text-white underline font-medium"
            >
              Já mandei o Pix! Deixar um recadinho pros anfitriões →
            </button>
          </div>
        </div>
      </section>

      {/* FILTROS E BUSCA */}
      <main className="max-w-6xl mx-auto px-4 py-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-full text-sm font-bold transition ${
                  selectedCategory === cat
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'bg-white text-stone-700 hover:bg-amber-100 border border-stone-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar presente..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-full bg-white border border-stone-200 text-sm focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 rounded-full bg-white border border-stone-200 text-sm font-semibold text-stone-700 outline-none"
            >
              <option value="all">Todos ({gifts.length})</option>
              <option value="available">Disponíveis</option>
              <option value="claimed">Já escolhidos</option>
            </select>
          </div>
        </div>

        {/* GRID DE PRESENTES */}
        {loading ? (
          <div className="text-center py-20 text-stone-500 font-medium">Carregando lista de presentes...</div>
        ) : filteredGifts.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-3xl border border-stone-200">
            <p className="text-stone-500 font-medium">Nenhum presente encontrado com esse filtro.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredGifts.map((gift) => {
              const claimedCount = gift.claims?.length || 0;
              const maxQty = gift.quantity || 1;
              const remaining = maxQty - claimedCount;
              const isSoldOut = remaining <= 0;

              return (
                <div
                  key={gift.id}
                  className={`group bg-white rounded-3xl overflow-hidden border transition-all flex flex-col ${
                    isSoldOut
                      ? 'border-stone-200 opacity-75'
                      : 'border-amber-200/80 shadow-sm hover:shadow-xl hover:-translate-y-1'
                  }`}
                >
                  <div className="relative h-52 bg-stone-100 overflow-hidden">
                    <img
                      src={gift.image}
                      alt={gift.title}
                      className={`w-full h-full object-cover transition duration-500 ${
                        isSoldOut ? 'grayscale' : 'group-hover:scale-105'
                      }`}
                    />
                    <span className="absolute top-3 left-3 bg-black/65 backdrop-blur-sm text-white text-xs font-bold px-3 py-1 rounded-full">
                      {gift.category}
                    </span>

                    {maxQty > 1 && !isSoldOut && (
                      <span className="absolute top-3 right-3 bg-amber-500 text-white text-xs font-extrabold px-3 py-1 rounded-full shadow flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        Restam {remaining} de {maxQty}
                      </span>
                    )}

                    {isSoldOut && (
                      <div className="absolute inset-0 bg-stone-900/55 flex items-center justify-center">
                        <span className="bg-emerald-600 text-white px-4 py-1.5 rounded-full text-sm font-extrabold flex items-center gap-1.5 shadow-lg">
                          <CheckCircle2 className="w-4 h-4" /> Já Escolhido!
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="text-lg font-extrabold text-stone-900 mb-1.5">{gift.title}</h3>
                      <p className="text-sm text-stone-600 leading-relaxed mb-4">{gift.description}</p>
                    </div>

                    <div className="space-y-2.5 pt-3 border-t border-stone-100">
                      {gift.buy_link && (
                        <a
                          href={gift.buy_link}
                          target="_blank"
                          rel="noreferrer"
                          className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 py-2 px-3 rounded-xl transition"
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> Ver sugestão de compra
                        </a>
                      )}

                      <button
                        disabled={isSoldOut}
                        onClick={() => setActiveGift(gift)}
                        className={`w-full py-3 px-4 rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 transition ${
                          isSoldOut
                            ? 'bg-stone-200 text-stone-500 cursor-not-allowed'
                            : 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white shadow-md'
                        }`}
                      >
                        <Gift className="w-4 h-4" />
                        {isSoldOut ? 'Presente já garantido' : 'Quero dar este presente'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* MODAL ESCOLHER PRESENTE */}
      {activeGift && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95">
            <button
              onClick={() => setActiveGift(null)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-stone-100 text-stone-500"
            >
              <X className="w-5 h-5" />
            </button>

            <span className="text-xs font-extrabold uppercase tracking-wider text-amber-600">Confirmar Presente</span>
            <h3 className="text-2xl font-extrabold text-stone-900 mt-1 mb-2">{activeGift.title}</h3>
            <p className="text-sm text-stone-600 mb-5">{activeGift.description}</p>

            <form onSubmit={handleClaimGift} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-stone-600 mb-1">Seu Nome *</label>
                <input
                  type="text"
                  required
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Ex: tia Carla / Pedro e Ana"
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-300 focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-stone-600 mb-1">Seu E-mail (pra receber os detalhes) *</label>
                <input
                  type="email"
                  required
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  placeholder="seuemail@exemplo.com"
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-300 focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-stone-600 mb-1">Recadinho opcional</label>
                <input
                  type="text"
                  value={guestNote}
                  onChange={(e) => setGuestNote(e.target.value)}
                  placeholder="Nos vemos dia 12/12! 🎉"
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-300 focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-sm shadow-lg transition disabled:opacity-60"
              >
                {submitting ? 'Confirmando...' : 'Confirmar e Receber por E-mail'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMAÇÃO & E-MAIL */}
      {confirmationResult && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl text-center relative">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <h3 className="text-2xl font-extrabold text-stone-900 mb-2">Presente Garantido! 🎉</h3>
            <p className="text-sm text-stone-600 mb-4">
              Valeu demais, <strong>{confirmationResult.claim.name}</strong>! O item{' '}
              <strong>{confirmationResult.gift.title}</strong> já foi reservado no seu nome.
            </p>

            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-left text-xs space-y-1.5 mb-5">
              <div className="font-bold text-amber-900 flex items-center gap-1.5">
                <Mail className="w-4 h-4" />
                {confirmationResult.emailSent
                  ? `Enviamos um e-mail para ${confirmationResult.claim.email}!`
                  : `Resumo para ${confirmationResult.claim.email}:`}
              </div>
              <p className="text-stone-700"><strong>Item:</strong> {confirmationResult.gift.title}</p>
              <p className="text-stone-600">{confirmationResult.gift.description}</p>
              {confirmationResult.gift.buy_link && (
                <a
                  href={confirmationResult.gift.buy_link}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-emerald-700 font-bold underline pt-1"
                >
                  Abrir link de sugestão de compra <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            <button
              onClick={() => setConfirmationResult(null)}
              className="w-full py-3 rounded-xl bg-stone-900 text-white font-bold text-sm hover:bg-stone-800 transition"
            >
              Voltar para a lista
            </button>
          </div>
        </div>
      )}

      {/* MODAL RECADO PIX */}
      {showPixModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setShowPixModal(false)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-stone-100 text-stone-500"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-extrabold text-stone-900 mb-1">Valeu pelo Pix! 🥂</h3>
            <p className="text-sm text-stone-600 mb-4">Deixe seu nome pra gente saber quem mandou e agradecer na festa.</p>

            {pixSentSuccess ? (
              <div className="py-8 text-center text-emerald-600 font-bold">
                Recadinho registrado! Muito obrigado! ❤️
              </div>
            ) : (
              <form onSubmit={handleSavePixMessage} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-stone-600 mb-1">Seu Nome *</label>
                  <input
                    type="text"
                    required
                    value={pixSenderName}
                    onChange={(e) => setPixSenderName(e.target.value)}
                    placeholder="Seu nome"
                    className="w-full px-4 py-2.5 rounded-xl border border-stone-300 outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-stone-600 mb-1">Mensagem (opcional)</label>
                  <input
                    type="text"
                    value={pixSenderMessage}
                    onChange={(e) => setPixSenderMessage(e.target.value)}
                    placeholder="Pra ajudar no churrasco da casa nova!"
                    className="w-full px-4 py-2.5 rounded-xl border border-stone-300 outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" /> Enviar Aviso
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL LOGIN ADMIN */}
      {showAdminLogin && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setShowAdminLogin(false)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-stone-100 text-stone-500"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-extrabold text-stone-900 mb-1">Área dos Anfitriões</h3>
            <p className="text-xs text-stone-500 mb-4">Digite a senha para editar links, itens e desmarcar presentes.</p>
            <form onSubmit={handleAdminLogin} className="space-y-3">
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Senha"
                className="w-full px-4 py-2.5 rounded-xl border border-stone-300 outline-none focus:ring-2 focus:ring-amber-500"
                autoFocus
              />
              {passwordError && (
                <p className="text-xs text-rose-600 font-semibold flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> {passwordError}
                </p>
              )}
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm"
              >
                Entrar
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDITAR / CRIAR PRESENTE NO ADMIN */}
      {editingGift && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setEditingGift(null)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-stone-100 text-stone-500"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-extrabold text-stone-900 mb-4">
              {editingGift.id ? 'Editar Presente' : 'Novo Presente'}
            </h3>
            <form onSubmit={handleSaveGiftForm} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-stone-600 mb-1">Nome do Item *</label>
                <input
                  type="text"
                  required
                  value={editingGift.title}
                  onChange={(e) => setEditingGift({ ...editingGift, title: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl border border-stone-300 outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-stone-600 mb-1">Categoria</label>
                  <select
                    value={editingGift.category}
                    onChange={(e) => setEditingGift({ ...editingGift, category: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 outline-none"
                  >
                    {CATEGORIES.filter((c) => c !== 'Todos').map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-stone-600 mb-1">Quantidade</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={editingGift.quantity || 1}
                    onChange={(e) => setEditingGift({ ...editingGift, quantity: Number(e.target.value) })}
                    className="w-full px-4 py-2 rounded-xl border border-stone-300 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-stone-600 mb-1">Descrição / Observações</label>
                <textarea
                  rows="3"
                  value={editingGift.description}
                  onChange={(e) => setEditingGift({ ...editingGift, description: e.target.value })}
                  className="w-full px-4 py-2 rounded-xl border border-stone-300 outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-stone-600 mb-1">Link de Sugestão de Compra (Amazon, Mercado Livre, Shopee...)</label>
                <input
                  type="url"
                  value={editingGift.buy_link || ''}
                  onChange={(e) => setEditingGift({ ...editingGift, buy_link: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-4 py-2 rounded-xl border border-stone-300 outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-stone-600 mb-1">URL da Imagem</label>
                <input
                  type="url"
                  value={editingGift.image || ''}
                  onChange={(e) => setEditingGift({ ...editingGift, image: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-4 py-2 rounded-xl border border-stone-300 outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-sm"
              >
                Salvar Alterações
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
