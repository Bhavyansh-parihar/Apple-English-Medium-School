/* ============================================
   WEBSITE SYNC BRIDGE  v2 — Firebase Firestore
   Reads ALL data from Firestore so every visitor
   sees the same content the admin entered.
   Emojis in gallery are replaced with proper
   placeholder cards (no broken images).
   ============================================ */

const WebsiteSync = {

    // Firestore collection names (must match admin-data.js)
    COL: {
        EVENTS: 'admin_events',
        NEWS: 'admin_news',
        GALLERY: 'admin_gallery',
        STAFF: 'admin_staff',
        CONTENT: 'admin_content',
        SETTINGS: 'admin_settings'
    },

    // HTML escape utility to prevent admin text from overlapping with HTML
    _esc(text) {
        if (!text) return '';
        const d = document.createElement('div');
        d.textContent = text;
        return d.innerHTML;
    },

    formatDate(dateStr) {
        if (!dateStr) return '';
        try {
            const d = new Date(dateStr);
            return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        } catch { return dateStr; }
    },

    /**
     * Return an optimized Cloudinary URL.
     * If the URL is not from Cloudinary, returns it unchanged.
     * @param {string} url    original image URL
     * @param {number} width  max display width in px
     */
    _cdnUrl(url, width = 800) {
        if (!url || !url.includes('cloudinary.com')) return url;
        // Insert f_auto (best format per browser), q_auto (smart quality), w_{width}
        return url.replace('/upload/', `/upload/f_auto,q_auto,w_${width}/`);
    },

    // =============================================
    // FIRESTORE HELPERS
    // =============================================

    async getAll(collection) {
        try {
            const snap = await db.collection(collection).get();
            return snap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) {
            console.warn(`Firestore read failed for ${collection}:`, e);
            // Fallback to localStorage cache
            try { return JSON.parse(localStorage.getItem(collection)) || []; }
            catch { return []; }
        }
    },

    async getObject(collection) {
        try {
            const doc = await db.collection(collection).doc('_data').get();
            return doc.exists ? doc.data() : {};
        } catch (e) {
            console.warn(`Firestore getObject failed for ${collection}:`, e);
            try { return JSON.parse(localStorage.getItem(collection)) || {}; }
            catch { return {}; }
        }
    },

    // =============================================
    // FACULTY PAGE — shows uploaded photos or initials
    // =============================================
    async renderFaculty() {
        const container = document.getElementById('dynamicFacultyGrid');
        if (!container) return;

        const staff = await this.getAll(this.COL.STAFF);
        if (staff.length === 0) return; // keep hardcoded fallback

        const colors = [
            'linear-gradient(135deg,#1e3a8a,#3b82f6)',
            'linear-gradient(135deg,#059669,#34d399)',
            'linear-gradient(135deg,#d97706,#fbbf24)',
            'linear-gradient(135deg,#dc2626,#f87171)',
            'linear-gradient(135deg,#7c3aed,#a78bfa)',
            'linear-gradient(135deg,#0891b2,#22d3ee)'
        ];

        container.innerHTML = staff.map((member, i) => {
            const hasPhoto = member.photoUrl && (member.photoUrl.startsWith('data:') || member.photoUrl.startsWith('http'));
            const optimizedPhoto = hasPhoto ? this._cdnUrl(member.photoUrl, 200) : null;
            const imageHtml = hasPhoto
                ? `<div class="faculty-image" style="border-radius:50%;width:100px;height:100px;margin:0 auto;overflow:hidden;">
                       <img src="${optimizedPhoto}" alt="${this._esc(member.name)}" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block;">
                   </div>`
                : `<div class="faculty-image" style="background:${colors[i % colors.length]};color:#fff;font-size:1.6rem;font-weight:700;display:flex;align-items:center;justify-content:center;border-radius:50%;width:100px;height:100px;margin:0 auto;">
                       ${member.avatar || member.name.split(' ').map(n => n[0]).join('')}
                   </div>`;
            return `
            <div class="faculty-card">
                ${imageHtml}
                <div class="faculty-info">
                    <h3>${this._esc(member.name)}</h3>
                    <p>${this._esc(member.designation || member.subject)}</p>
                    <p class="qualification">${this._esc(member.subject)}${member.email ? ' &middot; ' + this._esc(member.email) : ''}</p>
                </div>
            </div>`;
        }).join('');
    },

    // =============================================
    // GALLERY PAGE — real images if available, 
    //                styled cards otherwise (no broken emoji)
    // =============================================
    async renderGallery() {
        const container = document.getElementById('dynamicGalleryContent');
        if (!container) return;

        const albums = await this.getAll(this.COL.GALLERY);
        if (albums.length === 0) return;

        // Hide the placeholder note when we have real gallery data
        const placeholder = document.querySelector('.placeholder-content');
        if (placeholder) placeholder.closest('section').style.display = 'none';

        const bgColors = [
            '#e0e7ff', '#dcfce7', '#fef9c3', '#ffe4e6',
            '#e0f2fe', '#f3e8ff', '#fdf2f8', '#ecfdf5'
        ];

        container.innerHTML = albums.map(album => `
            <section style="padding:40px 0;">
                <div class="container">
                    <div class="section-title">
                        <h2>${this._esc(album.title)}</h2>
                        <p>${this._esc(album.description)}</p>
                    </div>
                    <div class="gallery-grid">
                        ${(album.images || []).map((img, idx) => {
            const escapedName = this._esc(img.name);
            // If it's a real image URL or base64, show it
            if (img.url && (img.url.startsWith('data:') || img.url.startsWith('http'))) {
                const optimizedUrl = this._cdnUrl(img.url, 900);
                return `
                                    <div class="gallery-item" title="${escapedName}">
                                        <img src="${optimizedUrl}" alt="${escapedName}"
                                             loading="lazy"
                                             onerror="this.parentElement.style.background='${bgColors[idx % bgColors.length]}';this.style.display='none';">
                                    </div>`;
            }
            // Styled placeholder card (emoji + name) — no real URL yet
            return `
                                <div class="gallery-item" style="background:${bgColors[idx % bgColors.length]};display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px;" title="${escapedName}">
                                    <span style="font-size:3rem;line-height:1;">${img.emoji || '&#128444;'}</span>
                                    <span style="font-size:0.82rem;color:#444;margin-top:10px;text-align:center;font-weight:500;">${escapedName}</span>
                                </div>`;
        }).join('')}
                    </div>
                </div>
            </section>
        `).join('');
    },

    // =============================================
    // PRINCIPAL PAGE
    // =============================================
    async renderPrincipalMessage() {
        const container = document.getElementById('dynamicPrincipalMessage');
        if (!container) return;

        const content = await this.getObject(this.COL.CONTENT);
        if (!content.principalMessage?.content) return;

        container.innerHTML = content.principalMessage.content
            .split('\n')
            .filter(p => p.trim())
            .map(p => `<p>${this._esc(p)}</p>`)
            .join('');
    },

    // =============================================
    // HOME — News Ticker
    // =============================================
    async renderNewsTicker() {
        const container = document.getElementById('dynamicNewsTicker');
        if (!container) return;

        const content = await this.getObject(this.COL.CONTENT);
        const items = content.homepageHighlights?.ticker;
        if (!items || items.length === 0) return;

        // Duplicate for seamless loop
        container.innerHTML = [...items, ...items].map(item => `<span>${this._esc(item)}</span>`).join('');
    },

    // =============================================
    // HOME — News section (latest 3 published)
    // =============================================
    async renderNewsSection() {
        const container = document.getElementById('dynamicNewsSection');
        if (!container) return;

        const allNews = await this.getAll(this.COL.NEWS);
        const news = allNews.filter(n => n.status === 'Published').slice(0, 3);
        if (news.length === 0) return;

        const icons = ['📰', '🏆', '📢', '🎉', '📚'];

        container.innerHTML = news.map((item, i) => `
            <div class="feature-card" style="text-align:left;">
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
                    <div class="feature-icon" style="width:44px;height:44px;font-size:1.1rem;margin:0;flex-shrink:0;">${icons[i % icons.length]}</div>
                    <span style="font-size:0.78rem;color:var(--text-light);font-weight:600;">${this.formatDate(item.publishDate)}</span>
                </div>
                <h3 style="font-size:1.1rem;">${this._esc(item.title)}</h3>
                <p>${this._esc(item.content.length > 150 ? item.content.substring(0, 150) + '...' : item.content)}</p>
            </div>
        `).join('');
    },

    // =============================================
    // CALENDAR — upcoming events
    // =============================================
    async renderCalendarEvents() {
        const container = document.getElementById('dynamicUpcomingEvents');
        if (!container) return;

        const allEvents = await this.getAll(this.COL.EVENTS);
        const events = allEvents
            .filter(e => e.category === 'Event' || e.category === 'Exam')
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        if (events.length === 0) return;

        const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
        container.innerHTML = events.map(evt => {
            const d = new Date(evt.date);
            return `
                <div class="calendar-event-item">
                    <div class="event-date-badge">
                        <span class="day">${d.getDate().toString().padStart(2, '0')}</span>
                        <span class="month">${monthNames[d.getMonth()]}</span>
                    </div>
                    <div class="event-details">
                        <h4>${this._esc(evt.title)}</h4>
                        <p>${this._esc(evt.description)}</p>
                    </div>
                </div>`;
        }).join('');
    },

    async renderCalendarHolidays() {
        const container = document.getElementById('dynamicHolidays');
        if (!container) return;

        const allEvents = await this.getAll(this.COL.EVENTS);
        const holidays = allEvents
            .filter(e => e.category === 'Holiday')
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        if (holidays.length === 0) return;

        container.innerHTML = holidays.map(h => {
            const end = h.endDate && h.endDate !== h.date ? ' – ' + this.formatDate(h.endDate) : '';
            return `
                <div class="vacation-item">
                    <span class="vacation-name">🏖️ ${this._esc(h.title)}</span>
                    <span class="vacation-dates">${this.formatDate(h.date)}${end}</span>
                </div>`;
        }).join('');
    },

    // Calendar widget data (returns sync from cache, best-effort)
    async getAdminCalendarData() {
        const events = await this.getAll(this.COL.EVENTS);
        const holidayMap = {}, eventMap = {};
        events.forEach(evt => {
            const key = d => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
            const start = new Date(evt.date);
            const end = evt.endDate ? new Date(evt.endDate) : new Date(evt.date);
            let cur = new Date(start);
            while (cur <= end) {
                const k = key(cur);
                if (evt.category === 'Holiday') holidayMap[k] = evt.title;
                else eventMap[k] = evt.title;
                cur.setDate(cur.getDate() + 1);
            }
        });
        return { holidays: holidayMap, events: eventMap };
    },

    // =============================================
    // INIT — called on every public page
    // =============================================
    async init() {
        // Run all renderers in parallel for speed
        await Promise.allSettled([
            this.renderFaculty(),
            this.renderGallery(),
            this.renderPrincipalMessage(),
            this.renderNewsTicker(),
            this.renderNewsSection(),
            this.renderCalendarEvents(),
            this.renderCalendarHolidays(),
            this.renderMedia()
        ]);
    },

    // =============================================
    // DYNAMIC MEDIA (Logo, Hero, About)
    // =============================================
    async renderMedia() {
        const content = await this.getObject(this.COL.CONTENT);
        const media = content.websiteMedia;
        if (!media) return;

        // 1. Logo replacement
        if (media.logoUrl) {
            const optLogo = this._cdnUrl(media.logoUrl, 120);
            const brandLogo = document.getElementById('brandLogo');
            const headerLogo = document.getElementById('headerLogo');
            
            if (brandLogo) {
                brandLogo.innerHTML = `<img src="${optLogo}" alt="School Logo" style="width:100%;height:100%;object-fit:contain;">`;
                brandLogo.style.background = 'transparent';
                brandLogo.style.padding = '0';
            }
            if (headerLogo) {
                headerLogo.innerHTML = `<img src="${optLogo}" alt="Logo" style="width:100%;height:100%;object-fit:contain;">`;
                headerLogo.style.background = 'transparent';
            }
        }

        // 2. Hero Background
        if (media.heroUrl) {
            const heroSec = document.getElementById('heroSection');
            if (heroSec) {
                const optHero = this._cdnUrl(media.heroUrl, 1600);
                heroSec.style.backgroundImage = `linear-gradient(rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.6)), url('${optHero}')`;
                heroSec.style.backgroundSize = 'cover';
                heroSec.style.backgroundPosition = 'center';
            }
        }

        // 3. About Section Image
        if (media.aboutUrl) {
            const aboutImg = document.getElementById('aboutImage');
            if (aboutImg) {
                const optAbout = this._cdnUrl(media.aboutUrl, 800);
                aboutImg.innerHTML = `<img src="${optAbout}" alt="About Our School" style="width:100%;height:100%;object-fit:cover;border-radius:12px;">`;
                aboutImg.style.background = 'transparent';
                aboutImg.style.display = 'block';
                aboutImg.style.overflow = 'hidden';
            }
        }
    }
};

// ---- Auto-initialise when DOM + Firebase are ready ----
document.addEventListener('DOMContentLoaded', () => {
    // If Firebase is loaded, use it; otherwise skip gracefully
    if (typeof firebase !== 'undefined' && typeof db !== 'undefined') {
        WebsiteSync.init().catch(e => console.warn('WebsiteSync init error:', e));
    } else {
        // Firebase not loaded on this page — skip silently
        console.info('WebsiteSync: Firebase not available, skipping dynamic content.');
    }
});
