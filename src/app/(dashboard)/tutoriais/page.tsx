'use client';

import { useState, useMemo } from 'react';
import {
  Play,
  Search,
  Clock,
  X,
  Youtube,
  Sparkles,
  BookOpen,
  MonitorPlay,
  PlayCircle,
  HelpCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Tutorial {
  id: string;
  marketplace: 'mercadolivre' | 'amazon' | 'kabum' | 'shopee';
  title: string;
  description: string;
  duration: string;
  level: 'Iniciante' | 'Intermediário' | 'Avançado';
  youtubeId: string | null;
}

// Lista de tutoriais com os IDs do YouTube
const TUTORIALS_DATA: Tutorial[] = [
  {
    id: 'mercadolivre',
    marketplace: 'mercadolivre',
    title: 'Integração Completa do Mercado Livre',
    description: 'Aprenda a conectar sua conta do Mercado Livre, configurar o cookie de sessão do painel de afiliados e ativar a busca automatizada de ofertas.',
    duration: '6 min',
    level: 'Iniciante',
    youtubeId: 'QpEqpbm7xuk',
  },
  {
    id: 'amazon',
    marketplace: 'amazon',
    title: 'Configurando Tag de Afiliado da Amazon BR',
    description: 'Como obter sua tag de associado Amazon, extrair os cookies SiteStripe necessários para converter links automaticamente de forma confiável.',
    duration: '8 min',
    level: 'Iniciante',
    youtubeId: '7wPgUmsv2iY',
  },
  {
    id: 'kabum',
    marketplace: 'kabum',
    title: 'Rastreamento com Publisher ID KaBuM!',
    description: 'Guia definitivo para obter seu ID de afiliado KaBuM! dentro da rede Awin e vinculá-lo ao painel para monitorar cliques e comissões.',
    duration: '4 min',
    level: 'Iniciante',
    youtubeId: '36ynuDMMmwY',
  },
  {
    id: 'shopee',
    marketplace: 'shopee',
    title: 'Integração de API de Afiliados Shopee',
    description: 'Passo a passo para gerar suas chaves de API (AppID e Secret Key) no console de desenvolvedor da Shopee para sincronização em tempo real.',
    duration: '9 min',
    level: 'Intermediário',
    youtubeId: 'QFV_u9Ng-lA',
  },
];

const MARKETPLACE_META = {
  mercadolivre: {
    label: 'Mercado Livre',
    logo: 'https://udlmqdwtisolgutzdylw.supabase.co/storage/v1/object/public/imagens/mercadolivre.png',
    color: 'from-amber-400 to-yellow-500',
    hoverBorder: 'hover:border-amber-450 dark:hover:border-yellow-500/50',
    shadow: 'shadow-[0_0_20px_-5px_rgba(245,158,11,0.15)] hover:shadow-[0_0_25px_0px_rgba(245,158,11,0.25)]',
    accent: 'text-amber-500 dark:text-yellow-450',
    bulletColor: '#f59e0b',
    gradientBg: 'from-amber-500/20 via-yellow-600/10 to-transparent',
  },
  amazon: {
    label: 'Amazon BR',
    logo: 'https://udlmqdwtisolgutzdylw.supabase.co/storage/v1/object/public/imagens/amazon.png',
    color: 'from-orange-400 to-orange-600',
    hoverBorder: 'hover:border-orange-500 dark:hover:border-orange-500/50',
    shadow: 'shadow-[0_0_20px_-5px_rgba(249,115,22,0.15)] hover:shadow-[0_0_25px_0px_rgba(249,115,22,0.25)]',
    accent: 'text-orange-500 dark:text-orange-400',
    bulletColor: '#ff5a00',
    gradientBg: 'from-orange-500/20 via-orange-600/10 to-transparent',
  },
  kabum: {
    label: 'KaBuM!',
    logo: 'https://udlmqdwtisolgutzdylw.supabase.co/storage/v1/object/public/imagens/kabum_logo.jfif',
    color: 'from-blue-400 to-indigo-600',
    hoverBorder: 'hover:border-blue-500 dark:hover:border-blue-500/50',
    shadow: 'shadow-[0_0_20px_-5px_rgba(59,130,246,0.15)] hover:shadow-[0_0_25px_0px_rgba(59,130,246,0.25)]',
    accent: 'text-blue-500 dark:text-blue-400',
    bulletColor: '#3b82f6',
    gradientBg: 'from-blue-500/20 via-indigo-600/10 to-transparent',
  },
  shopee: {
    label: 'Shopee',
    logo: 'https://udlmqdwtisolgutzdylw.supabase.co/storage/v1/object/public/imagens/shopee.png',
    color: 'from-rose-500 to-red-655',
    hoverBorder: 'hover:border-rose-500 dark:hover:border-rose-500/50',
    shadow: 'shadow-[0_0_20px_-5px_rgba(244,63,94,0.15)] hover:shadow-[0_0_25px_0px_rgba(244,63,94,0.25)]',
    accent: 'text-rose-500 dark:text-rose-455',
    bulletColor: '#ef4444',
    gradientBg: 'from-rose-500/20 via-red-600/10 to-transparent',
  },
} as const;

type CategoryFilter = 'all' | 'mercadolivre' | 'amazon' | 'kabum' | 'shopee';

export default function TutoriaisPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('all');
  const [selectedTutorial, setSelectedTutorial] = useState<Tutorial | null>(null);

  // Filtragem dos tutoriais
  const filteredTutorials = useMemo(() => {
    return TUTORIALS_DATA.filter((tutorial) => {
      const matchesSearch =
        tutorial.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tutorial.description.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory =
        selectedCategory === 'all' || tutorial.marketplace === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, selectedCategory]);

  return (
    <div className="space-y-5 md:space-y-6 max-w-5xl px-1 py-1 md:px-2 md:py-2">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="flex h-1.5 w-1.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-500"></span>
            </span>
            <span className="text-[9px] sm:text-[10px] font-bold text-indigo-500 uppercase tracking-widest">Base de Conhecimento</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white tracking-tight flex items-center gap-2">
            <MonitorPlay className="h-6 w-6 sm:h-7 sm:w-7 text-indigo-500" />
            Central de Tutoriais
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1 sm:mt-2 max-w-2xl leading-relaxed">
            Aprenda a configurar e integrar seus marketplaces preferidos. Siga os tutoriais passo a passo para automatizar o envio de ofertas nos seus canais.
          </p>
        </div>
      </div>

      {/* Busca e Abas (Responsivo Elaborado) */}
      <div className="flex flex-col gap-4 sm:gap-3 bg-card dark:bg-zinc-900/30 dark:backdrop-blur-md p-3 sm:p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800/60 shadow-sm transition-all duration-300">
        
        {/* Abas com Scroll Lateral no Celular */}
        <div className="flex flex-col gap-2.5">
          <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block sm:hidden">Filtrar Canal</span>
          <div className="overflow-x-auto -mx-3 px-3 pb-1.5 sm:pb-0 sm:mx-0 sm:px-0 flex gap-1.5 flex-nowrap sm:flex-wrap scrollbar-none select-none">
            <button
              onClick={() => setSelectedCategory('all')}
              className={cn(
                'px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 border shrink-0 cursor-pointer',
                selectedCategory === 'all'
                  ? 'bg-indigo-600/10 dark:bg-indigo-500/10 text-indigo-650 dark:text-indigo-400 border-indigo-500/30'
                  : 'text-zinc-500 border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-950/40 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/40'
              )}
            >
              Todos os Vídeos
            </button>
            {(Object.keys(MARKETPLACE_META) as Array<keyof typeof MARKETPLACE_META>).map((key) => {
              const meta = MARKETPLACE_META[key];
              const isActive = selectedCategory === key;
              return (
                <button
                  key={key}
                  onClick={() => setSelectedCategory(key)}
                  className={cn(
                    'px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 border flex items-center gap-2 shrink-0 cursor-pointer',
                    isActive
                      ? 'bg-indigo-600/10 dark:bg-indigo-500/10 text-indigo-650 dark:text-indigo-400 border-indigo-500/30'
                      : 'text-zinc-500 border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-950/40 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/40'
                  )}
                >
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: meta.bulletColor }} />
                  {meta.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Input de Busca com largura total no celular */}
        <div className="relative w-full sm:w-64 sm:ml-auto">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400 dark:text-zinc-550" />
          <input
            type="text"
            placeholder="Pesquisar tutorial..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-inner"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-white transition-colors p-1"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Grid de Tutoriais (1 col no celular, 2 cols em tablets/desktops) */}
      {filteredTutorials.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4 sm:gap-6">
          {filteredTutorials.map((tutorial) => {
            const meta = MARKETPLACE_META[tutorial.marketplace];
            const hasVideo = !!tutorial.youtubeId;

            return (
              <div
                key={tutorial.id}
                className={cn(
                  'group relative flex flex-col rounded-2xl bg-card dark:bg-zinc-900/40 dark:backdrop-blur-xl border border-zinc-200 dark:border-zinc-800/80 transition-all duration-300 overflow-hidden',
                  meta.hoverBorder,
                  meta.shadow
                )}
              >
                {/* Capa do Vídeo estilizada com gradiente e logo */}
                <div className="aspect-video relative overflow-hidden bg-zinc-100 dark:bg-zinc-950 flex items-center justify-center border-b border-zinc-200 dark:border-zinc-800/60 select-none">
                  {/* Fundo de Gradiente Suave */}
                  <div className={cn('absolute inset-0 bg-gradient-to-tr opacity-25 dark:opacity-40 transition-opacity duration-300 group-hover:opacity-35 dark:group-hover:opacity-50', meta.gradientBg)} />
                  <div className="absolute inset-0 bg-radial-to-t from-black/20 via-transparent to-transparent" />

                  {/* Logo do Marketplace no centro da capa */}
                  <div className="flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-2xl bg-white shadow-xl ring-1 ring-zinc-200 dark:ring-white/10 p-2.5 sm:p-3.5 transform transition-all duration-500 group-hover:scale-105 group-hover:-translate-y-1">
                    <img
                      src={meta.logo}
                      alt={meta.label}
                      className={cn(
                        'w-full h-full',
                        tutorial.marketplace === 'mercadolivre' ? 'object-cover' : 'object-contain'
                      )}
                    />
                  </div>

                  {/* Badges de Duração e Nível */}
                  <div className="absolute bottom-2.5 left-2.5 sm:bottom-3 sm:left-3 flex gap-1.5 sm:gap-2">
                    <span className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-bold text-white bg-black/75 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg backdrop-blur-xs ring-1 ring-white/10">
                      <Clock className="h-3 w-3" />
                      {tutorial.duration}
                    </span>
                    <span className={cn(
                      "inline-flex items-center text-[9px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg ring-1 ring-white/10",
                      tutorial.level === 'Iniciante' 
                        ? 'bg-emerald-500/80 text-white' 
                        : 'bg-indigo-500/80 text-white'
                    )}>
                      {tutorial.level}
                    </span>
                  </div>

                  {/* Badge de Disponibilidade */}
                  <div className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3">
                    {hasVideo ? (
                      <span className="inline-flex items-center gap-1 text-[8px] sm:text-[9px] font-bold uppercase tracking-wider bg-indigo-600/90 dark:bg-indigo-500/90 text-white px-2 py-1 rounded-lg shadow-sm">
                        Vídeo Ativo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[8px] sm:text-[9px] font-bold uppercase tracking-wider bg-zinc-650/90 dark:bg-zinc-800/90 text-white dark:text-zinc-300 px-2 py-1 rounded-lg shadow-sm">
                        Em breve
                      </span>
                    )}
                  </div>

                  {/* Botão de Play Translúcido no Centro */}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-white/20 dark:bg-black/40 backdrop-blur-sm border border-white/30 flex items-center justify-center transform scale-90 group-hover:scale-100 transition-transform duration-300 shadow-2xl">
                      <Play className="h-5 w-5 sm:h-6 sm:w-6 text-white fill-white translate-x-0.5" />
                    </div>
                  </div>
                </div>

                {/* Conteúdo do Card */}
                <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
                  <div className="space-y-1.5 sm:space-y-2">
                    <div className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: meta.bulletColor }} />
                      <span className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">{meta.label}</span>
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white tracking-tight leading-snug group-hover:text-indigo-650 dark:group-hover:text-indigo-400 transition-colors">
                      {tutorial.title}
                    </h3>
                    <p className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed font-medium">
                      {tutorial.description}
                    </p>
                  </div>

                  {/* Botão de Ação */}
                  <div className="pt-4 sm:pt-5 mt-auto">
                    <Button
                      onClick={() => setSelectedTutorial(tutorial)}
                      className={cn(
                        'w-full rounded-xl font-bold transition-all duration-300 text-xs shadow-sm py-4.5 sm:py-5 cursor-pointer',
                        hasVideo
                          ? 'bg-indigo-650 hover:bg-indigo-500 text-white shadow-indigo-650/10 hover:shadow-lg'
                          : 'bg-zinc-100 dark:bg-zinc-900/60 border border-zinc-250 dark:border-zinc-800 text-zinc-650 dark:text-zinc-350 hover:bg-zinc-200 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-white'
                      )}
                    >
                      {hasVideo ? (
                        <>
                          <PlayCircle className="h-4 w-4 mr-2" />
                          Assistir Tutorial
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-2 text-zinc-450 dark:text-zinc-400 animate-pulse" />
                          Vídeo em Produção (Em Breve)
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Estado Vazio */
        <div className="flex flex-col items-center justify-center p-8 sm:p-12 bg-card dark:bg-zinc-900/20 rounded-2xl border border-zinc-200 dark:border-zinc-800/60 text-center space-y-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            <HelpCircle className="h-5 w-5 text-zinc-400" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white">Nenhum tutorial encontrado</h3>
            <p className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-500 mt-1 max-w-xs leading-relaxed">
              Tente redefinir seus filtros ou pesquise por outros termos.
            </p>
          </div>
          <Button
            variant="outline"
            className="rounded-xl text-xs font-semibold cursor-pointer"
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('all');
            }}
          >
            Limpar Filtros
          </Button>
        </div>
      )}

      {/* Modal / Lightbox de Vídeo (Otimizado para Touch e Celular) */}
      {selectedTutorial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
          {/* Overlay de fundo */}
          <div
            className="absolute inset-0 bg-black/90 backdrop-blur-md transition-opacity duration-300"
            onClick={() => setSelectedTutorial(null)}
          />

          {/* Container do Modal */}
          <div className="relative w-full max-w-3xl rounded-2xl sm:rounded-3xl border border-zinc-250 dark:border-zinc-800/80 bg-zinc-50 dark:bg-zinc-950 p-4 sm:p-6 shadow-2xl scale-100 transition-all duration-300 z-10 flex flex-col max-h-[92vh]">
            
            {/* Header do Modal */}
            <div className="flex items-start justify-between pb-3.5 border-b border-zinc-200 dark:border-zinc-800/60 mb-3.5 shrink-0 gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-zinc-200 dark:ring-white/10 p-1.5 shrink-0">
                  <img
                    src={MARKETPLACE_META[selectedTutorial.marketplace].logo}
                    alt={selectedTutorial.marketplace}
                    className="h-full w-full object-contain"
                  />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm sm:text-lg font-bold text-zinc-900 dark:text-white leading-tight tracking-tight truncate">
                    {selectedTutorial.title}
                  </h2>
                  <p className="text-[9px] sm:text-[10px] font-bold text-indigo-500 uppercase tracking-wider mt-0.5">
                    Tutorial {MARKETPLACE_META[selectedTutorial.marketplace].label} • {selectedTutorial.duration}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedTutorial(null)}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-white transition-colors bg-zinc-200/50 dark:bg-zinc-800/50 hover:bg-zinc-250 dark:hover:bg-zinc-700/50 p-2 rounded-xl shrink-0 cursor-pointer focus:outline-none"
                title="Fechar"
              >
                <X className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
              </button>
            </div>

            {/* Corpo do Modal - Player de Vídeo ou Notificação de "Em Breve" */}
            <div className="flex-1 overflow-y-auto min-h-0 flex flex-col justify-center">
              {selectedTutorial.youtubeId ? (
                /* Player do YouTube Responsivo */
                <div className="aspect-video w-full rounded-xl sm:rounded-2xl overflow-hidden bg-black ring-1 ring-white/10 shadow-inner">
                  <iframe
                    src={`https://www.youtube.com/embed/${selectedTutorial.youtubeId}?autoplay=1&rel=0`}
                    title={selectedTutorial.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="w-full h-full border-0"
                  />
                </div>
              ) : (
                /* Tela elegante de "Em produção" */
                <div className="py-8 sm:py-10 text-center flex flex-col items-center justify-center space-y-4 sm:space-y-5 px-3 sm:px-4 bg-zinc-100 dark:bg-zinc-900/25 border border-zinc-250 dark:border-zinc-800/40 rounded-xl sm:rounded-2xl">
                  <div className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 shadow-sm animate-pulse">
                    <Youtube className="h-7 w-7 sm:h-8 sm:w-8 text-indigo-500 fill-indigo-500/20" />
                  </div>
                  <div className="space-y-1.5 sm:space-y-2 max-w-md mx-auto">
                    <h3 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-white tracking-tight">Vídeo em Produção</h3>
                    <p className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed font-medium">
                      O tutorial detalhado para a integração do <strong className="text-zinc-800 dark:text-white">{MARKETPLACE_META[selectedTutorial.marketplace].label}</strong> está sendo gravado e editado. 
                    </p>
                    <p className="text-[11px] sm:text-xs text-indigo-650 dark:text-indigo-400 font-semibold bg-indigo-500/5 dark:bg-indigo-500/10 py-1.5 px-3 rounded-lg w-max mx-auto border border-indigo-500/10 mt-1">
                      O link oficial será adicionado aqui automaticamente!
                    </p>
                  </div>
                  <div className="pt-2">
                    <Button
                      variant="outline"
                      className="rounded-xl text-xs font-semibold px-5 cursor-pointer"
                      onClick={() => setSelectedTutorial(null)}
                    >
                      Entendi, aguardar
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer do Modal */}
            <div className="mt-3.5 pt-3.5 border-t border-zinc-200 dark:border-zinc-800/60 flex items-center justify-between text-[10px] sm:text-[11px] text-zinc-400 dark:text-zinc-555 shrink-0">
              <span className="flex items-center gap-1 sm:gap-1.5 font-medium">
                <BookOpen className="h-3.5 w-3.5" /> Dificuldade: <strong className="text-zinc-700 dark:text-zinc-300">{selectedTutorial.level}</strong>
              </span>
              <span>DisparaZap Base de Tutoriais v1.0</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
