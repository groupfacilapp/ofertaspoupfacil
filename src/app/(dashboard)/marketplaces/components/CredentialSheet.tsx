'use client';

import { useState, useTransition, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Loader2, ShieldCheck, ExternalLink, ChevronDown, ChevronUp, X } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { saveAndValidateCredentials, getMarketplaceCredentials } from '../actions';

interface CredentialSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  marketplace: 'amazon' | 'mercadolivre' | 'shopee' | 'aliexpress' | 'kabum' | 'temu' | 'shein';
}

const fieldClass =
  'bg-zinc-50 dark:bg-zinc-800/60 border-zinc-300 dark:border-zinc-700/60 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus-visible:ring-0 focus-visible:border-zinc-500 transition-colors';

const labelClass = 'text-xs font-medium text-zinc-400 uppercase tracking-wide';

function FieldGroup({ children }: { children: React.ReactNode }) {
  return <div className="space-y-1.5">{children}</div>;
}

function HintText({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-zinc-600 leading-relaxed">{children}</p>;
}

function AmazonFields({
  values,
  onChange,
}: {
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  return (
    <>
      <FieldGroup>
        <div className="flex items-center justify-between">
          <Label htmlFor="tag" className={labelClass}>
            Tag de afiliado <span className="text-orange-400">*</span>
          </Label>
          <a
            href="https://associados.amazon.com.br"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[10px] text-zinc-600 hover:text-orange-400 transition-colors"
          >
            Abrir painel <ExternalLink className="h-2.5 w-2.5" />
          </a>
        </div>
        <Input
          id="tag"
          placeholder="ex: poupofertas-20"
          value={values.tag ?? ''}
          onChange={(e) => onChange('tag', e.target.value)}
          className={fieldClass}
          required
        />
        <CollapsibleGuide title="Onde encontrar minha tag?">
          <GuideStep n={1}>
            Acesse{' '}
            <a href="https://associados.amazon.com.br" target="_blank" rel="noopener noreferrer" className="text-orange-400/80 hover:text-orange-400 underline">
              associados.amazon.com.br
            </a>{' '}
            e faça login
          </GuideStep>
          <GuideStep n={2}>
            No topo da página você verá sua tag — ex:{' '}
            <span className="font-mono text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-1 rounded">seunome-20</span>
          </GuideStep>
          <GuideStep n={3}>
            Se não tiver conta, clique em <span className="text-zinc-300 font-medium">Criar conta</span> e siga o processo de aprovação da Amazon
          </GuideStep>
        </CollapsibleGuide>
      </FieldGroup>
      <FieldGroup>
        <Label htmlFor="cookies" className={labelClass}>
          Cookies do SiteStripe{' '}
          <span className="text-zinc-600 normal-case tracking-normal">(opcional)</span>
        </Label>
        <div className="relative">
          <Textarea
            id="cookies"
            placeholder="Cole aqui o JSON exportado pelo Cookie-Editor (pode ser grande — cole tudo)"
            value={values.cookies ?? ''}
            onChange={(e) => onChange('cookies', e.target.value)}
            rows={6}
            className={`${fieldClass} font-mono text-[11px] resize-y min-h-[120px] max-h-[320px] pr-8`}
          />
          {values.cookies && (
            <button
              type="button"
              onClick={() => onChange('cookies', '')}
              className="absolute top-2 right-2 rounded p-0.5 text-zinc-600 hover:text-zinc-400 transition-colors"
              title="Limpar cookies"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {values.cookies && (
          <p className="text-[10px] text-zinc-600">
            {(new Blob([values.cookies]).size / 1024).toFixed(1)} KB colados
            {values.cookies.trimStart().startsWith('[') ? ' · JSON ✓' : ' · string de texto'}
          </p>
        )}
        <CollapsibleGuide title="Como exportar os cookies?">
          <GuideStep n={1}>
            Instale a extensão{' '}
            <a href="https://chromewebstore.google.com/detail/cookie-editor/hlkenndednhfkekhgcdicdfddnkalmdm" target="_blank" rel="noopener noreferrer" className="text-orange-400/80 hover:text-orange-400 underline">
              Cookie-Editor
            </a>{' '}
            no Chrome
          </GuideStep>
          <GuideStep n={2}>
            Acesse{' '}
            <a href="https://associados.amazon.com.br" target="_blank" rel="noopener noreferrer" className="text-orange-400/80 hover:text-orange-400 underline">
              associados.amazon.com.br
            </a>{' '}
            logado na sua conta
          </GuideStep>
          <GuideStep n={3}>
            Clique no ícone do Cookie-Editor → <span className="text-zinc-300 font-medium">Export</span> → <span className="text-zinc-300 font-medium">Export as JSON</span>
          </GuideStep>
          <GuideStep n={4}>
            Cole o JSON exportado no campo acima
          </GuideStep>
        </CollapsibleGuide>
        <HintText>
          Sem cookies: links usam <code className="text-zinc-500">?tag=</code> simples. Com cookies:
          links encurtados via SiteStripe (mais profissional).
        </HintText>
      </FieldGroup>
    </>
  );
}

function GuideStep({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-2.5">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-[10px] font-bold text-zinc-500 dark:text-zinc-400 mt-0.5">
        {n}
      </span>
      <p className="text-xs text-zinc-500 leading-relaxed">{children}</p>
    </div>
  );
}

function CollapsibleGuide({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800/60 bg-zinc-50 dark:bg-zinc-900/40 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3.5 py-2.5 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
      >
        <span>{title}</span>
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>
      {open && (
        <div className="px-3.5 pb-3.5 space-y-2 border-t border-zinc-200 dark:border-zinc-800/60 pt-3">
          {children}
        </div>
      )}
    </div>
  );
}

function MercadoLivreFields({
  values,
  onChange,
}: {
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  return (
    <>
      <FieldGroup>
        <div className="flex items-center justify-between">
          <Label htmlFor="tag_afiliado" className={labelClass}>
            Tag de afiliado <span className="text-yellow-400">*</span>
          </Label>
          <a
            href="https://www.mercadolivre.com.br/afiliados/perfil"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[10px] text-zinc-600 hover:text-yellow-400 transition-colors"
          >
            Abrir perfil <ExternalLink className="h-2.5 w-2.5" />
          </a>
        </div>
        <Input
          id="tag_afiliado"
          placeholder="ex: SEUNOME1998"
          value={values.tag_afiliado ?? ''}
          onChange={(e) => onChange('tag_afiliado', e.target.value)}
          className={fieldClass}
          required
        />
        <CollapsibleGuide title="Onde encontrar minha tag?">
          <GuideStep n={1}>
            Acesse{' '}
            <a
              href="https://www.mercadolivre.com.br/afiliados/perfil"
              target="_blank"
              rel="noopener noreferrer"
              className="text-yellow-400/80 hover:text-yellow-400 underline"
            >
              mercadolivre.com.br/afiliados/perfil
            </a>
          </GuideStep>
          <GuideStep n={2}>
            Sua tag é o nome em destaque no topo da página — em maiúsculas, ex:{' '}
            <span className="font-mono text-zinc-300 bg-zinc-800 px-1 rounded">SEUNOME1998</span>
          </GuideStep>
          <GuideStep n={3}>
            Cole esse valor exatamente como aparece (respeitando maiúsculas)
          </GuideStep>
        </CollapsibleGuide>
      </FieldGroup>

      <FieldGroup>
        <Label htmlFor="cookie_session" className={labelClass}>
          Cookie de sessão <span className="text-yellow-400">*</span>
        </Label>
        <Textarea
          id="cookie_session"
          placeholder="Cole aqui o valor do cookie &quot;MELI_SESSION&quot; ou a string completa..."
          value={values.cookie_session ?? ''}
          onChange={(e) => onChange('cookie_session', e.target.value)}
          rows={3}
          className={`${fieldClass} font-mono text-xs resize-none`}
        />
        <CollapsibleGuide title="Como exportar o cookie?">
          <GuideStep n={1}>
            Instale a extensão{' '}
            <a
              href="https://chromewebstore.google.com/detail/cookie-editor/hlkenndednhfkekhgcdicdfddnkalmdm"
              target="_blank"
              rel="noopener noreferrer"
              className="text-yellow-400/80 hover:text-yellow-400 underline"
            >
              Cookie-Editor
            </a>{' '}
            no Chrome
          </GuideStep>
          <GuideStep n={2}>
            Acesse{' '}
            <a
              href="https://www.mercadolivre.com.br/afiliados/hub"
              target="_blank"
              rel="noopener noreferrer"
              className="text-yellow-400/80 hover:text-yellow-400 underline"
            >
              mercadolivre.com.br/afiliados/hub
            </a>{' '}
            e faça login
          </GuideStep>
          <GuideStep n={3}>
            Clique no ícone do Cookie-Editor → botão{' '}
            <span className="text-zinc-300 font-medium">Export</span> (canto inferior direito) →{' '}
            <span className="text-zinc-300 font-medium">Export as JSON</span>
          </GuideStep>
          <GuideStep n={4}>
            Cole o JSON exportado no campo acima
          </GuideStep>
        </CollapsibleGuide>
        <HintText>
          Usado para gerar links rastreados. Cookies expiram periodicamente — atualize se os links pararem de funcionar.
        </HintText>
      </FieldGroup>
    </>
  );
}

function ShopeeFields({
  values,
  onChange,
}: {
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  return (
    <>
      <FieldGroup>
        <div className="flex items-center justify-between">
          <Label htmlFor="app_id" className={labelClass}>
            AppID <span className="text-red-400">*</span>
          </Label>
          <a
            href="https://affiliate.shopee.com.br"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[10px] text-zinc-600 hover:text-red-400 transition-colors"
          >
            Abrir painel <ExternalLink className="h-2.5 w-2.5" />
          </a>
        </div>
        <Input
          id="app_id"
          placeholder="ex: 1234567890"
          value={values.app_id ?? ''}
          onChange={(e) => onChange('app_id', e.target.value)}
          className={fieldClass}
          required
        />
        <CollapsibleGuide title="Onde encontrar meu AppID e Secret?">
          <GuideStep n={1}>
            Acesse{' '}
            <a href="https://affiliate.shopee.com.br" target="_blank" rel="noopener noreferrer" className="text-red-400/80 hover:text-red-400 underline">
              affiliate.shopee.com.br
            </a>{' '}
            e faça login com sua conta de afiliado
          </GuideStep>
          <GuideStep n={2}>
            Se ainda não tem conta, clique em <span className="text-zinc-300 font-medium">Registrar</span> e aguarde a aprovação da Shopee (geralmente 1-2 dias úteis)
          </GuideStep>
          <GuideStep n={3}>
            Após aprovação, vá em <span className="text-zinc-300 font-medium">Ferramentas</span> → <span className="text-zinc-300 font-medium">API</span>
          </GuideStep>
          <GuideStep n={4}>
            Clique em <span className="text-zinc-300 font-medium">Criar App</span> (ou selecione um app existente)
          </GuideStep>
          <GuideStep n={5}>
            O <span className="text-zinc-300 font-medium">App ID</span> e o <span className="text-zinc-300 font-medium">Secret Key</span> aparecem nos detalhes do app — copie os dois
          </GuideStep>
        </CollapsibleGuide>
      </FieldGroup>
      <FieldGroup>
        <Label htmlFor="secret" className={labelClass}>
          Secret <span className="text-red-400">*</span>
        </Label>
        <Input
          id="secret"
          type="password"
          placeholder="Seu Secret Key da Shopee Affiliate API"
          value={values.secret ?? ''}
          onChange={(e) => onChange('secret', e.target.value)}
          className={fieldClass}
          required
        />
      </FieldGroup>
    </>
  );
}

function KabumFields({
  values,
  onChange,
}: {
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  return (
    <FieldGroup>
      <div className="flex items-center justify-between">
        <Label htmlFor="publisher_id" className={labelClass}>
          Publisher ID (Awin) <span className="text-blue-400">*</span>
        </Label>
        <a
          href="https://www.awin.com/br"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[10px] text-zinc-600 hover:text-blue-400 transition-colors"
        >
          Abrir Awin <ExternalLink className="h-2.5 w-2.5" />
        </a>
      </div>
      <Input
        id="publisher_id"
        placeholder="ex: 123456"
        value={values.publisher_id ?? ''}
        onChange={(e) => onChange('publisher_id', e.target.value)}
        className={fieldClass}
        required
      />
      <CollapsibleGuide title="Como obter meu Publisher ID?">
        <GuideStep n={1}>
          Acesse{' '}
          <a
            href="https://www.awin.com/br"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400/80 hover:text-blue-400 underline"
          >
            awin.com/br
          </a>{' '}
          e crie uma conta de afiliado (Publisher)
        </GuideStep>
        <GuideStep n={2}>
          Após aprovação, acesse{' '}
          <span className="text-zinc-300 font-medium">Account → Publisher Overview</span>
        </GuideStep>
        <GuideStep n={3}>
          Seu <span className="text-zinc-300 font-medium">Publisher ID</span> aparece no topo da página — é um número, ex:{' '}
          <span className="font-mono text-zinc-300 bg-zinc-800 px-1 rounded">123456</span>
        </GuideStep>
        <GuideStep n={4}>
          No painel Awin, pesquise por <span className="text-zinc-300 font-medium">KaBuM</span> em{' '}
          <span className="text-zinc-300 font-medium">Advertisers</span> e solicite aprovação (awinmid: 17729)
        </GuideStep>
      </CollapsibleGuide>
      <HintText>
        Sem necessidade de cookies — o link de afiliado é gerado via Awin usando apenas o seu Publisher ID.
      </HintText>
    </FieldGroup>
  );
}

function AliExpressFields({
  values,
  onChange,
}: {
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  return (
    <>
      <FieldGroup>
        <div className="flex items-center justify-between">
          <Label htmlFor="api_key" className={labelClass}>
            App Key <span className="text-rose-400">*</span>
          </Label>
          <a
            href="https://portals.aliexpress.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[10px] text-zinc-600 hover:text-rose-400 transition-colors"
          >
            Abrir painel <ExternalLink className="h-2.5 w-2.5" />
          </a>
        </div>
        <Input
          id="api_key"
          placeholder="ex: 123456"
          value={values.api_key ?? ''}
          onChange={(e) => onChange('api_key', e.target.value)}
          className={fieldClass}
          required
        />
        <CollapsibleGuide title="Onde encontrar meu App Key e Secret?">
          <GuideStep n={1}>
            Acesse{' '}
            <a href="https://portals.aliexpress.com" target="_blank" rel="noopener noreferrer" className="text-rose-400/80 hover:text-rose-400 underline">
              portals.aliexpress.com
            </a>{' '}
            e faça login com sua conta AliExpress
          </GuideStep>
          <GuideStep n={2}>
            Se ainda não tem conta de afiliado, clique em <span className="text-zinc-300 font-medium">Join Now</span> e preencha o cadastro
          </GuideStep>
          <GuideStep n={3}>
            No painel, vá em <span className="text-zinc-300 font-medium">Tools</span> → <span className="text-zinc-300 font-medium">Open Platform API</span>
          </GuideStep>
          <GuideStep n={4}>
            Seu <span className="text-zinc-300 font-medium">App Key</span> e <span className="text-zinc-300 font-medium">App Secret</span> aparecem na tela principal — o Secret pode precisar de um clique em "Show"
          </GuideStep>
        </CollapsibleGuide>
      </FieldGroup>
      <FieldGroup>
        <Label htmlFor="app_secret" className={labelClass}>
          App Secret <span className="text-rose-400">*</span>
        </Label>
        <Input
          id="app_secret"
          type="password"
          placeholder="Seu App Secret da AliExpress Open Platform"
          value={values.app_secret ?? ''}
          onChange={(e) => onChange('app_secret', e.target.value)}
          className={fieldClass}
          required
        />
      </FieldGroup>
      <FieldGroup>
        <Label htmlFor="tracking_id" className={labelClass}>
          TrackingID <span className="text-rose-400">*</span>
        </Label>
        <Input
          id="tracking_id"
          placeholder="ex: default"
          value={values.tracking_id ?? ''}
          onChange={(e) => onChange('tracking_id', e.target.value)}
          className={fieldClass}
          required
        />
        <CollapsibleGuide title="Onde encontrar meu TrackingID?">
          <GuideStep n={1}>
            No painel do Portals, vá em <span className="text-zinc-300 font-medium">Promotions</span> → <span className="text-zinc-300 font-medium">Tracking Links</span>
          </GuideStep>
          <GuideStep n={2}>
            O TrackingID padrão é <span className="font-mono text-zinc-300 bg-zinc-800 px-1 rounded">default</span> — use esse se não criou um personalizado
          </GuideStep>
          <GuideStep n={3}>
            Para criar um ID personalizado (ex: por campanha), clique em <span className="text-zinc-300 font-medium">Create Tracking ID</span>
          </GuideStep>
        </CollapsibleGuide>
      </FieldGroup>
    </>
  );
}

function TemuFields({
  values,
  onChange,
}: {
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  return (
    <FieldGroup>
      <div className="flex items-center justify-between">
        <Label htmlFor="temu_share_id" className={labelClass}>
          Share ID <span className="text-orange-400">*</span>
        </Label>
        <a
          href="https://partner.temu.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[10px] text-zinc-600 hover:text-orange-400 transition-colors"
        >
          Abrir painel <ExternalLink className="h-2.5 w-2.5" />
        </a>
      </div>
      <Input
        id="temu_share_id"
        placeholder="ex: ab12cd34"
        value={values.temu_share_id ?? ''}
        onChange={(e) => onChange('temu_share_id', e.target.value)}
        className={fieldClass}
        required
      />
      <CollapsibleGuide title="Como encontrar meu Share ID?">
        <GuideStep n={1}>
          Acesse{' '}
          <a
            href="https://partner.temu.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-orange-400/80 hover:text-orange-400 underline"
          >
            partner.temu.com
          </a>{' '}
          e faça login com sua conta de afiliado
        </GuideStep>
        <GuideStep n={2}>
          No painel, vá em{' '}
          <span className="text-zinc-300 font-medium">Ferramentas de Promoção</span> →{' '}
          <span className="text-zinc-300 font-medium">Gerar Link</span> (ou clique em Compartilhar em qualquer produto)
        </GuideStep>
        <GuideStep n={3}>
          No link gerado, copie o valor do parâmetro{' '}
          <span className="font-mono text-zinc-300 bg-zinc-800 px-1 rounded">refer_share_id</span>{' '}
          — ex:{' '}
          <span className="font-mono text-zinc-300 bg-zinc-800 px-1 rounded">ab12cd34</span>
        </GuideStep>
        <GuideStep n={4}>
          Esse ID é fixo para sua conta — não expira
        </GuideStep>
      </CollapsibleGuide>
      <HintText>
        O link de afiliado é gerado automaticamente adicionando seu Share ID aos produtos. Não requer cookies.
      </HintText>
    </FieldGroup>
  );
}

function SheinFields({
  values,
  onChange,
}: {
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  return (
    <>
      <FieldGroup>
        <div className="flex items-center justify-between">
          <Label htmlFor="cj_publisher_id" className={labelClass}>
            Publisher ID (CJ) <span className="text-pink-400">*</span>
          </Label>
          <a
            href="https://members.cj.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[10px] text-zinc-600 hover:text-pink-400 transition-colors"
          >
            Abrir CJ <ExternalLink className="h-2.5 w-2.5" />
          </a>
        </div>
        <Input
          id="cj_publisher_id"
          placeholder="ex: 1234567"
          value={values.cj_publisher_id ?? ''}
          onChange={(e) => onChange('cj_publisher_id', e.target.value)}
          className={fieldClass}
          required
        />
        <CollapsibleGuide title="Como obter meu Publisher ID e Website ID?">
          <GuideStep n={1}>
            Acesse{' '}
            <a
              href="https://members.cj.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-pink-400/80 hover:text-pink-400 underline"
            >
              members.cj.com
            </a>{' '}
            e faça login (ou crie uma conta de Publisher)
          </GuideStep>
          <GuideStep n={2}>
            Após aprovação, vá em{' '}
            <span className="text-zinc-300 font-medium">Account → Web Sites</span> — seu{' '}
            <span className="text-zinc-300 font-medium">Publisher ID</span> aparece no canto superior da tela
          </GuideStep>
          <GuideStep n={3}>
            O <span className="text-zinc-300 font-medium">Website ID</span> está na lista de sites cadastrados (ex: <span className="font-mono text-zinc-300 bg-zinc-800 px-1 rounded">7654321</span>)
          </GuideStep>
          <GuideStep n={4}>
            Em{' '}
            <span className="text-zinc-300 font-medium">Advertisers → Search</span>, busque por{' '}
            <span className="text-zinc-300 font-medium">SHEIN</span> e solicite participação no programa
          </GuideStep>
          <GuideStep n={5}>
            Após aprovação, os links de afiliado serão gerados automaticamente
          </GuideStep>
        </CollapsibleGuide>
      </FieldGroup>
      <FieldGroup>
        <Label htmlFor="cj_website_id" className={labelClass}>
          Website ID (CJ) <span className="text-pink-400">*</span>
        </Label>
        <Input
          id="cj_website_id"
          placeholder="ex: 7654321"
          value={values.cj_website_id ?? ''}
          onChange={(e) => onChange('cj_website_id', e.target.value)}
          className={fieldClass}
          required
        />
      </FieldGroup>
      <FieldGroup>
        <Label htmlFor="cj_merchant_id" className={labelClass}>
          Merchant ID da Shein no CJ{' '}
          <span className="text-zinc-600 normal-case tracking-normal">(opcional — padrão: 44161)</span>
        </Label>
        <Input
          id="cj_merchant_id"
          placeholder="44161"
          value={values.cj_merchant_id ?? ''}
          onChange={(e) => onChange('cj_merchant_id', e.target.value)}
          className={fieldClass}
        />
        <HintText>
          Só altere se o painel CJ mostrar um Merchant ID diferente para a Shein Brasil.
        </HintText>
      </FieldGroup>
    </>
  );
}

const SHEET_META: Record<string, { title: string; subtitle: string; accent: string; docsUrl: string }> = {
  amazon: {
    title: 'Amazon Associates BR',
    subtitle: 'Programa de Afiliados da Amazon',
    accent: 'text-orange-400',
    docsUrl: 'https://associados.amazon.com.br',
  },
  mercadolivre: {
    title: 'Mercado Livre Afiliados',
    subtitle: 'Programa de Afiliados do Mercado Livre',
    accent: 'text-yellow-400',
    docsUrl: 'https://www.mercadolivre.com.br/afiliados/hub',
  },
  shopee: {
    title: 'Shopee Affiliate',
    subtitle: 'API de Afiliados da Shopee',
    accent: 'text-red-400',
    docsUrl: 'https://affiliate.shopee.com.br',
  },
  aliexpress: {
    title: 'AliExpress Portals',
    subtitle: 'AliExpress Open Platform Affiliate',
    accent: 'text-rose-400',
    docsUrl: 'https://portals.aliexpress.com',
  },
  kabum: {
    title: 'KaBuM! via Awin',
    subtitle: 'Programa de Afiliados KaBuM! (Awin)',
    accent: 'text-blue-400',
    docsUrl: 'https://www.awin.com/br',
  },
  temu: {
    title: 'Temu Afiliados',
    subtitle: 'Programa de Afiliados da Temu',
    accent: 'text-orange-400',
    docsUrl: 'https://partner.temu.com',
  },
  shein: {
    title: 'Shein via CJ Affiliate',
    subtitle: 'Programa de Afiliados da Shein (CJ Affiliate)',
    accent: 'text-pink-400',
    docsUrl: 'https://members.cj.com',
  },
};

export function CredentialSheet({ open, onOpenChange, marketplace }: CredentialSheetProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ valid: boolean; error?: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [loadingValues, setLoadingValues] = useState(false);
  const meta = SHEET_META[marketplace];

  // Load existing credentials when sheet opens
  useEffect(() => {
    if (!open) return;
    setResult(null);
    setLoadingValues(true);
    getMarketplaceCredentials(marketplace).then((existing) => {
      if (existing) setValues(existing);
      else setValues({});
      setLoadingValues(false);
    });
  }, [open, marketplace]);

  function handleChange(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setResult(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    startTransition(async () => {
      try {
        const res = await saveAndValidateCredentials(marketplace, values);
        setResult(res);
      } catch (err) {
        setResult({ valid: false, error: String(err) });
      }
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:w-[420px] sm:max-w-[420px] overflow-y-auto bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800/60 flex flex-col gap-0 p-0">
        {/* Header with accent bar */}
        <div className="relative border-b border-zinc-200 dark:border-zinc-800/60 px-6 pt-8 pb-5">
          <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-current to-transparent opacity-60 ${meta.accent}`} />
          <SheetHeader className="text-left space-y-1">
            <SheetTitle className={`text-base font-semibold ${meta.accent}`}>
              {meta.title}
            </SheetTitle>
            <SheetDescription className="text-xs text-zinc-500">
              {meta.subtitle}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[10px] text-zinc-600">
              <ShieldCheck className="h-3 w-3" />
              Criptografado com AES-256-GCM
            </div>
            <a
              href={meta.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              Abrir plataforma <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 px-6 pt-5 pb-6 space-y-5">
          {loadingValues && (
            <div className="flex items-center justify-center py-8 gap-2 text-zinc-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-xs">Carregando dados salvos...</span>
            </div>
          )}
          {!loadingValues && marketplace === 'amazon' && (
            <AmazonFields values={values} onChange={handleChange} />
          )}
          {!loadingValues && marketplace === 'mercadolivre' && (
            <MercadoLivreFields values={values} onChange={handleChange} />
          )}
          {!loadingValues && marketplace === 'shopee' && (
            <ShopeeFields values={values} onChange={handleChange} />
          )}
          {!loadingValues && marketplace === 'aliexpress' && (
            <AliExpressFields values={values} onChange={handleChange} />
          )}
          {!loadingValues && marketplace === 'kabum' && (
            <KabumFields values={values} onChange={handleChange} />
          )}
          {!loadingValues && marketplace === 'temu' && (
            <TemuFields values={values} onChange={handleChange} />
          )}
          {!loadingValues && marketplace === 'shein' && (
            <SheinFields values={values} onChange={handleChange} />
          )}

          {result && (
            <div
              className={`flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm ${
                result.valid
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : 'bg-red-500/10 border-red-500/20 text-red-400'
              }`}
            >
              {result.valid ? (
                <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              )}
              <span>
                {result.valid
                  ? 'Conexão validada com sucesso!'
                  : `${result.error ?? 'Falha na validação'}`}
              </span>
            </div>
          )}

          <SheetFooter className="pt-2">
            <Button
              type="submit"
              disabled={isPending}
              className="w-full bg-zinc-100 text-zinc-900 hover:bg-white font-medium transition-colors"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                  Testando conexão...
                </>
              ) : (
                'Testar e Salvar'
              )}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
