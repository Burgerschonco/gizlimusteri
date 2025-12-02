import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast, Toaster } from 'react-hot-toast';
import { ref, get } from 'firebase/database';
import { realdb } from '../firebase/config';

function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [loginType, setLoginType] = useState('admin');
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevState => ({
      ...prevState,
      [name]: value
    }));
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      if (loginType === 'admin') {
        const adminEmails = ['admin@burgerschon.com', 'kadir@burgerschon.com'];
        
        if (adminEmails.includes(formData.email)) {
          const adminUser = {
            email: formData.email,
            username: formData.email.split('@')[0],
            isAdmin: true
          };
          await login(adminUser);
          toast.success('Yönetici girişi başarılı!');
          navigate('/panel');
        } else {
          setError('Bu e-posta adresi ile yönetici girişi yapamazsınız');
          toast.error('Giriş başarısız');
        }
      } else {
        const branchUsersRef = ref(realdb, 'branchUsers');
        const snapshot = await get(branchUsersRef);

        if (snapshot.exists()) {
          const branchUser = Object.values(snapshot.val()).find(
            user => user.username === formData.username && user.password === formData.password
          );

          if (branchUser) {
            await login(branchUser);
            toast.success('Şube girişi başarılı!');
            navigate('/sube-panel');
          } else {
            setError('Geçersiz kullanıcı adı veya şifre');
            toast.error('Giriş başarısız');
          }
        } else {
          setError('Şube kullanıcısı bulunamadı');
          toast.error('Giriş başarısız');
        }
      }
    } catch (error) {
      console.error('Login error:', error);
      setError('Giriş yapılırken bir hata oluştu');
      toast.error('Giriş başarısız');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-red-900 to-slate-900 relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 via-transparent to-red-500/10 animate-pulse"></div>
        <div className="absolute top-0 left-0 w-full h-full">
          <div className="absolute top-20 left-10 w-72 h-72 bg-red-500/5 rounded-full blur-3xl animate-bounce"></div>
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-red-500/5 rounded-full blur-3xl animate-pulse"></div>
        </div>
      </div>

      <div className="relative flex min-h-screen items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-sm sm:max-w-md lg:max-w-lg">
          {/* Logo Section */}
          <div className="flex justify-center mb-8 sm:mb-10">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-red-500/20 to-red-600/20 rounded-3xl blur-xl"></div>
              <div className="relative bg-white/5 backdrop-blur-xl rounded-3xl p-6 sm:p-8 border border-white/10">
                <img 
                  src="/burgerschonlogobeyaz.png" 
                  alt="Burgerschön Logo" 
                  className="h-24 sm:h-32 w-auto brightness-0 invert drop-shadow-lg" 
                />
              </div>
            </div>
          </div>

          {/* Login Card */}
          <div className="bg-white/5 backdrop-blur-xl rounded-3xl border border-white/10 p-6 sm:p-8 shadow-2xl">
            <form 
              id="loginForm"
              name="loginForm"
              method="post"
              onSubmit={handleLogin} 
              className="space-y-6"
              autoComplete="on"
            >
              {/* Giriş Tipi Seçimi */}
              <div className="flex rounded-2xl overflow-hidden bg-white/5 border border-white/10 p-1">
                <button
                  type="button"
                  data-role="admin-login"
                  onClick={() => setLoginType('admin')}
                  className={`flex-1 py-3 px-4 text-sm font-medium transition-all duration-300 rounded-xl ${
                    loginType === 'admin'
                      ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg'
                      : 'text-gray-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    <span className="hidden sm:inline">Yönetici</span>
                    <span className="sm:hidden">Admin</span>
                  </div>
                </button>
                <button
                  type="button"
                  data-role="branch-login"
                  onClick={() => setLoginType('branch')}
                  className={`flex-1 py-3 px-4 text-sm font-medium transition-all duration-300 rounded-xl ${
                    loginType === 'branch'
                      ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg'
                      : 'text-gray-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    <span>Şube</span>
                  </div>
                </button>
              </div>

              {/* Başlık */}
              <div className="text-center">
                <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">
                  {loginType === 'admin' ? 'Yönetici Girişi' : 'Şube Girişi'}
                </h2>
                <p className="text-gray-400 text-sm sm:text-base">
                  Lütfen bilgilerinizle giriş yapın
                </p>
              </div>

              {/* Hata Mesajı */}
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-2xl text-sm flex items-center gap-2">
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {error}
                </div>
              )}

              {/* Giriş Formu */}
              <div className="space-y-4">
                <div>
                  <div className="relative group">
                    {loginType === 'admin' ? (
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        className="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-gray-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:bg-white/10 transition-all duration-300 group-hover:border-white/20"
                        placeholder="E-posta adresiniz"
                        autoComplete="email"
                        required
                      />
                    ) : (
                      <input
                        type="text"
                        name="username"
                        value={formData.username}
                        onChange={handleInputChange}
                        className="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-gray-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:bg-white/10 transition-all duration-300 group-hover:border-white/20"
                        placeholder="Kullanıcı adınız"
                        autoComplete="username"
                        required
                      />
                    )}
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 group-hover:text-gray-300 transition-colors">
                      {loginType === 'admin' ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="relative group">
                    <input
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      className="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-gray-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:bg-white/10 transition-all duration-300 group-hover:border-white/20"
                      placeholder="Şifreniz"
                      autoComplete="current-password"
                      required
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 group-hover:text-gray-300 transition-colors">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Giriş Yap Butonu */}
              <button
                type="submit"
                data-role="submit-login"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-red-500 to-red-600 text-white py-4 px-6 rounded-2xl hover:from-red-600 hover:to-red-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 font-medium shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Giriş yapılıyor...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                    </svg>
                    <span>Giriş Yap</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Footer */}
          <div className="text-center mt-6 sm:mt-8">
            <p className="text-gray-400 text-xs sm:text-sm">
              © 2024 Burgerschön. Tüm hakları saklıdır.
            </p>
          </div>
        </div>
      </div>
      <Toaster 
        position="top-center"
        toastOptions={{
          style: {
            background: '#1f2937',
            color: '#fff',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          },
        }}
      />
    </div>
  );
}

export default LoginPage;