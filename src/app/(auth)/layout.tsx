import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { BRAND } from '@/config/brand';

const features = [
  'Amazon BR, Mercado Livre, Shopee e AliExpress',
  'Links de afiliado gerados automaticamente',
  'Envio automático para grupos do WhatsApp',
  'Filtros por desconto, preço e palavras-chave',
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-zinc-950">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[520px] flex-col relative overflow-hidden bg-[#0a0a14]">
        {/* Background grid */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(#818cf8 1px, transparent 1px), linear-gradient(to right, #818cf8 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        {/* Glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col h-full px-10 py-10">
          {/* Logo */}
          <Link href="/" className="w-fit">
            <Logo size="sm" />
          </Link>

          {/* Main copy */}
          <div className="flex-1 flex flex-col justify-center">
            <div className="space-y-3 mb-10">
              <p className="text-xs font-semibold text-indigo-400 uppercase tracking-widest">
                Automação de Afiliados
              </p>
              <h2 className="text-3xl xl:text-4xl font-bold text-white leading-tight">
                Dispare ofertas<br />
                <span className="text-indigo-400">no automático.</span>
              </h2>
              <p className="text-sm text-zinc-400 leading-relaxed max-w-xs">
                Conecte seus marketplaces, configure seus grupos do WhatsApp e deixe o {BRAND.name} trabalhar por você.
              </p>
            </div>

            {/* Features */}
            <ul className="space-y-3">
              {features.map((f) => (
                <li key={f} className="flex items-start gap-3">
                  <CheckCircle2 className="h-4 w-4 text-indigo-400 mt-0.5 shrink-0" />
                  <span className="text-sm text-zinc-300">{f}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Footer */}
          <p className="text-xs text-zinc-700">
            &copy; {new Date().getFullYear()} {BRAND.name}. Todos os direitos reservados.
          </p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 flex-col items-center justify-center px-5 py-10">
        {/* Mobile logo */}
        <Link href="/" className="mb-8 lg:hidden">
          <Logo size="md" />
        </Link>

        <div className="w-full max-w-[400px]">
          {children}
        </div>
      </div>
    </div>
  );
}
