import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Eye, EyeOff, Lock, Trophy } from 'lucide-react';
import LegacySettingsMenu from './components/LegacySettingsMenu';
import { supabase } from './lib/supabaseClient';
import type { ThemeControls } from './App';

type ResetPasswordProps = ThemeControls & {
  onNavigate: (page: string) => void;
};

export default function ResetPassword({ onNavigate, ...themeControls }: ResetPasswordProps) {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formNotice, setFormNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  async function handleResetPassword() {
    setFormError(null);
    setFormNotice(null);

    if (password.length < 6) {
      setFormError(t('ui.passwordMin'));
      return;
    }

    if (password !== confirmPassword) {
      setFormError(t('ui.passwordsMismatch'));
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);

    if (error) {
      setFormError(error.message);
      return;
    }

    setPassword('');
    setConfirmPassword('');
    setFormNotice(t('ui.passwordUpdated'));
  }

  return (
    <div className="min-h-screen bg-page font-sans relative overflow-hidden">
      <div className="absolute inset-0 z-0 pointer-events-none opacity-90 overflow-hidden flex justify-center">
        <img src="https://s6.imgcdn.dev/Ybh5S0.webp" alt="" aria-hidden="true" className="w-full h-full object-cover object-top" />
      </div>
      <div className="absolute inset-0 z-0 bg-page/15 pointer-events-none" />

      <div className="relative z-10 min-h-screen flex flex-col p-4 lg:p-6">
        <header className="flex items-center justify-between bg-card border-4 border-main px-4 md:px-6 py-4 shadow-[8px_8px_0_var(--color-shadow)]">
          <button type="button" onClick={() => onNavigate('landing')} className="text-xl md:text-3xl font-black uppercase tracking-tighter text-main hover:text-c2 transition-colors">
            {t('common.product')}
          </button>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => onNavigate('login')} className="hidden sm:flex bg-c2 text-inv border-2 border-main px-4 py-2 font-black uppercase text-xs shadow-[3px_3px_0_var(--color-shadow)]">
              {t('auth.signIn')}
            </button>
            <LegacySettingsMenu {...themeControls} />
          </div>
        </header>

        <main className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_460px] gap-5 lg:gap-10 items-start lg:items-center w-full max-w-6xl mx-auto py-5 lg:py-12">
          <section className="order-2 lg:order-1 bg-card border-4 border-main p-5 lg:p-10 shadow-[8px_8px_0_var(--color-shadow)] max-w-2xl">
            <div className="text-c2 font-black uppercase tracking-widest text-sm mb-3">{t('ui.accountRecovery')}</div>
            <h1 className="text-4xl sm:text-5xl md:text-7xl font-black uppercase tracking-tighter leading-[0.88] text-main">
              {t('ui.resetPassword')}
            </h1>
            <p className="font-bold text-sm lg:text-lg text-subtle mt-4 lg:mt-6 max-w-xl leading-snug">
              {t('ui.resetPasswordBody')}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 border-2 border-main mt-5 lg:mt-8 uppercase text-xs font-black overflow-hidden">
              <div className="p-3 bg-c1 text-main sm:border-r-2 border-main flex items-center gap-2"><Trophy size={16} /> {t('ui.secure')}</div>
              <div className="p-3 bg-c2 text-inv sm:border-r-2 border-main flex items-center gap-2"><Lock size={16} /> {t('ui.private')}</div>
              <div className="p-3 bg-c3 text-main flex items-center gap-2"><ArrowRight size={16} /> {t('ui.fast')}</div>
            </div>
          </section>

          <section className="order-1 lg:order-2 bg-card border-4 border-main shadow-[8px_8px_0_var(--color-shadow)] overflow-hidden">
            <div className="bg-c2 text-inv p-3 sm:p-4 text-center text-xs sm:text-sm font-black uppercase">{t('ui.setNewPassword')}</div>
            <div className="p-4 sm:p-5 lg:p-6 flex flex-col gap-3.5 sm:gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="font-black uppercase text-xs">{t('ui.newPassword')}</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3 top-1/2 z-10 -translate-y-1/2 text-main opacity-80 pointer-events-none" />
                  <input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={t('ui.enterNewPassword')} className="w-full border-2 border-main p-3 pl-10 pr-12 font-bold text-sm bg-card shadow-[2px_2px_0_0_var(--color-shadow)] focus:shadow-[4px_4px_0_0_var(--color-shadow)] focus:ring-2 focus:ring-c2 transition-all outline-none" />
                  <button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? t('ui.hidePassword') : t('ui.showPassword')} className="absolute right-2 top-1/2 z-10 -translate-y-1/2 border-2 border-transparent p-1 text-main opacity-80 hover:opacity-100 focus:border-main focus:bg-muted focus:outline-none">
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-black uppercase text-xs">{t('auth.confirmPassword')}</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3 top-1/2 z-10 -translate-y-1/2 text-main opacity-80 pointer-events-none" />
                  <input type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder={t('ui.confirmNewPassword')} className="w-full border-2 border-main p-3 pl-10 pr-12 font-bold text-sm bg-card shadow-[2px_2px_0_0_var(--color-shadow)] focus:shadow-[4px_4px_0_0_var(--color-shadow)] focus:ring-2 focus:ring-c2 transition-all outline-none" />
                  <button type="button" onClick={() => setShowConfirmPassword((current) => !current)} aria-label={showConfirmPassword ? t('ui.hidePassword') : t('ui.showPassword')} className="absolute right-2 top-1/2 z-10 -translate-y-1/2 border-2 border-transparent p-1 text-main opacity-80 hover:opacity-100 focus:border-main focus:bg-muted focus:outline-none">
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {formError && <div className="border-2 border-main bg-c5 text-main p-3 font-black uppercase text-xs">{formError}</div>}
              {formNotice && <div className="border-2 border-main bg-c1 text-main p-3 font-black uppercase text-xs">{formNotice}</div>}

              <button type="button" onClick={handleResetPassword} disabled={submitting} className="w-full bg-c2 hover:opacity-90 text-inv font-black uppercase py-4 border-2 border-main shadow-[4px_4px_0_0_var(--color-shadow)] active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-all text-lg disabled:opacity-60">
                {submitting ? t('ui.updatingPassword') : t('ui.updatePassword')}
              </button>
              <button type="button" onClick={() => onNavigate('login')} className="w-full bg-card hover:bg-muted text-main font-black uppercase py-3 border-2 border-main shadow-[4px_4px_0_0_var(--color-shadow)] active:translate-y-[2px] active:translate-x-[2px] active:shadow-none transition-all text-sm flex items-center justify-center gap-3">
                {t('ui.backToSignIn')} <ArrowRight size={18} strokeWidth={3} />
              </button>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
