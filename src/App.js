import React, { useEffect, useMemo, useState } from 'react';
import './App.css';
import { supabase } from './supabaseClient';

// Owner-provided affiliate tags (site will use these)
const AMAZON_AFFILIATE_TAG = 'our-affiliate-21';
const FLIPKART_AFFILIATE_TAG = 'our-affiliate-id';
const LOGO_SRC = 'https://cdn.builder.io/api/v1/image/assets%2Fc6dae523276642bb818e59bb22b2cbfd%2F3b98d10bc2a84c31a8ef2cd923ad8b95?format=webp&width=800';

function loadLocal(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}
function saveLocal(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function usePersistedState(key, initial) {
  const [val, setVal] = useState(() => loadLocal(key, initial));
  useEffect(() => saveLocal(key, val), [key, val]);
  return [val, setVal];
}

function bmiFrom(weightKg, heightCm) {
  if (!weightKg || !heightCm) return null;
  const h = Number(heightCm) / 100;
  if (!h) return null;
  const bmi = Number(weightKg) / (h * h);
  if (!isFinite(bmi)) return null;
  return Math.round(bmi * 10) / 10;
}

function localPrecautions({ skinType, hairType, age, bmi }) {
  const tips = [];
  if (skinType === 'oily') tips.push('Prefer gel cleansers, 2% BHA once daily, oil-free moisturizer, SPF in the morning.');
  if (skinType === 'dry') tips.push('Use creamy cleanser, layer hyaluronic acid and ceramide moisturizer, avoid hot water, use sunscreen.');
  if (skinType === 'combination') tips.push('Spot-treat T-zone, hydrate cheeks, use non-comedogenic SPF.');
  if (skinType === 'sensitive') tips.push('Keep routine fragrance-free, patch test actives, prefer mineral sunscreen.');
  if (age >= 25) tips.push('Introduce retinol gradually and consider daily antioxidants.');
  if (bmi && bmi < 18.5) tips.push('Ensure adequate calories and protein to support skin and hair health.');
  if (bmi && bmi >= 25) tips.push('Focus on balanced diet and hydration; manage sugar intake to reduce acne flares.');
  if (hairType) {
    if (hairType === 'dry') tips.push('Use sulfate-free shampoo, weekly oiling, deep-conditioning masks.');
    if (hairType === 'oily') tips.push('Clarify 1–2x/week and avoid heavy oils on the scalp.');
    if (hairType === 'dandruff') tips.push('Use anti-dandruff shampoo (ketoconazole/zinc pyrithione) 2–3x/week.');
    if (hairType === 'hairfall') tips.push('Check iron/B12/D; avoid tight hairstyles and use gentle detangling.');
  }
  return tips;
}

function nutritionAdvice({ concerns = [] }) {
  const db = {
    acne: { nutrients: ['Zinc', 'Vitamin A', 'Omega-3'], foods: ['chana, rajma', 'carrot, spinach', 'flaxseed, walnut'] },
    dullness: { nutrients: ['Vitamin C', 'Vitamin E'], foods: ['amla, orange', 'almond, sunflower seeds'] },
    dryness: { nutrients: ['Essential fats'], foods: ['ghee in moderation', 'soy, dairy, millets'] },
    pigmentation: { nutrients: ['Vitamin C', 'Antioxidants'], foods: ['guava, amla', 'green tea'] },
    hairfall: { nutrients: ['Protein', 'Iron', 'Biotin'], foods: ['paneer, dal, eggs', 'spinach, jaggery', 'peanuts, til'] },
    dandruff: { nutrients: ['Zinc', 'B-vitamins'], foods: ['pumpkin seeds', 'whole grains, curd'] },
  };
  const keys = new Set(concerns.length ? concerns : ['dullness', 'dryness']);
  const rows = [];
  keys.forEach((k) => {
    if (db[k]) rows.push({ concern: k, ...db[k] });
  });
  return rows;
}

function buildAffiliateLink(platform, query) {
  const q = encodeURIComponent(query);
  if (platform === 'amazon') {
    const base = `https://www.amazon.in/s?k=${q}`;
    return AMAZON_AFFILIATE_TAG ? `${base}&tag=${encodeURIComponent(AMAZON_AFFILIATE_TAG)}` : base;
  }
  if (platform === 'flipkart') {
    const base = `https://www.flipkart.com/search?q=${q}`;
    return FLIPKART_AFFILIATE_TAG ? `${base}&affid=${encodeURIComponent(FLIPKART_AFFILIATE_TAG)}` : base;
  }
  return `https://www.google.com/search?q=${q}`;
}

function productQueries({ skinType, hairType, budget }) {
  const tier = budget <= 600 ? 'budget' : budget <= 1500 ? 'mid' : 'premium';
  const items = [];
  if (skinType) {
    items.push({ label: 'Gentle cleanser (fragrance-free)', q: 'gentle cleanser fragrance free pH balanced' });
    if (skinType === 'oily' || skinType === 'combination') items.push({ label: '2% BHA exfoliant', q: 'BHA 2% salicylic acid leave on' });
    if (skinType === 'dry') items.push({ label: 'Ceramide moisturizer', q: 'ceramide moisturizer dry skin' });
    items.push({ label: 'Niacinamide 5% serum', q: 'niacinamide 5% serum' });
    items.push({ label: 'Sunscreen SPF 50 PA++++', q: 'sunscreen SPF 50 PA++++ broad spectrum' });
    if (tier !== 'budget') items.push({ label: 'Vitamin C 10% serum', q: 'vitamin C 10% l-ascorbic' });
  }
  if (hairType) {
    items.push({ label: 'Sulfate-free shampoo', q: 'sulfate free shampoo' });
    if (hairType === 'dandruff') items.push({ label: 'Ketoconazole 2% shampoo', q: 'ketoconazole 2% shampoo' });
    items.push({ label: 'Lightweight conditioner', q: 'lightweight conditioner silicone free' });
    if (tier !== 'budget') items.push({ label: 'Hair mask weekly', q: 'repair hair mask ceramide protein' });
  }
  return items;
}

function SectionTitle({ children }) {
  return <h2 className="section-title">{children}</h2>;
}

export default function App() {
  const [view, setView] = useState('auth');

  // Auth
  const [user, setUser] = useState(null);
  const [isGuest, setIsGuest] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  // Form
  const [skinType, setSkinType] = useState('oily');
  const [hairInterested, setHairInterested] = useState(false);
  const [hairType, setHairType] = useState('oily');
  const [age, setAge] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [gender, setGender] = useState('female');

  const [photoPreview, setPhotoPreview] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoData, setPhotoData] = useState(null);

  const [wantProducts, setWantProducts] = usePersistedState('want_products', true);
  const [budget, setBudget] = usePersistedState('budget', 800);

  const [knownCause, setKnownCause] = useState('');
  const [description, setDescription] = usePersistedState('user_description', '');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [aiText, setAiText] = useState('');

  const [history, setHistory] = useState([]);

  const bmi = useMemo(() => bmiFrom(Number(weightKg), Number(heightCm)), [weightKg, heightCm]);

  useEffect(() => {
    // Initialize auth state from Supabase if configured
    let mounted = true;
    async function init() {
      try {
        const { data } = await supabase.auth.getSession();
        const session = data?.session;
        if (session?.user && mounted) { setUser(session.user); setIsGuest(false); setView('home'); }
        supabase.auth.onAuthStateChange((_event, session) => {
          if (mounted) {
            setUser(session?.user ?? null);
            setIsGuest(false);
            if (session?.user) setView('home');
            else setView('auth');
          }
        });
      } catch (e) {
        // supabase not configured or network error
      }
    }
    init();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (user) fetchHistory();
  }, [user]);

  async function signup() {
    setAuthLoading(true);
    setAuthError('');
    try {
      const { data, error } = await supabase.auth.signUp({ email: authEmail, password: authPassword });
      if (error) throw error;
      alert('Sign-up successful. Please check your email to confirm (if your Supabase is configured that way).');
      setAuthEmail(''); setAuthPassword('');
    } catch (e) {
      setAuthError(e.message || String(e));
    } finally { setAuthLoading(false); }
  }
  async function login() {
    setAuthLoading(true);
    setAuthError('');
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
      if (error) throw error;
      setAuthEmail(''); setAuthPassword('');
    } catch (e) {
      setAuthError(e.message || String(e));
    } finally { setAuthLoading(false); }
  }
  async function logout() {
    try {
      if (isGuest) {
        setUser(null);
        setIsGuest(false);
        setHistory([]);
        setView('auth');
        return;
      }
      await supabase.auth.signOut();
      setUser(null);
      setHistory([]);
      setView('auth');
    } catch {}
  }

  function onPhotoChange(file) {
    if (!file) {
      setPhotoPreview('');
      setPhotoFile(null);
      setPhotoData(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        setPhotoPreview(result);
        const base64 = result.split(',')[1];
        setPhotoData({ data: base64, mimeType: file.type || 'image/jpeg' });
      }
    };
    reader.readAsDataURL(file);
    setPhotoFile(file);
  }

  async function handleAnalyze() {
    setLoading(true);
    setError('');
    setAiText('');
    try {
      const concernHints = [];
      if (skinType === 'oily') concernHints.push('acne, blackheads');
      if (skinType === 'dry') concernHints.push('dryness, flakiness');
      if (hairInterested && hairType === 'dandruff') concernHints.push('dandruff');
      if (hairInterested && hairType === 'hairfall') concernHints.push('hairfall');

      const tips = localPrecautions({ skinType, hairType: hairInterested ? hairType : null, age: Number(age) || 0, bmi });
      const lines = [
        'Likely causes: based on inputs, barrier imbalance and common issues for your profile.',
        `Precautions: ${tips.join(' ')} `,
        'Lifestyle: 2–3L water daily, 7–8h sleep, stress management, sunscreen every morning.',
        'When to seek care: sudden painful swelling, bleeding lesions, severe infections, or anything rapidly worsening.',
      ];
      setAiText(lines.join('\n'));
      setView('results');
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function saveAnalysis() {
    if (!user) { alert('Please log in to save your analysis.'); return; }
    setLoading(true);
    try {
      const payload = {
        id: 'local_' + Date.now(),
        user_id: user.id,
        skin_type: skinType,
        hair_type: hairInterested ? hairType : null,
        age: age || null,
        weight_kg: weightKg || null,
        height_cm: heightCm || null,
        bmi: bmi || null,
        blood_group: bloodGroup || null,
        gender,
        description,
        known_cause: knownCause,
        ai_text: aiText,
        photo_url: null,
        created_at: new Date().toISOString(),
      };

      if (isGuest) {
        // store locally
        const key = 'guest_analyses_' + user.id;
        const existing = JSON.parse(localStorage.getItem(key) || '[]');
        existing.unshift(payload);
        localStorage.setItem(key, JSON.stringify(existing));
        alert('Saved locally to your browser history. Sign up to save it in your account.');
        fetchHistory();
        return;
      }

      let photo_url = null;
      if (photoFile) {
        const filePath = `public/${user.id}/${Date.now()}_${photoFile.name}`;
        const { data, error: upErr } = await supabase.storage.from('photos').upload(filePath, photoFile, { cacheControl: '3600', upsert: false });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from('photos').getPublicUrl(filePath);
        photo_url = pub?.publicUrl || null;
      }
      payload.photo_url = photo_url;
      const { data: ins, error: insErr } = await supabase.from('analyses').insert([payload]).select();
      if (insErr) throw insErr;
      alert('Saved to your history.');
      fetchHistory();
    } catch (e) {
      alert('Save failed: ' + (e.message || String(e)));
    } finally { setLoading(false); }
  }

  async function fetchHistory() {
    if (!user) return;
    try {
      if (isGuest) {
        const key = 'guest_analyses_' + user.id;
        const existing = JSON.parse(localStorage.getItem(key) || '[]');
        setHistory(existing || []);
        return;
      }
      const { data, error } = await supabase.from('analyses').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50);
      if (error) throw error;
      setHistory(data || []);
    } catch (e) {
      console.error('history fetch', e);
    }
  }

  const nutrition = useMemo(() => {
    const concerns = [];
    if (skinType === 'oily') concerns.push('acne');
    if (skinType === 'dry') concerns.push('dryness');
    if (hairInterested && hairType === 'hairfall') concerns.push('hairfall');
    if (hairInterested && hairType === 'dandruff') concerns.push('dandruff');
    if (knownCause.toLowerCase().includes('pigment')) concerns.push('pigmentation');
    return nutritionAdvice({ concerns });
  }, [skinType, hairInterested, hairType, knownCause]);

  const productList = useMemo(() => productQueries({ skinType, hairType: hairInterested ? hairType : null, budget: Number(budget) || 0 }), [skinType, hairInterested, hairType, budget]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-row">
          <img src={LOGO_SRC} alt="logo" className="logo" />
          <div className="brand">Skin &amp; Hair Care Mentor</div>
        </div>
        <nav className="nav-actions">
          <button className={`nav-btn ${view === 'home' ? 'active' : ''}`} onClick={() => setView('home')}>Home</button>
          <button className={`nav-btn ${view === 'limitations' ? 'active' : ''}`} onClick={() => setView('limitations')}>Safety & Limitations</button>
          <a className="nav-btn primary" href="#analyze" onClick={(e) => { e.preventDefault(); setView('home'); const el = document.getElementById('analyze'); if (el) el.scrollIntoView({ behavior: 'smooth' }); }}>Start Analysis</a>

          {user ? (
            <>
              <button className="nav-btn" onClick={() => setView('history')}>My History</button>
              <button className="nav-btn" onClick={saveAnalysis}>Save Analysis</button>
              <div className="nav-user">{user.email}</div>
              <button className="nav-btn" onClick={logout}>Sign out</button>
            </>
          ) : (
            <div>
              <button className="nav-btn" onClick={() => setView('auth')}>Login / Sign up</button>
            </div>
          )}
        </nav>
      </header>

      {view === 'auth' && (
        <main className="panel auth-panel">
          <div className="card" style={{ maxWidth: 560, margin: '40px auto' }}>
            <h2 className="section-title">Welcome — login or create an account</h2>
            {authError && <div className="error-box">{authError}</div>}
            <label className="field-label">Email</label>
            <input className="input" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} />
            <label className="field-label">Password</label>
            <input className="input" type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} />
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="cta-btn" onClick={login} disabled={authLoading}>{authLoading ? 'Signing in…' : 'Login'}</button>
              <button className="nav-btn" onClick={signup} disabled={authLoading}>Sign up</button>
              <button className="nav-btn" onClick={() => {
                // create a local guest session
                const guestId = 'guest_' + Math.random().toString(36).slice(2,9);
                const guestUser = { id: guestId, email: `guest@${guestId}.local` };
                setUser(guestUser);
                setIsGuest(true);
                setView('home');
              }}>Continue as guest</button>
            </div>
          </div>
        </main>
      )}

      {view === 'home' && (
        <main className="home">
          <section className="hero">
            <div className="hero-content">
              <h1 className="hero-title">Personalized Skin &amp; Hair Care</h1>
              <p className="hero-sub">Look good, feel confident — science-backed routines for every Indian skin.</p>
              <p className="hero-why">Why use this site? In today's world appearance matters and many people want healthier skin and hair but lack trustworthy, simple guidance. We combine easy routines, Indian diet tips and product picks to help you build a reliable plan.</p>
              <div className="hero-cta">
                <a href="#analyze" className="cta-btn">Begin</a>
              </div>
            </div>
            <div className="hero-gallery">
              <img className="hero-img main" src="https://images.pexels.com/photos/3893744/pexels-photo-3893744.jpeg" alt="Welcome face" loading="lazy" />
              <div className="thumbs">
                <img className="hero-img thumb" src="https://images.pexels.com/photos/4041231/pexels-photo-4041231.jpeg" alt="Serum" loading="lazy" />
                <img className="hero-img thumb" src="https://images.pexels.com/photos/8384529/pexels-photo-8384529.jpeg" alt="Sunscreen" loading="lazy" />
                <img className="hero-img thumb" src="https://images.pexels.com/photos/8467963/pexels-photo-8467963.jpeg" alt="Hair care" loading="lazy" />
              </div>
            </div>
          </section>

          <section id="analyze" className="panel">
            <SectionTitle>Tell us about you</SectionTitle>
            <div className="form-grid">
              <div className="form-col">
                <label className="field-label">Skin type</label>
                <select className="input" value={skinType} onChange={(e) => setSkinType(e.target.value)}>
                  <option value="oily">Oily</option>
                  <option value="dry">Dry</option>
                  <option value="combination">Combination</option>
                  <option value="sensitive">Sensitive</option>
                </select>

                <label className="field-label">Age</label>
                <input type="number" className="input" min={1} max={100} value={age} onChange={(e) => setAge(e.target.value)} />

                <label className="field-label">Weight (kg)</label>
                <input type="number" className="input" min={1} max={500} value={weightKg} onChange={(e) => setWeightKg(e.target.value)} />

                <label className="field-label">Height (cm)</label>
                <input type="number" className="input" min={50} max={250} value={heightCm} onChange={(e) => setHeightCm(e.target.value)} />

                <div className="info-row">
                  <span className="info-chip">BMI: {bmi ?? '—'}</span>
                </div>

                <label className="field-label">Blood group</label>
                <input type="text" className="input" value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)} placeholder="e.g. B+" />

                <label className="field-label">Gender</label>
                <select className="input" value={gender} onChange={(e) => setGender(e.target.value)}>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="other">Other</option>
                  <option value="prefer_not">Prefer not to say</option>
                </select>

                <div className="toggle-row">
                  <input id="hairChk" type="checkbox" checked={hairInterested} onChange={(e) => setHairInterested(e.target.checked)} />
                  <label htmlFor="hairChk">I also want hair advice</label>
                </div>

                {hairInterested && (
                  <>
                    <label className="field-label">Hair type</label>
                    <select className="input" value={hairType} onChange={(e) => setHairType(e.target.value)}>
                      <option value="oily">Oily</option>
                      <option value="dry">Dry</option>
                      <option value="dandruff">Dandruff</option>
                      <option value="hairfall">Hair fall</option>
                    </select>
                  </>
                )}

                <label className="field-label">Brief description (optional)</label>
                <textarea className="input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe your concern briefly (e.g. started after a product, seasonal flare, etc.)" />

                <div className="upload-box">
                  <label className="field-label">Add a clear photo (optional)</label>
                  <input type="file" accept="image/*" onChange={(e) => onPhotoChange(e.target.files?.[0])} />
                  {photoPreview && <img className="photo-preview" src={photoPreview} alt="Preview" />}
                </div>

                <div className="toggle-row">
                  <input id="prodChk" type="checkbox" checked={wantProducts} onChange={(e) => setWantProducts(e.target.checked)} />
                  <label htmlFor="prodChk">Recommend products for my budget</label>
                </div>

                {wantProducts && (
                  <>
                    <label className="field-label">Budget per item (₹)</label>
                    <input type="number" className="input" min={100} step={50} value={budget} onChange={(e) => setBudget(e.target.value)} />
                  </>
                )}

                <div className="actions">
                  <button className="cta-btn" disabled={loading} onClick={handleAnalyze}>{loading ? 'Analyzing…' : 'Analyze'}</button>
                </div>
                {error && <div className="error-box">{error}</div>}
              </div>

              <aside className="form-aside">
                <div className="aside-card">
                  <h3 className="aside-title">What you get</h3>
                  <ul className="list">
                    <li>Likely causes and gentle precautions</li>
                    <li>Morning and night routines tailored to you</li>
                    <li>Nutrition gaps and Indian diet ideas</li>
                    <li>Product picks chosen by our team (affiliate links provided by us)</li>
                  </ul>
                </div>
              </aside>
            </div>
          </section>
        </main>
      )}

      {view === 'results' && (
        <main className="results">
          <SectionTitle>Your personalized guidance</SectionTitle>
          {aiText && (
            <div className="card">
              <pre className="ai-text">{aiText}</pre>
            </div>
          )}

          <div className="card">
            <h3 className="card-title">Do you already know a cause?</h3>
            <input className="input" type="text" value={knownCause} onChange={(e) => setKnownCause(e.target.value)} placeholder="e.g. hard water, new product, stress" />
          </div>

          {description && (
            <div className="card">
              <h3 className="card-title">Your description</h3>
              <div className="muted">{description}</div>
            </div>
          )}

          <div className="grid-2">
            <div className="card">
              <h3 className="card-title">Morning routine</h3>
              <ul className="list">
                {skinType === 'dry' && (
                  <>
                    <li>Hydrating cleanser</li>
                    <li>Hyaluronic acid serum on damp skin</li>
                    <li>Ceramide moisturizer</li>
                    <li>SPF 50 PA++++ sunscreen</li>
                  </>
                )}
                {skinType === 'oily' && (
                  <>
                    <li>Gel cleanser</li>
                    <li>Niacinamide 5%</li>
                    <li>Lightweight moisturizer</li>
                    <li>SPF 50 PA++++ sunscreen</li>
                  </>
                )}
                {skinType === 'combination' && (
                  <>
                    <li>Gentle cleanser</li>
                    <li>Niacinamide 5% or BHA on T-zone</li>
                    <li>Non-comedogenic moisturizer</li>
                    <li>SPF 50 PA++++ sunscreen</li>
                  </>
                )}
                {skinType === 'sensitive' && (
                  <>
                    <li>Mild, fragrance-free cleanser</li>
                    <li>Soothing serum (panthenol/centella)</li>
                    <li>Ceramide moisturizer</li>
                    <li>Mineral sunscreen SPF 50</li>
                  </>
                )}
              </ul>
            </div>
            <div className="card">
              <h3 className="card-title">Night routine</h3>
              <ul className="list">
                {skinType === 'dry' && (
                  <>
                    <li>Creamy cleanser</li>
                    <li>Layer hydrating toner/essence</li>
                    <li>Rich ceramide moisturizer or sleeping mask</li>
                  </>
                )}
                {skinType === 'oily' && (
                  <>
                    <li>Gentle cleanser</li>
                    <li>2% BHA (start 3x/week)</li>
                    <li>Non-comedogenic moisturizer</li>
                  </>
                )}
                {skinType === 'combination' && (
                  <>
                    <li>Cleanser</li>
                    <li>Targeted treatment on T-zone</li>
                    <li>Hydrating cream on cheeks</li>
                  </>
                )}
                {skinType === 'sensitive' && (
                  <>
                    <li>Fragrance-free cleanser</li>
                    <li>Barrier serum or squalane</li>
                    <li>Ceramide cream</li>
                  </>
                )}
                {Number(age) >= 25 && <li>Introduce retinol gradually (2–3x/week).</li>}
              </ul>
            </div>
          </div>

          {hairInterested && (
            <div className="card">
              <h3 className="card-title">Hair care</h3>
              <ul className="list">
                {hairType === 'oily' && (
                  <>
                    <li>Shampoo 2–3x/week; focus on scalp</li>
                    <li>Light conditioner on lengths only</li>
                  </>
                )}
                {hairType === 'dry' && (
                  <>
                    <li>Sulfate-free shampoo</li>
                    <li>Weekly oiling and deep-conditioning</li>
                  </>
                )}
                {hairType === 'dandruff' && (
                  <>
                    <li>Ketoconazole 2% shampoo 2–3x/week (leave on 5 minutes)</li>
                    <li>Alternate with gentle shampoo</li>
                  </>
                )}
                {hairType === 'hairfall' && (
                  <>
                    <li>Check ferritin, B12, D3 with your doctor</li>
                    <li>Gentle detangling; avoid tight hairstyles</li>
                  </>
                )}
              </ul>
            </div>
          )}

          <div className="card">
            <h3 className="card-title">Nutrition focus (Indian diet)</h3>
            <div className="nutri-grid">
              {nutrition.map((n) => (
                <div className="nutri-item" key={n.concern}>
                  <div className="nutri-head">{n.concern}</div>
                  <div className="nutri-body">
                    <div><strong>Nutrients:</strong> {n.nutrients.join(', ')}</div>
                    <div><strong>Foods:</strong> {n.foods.join(', ')}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {wantProducts && (
            <div className="card">
              <h3 className="card-title">Product finder (budget ₹{Number(budget) || 0} per item)</h3>
              <ul className="products">
                {productList.map((p) => (
                  <li key={p.q} className="product-item">
                    <div className="product-name">{p.label}</div>
                    <div className="product-links">
                      <a className="link" target="_blank" rel="noreferrer" href={buildAffiliateLink('amazon', p.q)}>Amazon</a>
                      <a className="link" target="_blank" rel="noreferrer" href={buildAffiliateLink('flipkart', p.q)}>Flipkart</a>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="actions center">
            <button className="nav-btn" onClick={() => setView('home')}>Back</button>
          </div>
        </main>
      )}

      {view === 'history' && (
        <main className="panel">
          <SectionTitle>Your saved analyses</SectionTitle>
          <div className="card">
            {user ? (
              <div>
                {history.length === 0 ? <div className="muted">No saved analyses yet.</div> : (
                  <ul className="list">
                    {history.map((h) => (
                      <li key={h.id} style={{ marginBottom: 8 }}>
                        <strong>{new Date(h.created_at).toLocaleString()}</strong>
                        <div>Skin: {h.skin_type} {h.hair_type ? `• Hair: ${h.hair_type}` : ''}</div>
                        {h.photo_url && <div><a href={h.photo_url} target="_blank" rel="noreferrer">View photo</a></div>}
                        <div className="muted">{(h.ai_text || '').slice(0, 300)}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <div className="muted">Please log in to see your saved analyses.</div>
            )}
          </div>
        </main>
      )}

      {view === 'results' && (
        <div style={{ display: 'none' }} />
      )}

      {view === 'limitations' && (
        <main className="panel">
          <SectionTitle>Safety, scope and limitations</SectionTitle>
          <div className="card">
            <ul className="list">
              <li>This tool offers general guidance and routine suggestions, not a medical diagnosis.</li>
              <li>For persistent, severe, or rapidly worsening problems, consult a qualified dermatologist.</li>
              <li>Patch test new products. If irritation occurs, stop immediately.</li>
              <li>Image-based analysis can be imperfect. Image quality, lighting, and occlusions can affect results.</li>
              <li>Product links are affiliate links managed by the site owners; prices and availability can change.</li>
            </ul>
          </div>

          <div className="card">
            <h3 className="card-title">Sources and data</h3>
            <p className="muted">Content, routines and nutrition suggestions are based on commonly accepted dermatology and nutrition guidance. Sources used when designing this site include public resources and clinical guidance such as the American Academy of Dermatology (AAD), British Association of Dermatologists (BAD), PubMed reviews on common skin conditions, and Indian dietary references for food examples. Images in the hero were sourced from Pexels (free-to-use photos) and the site logo was uploaded by the site owner.</p>
            <p className="muted">Specific image sources used in the app: Pexels photos: portrait (https://images.pexels.com/photos/3893744/pexels-photo-3893744.jpeg), serum (https://images.pexels.com/photos/4041231/pexels-photo-4041231.jpeg), sunscreen (https://images.pexels.com/photos/8384529/pexels-photo-8384529.jpeg), hair care (https://images.pexels.com/photos/8467963/pexels-photo-8467963.jpeg).</p>
          </div>

          <div className="card">
            <h3 className="card-title">Why use Skin &amp; Hair Care Mentor?</h3>
            <ul className="list">
              <li>Quick, practical routines tailored to your skin and hair type.</li>
              <li>Indian diet suggestions to address common nutritional gaps.</li>
              <li>Curated product recommendations chosen by our team to fit your budget.</li>
              <li>Clear safety guidance and when to consult a professional.</li>
            </ul>
            <p className="muted">Slogan: "Look good, feel confident — simple science for everyday skincare."</p>
          </div>

          <div className="actions center">
            <button className="cta-btn" onClick={() => setView('home')}>Go to Home</button>
          </div>
        </main>
      )}

      <footer className="footer">
        <div className="footer-inner">
          <span>© {new Date().getFullYear()} Skin &amp; Hair Care Mentor</span>
          <a className="link" href="#" onClick={(e) => { e.preventDefault(); setView('limitations'); }}>Safety & Limitations</a>
        </div>
      </footer>
    </div>
  );
}
