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
    // INIT
    // ═══════════════════════════════════════════════════
    async function init() {
        initChatbot();
        initQuickActions();

        // Fetch real data and populate, then animate
        const data = await fetchDashboardData();
        populateDashboard(data);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
