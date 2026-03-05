/**
 * TranscribeFlow — Dashboard JavaScript
 * Fetches real data from /api/dashboard/stats and renders dynamically.
 * Handles: data fetch, counter animations, trends, sentiment, topics,
 *          productivity ring, chatbot, quick actions.
 */

(function () {
    'use strict';

    // ═══════════════════════════════════════════════════
    // FETCH DASHBOARD DATA FROM API
    // ═══════════════════════════════════════════════════
    /**
     * Fetches dashboard statistics from the backend API
     * Uses authenticated fetch if available, falls back to manual token injection
     * @returns {Promise<Object|null} Dashboard stats object or null if fetch fails
     */
    async function fetchDashboardData() {
        try {
            // Use the global fetchWithAuth from sidebar.js
            if (typeof window.fetchWithAuth === 'undefined') {
                console.error('[Dashboard] fetchWithAuth not available yet, falling back to raw fetch');
                const token = localStorage.getItem('access_token');
                if (!token) {
                    console.warn('[Dashboard] No access_token found');
                    return null;
                }
                const res = await fetch('/api/dashboard/stats', {
                    headers: { 'Authorization': `Bearer ${token}` },
                });
                if (!res.ok) {
                    console.error('[Dashboard] API error:', res.status, await res.text());
                    return null;
                }
                const data = await res.json();
                console.log('[Dashboard] Stats loaded:', data);
                return data;
            }

            const res = await window.fetchWithAuth('/api/dashboard/stats');
            if (!res || !res.ok) {
                console.error('[Dashboard] API error:', res ? res.status : 'no response');
                return null;
            }

            const data = await res.json();
            console.log('[Dashboard] Stats loaded:', data);
            return data;
        } catch (err) {
            console.error('[Dashboard] Failed to fetch stats:', err);
            return null;
        }
    }

    // ═══════════════════════════════════════════════════
    // POPULATE UI WITH API DATA
    // ═══════════════════════════════════════════════════
    /**
     * Updates all dashboard UI elements with fetched data
     * Handles counters, trends, progress bars, topics, sentiment, and productivity
     * @param {Object} data - Dashboard statistics from API
     */
    function populateDashboard(data) {
        if (!data) { console.warn('[Dashboard] No data received'); return; }

        console.log('[Dashboard] Populating with:', JSON.stringify(data));
        console.log('[Dashboard] total_files=', data.total_files, 'total_minutes=', data.total_minutes, 'avg_duration_min=', data.avg_duration_min);
        console.log('[Dashboard] Elements found:', {
            statMinutes: !!document.getElementById('statMinutes'),
            statFiles: !!document.getElementById('statFiles'),
            statAvgDuration: !!document.getElementById('statAvgDuration'),
            statLanguage: !!document.getElementById('statLanguage'),
        });

        // — Stats counters —
        animateCounter('statMinutes', data.total_minutes);
        animateCounter('statFiles', data.total_files);
        animateCounter('statAvgDuration', data.avg_duration_min);

        // Language (text, not counter)
        const langEl = document.getElementById('statLanguage');
        if (langEl) langEl.textContent = data.most_used_language || '—';

        // — Trend badges —
        setTrend('trendMinutes', data.minutes_trend_pct);
        setTrend('trendFiles', data.files_trend_pct);

        // — Quota progress bar —
        animateProgressBar(data.quota_pct || 0);

        // — Common Topics —
        populateTopics(data.common_keywords || []);

        // — Sentiment bars —
        if (data.sentiment) {
            setSentiment('Pos', data.sentiment.positive);
            setSentiment('Neu', data.sentiment.neutral);
            setSentiment('Neg', data.sentiment.negative);
        }

        // — Productivity ring —
        animateProductivity(data.productivity_score || 0);
    }

    // ═══════════════════════════════════════════════════
    // ANIMATED COUNTER (animate from 0 → target)
    // ═══════════════════════════════════════════════════
    /**
     * Animates a numeric counter from 0 to target value
     * Uses requestAnimationFrame for smooth easing animation
     * @param {string} elementId - DOM element ID containing the counter
     * @param {number} target - Target value to count up to
     */
    function animateCounter(elementId, target) {
        const el = document.getElementById(elementId);
        if (!el) { console.warn('[Counter] Element not found:', elementId); return; }

        target = Math.round(target);
        console.log(`[Counter] Animating ${elementId} to ${target}`);

        // Immediately set the final value (safety net)
        el.textContent = target;

        if (target === 0) return;

        // Now animate from 0 → target for visual effect
        el.textContent = '0';
        const duration = 1400;
        const startTime = performance.now();

        function update(now) {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            el.textContent = Math.round(target * eased);
            if (progress < 1) {
                requestAnimationFrame(update);
            } else {
                el.textContent = target;
            }
        }

        requestAnimationFrame(update);
    }


    // ═══════════════════════════════════════════════════
    // TREND BADGES (up / down / stable)
    // ═══════════════════════════════════════════════════
    /**
     * Updates trend badge with appropriate styling and icon based on percentage change
     * @param {string} elementId - DOM element ID for the trend badge
     * @param {number} pct - Percentage change (positive, negative, or zero)
     */
    function setTrend(elementId, pct) {
        const el = document.getElementById(elementId);
        if (!el) return;

        // Remove old trend classes
        el.classList.remove('up', 'down', 'stable');

        if (pct > 0) {
            el.classList.add('up');
            el.innerHTML = `<i class="fas fa-arrow-up"></i> ${pct}%`;
        } else if (pct < 0) {
            el.classList.add('down');
            el.innerHTML = `<i class="fas fa-arrow-down"></i> ${Math.abs(pct)}%`;
        } else {
            el.classList.add('stable');
            el.innerHTML = `<i class="fas fa-minus"></i> Stable`;
        }
    }

    // ═══════════════════════════════════════════════════
    // PROGRESS BAR (quota)
    // ═══════════════════════════════════════════════════
    /**
     * Animates quota usage progress bar and percentage label
     * Delays animation to sync with other dashboard animations
     * @param {number} target - Target percentage for quota usage
     */
    function animateProgressBar(target) {
        const bar = document.getElementById('quotaBar');
        const label = document.getElementById('quotaPercent');
        if (!bar) return;

        setTimeout(() => {
            bar.style.width = target + '%';
        }, 400);

        // Animate label
        const duration = 1200;
        const startTime = performance.now();

        function update(now) {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            if (label) label.textContent = Math.round(target * eased) + '%';
            if (progress < 1) {
                requestAnimationFrame(update);
            } else {
                if (label) label.textContent = target + '%';
            }
        }

        setTimeout(() => requestAnimationFrame(update), 400);
    }

    // ═══════════════════════════════════════════════════
    // COMMON TOPICS / KEYWORDS
    // ═══════════════════════════════════════════════════
    /**
     * Renders common keywords as interactive tag chips
     * @param {string[]} keywords - Array of keyword strings from API
     */
    function populateTopics(keywords) {
        const container = document.getElementById('topicsContainer');
        if (!container) return;

        container.innerHTML = ''; // clear loading placeholder

        if (keywords.length === 0) {
            container.innerHTML = '<span class="tag-chip" style="opacity:0.5">No data yet</span>';
            return;
        }

        keywords.forEach(word => {
            const chip = document.createElement('span');
            chip.className = 'tag-chip';
            chip.textContent = word;
            container.appendChild(chip);
        });
    }

    // ═══════════════════════════════════════════════════
    // SENTIMENT BARS
    // ═══════════════════════════════════════════════════
    /**
     * Updates sentiment analysis bars with current percentages
     * Forces reflow to restart CSS animations for visual effect
     * @param {string} key - Sentiment category (Pos, Neu, Neg)
     * @param {number} pct - Percentage value for this sentiment
     */
    function setSentiment(key, pct) {
        const bar = document.getElementById(`sentiment${key}Bar`);
        const label = document.getElementById(`sentiment${key}Pct`);

        if (bar) {
            // Reset animation so bars animate fresh
            bar.style.animation = 'none';
            bar.offsetHeight; // force reflow
            bar.style.setProperty('--bar-width', pct + '%');
            bar.style.animation = '';
        }
        if (label) label.textContent = pct + '%';
    }

    // ═══════════════════════════════════════════════════
    // PRODUCTIVITY RING (conic-gradient)
    // ═══════════════════════════════════════════════════
    /**
     * Animates productivity ring using conic-gradient
     * Smoothly transitions from 0 to target percentage
     * @param {number} target - Target productivity score (0-100)
     */
    function animateProductivity(target) {
        const ring = document.getElementById('productivityRing');
        const valueEl = document.getElementById('productivityValue');
        if (!ring) return;

        const duration = 1600;
        const startTime = performance.now();

        function update(now) {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = Math.round(target * eased);
            const deg = (current / 100) * 360;

            ring.style.background = `conic-gradient(
        #5eead4 0deg,
        #06b6d4 ${deg}deg,
        #1a2332 ${deg}deg
      )`;
            if (valueEl) valueEl.textContent = current;

            if (progress < 1) {
                requestAnimationFrame(update);
            } else {
                if (valueEl) valueEl.textContent = target;
            }
        }

        // Delay to let the card animate in first
        setTimeout(() => requestAnimationFrame(update), 600);
    }

    // ═══════════════════════════════════════════════════
    // CHATBOT
    // ═══════════════════════════════════════════════════
    // Predefined responses for the support chatbot
    const CHATBOT_RESPONSES = [
        "That's a great question! Let me look into that for you. 🔍",
        "Sure! You can upload audio files from the Upload page. Supported formats include MP3, WAV, M4A, and OGG.",
        "Your transcriptions are processed using advanced AI models for 99% accuracy.",
        "You can access your past files in the History section of the dashboard.",
        "Need help with something else? I'm here for you! 😊",
        "TranscribeFlow supports 22+ languages including English, Hindi, Spanish, French, and more.",
        "Speaker diarization can identify and label different speakers in your audio automatically.",
        "You can export your transcripts in multiple formats including TXT, DOCX, PDF, and SRT.",
    ];

    /**
     * Initializes chatbot functionality with toggle button and message handling
     * Sets up event listeners for sending messages and keyboard shortcuts
     */
    function initChatbot() {
        const toggleBtn = document.getElementById('chatbotToggle');
        const closeBtn = document.getElementById('chatbotClose');
        const chatWindow = document.getElementById('chatbotWindow');
        const chatInput = document.getElementById('chatbotInput');
        const sendBtn = document.getElementById('chatbotSend');
        const messagesEl = document.getElementById('chatbotMessages');
        const toggleIcon = document.getElementById('chatbotIcon');

        if (!toggleBtn) return;

        let isOpen = false;
        let responseIndex = 0;

        function openChat() {
            chatWindow.classList.add('open');
            toggleIcon.className = 'fas fa-times chatbot-toggle-icon';
            isOpen = true;
            chatInput.focus();
        }

        function closeChat() {
            chatWindow.classList.remove('open');
            toggleIcon.className = 'fas fa-comment-dots chatbot-toggle-icon';
            isOpen = false;
        }

        toggleBtn.addEventListener('click', () => {
            isOpen ? closeChat() : openChat();
        });

        closeBtn.addEventListener('click', closeChat);

        function sendMessage() {
            const text = chatInput.value.trim();
            if (!text) return;

            appendMessage(text, 'user');
            chatInput.value = '';

            setTimeout(() => {
                const response = CHATBOT_RESPONSES[responseIndex % CHATBOT_RESPONSES.length];
                responseIndex++;
                appendMessage(response, 'bot');
            }, 600 + Math.random() * 600);
        }

        function appendMessage(text, type) {
            const msg = document.createElement('div');
            msg.className = `chat-msg ${type}`;
            msg.innerHTML = `<div class="chat-bubble">${escapeHtml(text)}</div>`;
            messagesEl.appendChild(msg);
            messagesEl.scrollTop = messagesEl.scrollHeight;
        }

        function escapeHtml(str) {
            const div = document.createElement('div');
            div.appendChild(document.createTextNode(str));
            return div.innerHTML;
        }

        sendBtn.addEventListener('click', sendMessage);
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') sendMessage();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && isOpen) closeChat();
        });
    }

    // ═══════════════════════════════════════════════════
    // QUICK ACTIONS
    // ═══════════════════════════════════════════════════
    /**
     * Sets up click handlers for quick action buttons
     * Redirects users to relevant sections of the application
     */
    function initQuickActions() {
        const uploadAction = document.getElementById('actionUpload');
        const historyAction = document.getElementById('actionHistory');

        if (uploadAction) {
            uploadAction.addEventListener('click', () => {
                window.location.href = '/upload';
            });
        }

        if (historyAction) {
            historyAction.addEventListener('click', () => {
                window.location.href = '/history';
            });
        }
    }

    // ═══════════════════════════════════════════════════
    // STARRED FILES
    // ═══════════════════════════════════════════════════
    /**
     * Fetches and displays user's starred files
     * Optimized to exclude transcript content for faster loading
     * Shows up to 6 most recent starred files
     */
    async function fetchStarredFiles() {
        const loader = document.getElementById('starredFilesLoader');
        const container = document.getElementById('starredFilesContainer');
        const emptyState = document.getElementById('starredEmptyState');

        try {
            // Use fetchWithAuth if available
            const fetchFn = window.fetchWithAuth || (async (url) => {
                const token = localStorage.getItem('access_token');
                return fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
            });

            // Optimize: don't fetch content (transcript/summary) to reduce load time
            const res = await fetchFn('/api/files?limit=100&include_content=false');

            if (!res || !res.ok) {
                const status = res ? res.status : 'no_response';
                throw new Error(`Failed to fetch files (status: ${status})`);
            }

            const data = await res.json();
            const starredFiles = (data.files || []).filter(f => f.is_starred);

            // Hide loader
            if (loader) loader.classList.add('hidden');

            if (starredFiles.length === 0) {
                if (emptyState) emptyState.classList.remove('hidden');
                if (container) container.classList.add('hidden');
            } else {
                if (emptyState) emptyState.classList.add('hidden');
                if (container) {
                    container.classList.remove('hidden');
                    // Show up to 6 recent starred files
                    container.innerHTML = starredFiles.slice(0, 6).map(f => createFileCard(f)).join('');
                    attachCardListeners();
                }
            }
        } catch (err) {
            console.error('[Dashboard] Error fetching starred files:', err);
            // Ensure loader shows error
            if (loader) {
                loader.classList.remove('hidden');
                loader.innerHTML = `
                    <div style="text-align:center; color: var(--error)">
                        <i class="fas fa-exclamation-circle" style="font-size:1.5rem; margin-bottom:0.5rem"></i>
                        <p>Failed to load starred files</p>
                        <button onclick="location.reload()" style="margin-top:0.5rem; padding:0.25rem 0.5rem; cursor:pointer">Retry</button>
                    </div>
                `;
            }
        }
    }

    /**
     * Creates HTML markup for a file card in starred files section
     * @param {Object} file - File object from API
     * @returns {string} HTML string for the file card
     */
    function createFileCard(file) {
        const date = new Date(file.created_at).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric'
        });

        return `
        <div class="file-card" data-file-id="${file.id}">
            <div class="file-card-header">
                <div class="file-info">
                    <div class="file-name" title="${file.filename}">${file.filename}</div>
                    <div class="file-meta">
                        <span class="file-meta-item"><i class="fas fa-hdd"></i> ${file.file_size_mb} MB</span>
                        <span class="file-meta-item"><i class="fas fa-language"></i> ${file.language}</span>
                    </div>
                </div>
                <div class="file-actions">
                    <button class="action-btn starred" title="Starred">
                        <i class="fas fa-star"></i>
                    </button>
                </div>
            </div>
            <div class="file-card-footer">
                <div class="file-date"><i class="fas fa-clock"></i> ${date}</div>
                <button class="view-btn-sm" data-file-id="${file.id}">
                    <i class="fas fa-eye"></i> View
                </button>
            </div>
        </div>
        `;
    }

    /**
     * Attaches click event listeners to file cards and view buttons
     * Handles navigation to detailed results page
     */
    function attachCardListeners() {
        document.querySelectorAll('.view-btn-sm').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                window.location.href = `/results?id=${btn.dataset.fileId}`;
            });
        });

        document.querySelectorAll('.file-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (!e.target.closest('button')) {
                    window.location.href = `/results?id=${card.dataset.fileId}`;
                }
            });
        });
    }

    // ═══════════════════════════════════════════════════
    // INIT
    // ═══════════════════════════════════════════════════
    /**
     * Main initialization function
     * Loads starred files, sets up interactive components, fetches and displays dashboard data
     */
    async function init() {
        populateTopics([]); // clear topics initially
        fetchStarredFiles(); // Load starred files specifically

        initChatbot();
        initQuickActions();

        // Fetch real data and populate, then animate
        const data = await fetchDashboardData();
        if (!data) {
            console.error('[Dashboard] Data fetch failed.');
            // Optionally show a global error toast or banner
            const header = document.querySelector('.dash-header-content');
            if (header) {
                const errBanner = document.createElement('div');
                errBanner.style.cssText = 'background:rgba(239,68,68,0.2); border:1px solid var(--error); color:var(--error); padding:0.5rem; margin-top:1rem; border-radius:6px; font-size:0.9rem;';
                errBanner.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Failed to load dashboard stats. Please refresh.';
                header.appendChild(errBanner);
            }
            return;
        }
        populateDashboard(data);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();