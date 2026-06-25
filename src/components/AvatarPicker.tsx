import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, X } from 'lucide-react';
import { CLUB_AVATAR_OPTIONS, CUSTOM_AVATAR_OPTIONS, FLAG_AVATAR_OPTIONS, type AvatarOption } from '../constants/avatars';
import { updateCurrentProfile } from '../services/profile';
import { getErrorMessage } from '../services/serviceTypes';
import { normalizeAvatarBgColor } from './ui/UserAvatar';

type AvatarPickerModalProps = {
  open: boolean;
  onClose: () => void;
  userId: string;
  currentUrl: string | null;
  currentBgColor: string | null;
  onSaved: (avatarUrl: string, avatarBgColor: string | null) => void;
};

export default function AvatarPickerModal({ open, onClose, userId, currentUrl, currentBgColor, onSaved }: AvatarPickerModalProps) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [selectedClubUrl, setSelectedClubUrl] = useState<string | null>(null);
  const [clubBgColor, setClubBgColor] = useState('#FFFFFF');
  const selectedClubOption = useMemo(() => CLUB_AVATAR_OPTIONS.find((option) => option.url === selectedClubUrl) ?? null, [selectedClubUrl]);

  useEffect(() => {
    if (!open) return;
    const currentClub = CLUB_AVATAR_OPTIONS.find((option) => option.url === currentUrl) ?? null;
    setStatus('idle');
    setError(null);
    setPendingUrl(null);
    setSelectedClubUrl(currentClub?.url ?? null);
    setClubBgColor(normalizeAvatarBgColor(currentBgColor));
  }, [currentBgColor, currentUrl, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function saveAvatar(option: AvatarOption, nextBgColor: string | null) {
    const normalizedBgColor = option.kind === 'club' ? normalizeAvatarBgColor(nextBgColor) : null;
    if (status === 'saving' || (option.url === currentUrl && normalizedBgColor === currentBgColor)) return;
    setStatus('saving');
    setError(null);
    setPendingUrl(option.url);
    try {
      await updateCurrentProfile(userId, { avatar_url: option.url, avatar_bg_color: normalizedBgColor });
      onSaved(option.url, normalizedBgColor);
      window.dispatchEvent(new CustomEvent('wc26:profile-avatar-changed', { detail: { avatar_url: option.url, avatar_bg_color: normalizedBgColor } }));
      setStatus('saved');
    } catch (err) {
      setStatus('idle');
      setError(getErrorMessage(err));
    } finally {
      setPendingUrl(null);
    }
  }

  function handleSelect(option: AvatarOption) {
    if (option.kind === 'club') {
      setSelectedClubUrl(option.url);
      const nextColor = normalizeAvatarBgColor(option.suggestedBgColors?.[0] ?? clubBgColor);
      setClubBgColor(nextColor);
      void saveAvatar(option, nextColor);
      return;
    }
    void saveAvatar(option, null);
  }

  function handleClubColorSave(nextColor: string) {
    if (!selectedClubOption) return;
    const normalized = normalizeAvatarBgColor(nextColor);
    setClubBgColor(normalized);
    void saveAvatar(selectedClubOption, normalized);
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-black/60" onClick={onClose}>
      <div className="bg-card border-4 border-main shadow-[8px_8px_0_0_var(--color-shadow)] w-full max-w-lg max-h-[85vh] flex flex-col rounded-sm" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between bg-main text-inv px-4 py-3 border-b-4 border-main">
          <span className="font-black uppercase tracking-wide text-sm">{t('ui.chooseAvatar')}</span>
          <div className="flex items-center gap-3">
            {status === 'saving' && <span className="font-black text-[10px] uppercase opacity-80">{t('ui.avatarSaving')}</span>}
            {status === 'saved' && <span className="font-black text-[10px] uppercase text-c3">{t('ui.avatarSaved')}</span>}
            <button type="button" onClick={onClose} aria-label={t('ui.close')} className="hover:opacity-70 transition-opacity">
              <X size={20} strokeWidth={3} />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto p-3 sm:p-4 flex flex-col gap-4">
          <AvatarGroup label={t('ui.avatarCustom')} options={CUSTOM_AVATAR_OPTIONS} currentUrl={currentUrl} currentBgColor={currentBgColor} pendingUrl={pendingUrl} onSelect={handleSelect} />
          <AvatarGroup label={t('ui.avatarFlags')} options={FLAG_AVATAR_OPTIONS} currentUrl={currentUrl} currentBgColor={currentBgColor} pendingUrl={pendingUrl} onSelect={handleSelect} />
          <AvatarGroup label={t('ui.avatarClubs')} options={CLUB_AVATAR_OPTIONS} currentUrl={currentUrl} currentBgColor={currentBgColor} pendingUrl={pendingUrl} onSelect={handleSelect} />

          {selectedClubOption && (
            <div className="border-2 border-main p-3 rounded-sm flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <span className="font-black uppercase text-[10px] text-subtle">{t('ui.avatarBackground')}</span>
                <input
                  type="color"
                  value={clubBgColor}
                  onChange={(event) => handleClubColorSave(event.target.value)}
                  className="w-10 h-8 border-2 border-main bg-card cursor-pointer"
                  aria-label={t('ui.avatarCustomBackground')}
                />
              </div>
              <div className="flex flex-col gap-2">
                <span className="font-black uppercase text-[10px] text-subtle">{t('ui.avatarSuggestedBackgrounds')}</span>
                <div className="flex gap-2 flex-wrap">
                  {(selectedClubOption.suggestedBgColors ?? ['#FFFFFF']).map((color) => {
                    const normalized = normalizeAvatarBgColor(color);
                    return (
                      <button
                        key={normalized}
                        type="button"
                        title={normalized}
                        onClick={() => handleClubColorSave(normalized)}
                        className={`w-8 h-8 border-2 rounded-sm shadow-[2px_2px_0_var(--color-shadow)] ${clubBgColor.toUpperCase() === normalized.toUpperCase() ? 'border-c2' : 'border-main'}`}
                        style={{ backgroundColor: normalized }}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {error && <div className="font-black text-[10px] uppercase text-c5">{error}</div>}
        </div>
      </div>
    </div>
  );
}

type AvatarGroupProps = {
  label: string;
  options: AvatarOption[];
  currentUrl: string | null;
  currentBgColor: string | null;
  pendingUrl: string | null;
  onSelect: (option: AvatarOption) => void;
};

function AvatarGroup({ label, options, currentUrl, currentBgColor, pendingUrl, onSelect }: AvatarGroupProps) {
  return (
    <div className="flex flex-col gap-2">
      <span className="font-black uppercase text-[10px] text-subtle">{label}</span>
      <div className="grid grid-cols-5 sm:grid-cols-6 gap-2">
        {options.map((option) => {
          const isClub = option.kind === 'club';
          const isSelected = option.url === currentUrl;
          const isPending = option.url === pendingUrl;
          const previewBgColor = isSelected ? normalizeAvatarBgColor(currentBgColor) : normalizeAvatarBgColor(option.suggestedBgColors?.[0]);
          return (
            <button
              key={option.url}
              type="button"
              title={option.name}
              onClick={() => onSelect(option)}
              className={`relative aspect-square border-2 overflow-hidden rounded-sm bg-card transition-transform active:scale-95 ${isSelected ? 'border-c2 shadow-[2px_2px_0_var(--color-shadow)]' : 'border-main hover:bg-muted'} ${isPending ? 'opacity-60' : ''}`}
              style={isClub ? { backgroundColor: previewBgColor } : undefined}
            >
              <img src={option.url} alt={option.name} loading="lazy" className={isClub ? 'w-full h-full object-contain p-1.5' : 'w-full h-full object-cover'} />
              {isSelected && (
                <span className="absolute inset-0 flex items-center justify-center bg-c2/70">
                  <Check size={16} className="text-inv" strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
