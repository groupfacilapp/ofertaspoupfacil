# Templates de Email — DisparaZap

> ⚠️ **Atenção sobre a logo em Emails:**
> A maioria dos clientes de email (como Gmail e Outlook) **não suporta imagens em `.svg`**. Portanto, para as imagens aparecerem, usei o nome estilizado em texto. 
> Se preferir usar o arquivo exato da logo no futuro, suba uma versão `.png` ou `.jpg` no servidor (`https://dispara-zap.com/brand/logo-full.png`) e substitua a linha do `<h1>` pela tag `<img>` informada em comentário no HTML.

Para utilizar estes templates, copie o bloco HTML inteiro correspondente e cole na caixa de texto do Supabase (Authentication > Email Templates), certificando-se de alterar as opções das mensagens.

---

## 1. Confirmação de Cadastro (Signup)

Navegue até o Supabase: **Authentication -> Email Templates -> Confirm signup**. 
Cole o código abaixo:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 0; color: #09090b; }
    .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
    .header { background-color: #09090b; padding: 32px 24px; text-align: center; }
    /* Para usar a imagem real (lembre-se de usar PNG e não SVG no email):
       <img src="https://dispara-zap.com/brand/logo-full.png" alt="DisparaZap" style="width: 140px; margin: 0 auto;" /> 
    */
    .header h1 { color: #ffffff; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px; }
    .header h1 span { color: #818cf8; } /* Indigo 400 */
    .content { padding: 32px 24px; }
    .content h2 { font-size: 22px; font-weight: 600; margin-top: 0; color: #09090b; }
    .content p { font-size: 16px; line-height: 1.6; color: #3f3f46; margin-bottom: 24px; }
    .btn { display: inline-block; background-color: #4f46e5; color: #ffffff !important; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-weight: 600; font-size: 16px; }
    .btn:hover { background-color: #4338ca; }
    .footer { padding: 24px; text-align: center; background-color: #fafafa; border-top: 1px solid #e4e4e7; font-size: 14px; color: #71717a; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <!-- Fallback textual com a sua paleta -->
      <h1><span>Dispara</span>Zap</h1>
    </div>
    <div class="content">
      <h2>Confirme seu cadastro</h2>
      <p>Olá! Ficamos muito felizes em receber você no DisparaZap. Para ativar a sua conta e começar a gerenciar suas automações e vendas via WhatsApp, por favor confirme o seu endereço de email clicando no botão abaixo:</p>
      
      <div style="text-align: center; margin: 32px 0;">
        <a href="{{ .ConfirmationURL }}" class="btn">Confirmar Email</a>
      </div>
      
      <p style="font-size: 14px; color: #71717a;">Se você não solicitou este cadastro, pode ignorar este email com segurança. O link vai expirar em 24 horas.</p>
    </div>
    <div class="footer">
      <p>&copy; 2026 DisparaZap. Todos os direitos reservados.</p>
    </div>
  </div>
</body>
</html>
```

---

## 2. Redefinição de Senha (Reset Password)

Navegue até o Supabase: **Authentication -> Email Templates -> Reset Password**. 
Cole o código abaixo:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 0; color: #09090b; }
    .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
    .header { background-color: #09090b; padding: 32px 24px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px; }
    .header h1 span { color: #818cf8; }
    .content { padding: 32px 24px; }
    .content h2 { font-size: 22px; font-weight: 600; margin-top: 0; color: #09090b; }
    .content p { font-size: 16px; line-height: 1.6; color: #3f3f46; margin-bottom: 24px; }
    .btn { display: inline-block; background-color: #4f46e5; color: #ffffff !important; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-weight: 600; font-size: 16px; }
    .btn:hover { background-color: #4338ca; }
    .footer { padding: 24px; text-align: center; background-color: #fafafa; border-top: 1px solid #e4e4e7; font-size: 14px; color: #71717a; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1><span>Dispara</span>Zap</h1>
    </div>
    <div class="content">
      <h2>Redefinição de Senha</h2>
      <p>Olá! Recebemos uma solicitação para alterar a senha da sua conta no DisparaZap. Para realizar a troca e voltar a acessar a plataforma, clique no botão abaixo:</p>
      
      <div style="text-align: center; margin: 32px 0;">
        <a href="{{ .ConfirmationURL }}" class="btn">Redefinir Senha</a>
      </div>
      
      <p style="font-size: 14px; color: #71717a;">Se você não solicitou a alteração, por favor, desconsidere este email. Sua conta e senha atuais continuam seguras e não serão alteradas.</p>
    </div>
    <div class="footer">
      <p>&copy; 2026 DisparaZap. Todos os direitos reservados.</p>
    </div>
  </div>
</body>
</html>
```
