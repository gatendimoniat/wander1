import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { syncLocalStorageToSupabase } from '@/lib/storage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LogIn, LogOut, User, Mail, Lock, Loader2, CheckCircle, AlertCircle, Cloud, CloudOff, Wifi } from 'lucide-react';
import { toast } from 'sonner';

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [user, setUser] = useState<any>(null);
  const [view, setView] = useState<'login' | 'signup' | 'profile'>('login');
  const [emailSent, setEmailSent] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  const [syncCount, setSyncCount] = useState(0);

  useEffect(() => {
    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        setView('profile');
        setAuthError(null);
        if (event === 'SIGNED_IN') {
          syncOnLogin();
        }
      } else {
        setView('login');
        setSyncStatus('idle');
        setSyncCount(0);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkSession = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        setAuthError('No es pot connectar amb el servidor');
        return;
      }
      setUser(session?.user ?? null);
      if (session?.user) setView('profile');
    } catch {
      setAuthError('Error de connexió');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setAuthError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (error.message.includes('Email not confirmed')) {
        setAuthError('Email no verificat. Revisa la teva bústia o sol·licita un nou enllaç.');
      } else {
        setAuthError(error.message);
      }
      toast.error('Error en iniciar sessió', { description: error.message });
    } else {
      toast.success('Sessió iniciada!');
      await syncOnLogin();
    }
    setLoading(false);
  };

  const syncOnLogin = async () => {
    setSyncStatus('syncing');
    try {
      const result = await syncLocalStorageToSupabase();
      setSyncCount(result.synced);
      if (result.synced > 0) {
        toast.success(`${result.synced} elements sincronitzats del dispositiu`);
      }
      setSyncStatus(result.errors > 0 ? 'error' : 'synced');
    } catch {
      setSyncStatus('error');
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setAuthError(null);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) {
      if (error.message.includes('already registered')) {
        setAuthError('Aquest email ja està registrat. Prova d\'iniciar sessió.');
        setView('login');
      } else {
        setAuthError(error.message);
      }
      toast.error('Error en el registre', { description: error.message });
    } else {
      setEmailSent(true);
      toast.success('Registre completat! Revisa el teu email per verificar el compte.');
    }
    setLoading(false);
  };

  const handleResendConfirmation = async () => {
    setLoading(true);
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) {
      toast.error('Error reenviant email', { description: error.message });
    } else {
      toast.success('Email de confirmació reenviat!');
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setEmailSent(false);
    setAuthError(null);
    toast.success('Sessió tancada');
  };

  if (view === 'profile' && user) {
    return (
      <div className="p-3 bg-white/50 dark:bg-black/20 rounded-xl border border-white/20 backdrop-blur-sm space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white shrink-0">
            <User className="w-4 h-4" />
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-medium truncate">{user.email}</p>
            <div className="flex items-center gap-1">
              {syncStatus === 'syncing' && (
                <>
                  <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />
                  <p className="text-xs text-blue-400">Sincronitzant...</p>
                </>
              )}
              {syncStatus === 'synced' && (
                <>
                  <Cloud className="w-3 h-3 text-green-400" />
                  <p className="text-xs text-green-400">
                    {syncCount > 0 ? `${syncCount} elements sincronitzats` : 'Tot sincronitzat'}
                  </p>
                </>
              )}
              {syncStatus === 'error' && (
                <>
                  <CloudOff className="w-3 h-3 text-yellow-400" />
                  <p className="text-xs text-yellow-400">Sincronització parcial</p>
                </>
              )}
              {syncStatus === 'idle' && (
                <>
                  <Wifi className="w-3 h-3 text-green-500" />
                  <p className="text-xs opacity-60">Connectat al núvol</p>
                </>
              )}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-red-500 hover:text-red-600 hover:bg-red-50/10 p-2 min-h-[36px]">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 bg-white/50 dark:bg-black/20 rounded-xl border border-white/20 backdrop-blur-sm space-y-3">
      <div className="flex items-center gap-2">
        <LogIn className="w-4 h-4 opacity-60" />
        <h3 className="font-semibold text-sm">{view === 'login' ? 'Inicia sessió' : 'Crea un compte'}</h3>
      </div>

      {authError && (
        <div className="flex items-start gap-2 p-2 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{authError}</span>
        </div>
      )}

      {emailSent && (
        <div className="flex items-start gap-2 p-2 bg-green-500/10 border border-green-500/30 rounded-lg text-xs text-green-400">
          <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>Email enviat! Revisa la teva bústia (incloent spam).</span>
        </div>
      )}
      
      <form onSubmit={view === 'login' ? handleLogin : handleSignUp} className="space-y-2">
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40" />
          <Input 
            type="email" 
            placeholder="Email" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)}
            className="pl-9 bg-white/50 dark:bg-black/20 border-white/20 text-sm h-9"
            required
          />
        </div>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40" />
          <Input 
            type="password" 
            placeholder="Contrasenya (mín. 6 caràcters)" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)}
            className="pl-9 bg-white/50 dark:bg-black/20 border-white/20 text-sm h-9"
            required
            minLength={6}
          />
        </div>
        <Button disabled={loading} className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg text-sm h-9">
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          {view === 'login' ? 'Entrar' : 'Registrar-se'}
        </Button>
      </form>

      {view === 'login' && authError?.includes('Email not confirmed') && (
        <button
          onClick={handleResendConfirmation}
          disabled={loading}
          className="w-full text-xs text-yellow-500 hover:underline flex items-center justify-center gap-1"
        >
          <Mail className="w-3 h-3" />
          Reenviar email de confirmació
        </button>
      )}

      <div className="text-center">
        <button 
          onClick={() => { setView(view === 'login' ? 'signup' : 'login'); setAuthError(null); setEmailSent(false); }}
          className="text-xs text-blue-500 hover:underline"
        >
          {view === 'login' ? "No tens compte? Registra't" : "Ja tens compte? Entra"}
        </button>
      </div>
    </div>
  );
}
