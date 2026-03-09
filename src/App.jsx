
import React, { useState, useEffect, useRef } from 'react';
import ChatbotWidget from './components/ChatbotWidget.jsx';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const navItems = [
  { label: 'Home', href: '#' },
  { label: 'Hospitals', href: '#hospitals' },
];

const SLOT_CAPACITY_PER_HOUR = 6;

function App() {
  const [hospitals, setHospitals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeRole, setActiveRole] = useState(null); // 'user' | 'hospital' | null
  const [userCoords, setUserCoords] = useState(null);
  const hasRequestedGeoRef = useRef(false);
  // Slot bookings persist per-day via localStorage — reset automatically on a new day
  const todayKey = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
  const [slotBookings, setSlotBookings] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('slotBookings'));
      if (stored && stored.date === todayKey) return stored.data;
    } catch { /* ignore */ }
    return {};
  });
  // Read logged-in user from localStorage
  const [loggedInUser, setLoggedInUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
  });
  const [hospitalData, setHospitalData] = useState(null); // hospital admin data after login

  // Persist slot bookings to localStorage with today's date
  useEffect(() => {
    localStorage.setItem('slotBookings', JSON.stringify({ date: todayKey, data: slotBookings }));
  }, [slotBookings, todayKey]);

  // Auto-reset at midnight: calculate ms until next 00:00:00 and clear bookings
  useEffect(() => {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0); // next midnight
    const msUntilMidnight = midnight.getTime() - now.getTime();

    const timer = setTimeout(() => {
      setSlotBookings({});
      localStorage.removeItem('slotBookings');
    }, msUntilMidnight);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/hospitals`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setHospitals(normalizeHospitals(data));
        } else {
          setHospitals([]);
        }
        setIsLoading(false);
      })
      .catch(() => {
        // Backend unavailable — show empty state, no static fallback
        setHospitals([]);
        setIsLoading(false);
      });
  }, []);

  // When the user role is selected, ask for location (only once)
  useEffect(() => {
    if (activeRole !== 'user') return;
    if (hasRequestedGeoRef.current) return;

    if (typeof window === 'undefined' || !navigator.geolocation) {
      return;
    }

    hasRequestedGeoRef.current = true;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserCoords({ lat: latitude, lng: longitude });
      },
      () => {
        // If the user denies or it fails, we simply keep the original order
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  }, [activeRole]);

  // Once we have both hospitals and user coordinates, compute distance for each hospital
  useEffect(() => {
    if (!userCoords) return;
    if (!Array.isArray(hospitals) || hospitals.length === 0) return;

    // If distances are already computed, skip to avoid loops
    const alreadyHasDistance = hospitals.some(
      (hospital) =>
        hospital && typeof hospital.distance === 'string' && hospital.distance.includes('km'),
    );
    if (alreadyHasDistance) return;

    const withDistance = hospitals.map((hospital) => {
      if (hospital.lat == null || hospital.lng == null) return hospital;
      const distanceKm = computeDistanceKm(
        userCoords.lat,
        userCoords.lng,
        hospital.lat,
        hospital.lng,
      );
      return {
        ...hospital,
        distanceKm,
        distance: `${distanceKm.toFixed(1)} km`,
      };
    });

    setHospitals(withDistance);
  }, [userCoords, hospitals]);

  const getDaysFromToday = (dateString) => {
    if (!dateString) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateString);
    target.setHours(0, 0, 0, 0);
    const diffMs = target.getTime() - today.getTime();
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
  };

  // Compute remaining slots for a given doctor, date & time slot (front-end demo only)
  const getRemainingSlots = (doctorName, slot, dateString) => {
    if (!doctorName || !slot || !dateString) return SLOT_CAPACITY_PER_HOUR;
    const doctorBookings = slotBookings[doctorName] || {};
    const dateBookings = doctorBookings[dateString] || {};
    const bookedCount = dateBookings[slot] || 0;
    const remaining = SLOT_CAPACITY_PER_HOUR - bookedCount;
    return remaining > 0 ? remaining : 0;
  };

  // Register a booking so that remaining slots decrease for this doctor, date & time
  const registerBooking = (doctorName, slot, dateString) => {
    if (!doctorName || !slot || !dateString) return;
    setSlotBookings((prev) => {
      const doctorBookings = prev[doctorName] || {};
      const dateBookings = doctorBookings[dateString] || {};
      const current = dateBookings[slot] || 0;
      const nextCount = Math.min(SLOT_CAPACITY_PER_HOUR, current + 1);
      return {
        ...prev,
        [doctorName]: {
          ...doctorBookings,
          [dateString]: {
            ...dateBookings,
            [slot]: nextCount,
          },
        },
      };
    });
  };

  return (
    <div className="app-shell relative overflow-hidden">
      {/* Background gradients */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.16),transparent_60%),radial-gradient(circle_at_bottom,_rgba(45,212,191,0.18),transparent_55%)]" />
      <div className="relative z-10 flex min-h-screen flex-col">
        {activeRole === 'user' && <SiteHeader user={loggedInUser} onLogout={() => {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setLoggedInUser(null);
          setActiveRole(null);
        }} />}
        <main className="flex-1">
          {isLoading ? (
            <div className="flex h-96 items-center justify-center text-slate-500">Loading DocApoint...</div>
          ) : !activeRole ? (
            <AuthFlow onLoginSuccess={() => {
              const stored = JSON.parse(localStorage.getItem('user'));
              setLoggedInUser(stored);
              setActiveRole('user');
            }} onSelectHospital={() => setActiveRole('hospital')} />
          ) : activeRole === 'user' ? (
            <>
              <HeroSection
                hospitals={hospitals}
                onNearbyComputed={setHospitals}
                getRemainingSlots={getRemainingSlots}
                registerBooking={registerBooking}
                getDaysFromToday={getDaysFromToday}
              />
              <HighlightsSection
                hospitals={hospitals}
                getRemainingSlots={getRemainingSlots}
                registerBooking={registerBooking}
                getDaysFromToday={getDaysFromToday}
              />
            </>
          ) : activeRole === 'hospital' && !hospitalData ? (
            <HospitalAuthFlow
              onBack={() => setActiveRole(null)}
              onLoginSuccess={(data) => {
                setHospitalData(data);
              }}
            />
          ) : (
            <HospitalDashboard
              hospital={hospitalData}
              onBack={() => { setActiveRole(null); setHospitalData(null); }}
              slotBookings={slotBookings}
              slotCapacityPerHour={SLOT_CAPACITY_PER_HOUR}
            />
          )}
        </main>
        <SiteFooter />
        <ChatbotWidget hospitals={hospitals} />
      </div>
    </div>
  );
}
function AuthFlow({ onLoginSuccess, onSelectHospital }) {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const url = isLogin ? `${API_BASE_URL}/api/auth/login` : `${API_BASE_URL}/api/auth/register`;
    const payload = isLogin
      ? { email, password }
      : { name, email, password, phone, role: 'USER' };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Authentication failed');
      }

      if (isLogin) {
        const data = await response.json();
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        onLoginSuccess();
      } else {
        setIsLogin(true); // Switch to login after successful signup
        setError('Registration successful! Please sign in.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center px-4 py-6 sm:px-6 sm:py-8 min-h-[80vh] sm:min-h-screen relative">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-sky-100 via-white to-emerald-50 opacity-40" />

      <div className="w-full max-w-md backdrop-blur-3xl bg-white/70 p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl shadow-sky-500/10 ring-1 ring-white/80 border border-sky-100 relative overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-sky-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob" />
        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-emerald-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000" />

        <div className="relative z-10">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-black tracking-tight text-slate-900 mb-2">
              {isLogin ? 'Welcome back' : 'Create account'}
            </h2>
            <p className="text-sm text-slate-500 font-medium">
              {isLogin ? 'Sign in to book your next appointment' : 'Join DocApoint to find the best doctors'}
            </p>
          </div>

          {error && (
            <div className={`mb-6 p-3 rounded-xl text-sm text-center font-medium ${error.includes('successful') ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-rose-50 text-rose-600 ring-1 ring-rose-200'}`}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Full Name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-12 px-4 rounded-xl bg-white border-0 ring-1 ring-slate-200 text-sm shadow-sm placeholder:text-slate-400 focus:ring-2 focus:ring-sky-500 transition-all outline-none"
                />
                <input
                  type="tel"
                  placeholder="Phone Number"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full h-12 px-4 rounded-xl bg-white border-0 ring-1 ring-slate-200 text-sm shadow-sm placeholder:text-slate-400 focus:ring-2 focus:ring-sky-500 transition-all outline-none"
                />
              </div>
            )}

            <input
              type="email"
              placeholder="Email address"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-12 px-4 rounded-xl bg-white border-0 ring-1 ring-slate-200 text-sm shadow-sm placeholder:text-slate-400 focus:ring-2 focus:ring-sky-500 transition-all outline-none"
            />

            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-12 px-4 pr-12 rounded-xl bg-white border-0 ring-1 ring-slate-200 text-sm shadow-sm placeholder:text-slate-400 focus:ring-2 focus:ring-sky-500 transition-all outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  </svg>
                )}
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 mt-2 bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-400 hover:to-sky-500 text-white rounded-xl font-semibold shadow-lg shadow-sky-500/30 transition-all hover:shadow-sky-500/40 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Sign Up')}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-200/60 text-center">
            <button
              type="button"
              onClick={() => { setIsLogin(!isLogin); setError(''); }}
              className="text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
            >
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <span className="text-sky-600 font-semibold">{isLogin ? 'Sign up' : 'Sign in'}</span>
            </button>
          </div>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={onSelectHospital}
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-500 transition-colors underline underline-offset-4"
            >
              I am a Hospital Administrator
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function HospitalAuthFlow({ onBack, onLoginSuccess }) {
  const [hospitalId, setHospitalId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/hospital-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hospitalId: hospitalId.trim(), password }),
      });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || 'Invalid credentials');
      }
      const data = await res.json();
      onLoginSuccess(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center px-4 py-6 sm:px-6 sm:py-8 min-h-[80vh] sm:min-h-screen relative">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-emerald-100 via-white to-sky-50 opacity-40" />
      <div className="w-full max-w-md backdrop-blur-3xl bg-white/70 p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl shadow-emerald-500/10 ring-1 ring-white/80 border border-emerald-100 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-emerald-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20" />
        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-sky-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20" />
        <div className="relative z-10">
          <div className="flex justify-center mb-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/40">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3v18" /><path d="M7 12h10" /><rect x="3" y="3" width="18" height="18" rx="3" /></svg>
            </div>
          </div>
          <div className="text-center mb-8">
            <h2 className="text-3xl font-black tracking-tight text-slate-900 mb-1">Hospital Portal</h2>
            <p className="text-sm text-slate-500 font-medium">Sign in with your hospital credentials</p>
          </div>
          {error && (
            <div className="mb-5 p-3 rounded-xl text-sm text-center font-medium bg-rose-50 text-rose-600 ring-1 ring-rose-200">{error}</div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 ml-1">Hospital ID</label>
              <input
                type="text"
                placeholder="e.g. 1001"
                required
                value={hospitalId}
                onChange={(e) => setHospitalId(e.target.value)}
                className="w-full h-12 px-4 rounded-xl bg-white border-0 ring-1 ring-slate-200 text-sm shadow-sm placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 transition-all outline-none font-mono tracking-widest"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 ml-1">Admin Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-12 px-4 pr-12 rounded-xl bg-white border-0 ring-1 ring-slate-200 text-sm shadow-sm placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 transition-all outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 mt-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white rounded-xl font-semibold shadow-lg shadow-emerald-500/30 transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign In to Hospital Portal'}
            </button>
          </form>
          <div className="mt-6 text-center">
            <button type="button" onClick={onBack} className="text-xs text-slate-500 hover:text-slate-700 transition-colors">
              ← Back to user login
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function SiteHeader({ user, onLogout }) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const dropdownRef = React.useRef(null);

  React.useEffect(() => {
    const handler = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowProfile(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Get initials from user name
  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <header
      className={`sticky top-0 z-20 border-b border-slate-200/80 backdrop-blur-xl transition-all ${isScrolled ? 'bg-white/95 shadow-sm' : 'bg-sky-50/90'
        }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 to-emerald-400 text-slate-950 font-black shadow-lg shadow-sky-500/40">
            DA
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-semibold tracking-tight">DocApoint</span>
              <span className="hidden text-xs font-medium text-emerald-400 sm:inline">beta</span>
            </div>
            <p className="hidden text-xs text-slate-500 sm:block">Next‑day smart doctor booking</p>
          </div>
        </div>

        <nav className="hidden items-center gap-6 text-sm text-slate-600 md:flex">
          {navItems.map((item) => (
            <a key={item.label} href={item.href} className="transition hover:text-sky-400">
              {item.label}
            </a>
          ))}

          {/* User Avatar with Dropdown */}
          {user ? (
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setShowProfile(!showProfile)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-emerald-500 text-white text-sm font-bold shadow-md shadow-sky-400/40 hover:shadow-sky-400/60 transition-all hover:scale-105"
                title={user.name}
              >
                {getInitials(user.name)}
              </button>

              {showProfile && (
                <div className="absolute right-0 top-12 w-72 rounded-2xl bg-white border border-slate-100 shadow-2xl shadow-slate-200/80 p-4 z-50">
                  {/* Avatar header */}
                  <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-emerald-500 text-white text-base font-bold flex-shrink-0">
                      {getInitials(user.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{user.name}</p>
                      <p className="text-xs text-slate-500 truncate">{user.email}</p>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-sky-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.56 3.18 2 2 0 0 1 3.56 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.54a16 16 0 0 0 6 6l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.73 16z" /></svg>
                      <span>{user.phone || 'Phone not set'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                      <span className="capitalize">{user.role || 'Patient'}</span>
                    </div>
                  </div>

                  {/* Sign out */}
                  <button
                    type="button"
                    onClick={() => { setShowProfile(false); onLogout(); }}
                    className="mt-4 w-full rounded-xl bg-rose-50 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-100 transition-colors"
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button className="rounded-full bg-sky-600 px-4 py-1.5 text-sm font-semibold text-white shadow-lg shadow-sky-500/40 transition hover:bg-sky-500">
              Login
            </button>
          )}
        </nav>

        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-700/70 text-slate-200 hover:border-sky-500 hover:text-sky-400 md:hidden"
        >
          <span className="sr-only">Open navigation</span>
          <span className="i-lucide-menu h-4 w-4">☰</span>
        </button>
      </div>
    </header>
  );
}

function HeroSection({ hospitals, onNearbyComputed, getRemainingSlots, registerBooking }) {
  const [showNearby, setShowNearby] = useState(false); // kept but no longer used to open popup
  const [geoStatus, setGeoStatus] = useState('idle');
  const [locationInput, setLocationInput] = useState('');
  const [userLocation, setUserLocation] = useState(null);
  const [nearbyHospitals, setNearbyHospitals] = useState([]);
  const [selectedSpec, setSelectedSpec] = useState('all');
  const [slotFilter, setSlotFilter] = useState('any');
  const hasRequestedGeoRef = React.useRef(false);

  const baseHospitals = Array.isArray(hospitals) ? hospitals : [];

  useEffect(() => {
    // Initialize nearby with some default if available
    if (baseHospitals.length > 0) {
      setNearbyHospitals(baseHospitals.slice(0, 10));
    }
  }, [hospitals]);

  useEffect(() => {
    if (hasRequestedGeoRef.current) return;
    if (!Array.isArray(baseHospitals) || baseHospitals.length === 0) return;
    hasRequestedGeoRef.current = true;
    requestNearbyWithoutScroll();
  }, [baseHospitals]);

  const SPECIALIZATIONS = Array.from(
    new Set(
      baseHospitals.flatMap((hospital) =>
        (hospital.doctors || []).map((doctor) => doctor.specialization),
      ),
    ),
  );

  const [bookingHospital, setBookingHospital] = useState(null);
  const [bookingDoctor, setBookingDoctor] = useState(null);
  const [bookingDate, setBookingDate] = useState('');
  const [bookingTime, setBookingTime] = useState('');

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const maxDate = new Date(today);
  maxDate.setDate(today.getDate() + 7);
  const heroMinDateStr = tomorrow.toISOString().slice(0, 10);
  const heroMaxDateStr = maxDate.toISOString().slice(0, 10);

  const scrollToHospitalsSection = () => {
    if (typeof window === 'undefined') return;
    const target = document.getElementById('hospitals');
    if (target && typeof target.scrollIntoView === 'function') {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const openWithDefaultHospitals = () => {
    const base = baseHospitals.slice(0, 10);
    setNearbyHospitals(base);
    if (onNearbyComputed) {
      onNearbyComputed(baseHospitals);
    }
  };

  const requestNearbyWithoutScroll = () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setGeoStatus('unsupported');
      openWithDefaultHospitals();
      return;
    }

    setGeoStatus('locating');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ lat: latitude, lng: longitude });
        updateNearbyFromCoords(latitude, longitude);
        setGeoStatus('success');
      },
      () => {
        setGeoStatus('denied');
        openWithDefaultHospitals();
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  };

  const updateNearbyFromCoords = (lat, lng) => {
    const withDistance = baseHospitals.map((hospital) => {
      if (hospital.lat == null || hospital.lng == null) {
        return { ...hospital, distanceKm: null };
      }
      const distanceKm = computeDistanceKm(lat, lng, hospital.lat, hospital.lng);
      return {
        ...hospital,
        distanceKm,
        distance: `${distanceKm.toFixed(1)} km`,
      };
    }).sort((a, b) => {
      const aDist = a.distanceKm ?? 9999;
      const bDist = b.distanceKm ?? 9999;
      return aDist - bDist;
    });

    setNearbyHospitals(withDistance.slice(0, 10));
    if (onNearbyComputed) {
      onNearbyComputed(withDistance);
    }
  };

  const handleFindNearbyClick = () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setGeoStatus('unsupported');
      openWithDefaultHospitals();
      scrollToHospitalsSection();
      return;
    }

    setGeoStatus('locating');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ lat: latitude, lng: longitude });
        updateNearbyFromCoords(latitude, longitude);
        setGeoStatus('success');
        scrollToHospitalsSection();
      },
      () => {
        setGeoStatus('denied');
        openWithDefaultHospitals();
        scrollToHospitalsSection();
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  };

  const handleManualSearch = (event) => {
    event.preventDefault();
    const value = locationInput.trim().toLowerCase();
    if (!value) {
      setNearbyHospitals(baseHospitals.slice(0, 10));
      return;
    }
    const filtered = baseHospitals.filter(
      (hospital) =>
        hospital.name.toLowerCase().includes(value) ||
        (hospital.city && hospital.city.toLowerCase().includes(value)),
    );
    const base = filtered.length > 0 ? filtered : baseHospitals;
    setNearbyHospitals(base.slice(0, 10));
  };

  const handleOpenNearbyBooking = (hospital, preSelectedDoctor) => {
    const resolved = resolveHospitalDetailsFromStatic(hospital);
    setBookingHospital(resolved);
    setBookingDate('');
    setBookingTime('');

    if (preSelectedDoctor) {
      setBookingDoctor(preSelectedDoctor);
      // Auto-select first available date for this doctor
      const options = getDateRange(heroMinDateStr, heroMaxDateStr);
      const firstAvailable = options.find((option) =>
        isDoctorAvailableOnDate(preSelectedDoctor.name, option.value),
      );
      if (firstAvailable) {
        setBookingDate(firstAvailable.value);
      }
    } else {
      setBookingDoctor(null);
    }
  };

  const handleCloseNearbyBooking = () => {
    setBookingHospital(null);
    setBookingDoctor(null);
    setBookingDate('');
    setBookingTime('');
  };

  const handleOpenSymptomChat = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('docapoint-open-symptom-chat'));
    }
  };

  // Keyboard shortcuts for booking modal
  React.useEffect(() => {
    if (!bookingHospital) return;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        handleCloseNearbyBooking();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [bookingHospital]);

  React.useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        if (bookingHospital) {
          handleCloseNearbyBooking();
          return;
        }
        if (showNearby) {
          setShowNearby(false);
        }
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('keydown', handleKeyDown);
      }
    };
  }, [bookingHospital, showNearby]);

  return (
    <section className="relative mx-auto flex max-w-6xl flex-col items-center justify-center overflow-hidden px-4 pb-20 pt-12 sm:px-6 md:pb-24 md:pt-16">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-sky-50/50 to-white" />

      <div className="mx-auto w-full max-w-3xl text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50/80 px-4 py-1.5 text-xs font-medium text-emerald-700 shadow-sm backdrop-blur-sm">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          Booking opens 1 day before · real‑time slots
        </div>

        {/* Main heading */}
        <h1 className="mt-8 text-balance text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl md:text-6xl">
          Skip the queue.
          <span className="mt-2 block bg-gradient-to-r from-sky-500 via-emerald-400 to-fuchsia-500 bg-clip-text text-transparent">
            Book tomorrow&apos;s doctor today.
          </span>
        </h1>

        {/* Subtitle */}
        <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
          DocApoint matches your symptoms, location, and availability to the
          right doctor. See live slot counts per hospital and confirm in two
          taps.
        </p>

        {/* CTA Buttons */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <button
            type="button"
            onClick={handleFindNearbyClick}
            className="group inline-flex items-center gap-2 rounded-full bg-sky-600 px-7 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/30 transition-all duration-200 hover:-translate-y-0.5 hover:bg-sky-500 hover:shadow-xl hover:shadow-sky-500/40"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            Find nearby hospitals
          </button>
          <button
            type="button"
            onClick={handleOpenSymptomChat}
            className="group inline-flex items-center gap-2 rounded-full border-2 border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition-all duration-200 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            Help me choose a doctor
          </button>
        </div>

        {/* Stats */}
        <div className="mt-12 grid grid-cols-3 gap-4 sm:gap-8">
          <div className="rounded-2xl bg-white/60 p-4 backdrop-blur-sm ring-1 ring-slate-200/60">
            <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">Hospitals</dt>
            <dd className="mt-1 text-2xl font-bold text-sky-600 sm:text-3xl">
              24
            </dd>
          </div>
          <div className="rounded-2xl bg-white/60 p-4 backdrop-blur-sm ring-1 ring-slate-200/60">
            <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">Next‑day slots</dt>
            <dd className="mt-1 text-2xl font-bold text-emerald-600 sm:text-3xl">
              320+
            </dd>
          </div>
          <div className="rounded-2xl bg-white/60 p-4 backdrop-blur-sm ring-1 ring-slate-200/60">
            <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">Avg. booking</dt>
            <dd className="mt-1 text-2xl font-bold text-fuchsia-600 sm:text-3xl">
              45s
            </dd>
          </div>
        </div>
      </div>

      {false && showNearby && (
        <div className="fixed inset-0 z-30 flex items-center justify-center px-4 nearby-overlay-backdrop">
          <div className="w-full max-w-3xl rounded-[2rem] bg-gradient-to-b from-white to-sky-50/70 p-4 shadow-xl shadow-sky-200/70 ring-1 ring-sky-100/80 sm:p-6 nearby-overlay-panel">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-600">
                  Nearby hospitals
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  Based on your location
                </p>
                {geoStatus === 'locating' && (
                  <p className="mt-1 text-xs text-slate-500">Detecting your location…</p>
                )}
                {geoStatus === 'denied' && (
                  <p className="mt-1 text-xs text-amber-600">
                    Location access was blocked. Showing generic results. You can refine by
                    city or area below.
                  </p>
                )}
                {geoStatus === 'unsupported' && (
                  <p className="mt-1 text-xs text-slate-500">
                    This browser does not support location. Showing generic hospitals; you
                    can filter by city.
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowNearby(false)}
                className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 shadow-sm hover:border-sky-400 hover:bg-slate-50 hover:text-sky-600"
              >
                Close
              </button>
            </div>

            <form
              onSubmit={handleManualSearch}
              className="mt-4 flex flex-col gap-2 text-xs sm:flex-row sm:items-center"
            >
              <input
                type="text"
                value={locationInput}
                onChange={(event) => setLocationInput(event.target.value)}
                placeholder="Enter city, area, or pincode"
                className="h-9 flex-1 rounded-full border border-slate-300 bg-slate-50 px-3 text-[0.75rem] text-slate-800 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
              <button
                type="submit"
                className="h-9 rounded-full bg-sky-600 px-4 text-[0.75rem] font-semibold text-white shadow-md shadow-sky-400/40 transition hover:-translate-y-[1px] hover:bg-sky-500"
              >
                Search
              </button>
            </form>

            <div className="mt-3 flex flex-wrap items-center gap-3 text-[0.7rem] text-slate-600">
              <div className="flex items-center gap-1">
                <span className="text-slate-500">Specialization</span>
                <select
                  value={selectedSpec}
                  onChange={(event) => setSelectedSpec(event.target.value)}
                  className="h-7 w-32 rounded-full border border-slate-300 bg-slate-50 px-2 text-[0.7rem] focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 sm:w-40"
                >
                  <option value="all">All</option>
                  {SPECIALIZATIONS.map((spec) => (
                    <option key={spec} value={spec}>
                      {spec}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-slate-500">Slots</span>
                <select
                  value={slotFilter}
                  onChange={(event) => setSlotFilter(event.target.value)}
                  className="h-7 rounded-full border border-slate-300 bg-slate-50 px-2 text-[0.7rem] focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  <option value="any">Any</option>
                  <option value="gt20">20+ slots</option>
                  <option value="10-19">10–19 slots</option>
                  <option value="lt10">&lt; 10 slots</option>
                </select>
              </div>
            </div>

            <div className="mt-4 max-h-72 space-y-2 overflow-y-auto pr-1 text-xs nearby-scroll">
              {nearbyHospitals
                .filter((hospital) => {
                  const parseKm = (label) => {
                    if (!label) return 9999;
                    const match = label.match(/([0-9]+(?:\.[0-9]+)?)/);
                    if (!match) return 9999;
                    const value = Number.parseFloat(match[1]);
                    return Number.isNaN(value) ? 9999 : value;
                  };

                  const matchesSpec =
                    selectedSpec === 'all' ||
                    (hospital.doctors &&
                      hospital.doctors.some(
                        (doctor) => doctor.specialization === selectedSpec,
                      ));
                  const matchesSlots = matchesSlotFilter(
                    hospital.availableSlotsLabel,
                    slotFilter,
                  );
                  const isWithinRange = parseKm(hospital.distance) <= 20;
                  return matchesSpec && matchesSlots && isWithinRange;
                })
                .map((hospital) => (
                  <div
                    role="button"
                    tabIndex={0}
                    key={hospital.id || hospital.name}
                    onClick={() => handleOpenNearbyBooking(hospital)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        handleOpenNearbyBooking(hospital);
                      }
                    }}
                    className="flex w-full items-start justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white/80 px-3 py-2.5 text-left shadow-sm shadow-slate-200/60 transition hover:-translate-y-[1px] hover:border-sky-400 hover:bg-sky-50 hover:shadow-sky-100/80 cursor-pointer"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {hospital.name}
                      </p>
                      <p className="mt-0.5 text-[0.7rem] text-slate-500">
                        {hospital.city} · {hospital.address}
                      </p>
                      {hospital.doctors && hospital.doctors.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1 text-[0.7rem] text-slate-500">
                          Top doctors:{' '}
                          {hospital.doctors.slice(0, 3).map((doctor, index) => (
                            <button
                              type="button"
                              key={`${hospital.id}-${doctor.name}-${index}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenNearbyBooking(hospital, doctor);
                              }}
                              className="cursor-pointer hover:text-sky-600 hover:underline bg-transparent border-none p-0 inline text-left font-inherit"
                            >
                              {doctor.name} ({doctor.specialization})
                              {index < Math.min(2, hospital.doctors.length - 1) ? ', ' : ''}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {hospital.distanceKm != null && (
                        <span className="text-[0.7rem] text-slate-500">
                          ~{hospital.distanceKm.toFixed(1)} km
                        </span>
                      )}
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[0.65rem] font-medium text-emerald-700">
                        {hospital.availableSlotsLabel || 'Tomorrow slots available'}
                      </span>
                    </div>
                  </div>
                ))}
              {nearbyHospitals.filter((hospital) => {
                const parseKm = (label) => {
                  if (!label) return 9999;
                  const match = label.match(/([0-9]+(?:\.[0-9]+)?)/);
                  if (!match) return 9999;
                  const value = Number.parseFloat(match[1]);
                  return Number.isNaN(value) ? 9999 : value;
                };
                const matchesSpec = selectedSpec === 'all' || (hospital.doctors && hospital.doctors.some((doctor) => doctor.specialization === selectedSpec));
                const matchesSlots = matchesSlotFilter(hospital.availableSlotsLabel, slotFilter);
                return matchesSpec && matchesSlots && parseKm(hospital.distance) <= 20;
              }).length === 0 && (
                  <div className="flex flex-col items-center justify-center p-6 text-center bg-white/50 rounded-2xl border border-dashed border-slate-300">
                    <span className="text-2xl mb-2">🌍</span>
                    <p className="text-[0.75rem] font-medium text-slate-700">
                      No nearby hospitals found.
                    </p>
                    <p className="text-[0.65rem] text-slate-500 mt-1">
                      We are expanding our service. Please check back later!
                    </p>
                  </div>
                )}
            </div>
          </div>
        </div>
      )}

      {bookingHospital && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-5 shadow-2xl ring-1 ring-slate-200 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-600">
                  Book at {bookingHospital.name}
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  Choose a doctor, date, and time.
                </p>
                {bookingHospital.city && bookingHospital.address && (
                  <p className="mt-1 text-[0.7rem] text-slate-500">
                    {bookingHospital.city} · {bookingHospital.address}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={handleCloseNearbyBooking}
                className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:border-sky-400 hover:text-sky-600"
              >
                Close
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div className="grid gap-4 md:grid-cols-[1.1fr,1fr] md:items-start">
                <div>
                  <p className="text-[0.7rem] font-semibold text-slate-700">
                    1. Choose a date
                  </p>
                  <div className="mt-2 flex flex-col items-start gap-2">
                    <div className="flex flex-wrap gap-2">
                      {getDateRange(heroMinDateStr, heroMaxDateStr).map((option) => {
                        const isAvailable =
                          !bookingDoctor ||
                          isDoctorAvailableOnDate(bookingDoctor, option.value);
                        const isSelected = bookingDate === option.value;
                        const baseClasses =
                          'rounded-full border px-3 py-1 text-[0.75rem] transition';
                        const activeClasses = isSelected
                          ? 'border-sky-600 bg-sky-600 text-white'
                          : 'border-slate-300 bg-slate-50 text-slate-700 hover:border-sky-400 hover:bg-sky-50';
                        const disabledClasses =
                          'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 opacity-50';

                        return (
                          <button
                            key={option.value}
                            type="button"
                            disabled={!isAvailable}
                            onClick={() => {
                              if (!isAvailable) return;
                              setBookingDate(option.value);
                              setBookingTime('');
                            }}
                            className={`${baseClasses} ${isAvailable ? activeClasses : disabledClasses}`}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                    <span className="text-[0.65rem] text-slate-400">
                      {bookingDoctor
                        ? 'Demo only · schedules are sample data.'
                        : 'Pick a doctor first to choose a date.'}
                    </span>
                  </div>
                </div>

                <div>
                  <p className="text-[0.7rem] font-semibold text-slate-700">
                    2. Choose a time
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {bookingDoctor && bookingDate ? (
                      isDoctorAvailableOnDate(bookingDoctor, bookingDate) ? (
                        getDaysFromToday(bookingDate) > 1 ? (
                          <p className="text-[0.75rem] font-medium text-sky-600">
                            Slots open 1 day before. Please book closer to the date.
                          </p>
                        ) : (
                          DEFAULT_TIME_SLOTS.map((slot) => {
                            const isSelected = bookingTime === slot;
                            const remaining = getRemainingSlots(
                              bookingDoctor.name,
                              slot,
                              bookingDate,
                            );
                            const isDisabled = remaining === 0;
                            return (
                              <button
                                key={slot}
                                type="button"
                                onClick={() => setBookingTime(slot)}
                                className={`rounded-full border px-3 py-1 text-[0.75rem] ${isSelected
                                  ? 'border-sky-600 bg-sky-600 text-white'
                                  : 'border-slate-300 bg-slate-50 text-slate-700 hover:border-sky-400 hover:bg-sky-50'
                                  }`}
                                disabled={isDisabled}
                              >
                                {slot}
                                <span className="ml-1 text-[0.65rem] text-emerald-700">
                                  · {remaining} left
                                </span>
                              </button>
                            );
                          })
                        )
                      ) : (
                        <p className="text-[0.7rem] text-rose-500">
                          {bookingDoctor.name} is not available on this day. Try another
                          date.
                        </p>
                      )
                    ) : (
                      <p className="text-[0.7rem] text-slate-400">
                        Pick a doctor and date first to see available times.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <p className="text-[0.7rem] font-semibold text-slate-700">
                  3. Choose a doctor
                </p>
                <div className="mt-2 grid max-h-64 gap-2 overflow-y-auto pr-1 text-xs sm:grid-cols-2">
                  {bookingHospital.doctors && bookingHospital.doctors.length > 0 ? (
                    bookingHospital.doctors.map((doctor) => {
                      const days = getDoctorAvailableDays(doctor);
                      const label = formatAvailableDaysLabel(days);
                      const isActive =
                        bookingDoctor && bookingDoctor.name === doctor.name;
                      return (
                        <button
                          key={doctor.name}
                          type="button"
                          onClick={() => {
                            setBookingDoctor(doctor);
                            setBookingTime('');
                            // Always auto-select the first available date for this doctor
                            const options = getDateRange(heroMinDateStr, heroMaxDateStr);
                            const firstAvailable = options.find((option) =>
                              isDoctorAvailableOnDate(doctor, option.value),
                            );
                            if (firstAvailable) {
                              setBookingDate(firstAvailable.value);
                            } else {
                              setBookingDate('');
                            }
                          }}
                          className={`flex w-full items-start justify-between rounded-2xl border px-3 py-2.5 text-left transition ${isActive
                            ? 'border-sky-500 bg-sky-50'
                            : 'border-slate-200 bg-slate-50 hover:border-sky-400 hover:bg-sky-50'
                            }`}
                        >
                          <div>
                            <p className="text-sm font-medium text-slate-800">
                              {doctor.name}
                            </p>
                            <p className="mt-0.5 text-[0.7rem] text-slate-500">
                              {doctor.specialization}
                            </p>
                            <p className="mt-0.5 text-[0.65rem] text-emerald-700">
                              Available: {label}
                            </p>
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <p className="text-[0.7rem] text-slate-500">
                      Doctor profiles are coming soon for this hospital.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )
      }
    </section >
  );
}

function HighlightsSection({ hospitals, getRemainingSlots, registerBooking, getDaysFromToday }) {
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState('distance');
  const [searchQuery, setSearchQuery] = useState('');
  const [bookingToast, setBookingToast] = useState(null); // { message, type }

  const [selectedHospital, setSelectedHospital] = useState(null);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [patientName, setPatientName] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [isBooking, setIsBooking] = useState(false);

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const maxDate = new Date(today);
  maxDate.setDate(today.getDate() + 7);
  const minDateStr = tomorrow.toISOString().slice(0, 10);
  const maxDateStr = maxDate.toISOString().slice(0, 10);

  const baseHospitals = Array.isArray(hospitals) ? hospitals : [];

  const handleOpenBooking = (hospital, preSelectedDoctor) => {
    const resolved = resolveHospitalDetailsFromStatic(hospital);
    setSelectedHospital(resolved);
    setSelectedDate('');
    setSelectedTime('');

    if (preSelectedDoctor) {
      setSelectedDoctor(preSelectedDoctor);
      // Auto-select first available date for this doctor
      const options = getDateRange(minDateStr, maxDateStr);
      const firstAvailable = options.find((option) =>
        isDoctorAvailableOnDate(preSelectedDoctor, option.value),
      );
      if (firstAvailable) {
        setSelectedDate(firstAvailable.value);
      }
    } else {
      setSelectedDoctor(null);
    }
  };

  const handleCloseBooking = () => {
    setSelectedHospital(null);
    setSelectedDoctor(null);
    setSelectedDate('');
    setSelectedTime('');
    setPatientName('');
    setPatientAge('');
    setPatientPhone('');
  };

  // Keyboard shortcuts for booking modal
  React.useEffect(() => {
    if (!selectedHospital) return;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        handleCloseBooking();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedHospital]);

  const filteredHospitals = React.useMemo(() => {
    const parseKm = (label) => {
      if (!label) return 9999;
      const match = label.match(/([0-9]+(?:\.[0-9]+)?)/);
      if (!match) return 9999;
      const value = Number.parseFloat(match[1]);
      return Number.isNaN(value) ? 9999 : value;
    };

    const withSlots = baseHospitals.filter((hospital) => {
      const slotCount = parseSlotsCount(hospital.slots || hospital.availableSlotsLabel);
      const isWithinRange = parseKm(hospital.distance) <= 20;
      return (slotCount === null || slotCount > 0) && isWithinRange;
    });

    const byCategory = withSlots.filter((hospital) => {
      if (searchQuery && !hospital.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }

      if (categoryFilter === 'all') return true;

      const tag = (hospital.tag || '').toLowerCase();
      const doctorSpecs = (hospital.doctors || [])
        .map((doctor) => (doctor.specialization || '').toLowerCase())
        .join(' ');

      if (categoryFilter === 'cardiology') {
        return tag.includes('cardio') || doctorSpecs.includes('cardio');
      }
      if (categoryFilter === 'multi') {
        return tag.includes('multi');
      }
      if (categoryFilter === 'ortho-neuro') {
        return (
          tag.includes('ortho') ||
          tag.includes('neuro') ||
          doctorSpecs.includes('ortho') ||
          doctorSpecs.includes('neuro')
        );
      }
      if (categoryFilter === 'government') {
        return tag.includes('government');
      }
      return true;
    });

    const sorted = [...byCategory].sort((a, b) => {
      if (sortBy === 'slots') {
        const aSlots = parseSlotsCount(a.slots || a.availableSlotsLabel) ?? 0;
        const bSlots = parseSlotsCount(b.slots || b.availableSlotsLabel) ?? 0;
        return bSlots - aSlots; // highest first
      }

      const aKm = parseKm(a.distance);
      const bKm = parseKm(b.distance);
      return aKm - bKm; // nearest first
    });

    return sorted.slice(0, 10);
  }, [baseHospitals, categoryFilter, sortBy, searchQuery]);

  return (
    <>
      <section
        id="how-it-works"
        className="border-t border-slate-200 bg-sky-50"
      >
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
          <div className="flex justify-center">
            <div
              id="hospitals"
              className="glass-panel w-full max-w-5xl border border-sky-100 bg-white p-5"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
                Nearby hospitals
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-[0.7rem] text-slate-600">
                <div className="flex items-center gap-1 w-full sm:w-auto">
                  <span className="text-slate-500">Search</span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Hospital name..."
                    className="h-7 w-full sm:w-48 rounded-full border border-slate-300 bg-slate-50 px-3 text-[0.7rem] focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-slate-500">Category</span>
                  <select
                    value={categoryFilter}
                    onChange={(event) => setCategoryFilter(event.target.value)}
                    className="h-7 rounded-full border border-slate-300 bg-slate-50 px-2 text-[0.7rem] focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  >
                    <option value="all">All</option>
                    <option value="cardiology">Cardiology</option>
                    <option value="multi">Multi‑speciality</option>
                    <option value="ortho-neuro">Ortho / Neuro</option>
                    <option value="government">Government</option>
                  </select>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-slate-500">Sort by</span>
                  <select
                    value={sortBy}
                    onChange={(event) => setSortBy(event.target.value)}
                    className="h-7 rounded-full border border-slate-300 bg-slate-50 px-2 text-[0.7rem] focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                  >
                    <option value="distance">Nearest distance</option>
                    <option value="slots">Most slots tomorrow</option>
                  </select>
                </div>
              </div>

              <div className="mt-4 grid gap-3 text-xs md:grid-cols-2">
                {filteredHospitals.map((hospital) => (
                  <div
                    role="button"
                    tabIndex={0}
                    key={hospital.name}
                    onClick={() => handleOpenBooking(hospital)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        handleOpenBooking(hospital);
                      }
                    }}
                    className="flex w-full items-start justify-between rounded-2xl border border-sky-100 bg-white px-3 py-2.5 text-left transition hover:border-sky-400 hover:bg-sky-50 hover:shadow-sm hover:shadow-sky-100 cursor-pointer"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-800">
                        {hospital.name}
                      </p>
                      <p className="mt-0.5 text-[0.7rem] text-slate-500">
                        {hospital.tag}
                      </p>
                      {(resolveHospitalDetailsFromStatic(hospital).doctors || []).length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1 text-[0.7rem] text-slate-500">
                          Top doctors:{' '}
                          {resolveHospitalDetailsFromStatic(hospital)
                            .doctors.slice(0, 3)
                            .map((doctor, index) => (
                              <button
                                type="button"
                                key={`${hospital.name}-${doctor.name}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenBooking(hospital, doctor);
                                }}
                                className="cursor-pointer hover:text-sky-600 hover:underline bg-transparent border-none p-0 inline text-left font-inherit"
                              >
                                {doctor.name} ({doctor.specialization})
                                {index <
                                  Math.min(
                                    2,
                                    resolveHospitalDetailsFromStatic(hospital).doctors.length - 1,
                                  )
                                  ? ', '
                                  : ''}
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="text-[0.7rem] text-slate-500">
                        {hospital.distance}
                      </span>
                      <span className="inline-flex min-w-[4.5rem] flex-col items-center justify-center rounded-full bg-emerald-50 px-3 py-1 text-center text-[0.65rem] font-medium leading-tight text-emerald-700">
                        {hospital.slots}
                      </span>
                    </div>
                  </div>
                ))}
                {filteredHospitals.length === 0 && (
                  <div className="col-span-2 flex flex-col items-center justify-center p-8 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                    <span className="text-3xl mb-2">🌍</span>
                    <p className="text-[0.8rem] font-medium text-slate-700">
                      No nearby hospitals found.
                    </p>
                    <p className="text-[0.7rem] text-slate-500 mt-1">
                      We are expanding our service. Please check back later!
                    </p>
                  </div>
                )}
              </div>
              {selectedHospital && (
                <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/30 px-4 nearby-overlay-backdrop">
                  <div className="w-full max-w-2xl rounded-3xl bg-white p-5 shadow-2xl ring-1 ring-slate-200 sm:p-6 nearby-overlay-panel">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-600">
                          Book at {selectedHospital.name}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          Choose a doctor, date, and time.
                        </p>
                        {selectedHospital.city && selectedHospital.address && (
                          <p className="mt-1 text-[0.7rem] text-slate-500">
                            {selectedHospital.city} · {selectedHospital.address}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={handleCloseBooking}
                        className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:border-sky-400 hover:text-sky-600"
                      >
                        Close
                      </button>
                    </div>

                    <div className="mt-4 space-y-4 text-xs">
                      <div className="grid gap-4 md:grid-cols-[1.1fr,1fr] md:items-start">
                        <div>
                          <p className="text-[0.7rem] font-semibold text-slate-700">
                            1. Choose a date
                          </p>
                          <div className="mt-2 flex flex-col items-start gap-2">
                            <div className="flex flex-wrap gap-2">
                              {getDateRange(minDateStr, maxDateStr).map((option) => {
                                const isAvailable =
                                  !selectedDoctor ||
                                  isDoctorAvailableOnDate(selectedDoctor, option.value);
                                const isSelected = selectedDate === option.value;
                                const baseClasses =
                                  'rounded-full border px-3 py-1 text-[0.75rem] transition';
                                const activeClasses = isSelected
                                  ? 'border-sky-600 bg-sky-600 text-white'
                                  : 'border-slate-300 bg-slate-50 text-slate-700 hover:border-sky-400 hover:bg-sky-50';
                                const disabledClasses =
                                  'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 opacity-50';

                                return (
                                  <button
                                    key={option.value}
                                    type="button"
                                    disabled={!isAvailable}
                                    onClick={() => {
                                      if (!isAvailable) return;
                                      setSelectedDate(option.value);
                                      setSelectedTime('');
                                    }}
                                    className={`${baseClasses} ${isAvailable ? activeClasses : disabledClasses}`}
                                  >
                                    {option.label}
                                  </button>
                                );
                              })}                          </div>
                            <span className="text-[0.65rem] text-slate-400">
                              {selectedDoctor
                                ? 'Demo only · schedules are sample data.'
                                : 'Pick a doctor first to choose a date.'}
                            </span>
                          </div>
                        </div>

                        <div>
                          <p className="text-[0.7rem] font-semibold text-slate-700">
                            2. Choose a time
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {selectedDoctor && selectedDate ? (
                              isDoctorAvailableOnDate(selectedDoctor, selectedDate) ? (
                                getDaysFromToday(selectedDate) > 1 ? (
                                  <p className="text-[0.75rem] font-medium text-sky-600">
                                    Slots open 1 day before. Please book closer to the date.
                                  </p>
                                ) : (
                                  DEFAULT_TIME_SLOTS.map((slot) => {
                                    const isSelected = selectedTime === slot;
                                    const remaining = getRemainingSlots(
                                      selectedDoctor.name,
                                      slot,
                                      selectedDate,
                                    );
                                    const isDisabled = remaining === 0;
                                    return (
                                      <button
                                        key={slot}
                                        type="button"
                                        onClick={() => setSelectedTime(slot)}
                                        className={`rounded-full border px-3 py-1 text-[0.75rem] ${isSelected
                                          ? 'border-sky-600 bg-sky-600 text-white'
                                          : 'border-slate-300 bg-slate-50 text-slate-700 hover:border-sky-400 hover:bg-sky-50'
                                          }`}
                                        disabled={isDisabled}
                                      >
                                        {slot}
                                        <span className="ml-1 text-[0.65rem] text-emerald-700">
                                          · {remaining} left
                                        </span>
                                      </button>
                                    );
                                  })
                                )
                              ) : (
                                <p className="text-[0.7rem] text-rose-500">
                                  {selectedDoctor.name} is not available on this day. Try
                                  another date.
                                </p>
                              )
                            ) : (
                              <p className="text-[0.7rem] text-slate-400">
                                Pick a doctor and date first to see available times.
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      <div>
                        <p className="text-[0.7rem] font-semibold text-slate-700">
                          3. Choose a doctor
                        </p>
                        <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
                          {selectedHospital.doctors && selectedHospital.doctors.length > 0 ? (
                            selectedHospital.doctors.map((doctor) => {
                              const days = getDoctorAvailableDays(doctor);
                              const label = formatAvailableDaysLabel(days);
                              const isActive =
                                selectedDoctor && selectedDoctor.name === doctor.name;
                              return (
                                <button
                                  key={doctor.name}
                                  type="button"
                                  onClick={() => {
                                    setSelectedDoctor(doctor);
                                    setSelectedTime('');
                                    const options = getDateRange(minDateStr, maxDateStr);
                                    const firstAvailable = options.find((option) =>
                                      isDoctorAvailableOnDate(doctor, option.value),
                                    );
                                    if (firstAvailable) {
                                      setSelectedDate(firstAvailable.value);
                                    } else {
                                      setSelectedDate('');
                                    }
                                  }}
                                  className={`flex w-full items-start justify-between rounded-2xl border px-3 py-2.5 text-left transition ${isActive
                                    ? 'border-sky-500 bg-sky-50'
                                    : 'border-slate-200 bg-slate-50 hover:border-sky-400 hover:bg-sky-50'
                                    }`}
                                >
                                  <div>
                                    <p className="text-sm font-medium text-slate-800">
                                      {doctor.name}
                                    </p>
                                    <p className="mt-0.5 text-[0.7rem] text-slate-500">
                                      {doctor.specialization}
                                    </p>
                                    <p className="mt-0.5 text-[0.65rem] text-emerald-700">
                                      Available: {label}
                                    </p>
                                  </div>
                                </button>
                              );
                            })
                          ) : (
                            <p className="text-[0.7rem] text-slate-500">
                              Doctor profiles are coming soon for this hospital.
                            </p>
                          )}
                        </div>
                      </div>

                      {selectedDoctor && selectedDate && selectedTime && (
                        <div className="space-y-3">
                          <div className="rounded-2xl bg-emerald-50 px-3 py-2 text-[0.7rem] text-emerald-800">
                            <p className="font-semibold">Booking summary</p>
                            <p className="mt-0.5">
                              {selectedDoctor.name} · {selectedDoctor.specialization}
                            </p>
                            <p className="mt-0.5">
                              {selectedHospital.name} · {selectedDate} at {selectedTime}
                            </p>
                          </div>

                          {/* Patient Details Form */}
                          <div className="space-y-2">
                            <p className="text-[0.7rem] font-semibold text-slate-700">Patient Details</p>
                            <input
                              type="text"
                              value={patientName}
                              onChange={(e) => setPatientName(e.target.value)}
                              placeholder="Patient name"
                              className="h-8 w-full rounded-full border border-slate-300 bg-white px-3 text-[0.75rem] text-slate-800 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                            />
                            <div className="flex gap-2">
                              <input
                                type="number"
                                value={patientAge}
                                onChange={(e) => setPatientAge(e.target.value)}
                                placeholder="Age"
                                min="0"
                                max="120"
                                className="h-8 w-20 rounded-full border border-slate-300 bg-white px-3 text-[0.75rem] text-slate-800 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                              />
                              <input
                                type="tel"
                                value={patientPhone}
                                onChange={(e) => setPatientPhone(e.target.value)}
                                placeholder="Phone number"
                                className="h-8 flex-1 rounded-full border border-slate-300 bg-white px-3 text-[0.75rem] text-slate-800 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                              />
                            </div>
                          </div>

                          <button
                            type="button"
                            disabled={!patientName || !patientAge || !patientPhone || isBooking}
                            onClick={async () => {
                              setIsBooking(true);
                              // 1. Update local slot count
                              registerBooking(selectedDoctor.name, selectedTime, selectedDate);

                              // 2. Persist booking to MongoDB
                              const bookingPayload = {
                                hospitalId: selectedHospital.id || selectedHospital.hospitalId || '',
                                hospitalName: selectedHospital.name,
                                doctorName: selectedDoctor.name,
                                doctorSpecialization: selectedDoctor.specialization,
                                appointmentDate: selectedDate,
                                appointmentTime: selectedTime,
                                patientName,
                                patientAge,
                                patientPhone,
                              };
                              try {
                                await fetch(`${API_BASE_URL}/api/bookings`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify(bookingPayload),
                                });
                              } catch (err) {
                                console.error('Failed to save booking:', err);
                              }

                              // 3. Close modal & show success toast
                              handleCloseBooking();
                              setIsBooking(false);
                              setBookingToast({
                                message: `✅ Appointment confirmed! ${selectedDoctor.name} on ${selectedDate} at ${selectedTime}.`,
                                type: 'success',
                              });
                              setTimeout(() => setBookingToast(null), 5000);
                            }}
                            className="flex h-9 w-full items-center justify-center rounded-full bg-sky-600 text-[0.8rem] font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isBooking ? 'Booking...' : 'Book appointment'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Booking success toast */}
      {bookingToast && (
        <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', zIndex: 9999 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#059669', color: 'white', borderRadius: '16px', padding: '12px 20px', fontSize: '0.875rem', fontWeight: 500, boxShadow: '0 8px 32px rgba(5,150,105,0.4)' }}>
            <span>{bookingToast.message}</span>
            <button type="button" onClick={() => setBookingToast(null)} style={{ marginLeft: '8px', background: 'none', border: 'none', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', fontSize: '1rem' }}>×</button>
          </div>
        </div>
      )}
    </>
  );
}

function HospitalDashboard({ hospital, onBack, slotBookings, slotCapacityPerHour }) {
  const [selectedDayTab, setSelectedDayTab] = useState('today'); // 'today' | 'tomorrow'

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const activeDate = selectedDayTab === 'today' ? today : tomorrow;
  const activeDayIndex = activeDate.getDay();
  const activeDateISO = `${activeDate.getFullYear()}-${String(activeDate.getMonth() + 1).padStart(2, '0')}-${String(activeDate.getDate()).padStart(2, '0')}`;

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Build doctor list from hospital prop
  const allDoctors = (hospital?.doctors || []).map((d, i) => ({
    id: i + 1,
    name: d.name,
    specialization: d.specialization,
    availableDays: d.availableDays || [],
    availability: (d.availableDays || []).map(dn => dayLabels[dn]).join(', '),
    slotsPerDay: 6,
    bookingsPerSlot: 0,
  }));

  // Store all doctors in local state, filter on the fly
  const [doctors, setDoctors] = useState(allDoctors);
  const displayedDoctors = doctors.filter(d => d.availableDays.includes(activeDayIndex));


  const [newDoctorName, setNewDoctorName] = useState('');
  const [newDoctorSpec, setNewDoctorSpec] = useState('');
  const [newDoctorDays, setNewDoctorDays] = useState([1, 2, 3, 4, 5]);
  const [showAddDoctorForm, setShowAddDoctorForm] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [showEditDoctorsModal, setShowEditDoctorsModal] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState(null);
  const [tempAvailability, setTempAvailability] = useState({
    availableDays: [],
    slotsPerDay: 6,
    bookingsPerSlot: 0,
  });

  // Bookings start empty, then load from DB
  const [bookings, setBookings] = useState([]);

  // Fetch bookings from backend when the dashboard loads
  useEffect(() => {
    const fetchId = hospital?.hospitalId || hospital?.id;
    if (!fetchId) return;
    fetch(`${API_BASE_URL}/api/bookings/hospital/${fetchId}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setBookings(data);
      })
      .catch(() => { }); // silently ignore if offline
  }, [hospital?.hospitalId]);

  const handleAddDoctor = (event) => {
    event.preventDefault();
    const trimmedName = newDoctorName.trim();
    const trimmedSpec = newDoctorSpec.trim();
    if (!trimmedName || !trimmedSpec) {
      return;
    }
    const days = newDoctorDays.length > 0 ? newDoctorDays : [1, 2, 3, 4, 5];
    const dayLabels2 = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    setDoctors((prev) => [
      ...prev,
      {
        id: Date.now(),
        name: trimmedName,
        specialization: trimmedSpec,
        availability: days.map(d => dayLabels2[d]).join(', '),
        availableDays: days,
        slotsPerDay: 6,
        bookingsPerSlot: 1,
      },
    ]);
    setNewDoctorName('');
    setNewDoctorSpec('');
    setNewDoctorDays([1, 2, 3, 4, 5]);
    setShowAddDoctorForm(false);
  };

  const handleRemoveDoctor = (id) => {
    setDoctors((prev) => prev.filter((doctor) => doctor.id !== id));
    if (selectedDoctor?.id === id) {
      setSelectedDoctor(null);
    }
  };

  const markBookingCompleted = async (bookingId) => {
    // Set deleting state to trigger fade-out animation
    setBookings((prev) =>
      prev.map((b) => (b.id === bookingId ? { ...b, isDeleting: true } : b))
    );
    setTimeout(async () => {
      try {
        await fetch(`${API_BASE_URL}/api/bookings/${bookingId}`, { method: 'DELETE' });
        setBookings((prev) => prev.filter((b) => b.id !== bookingId));
      } catch (err) {
        console.error('Failed to complete booking', err);
      }
    }, 400);
  };

  const cancelBooking = async (bookingId) => {
    // Using same fade-out animation
    setBookings((prev) =>
      prev.map((b) => (b.id === bookingId ? { ...b, isDeleting: true } : b))
    );
    setTimeout(async () => {
      try {
        await fetch(`${API_BASE_URL}/api/bookings/${bookingId}`, { method: 'DELETE' });
        setBookings((prev) => prev.filter((b) => b.id !== bookingId));
      } catch (err) {
        console.error('Failed to cancel booking', err);
      }
    }, 400);
  };

  const displayedBookings = bookings.filter(b => b.appointmentDate === activeDateISO);

  const getActiveBookingsCount = (doctorName) => {
    return displayedBookings.filter(
      (b) => b.doctorName === doctorName && b.status !== 'Completed'
    ).length;
  };

  const openAvailabilityModal = (doctor, event) => {
    event.stopPropagation();
    setEditingDoctor(doctor);
    setTempAvailability({
      availableDays: [...(doctor.availableDays || [])],
      slotsPerDay: doctor.slotsPerDay || 6,
      bookingsPerSlot: doctor.bookingsPerSlot || 1,
    });
  };

  const closeAvailabilityModal = () => {
    setEditingDoctor(null);
    setTempAvailability({
      availableDays: [],
      slotsPerDay: 6,
      bookingsPerSlot: 1,
    });
  };

  const saveAvailability = async () => {
    if (!editingDoctor) return;
    const daysStr = tempAvailability.availableDays.length > 0
      ? tempAvailability.availableDays.map(d => dayLabels[d]).join(', ')
      : 'No days selected';
    const newAvailability = `${daysStr} · 09:00–17:00`;

    // 1. Update local state immediately for instant UI feedback
    setDoctors((prev) => {
      const updated = prev.map((doctor) =>
        doctor.id === editingDoctor.id
          ? {
            ...doctor,
            availability: newAvailability,
            availableDays: tempAvailability.availableDays,
            slotsPerDay: tempAvailability.slotsPerDay,
            bookingsPerSlot: tempAvailability.bookingsPerSlot,
          }
          : doctor
      );
      // We now keep all doctors in state, so we don't filter them out here
      return updated;
    });

    // 2. Persist to MongoDB via backend PATCH endpoint
    if (hospital?.hospitalId) {
      const doctorIndex = editingDoctor.id - 1; // id is 1-based, index is 0-based
      try {
        await fetch(
          `${API_BASE_URL}/api/hospitals/${hospital.hospitalId}/doctors/${doctorIndex}/availability`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ availableDays: tempAvailability.availableDays }),
          }
        );
      } catch (err) {
        console.error('Failed to persist availability to database:', err);
      }
    }

    closeAvailabilityModal();
  };

  const toggleDay = (dayIndex) => {
    setTempAvailability((prev) => {
      const hasDay = prev.availableDays.includes(dayIndex);
      const newDays = hasDay
        ? prev.availableDays.filter((d) => d !== dayIndex)
        : [...prev.availableDays, dayIndex].sort();
      return { ...prev, availableDays: newDays };
    });
  };

  // Keyboard shortcuts for availability modal
  React.useEffect(() => {
    if (!editingDoctor) return;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        closeAvailabilityModal();
      } else if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        saveAvailability();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingDoctor, tempAvailability]);

  return (
    <section className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600">
            Hospital Dashboard · {activeDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
          </p>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-1">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
              {hospital?.name || 'Hospital Dashboard'}
            </h1>

            <div className="flex items-center gap-3">
              <div className="flex rounded-full bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => { setSelectedDayTab('today'); setSelectedDoctor(null); }}
                  className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${selectedDayTab === 'today' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => { setSelectedDayTab('tomorrow'); setSelectedDoctor(null); }}
                  className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${selectedDayTab === 'tomorrow' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Tomorrow
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[0.7rem] font-semibold text-emerald-700 ring-1 ring-emerald-200">
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
              {displayedDoctors.length} doctors available {selectedDayTab}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1 text-[0.7rem] font-semibold text-sky-700 ring-1 ring-sky-200">
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
              {displayedBookings.length} bookings {selectedDayTab}
            </span>
          </div>
        </div>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="rounded-full border border-slate-300 bg-white px-4 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:border-rose-300 hover:text-rose-600"
          >
            ← Sign Out
          </button>
        )}
      </div>

      {/* Availability Modal */}
      {editingDoctor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl ring-1 ring-slate-200 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-600">
                  Edit Availability
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {editingDoctor.name}
                </p>
              </div>
              <button
                type="button"
                onClick={closeAvailabilityModal}
                className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:border-sky-400 hover:text-sky-600"
              >
                Close
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              {/* Day Selection */}
              <div>
                <p className="text-[0.7rem] font-semibold text-slate-700 mb-2">
                  Select Available Days
                </p>
                <div className="flex flex-wrap gap-2">
                  {dayLabels.map((day, index) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(index)}
                      className={`rounded-full border px-3 py-1.5 text-[0.75rem] transition ${tempAvailability.availableDays.includes(index)
                        ? 'border-sky-600 bg-sky-600 text-white'
                        : 'border-slate-300 bg-slate-50 text-slate-700 hover:border-sky-400 hover:bg-sky-50'
                        }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>

              {/* Slots Per Day */}
              <div>
                <p className="text-[0.7rem] font-semibold text-slate-700 mb-2">
                  Slots Per Day
                </p>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setTempAvailability((prev) => ({
                        ...prev,
                        slotsPerDay: Math.max(1, prev.slotsPerDay - 1),
                      }))
                    }
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 bg-slate-50 text-slate-700 hover:border-sky-400 hover:bg-sky-50"
                  >
                    −
                  </button>
                  <span className="text-sm font-semibold text-slate-900 w-8 text-center">
                    {tempAvailability.slotsPerDay}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setTempAvailability((prev) => ({
                        ...prev,
                        slotsPerDay: Math.min(20, prev.slotsPerDay + 1),
                      }))
                    }
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 bg-slate-50 text-slate-700 hover:border-sky-400 hover:bg-sky-50"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Bookings Per Slot */}
              <div>
                <p className="text-[0.7rem] font-semibold text-slate-700 mb-2">
                  Bookings Per Slot
                </p>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setTempAvailability((prev) => ({
                        ...prev,
                        bookingsPerSlot: Math.max(1, prev.bookingsPerSlot - 1),
                      }))
                    }
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 bg-slate-50 text-slate-700 hover:border-sky-400 hover:bg-sky-50"
                  >
                    −
                  </button>
                  <span className="text-sm font-semibold text-slate-900 w-8 text-center">
                    {tempAvailability.bookingsPerSlot}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setTempAvailability((prev) => ({
                        ...prev,
                        bookingsPerSlot: Math.min(10, prev.bookingsPerSlot + 1),
                      }))
                    }
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 bg-slate-50 text-slate-700 hover:border-sky-400 hover:bg-sky-50"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Save Button */}
              <button
                type="button"
                onClick={saveAvailability}
                className="flex h-10 w-full items-center justify-center rounded-full bg-emerald-600 text-[0.8rem] font-semibold text-white shadow-sm transition hover:bg-emerald-500"
              >
                Save Availability
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr,1fr]">
        {/* Doctors List Section */}
        <div className="space-y-4">
          <div className="rounded-3xl bg-white/95 p-4 shadow-sm ring-1 ring-slate-200 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900">Doctors in this hospital</h2>
              <button
                type="button"
                onClick={() => setShowEditDoctorsModal(true)}
                className="flex items-center gap-1 rounded-full bg-gradient-to-r from-sky-500 to-blue-500 px-3 py-1.5 text-[0.7rem] font-semibold text-white shadow-sm transition hover:scale-105 hover:from-sky-600 hover:to-blue-600"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Edit Doctors
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              {displayedDoctors.length === 0 ? (
                <p className="rounded-2xl bg-slate-50 px-3 py-2 text-[0.75rem] text-slate-500">
                  No doctors available {selectedDayTab}.
                </p>
              ) : (
                displayedDoctors.map((doctor) => (
                  <div
                    key={doctor.id}
                    onClick={() => setSelectedDoctor(selectedDoctor?.id === doctor.id ? null : doctor)}
                    className={`flex flex-col gap-2 rounded-2xl border px-3 py-2.5 sm:flex-row sm:items-start sm:justify-between cursor-pointer transition ${selectedDoctor?.id === doctor.id
                      ? 'border-sky-400 bg-sky-50'
                      : 'border-slate-200 bg-slate-50 hover:border-sky-300 hover:bg-slate-100'
                      }`}
                  >
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900">
                          {doctor.name}
                        </p>
                        {(() => {
                          const count = getActiveBookingsCount(doctor.name);
                          return count > 0 ? (
                            <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-rose-500 px-1.5 text-[0.65rem] font-bold text-white">
                              {count}
                            </span>
                          ) : null;
                        })()}
                      </div>
                      <p className="text-[0.75rem] text-slate-600">
                        {doctor.specialization}
                      </p>
                      <div className="mt-1 flex flex-col gap-1 text-[0.7rem] text-slate-600">
                        <span className="font-medium text-slate-700">Availability</span>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[0.65rem] text-sky-700">
                            {doctor.availability}
                          </span>
                          <span className="text-[0.65rem] text-slate-500">
                            ({doctor.slotsPerDay} slots/day, {doctor.bookingsPerSlot} booking/slot)
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        {/* ── Edit Doctors Modal ── */}
        {showEditDoctorsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
            <div className="w-full max-w-xl rounded-3xl bg-white p-5 shadow-2xl ring-1 ring-slate-200 sm:p-6 max-h-[90vh] flex flex-col">
              {/* Modal header */}
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-sky-600">Hospital Doctors</p>
                  <h2 className="mt-0.5 text-base font-bold text-slate-900">Edit Doctors</h2>
                </div>
                <button
                  type="button"
                  onClick={() => { setShowEditDoctorsModal(false); setEditingDoctor(null); }}
                  className="rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:border-sky-400 hover:text-sky-600 transition"
                >
                  Close
                </button>
              </div>

              {/* Scrollable doctor list */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {doctors.map((doctor) => (
                  <div key={doctor.id}>
                    {editingDoctor?.id === doctor.id ? (
                      /* Inline availability editor for this doctor */
                      <div className="rounded-2xl border border-sky-200 bg-sky-50 p-3 space-y-3">
                        <p className="text-xs font-bold text-sky-700">{doctor.name} — Edit Schedule</p>
                        <div className="flex flex-wrap gap-2">
                          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((label, index) => (
                            <button
                              key={label}
                              type="button"
                              onClick={() => toggleDay(index)}
                              className={`rounded-full border px-3 py-1 text-[0.7rem] font-semibold transition ${
                                tempAvailability.availableDays.includes(index)
                                  ? 'border-sky-500 bg-sky-500 text-white'
                                  : 'border-slate-300 bg-white text-slate-600 hover:border-sky-400'
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={saveAvailability}
                            className="flex-1 rounded-full bg-emerald-500 py-1.5 text-[0.75rem] font-bold text-white transition hover:bg-emerald-600"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingDoctor(null)}
                            className="rounded-full border border-slate-300 px-4 py-1.5 text-[0.75rem] font-medium text-slate-600 transition hover:border-slate-400"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 hover:border-sky-200 hover:bg-sky-50 transition">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">{doctor.name}</p>
                          <p className="text-[0.7rem] text-slate-500">{doctor.specialization}</p>
                          <span className="mt-1 inline-block rounded-full bg-sky-100 px-2 py-0.5 text-[0.65rem] text-sky-700">
                            {doctor.availability || 'No schedule set'}
                          </span>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => openAvailabilityModal(doctor, { stopPropagation: () => {} })}
                            className="rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 px-3 py-1 text-[0.7rem] font-bold text-white shadow-sm transition hover:scale-105 hover:from-emerald-500 hover:to-emerald-600"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveDoctor(doctor.id)}
                            className="rounded-full bg-gradient-to-r from-rose-400 to-rose-500 px-3 py-1 text-[0.7rem] font-bold text-white shadow-sm transition hover:scale-105 hover:from-rose-500 hover:to-rose-600"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Add a new doctor — collapsed button / expanded form */}
                <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-4">
                  {!showAddDoctorForm ? (
                    <button
                      type="button"
                      onClick={() => setShowAddDoctorForm(true)}
                      className="w-full flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-sky-500 to-blue-500 py-2 text-[0.8rem] font-bold text-white shadow-sm transition hover:scale-105 hover:from-sky-600 hover:to-blue-600"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                      Add Doctor
                    </button>
                  ) : (
                    <form onSubmit={handleAddDoctor} className="space-y-4">
                      <p className="text-[0.75rem] font-bold text-sky-700">➕ New Doctor Details</p>

                      {/* Name */}
                      <div className="space-y-1">
                        <label className="text-[0.7rem] font-semibold text-slate-600">Doctor Name</label>
                        <input
                          type="text"
                          value={newDoctorName}
                          onChange={(e) => setNewDoctorName(e.target.value)}
                          className="h-8 w-full rounded-full border border-slate-300 bg-white px-3 text-[0.7rem] text-slate-800 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                          placeholder="e.g., Dr. Kavya Rao"
                        />
                      </div>

                      {/* Specialization */}
                      <div className="space-y-1">
                        <label className="text-[0.7rem] font-semibold text-slate-600">Specialization</label>
                        <input
                          type="text"
                          value={newDoctorSpec}
                          onChange={(e) => setNewDoctorSpec(e.target.value)}
                          className="h-8 w-full rounded-full border border-slate-300 bg-white px-3 text-[0.7rem] text-slate-800 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                          placeholder="e.g., Cardiologist"
                        />
                      </div>

                      {/* Schedule */}
                      <div className="space-y-2">
                        <label className="text-[0.7rem] font-semibold text-slate-600">Schedule (select available days)</label>
                        <div className="flex flex-wrap gap-2">
                          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label, index) => (
                            <button
                              key={label}
                              type="button"
                              onClick={() => setNewDoctorDays(prev =>
                                prev.includes(index) ? prev.filter(d => d !== index) : [...prev, index].sort()
                              )}
                              className={`rounded-full border px-3 py-1 text-[0.7rem] font-semibold transition ${
                                newDoctorDays.includes(index)
                                  ? 'border-sky-500 bg-sky-500 text-white'
                                  : 'border-slate-300 bg-white text-slate-600 hover:border-sky-400'
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => { setShowAddDoctorForm(false); setNewDoctorName(''); setNewDoctorSpec(''); setNewDoctorDays([1,2,3,4,5]); }}
                          className="rounded-full border border-slate-300 px-4 py-1.5 text-[0.75rem] font-medium text-slate-600 transition hover:border-slate-400"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="inline-flex items-center rounded-full bg-gradient-to-r from-sky-500 to-blue-500 px-4 py-1.5 text-[0.75rem] font-bold text-white shadow-sm transition hover:scale-105 hover:from-sky-600 hover:to-blue-600"
                        >
                          + Add Doctor
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        </div>{/* end left doctors column */}

        {/* Bookings Panel Section */}
        <div className="space-y-3 rounded-3xl bg-white/95 p-4 shadow-sm ring-1 ring-slate-200 sm:p-5 h-fit">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900">
              {selectedDoctor ? `Bookings for ${selectedDoctor.name}` : 'Bookings'}
            </h2>
            <p className="text-[0.7rem] text-slate-500">
              {selectedDoctor ? 'Appointments' : 'Select a doctor'}
            </p>
          </div>

          {!selectedDoctor ? (
            <div className="flex h-64 items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50">
              <div className="text-center">
                <p className="text-sm font-medium text-slate-600">No doctor selected</p>
                <p className="mt-1 text-[0.7rem] text-slate-500">
                  Click on a doctor to view their bookings
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-2 space-y-2 text-[0.7rem] text-slate-700">
              {displayedBookings.filter(b => b.doctorName === selectedDoctor.name && b.status !== 'Completed').length === 0 &&
                displayedBookings.filter(b => b.doctorName === selectedDoctor.name && b.status === 'Completed').length === 0 ? (
                <div className="flex h-64 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50">
                  <p className="text-[0.75rem] text-slate-500">
                    No bookings for {selectedDoctor.name} {selectedDayTab}.
                  </p>
                </div>
              ) : (
                <>
                  {/* Active bookings */}
                  {displayedBookings
                    .filter(b => b.doctorName === selectedDoctor.name && b.status !== 'Completed')
                    .map((booking) => (
                      <div
                        key={booking.id}
                        className={`flex flex-col gap-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition-all duration-400 ease-out hover:shadow-md ${booking.isDeleting ? 'scale-90 opacity-0' : 'scale-100 opacity-100'}`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-bold text-slate-800 tracking-tight">
                            {booking.patientName}
                          </span>
                          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[0.65rem] font-bold tracking-wider text-amber-700 uppercase">
                            {booking.status}
                          </span>
                        </div>
                        <p className="text-slate-500 text-xs mt-1 font-medium">
                          📅 {booking.appointmentDate} &nbsp; ⏰ {booking.appointmentTime}
                        </p>
                        {booking.patientPhone && <p className="text-slate-400 text-[0.65rem]">📞 {booking.patientPhone} · 👤 {booking.patientAge} years</p>}
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            onClick={() => markBookingCompleted(booking.id)}
                            className="flex-1 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 px-2 py-1.5 text-[0.7rem] font-bold text-white shadow-sm transition-all hover:scale-105 hover:from-emerald-500 hover:to-emerald-600 hover:shadow-emerald-200"
                          >
                            ✓ Completed
                          </button>
                          <button
                            type="button"
                            onClick={() => cancelBooking(booking.id)}
                            className="flex-1 rounded-full bg-gradient-to-r from-rose-400 to-rose-500 px-2 py-1.5 text-[0.7rem] font-bold text-white shadow-sm transition-all hover:scale-105 hover:from-rose-500 hover:to-rose-600 hover:shadow-rose-200"
                          >
                            ✕ Cancel
                          </button>
                        </div>
                      </div>
                    ))}

                  {/* Completed bookings */}
                  {displayedBookings.filter(b => b.doctorName === selectedDoctor.name && b.status === 'Completed').length > 0 && (
                    <div className="mt-3 pt-2 border-t border-slate-200">
                      <p className="text-[0.65rem] text-slate-400 mb-2">Completed appointments</p>
                      {displayedBookings
                        .filter(b => b.doctorName === selectedDoctor.name && b.status === 'Completed')
                        .map((booking) => (
                          <div
                            key={booking.id}
                            className="flex flex-col gap-1 rounded-2xl border border-slate-200 bg-slate-100/50 px-3 py-2 opacity-60"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-semibold text-slate-700">
                                {booking.patientName}
                              </span>
                              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[0.65rem] font-medium text-slate-600">
                                Completed
                              </span>
                            </div>
                            <p className="text-slate-500">
                              {booking.appointmentDate} · {booking.appointmentTime}
                            </p>
                          </div>
                        ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <p className="mt-2 text-[0.65rem] text-slate-500">
            In the full implementation, this panel would be backed by a Spring Boot appointment
            service, so that every user booking updates these counts in real time.
          </p>
        </div>
      </div>
    </section>
  );
}


function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white/95">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-4 text-[0.7rem] text-slate-500 sm:flex-row sm:px-6">
        <p>© {new Date().getFullYear()} DocApoint. UI preview only.</p>
        <p className="text-[0.65rem]">
          Backend: Spring Boot microservices · ML: Python FastAPI · DB:
          PostgreSQL
        </p>
      </div>
    </footer>
  );
}

function normalizeHospitals(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((hospital) => ({
    ...hospital,
    slots:
      hospital.slots ||
      hospital.availableSlotsLabel ||
      'Tomorrow slots available',
  }));
}

function computeDistanceKm(lat1, lng1, lat2, lng2) {
  const toRad = (value) => (value * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
    Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) *
    Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function parseSlotsCount(label) {
  if (!label) return null;
  const match = label.match(/(\d+)/);
  if (!match) return null;
  const value = Number.parseInt(match[1], 10);
  return Number.isNaN(value) ? null : value;
}

function matchesSlotFilter(label, slotFilter) {
  if (slotFilter === 'any') return true;
  const count = parseSlotsCount(label);
  if (count == null) return true;
  if (slotFilter === 'gt20') return count >= 20;
  if (slotFilter === '10-19') return count >= 10 && count <= 19;
  if (slotFilter === 'lt10') return count < 10;
  return true;
}



const DEFAULT_TIME_SLOTS = ['09:00', '10:30', '12:00', '16:30', '18:00'];

function getDemoRemainingSlots(name, slot) {
  if (!name || !slot) return 0;
  const hash =
    name.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0) +
    slot.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const base = (hash % 6) + 1;
  return base;
}

function getDoctorAvailableDays(doctor) {
  if (!doctor || !doctor.availableDays) {
    return [1, 2, 3, 4, 5];
  }
  return doctor.availableDays;
}

function formatAvailableDaysLabel(days) {
  const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  if (
    days.length === 5 &&
    days.every((dayIndex) => dayIndex >= 1 && dayIndex <= 5)
  ) {
    return 'Mon–Fri';
  }
  return days.map((index) => labels[index] || '').join(', ');
}

function isDoctorAvailableOnDate(doctor, dateString) {
  if (!dateString || !doctor) return false;
  const days = getDoctorAvailableDays(doctor);
  const date = new Date(dateString);
  const dayIndex = date.getDay();
  return days.includes(dayIndex);
}

function getDateRange(minDateString, maxDateString) {
  if (!minDateString || !maxDateString) return [];
  const start = new Date(minDateString);
  const end = new Date(maxDateString);
  const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const result = [];
  const current = new Date(start);

  while (current <= end) {
    const dayIndex = current.getDay();
    result.push({
      value: current.toISOString().slice(0, 10),
      label: `${labels[dayIndex]} ${current.getDate()}`,
    });
    current.setDate(current.getDate() + 1);
  }

  return result;
}

function resolveHospitalDetailsFromStatic(hospital) {
  // Simply return the hospital as it now contains all details from the backend
  return hospital;
}

export default App;
