import React, { useEffect, useMemo, useState } from 'react';
import './App.css';

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

function GoogleAdSlot({ client, slot, layout = 'in-article', format = 'fluid' }) {
  useEffect(() => {
    if (!client) return;
    const id = 'adsbygoogle-lib';
    if (!document.getElementById(id)) {
      const s = document.createElement('script');
      s.id = id;
      s.async = true;
      s.crossOrigin = 'anonymous';
      s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
      document.head.appendChild(s);
    }
    const timeout = setTimeout(() => {
      try {
        // @ts-ignore
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch {}
    }, 400);
    return () => clearTimeout(timeout);
  }, [client]);

  if (!client) return null;
  return (
    <ins
      className="adsbygoogle ad-slot"
      style={{ display: 'block' }}
      data-ad-client={client}
      data-ad-slot={slot}
      data-ad-layout={layout}
      data-ad-format={format}
    />
  );
}

async function analyzeWithGemini({ apiKey, promptText, image }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
  const parts = [{ text: promptText }];
  if (image && image.data && image.mimeType) {
    parts.push({
      inlineData: {
        mimeType: image.mimeType,
        data: image.data,
      },
    });
  }
  const body = { contents: [{ role: 'user', parts }] };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Gemini API error: ${res.status}`);
  const data = await res.json();
  const text = (data?.candidates?.[0]?.content?.parts || [])
    .map((p) => p.text)
    .filter(Boolean)
    .join('\n');
  return text || '';
}

function localPrecautions({ skinType, hairType, age, bmi }) {
  const tips = [];
  if (skinType === 'oily') tips.push('Prefer gel cleansers, 2% BHA once daily, oil-free moisturizer, SPF 50 PA++++.');
  if (skinType === 'dry') tips.push('Use creamy cleanser, layer hyaluronic acid and ceramide moisturizer, avoid hot water, SPF 50.');
  if (skinType === 'combination') tips.push('Spot-treat T-zone with BHA/niacinamide, hydrate cheeks, non-comedogenic SPF.');
  if (skinType === 'sensitive') tips.push('Keep routine fragrance-free, patch test actives (AHA/BHA/retinol), prefer mineral sunscreen.');
  if (age >= 25) tips.push('Introduce nightly retinol gradually (2–3x/week) and daily antioxidant serum.');
  if (bmi && bmi < 18.5) tips.push('Ensure adequate calories and protein to support skin and hair barrier.');
  if (bmi && bmi >= 25) tips.push('Focus on balanced diet and hydration; manage sugar spikes that may aggravate acne.');
  if (hairType) {
    if (hairType === 'dry') tips.push('Use sulfate-free shampoo, weekly oiling (coconut/argan), deep-condition with shea/ceramide masks.');
    if (hairType === 'oily') tips.push('Clarify 1–2x/week, lightweight conditioner on lengths only, avoid heavy oils on scalp.');
    if (hairType === 'dandruff') tips.push('Use anti-dandruff shampoos (ketoconazole 2%, zinc pyrithione) 2–3x/week, leave on 5 minutes.');
    if (hairType === 'hairfall') tips.push('Check ferritin, B12, D3; use gentle detangling and scalp massages; avoid tight hairstyles.');
  }
  return tips;
}

function nutritionAdvice({ concerns = [] }) {
  // Map common concerns to nutrients and Indian foods
  const db = {
    acne: { nutrients: ['Zinc', 'Vitamin A', 'Omega-3'], foods: ['chana, rajma', 'carrot, spinach', 'flaxseed, walnut'] },
    dullness: { nutrients: ['Vitamin C', 'Vitamin E'], foods: ['amla, orange', 'almond, sunflower seeds'] },
    dryness: { nutrients: ['Essential fats', 'Ceramide precursors'], foods: ['ghee in moderation', 'soy, dairy, millets'] },
    pigmentation: { nutrients: ['Vitamin C', 'Antioxidants'], foods: ['guava, amla', 'green tea, berries'] },
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

function buildAffiliateLink(platform, query, tag) {
  const q = encodeURIComponent(query);
  if (platform === 'amazon') {
    const base = `https://www.amazon.in/s?k=${q}`;
    return tag ? `${base}&tag=${encodeURIComponent(tag)}` : base;
  }
  if (platform === 'flipkart') {
    const base = `https://www.flipkart.com/search?q=${q}`;
    return tag ? `${base}&affid=${encodeURIComponent(tag)}` : base;
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
  const [view, setView] = useState('home');

  const [apiKey, setApiKey] = usePersistedState('gemini_api_key', '');
  const [adsenseClient, setAdsenseClient] = usePersistedState('adsense_client', '');
  const [amazonTag, setAmazonTag] = usePersistedState('amazon_affiliate_tag', '');
  const [flipkartTag, setFlipkartTag] = usePersistedState('flipkart_affiliate_tag', '');

  const [skinType, setSkinType] = useState('oily');
  const [hairInterested, setHairInterested] = useState(false);
  const [hairType, setHairType] = useState('oily');
  const [age, setAge] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [gender, setGender] = useState('female');

  const [photoPreview, setPhotoPreview] = useState('');
  const [photoData, setPhotoData] = useState(null);

  const [wantProducts, setWantProducts] = useState(true);
  const [budget, setBudget] = useState(800);

  const [knownCause, setKnownCause] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [aiText, setAiText] = useState('');

  const bmi = useMemo(() => bmiFrom(Number(weightKg), Number(heightCm)), [weightKg, heightCm]);

  function onPhotoChange(file) {
    if (!file) {
      setPhotoPreview('');
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
      const prompt = `You are a dermatologist assistant. Analyze the provided details and image if present and respond in concise bullet points suitable for a layperson in India.\nUser details:\n- Skin type: ${skinType}\n- Age: ${age || 'n/a'}\n- Gender: ${gender}\n- Weight(kg): ${weightKg || 'n/a'}\n- Height(cm): ${heightCm || 'n/a'}\n- BMI: ${bmi ?? 'n/a'}\n- Blood group: ${bloodGroup || 'n/a'}\n- Hair interest: ${hairInterested ? 'yes' : 'no'}${hairInterested ? `, type: ${hairType}` : ''}\nPotential concerns to check: ${concernHints.join(', ') || 'general skin health'}.\nIf the image shows warning signs (bleeding moles, rapid spreading rashes, severe infections), clearly advise to see a dermatologist.\nReturn sections: 1) Likely causes 2) Precautions 3) Lifestyle 4) When to seek care.`;

      if (apiKey) {
        const text = await analyzeWithGemini({ apiKey, promptText: prompt, image: photoData });
        setAiText(text);
      } else {
        const tips = localPrecautions({ skinType, hairType: hairInterested ? hairType : null, age: Number(age) || 0, bmi });
        const lines = [
          'Likely causes: based on inputs, barrier imbalance and common issues for your profile.',
          `Precautions: ${tips.join(' ')} `,
          'Lifestyle: 2–3L water daily, 7–8h sleep, stress management, sunscreen every morning.',
          'When to seek care: sudden painful swelling, bleeding lesions, severe infections, or anything rapidly worsening.',
        ];
        setAiText(lines.join('\n'));
      }
      setView('results');
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
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
        <div className="brand">GlowGuide</div>
        <nav className="nav-actions">
          <button className={`nav-btn ${view === 'home' ? 'active' : ''}`} onClick={() => setView('home')}>Home</button>
          <button className={`nav-btn ${view === 'limitations' ? 'active' : ''}`} onClick={() => setView('limitations')}>Safety & Limitations</button>
          <a className="nav-btn primary" href="#analyze" onClick={(e) => { e.preventDefault(); setView('home'); const el = document.getElementById('analyze'); if (el) el.scrollIntoView({ behavior: 'smooth' }); }}>Start Analysis</a>
        </nav>
      </header>

      {view === 'home' && (
        <main className="home">
          <section className="hero">
            <div className="hero-content">
              <h1 className="hero-title">Personalized Skin & Hair Care</h1>
              <p className="hero-sub">Get routines, nutrition tips with Indian foods, and product picks based on your budget.</p>
              <div className="hero-cta">
                <a href="#analyze" className="cta-btn">Begin</a>
              </div>
              <div className="api-ad-box">
                <div className="api-box">
                  <label className="field-label" htmlFor="api">Gemini API key (stored locally)</label>
                  <input id="api" className="input" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Paste key" />
                </div>
                <div className="api-box">
                  <label className="field-label" htmlFor="adsense">Google AdSense client ID</label>
                  <input id="adsense" className="input" type="text" value={adsenseClient} onChange={(e) => setAdsenseClient(e.target.value)} placeholder="e.g. ca-pub-XXXXXXXXXXXXXXXX" />
                </div>
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

          <GoogleAdSlot client={adsenseClient} slot="auto" />

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

                    <div className="aff-grid">
                      <div>
                        <label className="field-label">Amazon affiliate tag</label>
                        <input type="text" className="input" value={amazonTag} onChange={(e) => setAmazonTag(e.target.value)} placeholder="yourtag-21" />
                      </div>
                      <div>
                        <label className="field-label">Flipkart affiliate id</label>
                        <input type="text" className="input" value={flipkartTag} onChange={(e) => setFlipkartTag(e.target.value)} placeholder="yourid" />
                      </div>
                    </div>
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
                    <li>Optional product picks with affiliate links</li>
                  </ul>
                </div>
                <GoogleAdSlot client={adsenseClient} slot="auto" />
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
                      <a className="link" target="_blank" rel="noreferrer" href={buildAffiliateLink('amazon', p.q, amazonTag)}>Amazon</a>
                      <a className="link" target="_blank" rel="noreferrer" href={buildAffiliateLink('flipkart', p.q, flipkartTag)}>Flipkart</a>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <GoogleAdSlot client={adsenseClient} slot="auto" />

          <div className="actions center">
            <button className="nav-btn" onClick={() => setView('home')}>Back</button>
          </div>
        </main>
      )}

      {view === 'limitations' && (
        <main className="panel">
          <SectionTitle>Safety, scope and limitations</SectionTitle>
          <div className="card">
            <ul className="list">
              <li>This tool offers general guidance and routine suggestions, not a medical diagnosis.</li>
              <li>For persistent, severe, or rapidly worsening problems, consult a qualified dermatologist.</li>
              <li>Patch test new products. If irritation occurs, stop immediately.</li>
              <li>AI analysis can be imperfect. Image quality, lighting, and occlusions can affect results.</li>
              <li>Product links may be affiliate links; prices and availability can change.</li>
            </ul>
          </div>
          <div className="actions center">
            <button className="cta-btn" onClick={() => setView('home')}>Go to Home</button>
          </div>
        </main>
      )}

      <footer className="footer">
        <div className="footer-inner">
          <span>© {new Date().getFullYear()} GlowGuide</span>
          <a className="link" href="#" onClick={(e) => { e.preventDefault(); setView('limitations'); }}>Safety & Limitations</a>
        </div>
      </footer>
    </div>
  );
}
