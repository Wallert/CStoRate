/**
 * Steam Tier Master - Application Controller
 */

// Popular Steam games template caches for instant loading (bypasses initial network fetches)
const PRESET_TEMPLATES = [
    {
        id: "empty-canvas",
        name: "Empty Custom Canvas",
        description: "Start with a completely blank board. Design your own tiers and search/add any Steam games from scratch.",
        banner: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=600&auto=format&fit=crop",
        games: []
    },
    {
        id: "rpg-legends",
        name: "Steam RPG Classics",
        description: "The greatest role-playing games on Steam. Rank your epics!",
        banner: "https://cdn.akamai.steamstatic.com/steam/apps/1086940/header.jpg",
        games: [
            { id: "1086940", name: "Baldur's Gate 3", image: "https://cdn.akamai.steamstatic.com/steam/apps/1086940/header.jpg" },
            { id: "1245620", name: "Elden Ring", image: "https://cdn.akamai.steamstatic.com/steam/apps/1245620/header.jpg" },
            { id: "292030", name: "The Witcher 3: Wild Hunt", image: "https://cdn.akamai.steamstatic.com/steam/apps/292030/header.jpg" },
            { id: "207710", name: "Cyberpunk 2077", image: "https://cdn.akamai.steamstatic.com/steam/apps/207710/header.jpg" },
            { id: "489830", name: "The Elder Scrolls V: Skyrim", image: "https://cdn.akamai.steamstatic.com/steam/apps/489830/header.jpg" },
            { id: "377160", name: "Fallout 4", image: "https://cdn.akamai.steamstatic.com/steam/apps/377160/header.jpg" }
        ]
    },
    {
        id: "competitive-fps",
        name: "Competitive Shooters",
        description: "Test your aim and strategy. Rank the best tactical and arena shooters.",
        banner: "https://cdn.akamai.steamstatic.com/steam/apps/730/header.jpg",
        games: [
            { id: "730", name: "Counter-Strike 2", image: "https://cdn.akamai.steamstatic.com/steam/apps/730/header.jpg" },
            { id: "1172470", name: "Apex Legends", image: "https://cdn.akamai.steamstatic.com/steam/apps/1172470/header.jpg" },
            { id: "252490", name: "Rust", image: "https://cdn.akamai.steamstatic.com/steam/apps/252490/header.jpg" },
            { id: "1085660", name: "Destiny 2", image: "https://cdn.akamai.steamstatic.com/steam/apps/1085660/header.jpg" },
            { id: "440", name: "Team Fortress 2", image: "https://cdn.akamai.steamstatic.com/steam/apps/440/header.jpg" },
            { id: "550", name: "Left 4 Dead 2", image: "https://cdn.akamai.steamstatic.com/steam/apps/550/header.jpg" }
        ]
    },
    {
        id: "indie-gems",
        name: "Indie Masterpieces",
        description: "Small budget, massive heart. Rank these iconic independent titles.",
        banner: "https://cdn.akamai.steamstatic.com/steam/apps/1145360/header.jpg",
        games: [
            { id: "1145360", name: "Hades", image: "https://cdn.akamai.steamstatic.com/steam/apps/1145360/header.jpg" },
            { id: "367520", name: "Hollow Knight", image: "https://cdn.akamai.steamstatic.com/steam/apps/367520/header.jpg" },
            { id: "413150", name: "Stardew Valley", image: "https://cdn.akamai.steamstatic.com/steam/apps/413150/header.jpg" },
            { id: "105600", name: "Terraria", image: "https://cdn.akamai.steamstatic.com/steam/apps/105600/header.jpg" },
            { id: "646570", name: "Slay the Spire", image: "https://cdn.akamai.steamstatic.com/steam/apps/646570/header.jpg" },
            { id: "268910", name: "Cuphead", image: "https://cdn.akamai.steamstatic.com/steam/apps/268910/header.jpg" }
        ]
    },
    {
        id: "coop-casual",
        name: "Co-op & Casual Fun",
        description: "Gather your friends or relax solo. Rank the best co-op and party games.",
        banner: "https://cdn.akamai.steamstatic.com/steam/apps/1426210/header.jpg",
        games: [
            { id: "1426210", name: "It Takes Two", image: "https://cdn.akamai.steamstatic.com/steam/apps/1426210/header.jpg" },
            { id: "1966720", name: "Lethal Company", image: "https://cdn.akamai.steamstatic.com/steam/apps/1966720/header.jpg" },
            { id: "739630", name: "Phasmophobia", image: "https://cdn.akamai.steamstatic.com/steam/apps/739630/header.jpg" },
            { id: "945360", name: "Among Us", image: "https://cdn.akamai.steamstatic.com/steam/apps/945360/header.jpg" },
            { id: "1097150", name: "Fall Guys", image: "https://cdn.akamai.steamstatic.com/steam/apps/1097150/header.jpg" },
            { id: "620", name: "Portal 2", image: "https://cdn.akamai.steamstatic.com/steam/apps/620/header.jpg" }
        ]
    }
];


function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

class TierListApp {
    constructor() {
        this.state = {
            id: null, // set if loaded from saved list
            listTitle: "My Ultimate Gaming Tier List",
            tiers: [
                { id: "tier-s", label: "S", color: "#ff79c6", games: [] },
                { id: "tier-a", label: "A", color: "#ffb86c", games: [] },
                { id: "tier-b", label: "B", color: "#f1fa8c", games: [] },
                { id: "tier-c", label: "C", color: "#50fa7b", games: [] },
                { id: "tier-d", label: "D", color: "#8be9fd", games: [] }
            ],
            pool: [],
            cardStyle: "horizontal", // 'horizontal' (headers) or 'vertical' (library posters)
            cardSize: "medium", // 'tiny', 'small', 'medium', 'large', 'xl', 'xxl'
            savedLists: []
        };

        this.draggedGameId = null;
        this.draggedSourceId = null; // 'pool' or tier-id
        this.activeEditTierId = null;
        this.activeMobileGame = null;
        this.isDirty = false;

        // Search debounce & AbortController
        this.searchTimeout = null;
        this.activeSearchAbortController = null;
        this.confirmCallback = null;
        this.autoSaveInterval = null;

        this.init();
    }

    markDirty() {
        this.isDirty = true;
    }

    refreshIcons() {
        try {
            const l = (typeof window !== 'undefined' && window.lucide) ? window.lucide : (typeof lucide !== 'undefined' ? lucide : null);
            if (l && typeof l.createIcons === 'function') {
                l.createIcons();
            }
        } catch (e) {
            // Ignore icon rendering error in non-browser env
        }
    }

    init() {
        try {
            // Load saved library lists
            this.loadLibraryFromStorage();

            // Populate DOM elements and bindings
            this.cacheDomElements();
            this.bindEvents();
            
            // Load autosave if it exists
            this.loadAutoSave();

            this.renderTemplates();
            this.renderLibrary();
            
            // Render library tab count badge
            this.updateLibraryBadge();
            
            // Initial style configuration
            this.applyCardStyleClasses();
            this.applyCardSizeClasses();
            
            // Render Active Board
            this.renderBoard();
            this.renderPool();
            
            // Auto initialize lucide icons
            this.refreshIcons();

            // Start autosave loop (saves state every 2 seconds if dirty)
            if (this.autoSaveInterval) clearInterval(this.autoSaveInterval);
            this.autoSaveInterval = setInterval(() => {
                if (this.isDirty) {
                    this.saveAutoSave();
                }
            }, 2000);
        } catch (err) {
            // Ensure app initialization does not throw uncaught error
        }
    }

    cacheDomElements() {
        this.dom = {
            tabs: document.querySelectorAll('.nav-btn'),
            tabContents: document.querySelectorAll('.tab-content'),
            listTitleInput: document.getElementById('list-title'),
            layoutToggles: document.querySelectorAll('#layout-toggle-group .btn-toggle'),
            sizeToggles: document.querySelectorAll('#size-toggle-group .btn-toggle'),
            boardToolbar: document.querySelector('.board-toolbar'),
            tierListBoard: document.getElementById('tier-list-board'),
            boardTitleDisplay: document.getElementById('board-title-display'),
            steamSearch: document.getElementById('steam-search'),
            searchSpinner: document.getElementById('search-spinner'),
            searchDropdown: document.getElementById('search-dropdown'),
            steamIdInput: document.getElementById('steam-id-input'),
            btnAddById: document.getElementById('btn-add-by-id'),
            btnSave: document.getElementById('btn-save'),
            btnExportPng: document.getElementById('btn-export-png'),
            btnExportJson: document.getElementById('btn-export-json'),
            btnImportTrigger: document.getElementById('btn-import-trigger'),
            fileImport: document.getElementById('file-import'),
            btnReset: document.getElementById('btn-reset'),
            tierRowsContainer: document.getElementById('tier-rows-container'),
            btnAddTier: document.getElementById('btn-add-tier'),
            unassignedPool: document.getElementById('unassigned-pool'),
            trashDropzone: document.getElementById('trash-dropzone'),
            poolCount: document.getElementById('pool-count'),
            poolEmptyState: document.getElementById('pool-empty-state'),
            templatesGrid: document.getElementById('templates-grid'),
            libraryGrid: document.getElementById('library-grid'),
            libraryCount: document.getElementById('library-count'),
            
            // Modals
            mobileMoveModal: document.getElementById('mobile-move-modal'),
            mobileGameName: document.getElementById('mobile-game-name'),
            mobileTierSelectGrid: document.getElementById('mobile-tier-select-grid'),
            btnMobileReturnPool: document.getElementById('btn-mobile-return-pool'),
            btnMobileDelete: document.getElementById('btn-mobile-delete'),
            btnCloseMobileModal: document.getElementById('btn-close-mobile-modal'),
            
            tierEditModal: document.getElementById('tier-edit-modal'),
            editTierLabel: document.getElementById('edit-tier-label'),
            colorPresets: document.querySelectorAll('.color-preset'),
            customColorPicker: document.getElementById('edit-tier-color-custom'),
            btnSaveTierSettings: document.getElementById('btn-save-tier-settings'),
            btnCloseTierEditModal: document.getElementById('btn-close-tier-edit-modal'),
            btnCancelTierEdit: document.getElementById('btn-cancel-tier-edit'),

            confirmModal: document.getElementById('confirm-modal'),
            confirmTitle: document.getElementById('confirm-modal-title'),
            confirmMessage: document.getElementById('confirm-modal-message'),
            btnCloseConfirmModal: document.getElementById('btn-close-confirm-modal'),
            btnConfirmCancel: document.getElementById('btn-confirm-cancel'),
            btnConfirmOk: document.getElementById('btn-confirm-ok'),
            
            toastContainer: document.getElementById('toast-container')
        };
    }

    bindEvents() {
        // Tab switching
        if (this.dom.tabs) {
            this.dom.tabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    const targetTab = tab.dataset.tab;
                    this.switchTab(targetTab);
                });
            });
        }

        // List Title sync
        if (this.dom.listTitleInput) {
            this.dom.listTitleInput.addEventListener('input', (e) => {
                this.state.listTitle = e.target.value;
                this.markDirty();
                if (this.dom.boardTitleDisplay) {
                    this.dom.boardTitleDisplay.textContent = e.target.value.toUpperCase();
                }
            });
        }

        // Card style toggle buttons click listener
        if (this.dom.layoutToggles) {
            this.dom.layoutToggles.forEach(btn => {
                btn.addEventListener('click', () => {
                    this.updateCardStyle(btn.dataset.layout);
                });
            });
        }

        // Card size toggle buttons click listener
        if (this.dom.sizeToggles) {
            this.dom.sizeToggles.forEach(btn => {
                btn.addEventListener('click', () => {
                    this.updateCardSize(btn.dataset.size);
                });
            });
        }

        // Steam autocomplete search & keydown ESC listener
        if (this.dom.steamSearch) {
            this.dom.steamSearch.addEventListener('input', (e) => {
                this.handleSearchInput(e.target.value);
            });
            this.dom.steamSearch.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.dom.searchDropdown) {
                    this.dom.searchDropdown.style.display = 'none';
                }
            });
        }

        // Global Keydown for Escape key (close modals and search dropdown)
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (this.dom.searchDropdown) this.dom.searchDropdown.style.display = 'none';
                this.closeMobileModal();
                this.closeTierEditModal();
                this.closeConfirmModal();
            }
        });

        // Close search dropdown on click outside
        document.addEventListener('click', (e) => {
            if (this.dom.steamSearch && this.dom.searchDropdown) {
                if (!this.dom.steamSearch.contains(e.target) && !this.dom.searchDropdown.contains(e.target)) {
                    this.dom.searchDropdown.style.display = 'none';
                }
            }
        });

        // Enable mouse wheel scrolling during drag
        window.addEventListener('wheel', (e) => {
            if (this.draggedGameId) {
                window.scrollBy({ top: e.deltaY, behavior: 'auto' });
            }
        }, { passive: true, capture: true });

        // Auto-scroll when dragging near edges (throttled with requestAnimationFrame)
        let isDragScrolling = false;
        document.addEventListener('dragover', (e) => {
            if (!this.draggedGameId || isDragScrolling) return;
            isDragScrolling = true;
            requestAnimationFrame(() => {
                const edgeSize = 60;
                if (e.clientY < edgeSize) {
                    window.scrollBy(0, -15);
                } else if (window.innerHeight - e.clientY < edgeSize) {
                    window.scrollBy(0, 15);
                }
                isDragScrolling = false;
            });
        });

        // Add game by ID or URL
        if (this.dom.btnAddById) {
            this.dom.btnAddById.addEventListener('click', () => {
                this.handleAddByLinkOrId().catch(err => {
                    this.showToast("Failed to fetch game details", "error");
                });
            });
        }
        if (this.dom.steamIdInput) {
            this.dom.steamIdInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.handleAddByLinkOrId().catch(err => {
                        this.showToast("Failed to fetch game details", "error");
                    });
                }
            });
        }

        // Action Buttons
        if (this.dom.btnSave) this.dom.btnSave.addEventListener('click', () => this.saveActiveList());
        if (this.dom.btnExportPng) this.dom.btnExportPng.addEventListener('click', () => this.exportToPng());
        if (this.dom.btnExportJson) this.dom.btnExportJson.addEventListener('click', () => this.backupJson());
        if (this.dom.btnImportTrigger) this.dom.btnImportTrigger.addEventListener('click', () => this.dom.fileImport.click());
        if (this.dom.fileImport) this.dom.fileImport.addEventListener('change', (e) => this.importJson(e));
        if (this.dom.btnReset) this.dom.btnReset.addEventListener('click', () => this.resetBoard());

        // Add Row
        if (this.dom.btnAddTier) this.dom.btnAddTier.addEventListener('click', () => this.addNewTier());

        // Save Tier Row settings
        if (this.dom.btnSaveTierSettings) this.dom.btnSaveTierSettings.addEventListener('click', () => this.saveTierRowSettings());

        // Preset color pickers inside modal
        if (this.dom.colorPresets) {
            this.dom.colorPresets.forEach(preset => {
                preset.addEventListener('click', () => {
                    this.dom.colorPresets.forEach(p => p.classList.remove('active'));
                    preset.classList.add('active');
                    if (this.dom.customColorPicker) this.dom.customColorPicker.value = preset.dataset.color;
                });
            });
        }

        // Custom color picker inside modal overrides presets
        if (this.dom.customColorPicker) {
            this.dom.customColorPicker.addEventListener('input', (e) => {
                if (this.dom.colorPresets) {
                    this.dom.colorPresets.forEach(p => p.classList.remove('active'));
                }
            });
        }

        // Modal close buttons
        if (this.dom.btnCloseMobileModal) {
            this.dom.btnCloseMobileModal.addEventListener('click', () => this.closeMobileModal());
        }
        if (this.dom.btnCloseTierEditModal) {
            this.dom.btnCloseTierEditModal.addEventListener('click', () => this.closeTierEditModal());
        }
        if (this.dom.btnCancelTierEdit) {
            this.dom.btnCancelTierEdit.addEventListener('click', () => this.closeTierEditModal());
        }

        // Confirmation modal buttons
        if (this.dom.btnCloseConfirmModal) {
            this.dom.btnCloseConfirmModal.addEventListener('click', () => this.closeConfirmModal());
        }
        if (this.dom.btnConfirmCancel) {
            this.dom.btnConfirmCancel.addEventListener('click', () => this.closeConfirmModal());
        }
        if (this.dom.btnConfirmOk) {
            this.dom.btnConfirmOk.addEventListener('click', () => {
                const cb = this.confirmCallback;
                this.closeConfirmModal();
                if (cb) cb();
            });
        }

        // Mobile actions binding
        if (this.dom.btnMobileReturnPool) {
            this.dom.btnMobileReturnPool.addEventListener('click', () => {
                if (this.activeMobileGame) {
                    this.moveGameToDestination(this.activeMobileGame.id, this.draggedSourceId, 'pool');
                }
                this.closeMobileModal();
            });
        }

        if (this.dom.btnMobileDelete) {
            this.dom.btnMobileDelete.addEventListener('click', () => {
                if (this.activeMobileGame) {
                    this.deleteGame(this.activeMobileGame.id, this.draggedSourceId);
                }
                this.closeMobileModal();
            });
        }
    }

    showConfirmModal(title, message, onConfirm) {
        if (confirm(message)) {
            onConfirm();
        }
    }

    closeConfirmModal() {
        if (this.dom.confirmModal) {
            this.dom.confirmModal.style.display = 'none';
        }
        this.confirmCallback = null;
    }

    // ==========================================================================
    // STEAM INTEGRATION & SEARCH
    // ==========================================================================

    handleSearchInput(query) {
        clearTimeout(this.searchTimeout);
        
        if (this.activeSearchAbortController) {
            this.activeSearchAbortController.abort();
            this.activeSearchAbortController = null;
        }

        if (!query.trim()) {
            if (this.dom.searchDropdown) this.dom.searchDropdown.style.display = 'none';
            if (this.dom.searchSpinner) this.dom.searchSpinner.style.display = 'none';
            return;
        }

        if (this.dom.searchSpinner) this.dom.searchSpinner.style.display = 'block';

        this.activeSearchAbortController = new AbortController();
        const signal = this.activeSearchAbortController.signal;

        this.searchTimeout = setTimeout(async () => {
            try {
                const steamSearchUrl = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(query)}&l=english&cc=US`;
                let result = null;

                // Try 1: Local HTTP-Server Proxy
                try {
                    const localProxyUrl = `/api/storesearch/?term=${encodeURIComponent(query)}&l=english&cc=US`;
                    const response = await fetch(localProxyUrl, { signal });
                    if (response.ok) {
                        result = await response.json();
                    }
                } catch (e) {
                    if (e.name === 'AbortError') return;
                }

                // Try 2: CodeTabs high-speed proxy (raw direct JSON)
                if (!result && !signal.aborted) {
                    try {
                        const codeTabsUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(steamSearchUrl)}`;
                        const response = await fetch(codeTabsUrl, { signal });
                        if (response.ok) {
                            result = await response.json();
                        }
                    } catch (e) {
                        if (e.name === 'AbortError') return;
                    }
                }

                // Try 3: AllOrigins fallback
                if (!result && !signal.aborted) {
                    try {
                        const allOriginsUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(steamSearchUrl)}`;
                        const response = await fetch(allOriginsUrl, { signal });
                        if (response.ok) {
                            const data = await response.json();
                            if (data && typeof data.contents === 'string') {
                                const trimmed = data.contents.trim();
                                if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                                    result = JSON.parse(trimmed);
                                }
                            }
                        }
                    } catch (e) {
                        if (e.name === 'AbortError') return;
                    }
                }

                // Try 4: ThingProxy fallback
                if (!result && !signal.aborted) {
                    try {
                        const thingProxyUrl = `https://thingproxy.freeboard.io/fetch/${steamSearchUrl}`;
                        const response = await fetch(thingProxyUrl, { signal });
                        if (response.ok) {
                            result = await response.json();
                        }
                    } catch (e) {
                        if (e.name === 'AbortError') return;
                    }
                }

                if (signal.aborted) return;

                if (result && result.items && result.items.length > 0) {
                    const items = result.items.map(item => ({
                        id: String(item.id),
                        name: item.name
                    }));
                    this.renderSearchDropdown(items);
                } else {
                    this.searchLocalTemplates(query);
                }
            } catch (err) {
                if (err.name === 'AbortError') return;
                this.searchLocalTemplates(query);
            } finally {
                if (!signal.aborted && this.dom.searchSpinner) {
                    this.dom.searchSpinner.style.display = 'none';
                }
            }
        }, 400);
    }

    searchLocalTemplates(query) {
        const localMatches = [];
        const searchLower = query.toLowerCase();
        
        // Search inside PRESET_TEMPLATES
        PRESET_TEMPLATES.forEach(tmpl => {
            tmpl.games.forEach(game => {
                if (game.name.toLowerCase().includes(searchLower) && !localMatches.some(g => String(g.id) === String(game.id))) {
                    localMatches.push(game);
                }
            });
        });

        if (localMatches.length > 0) {
            this.renderSearchDropdown(localMatches);
        } else {
            if (this.dom.searchDropdown) {
                const emptyItem = document.createElement('div');
                emptyItem.className = 'autocomplete-item';
                const emptySpan = document.createElement('span');
                emptySpan.className = 'game-title';
                emptySpan.textContent = 'No games found. Try App ID directly.';
                emptyItem.appendChild(emptySpan);
                this.dom.searchDropdown.replaceChildren(emptyItem);
                this.dom.searchDropdown.style.display = 'block';
            }
        }
    }

    renderSearchDropdown(items) {
        if (!this.dom.searchDropdown) return;
        this.dom.searchDropdown.replaceChildren();
        
        // Show up to 8 results
        items.slice(0, 8).forEach(item => {
            const el = document.createElement('div');
            el.className = 'autocomplete-item';
            
            let imageUrl = item.image || `https://cdn.akamai.steamstatic.com/steam/apps/${item.id}/header.jpg`;
            if (imageUrl && !/^(https?:\/\/|data:image\/|\/)/i.test(imageUrl)) {
                imageUrl = '';
            }

            const img = document.createElement('img');
            img.src = imageUrl;
            img.loading = 'lazy';
            img.decoding = 'async';
            img.crossOrigin = 'anonymous';
            img.onerror = function() {
                this.src = `https://shared.fastly.steamstatic.com/store_images_shared/v2/apps/${item.id}/header.jpg`;
                this.onerror = () => { this.style.display = 'none'; };
            };

            const titleSpan = document.createElement('span');
            titleSpan.className = 'game-title';
            titleSpan.textContent = item.name;

            el.append(img, titleSpan);

            el.addEventListener('click', () => {
                this.addGameToPool(String(item.id), item.name, imageUrl);
                if (this.dom.steamSearch) this.dom.steamSearch.value = '';
                this.dom.searchDropdown.style.display = 'none';
            });

            this.dom.searchDropdown.appendChild(el);
        });

        this.dom.searchDropdown.style.display = 'block';
    }

    async handleAddByLinkOrId() {
        if (!this.dom.steamIdInput) return;
        const input = this.dom.steamIdInput.value.trim();
        if (!input) return;

        // Try extracting ID from store URLs, community URLs, query params, or plain app IDs
        let appId = null;
        const linkMatch = input.match(/(?:app\/|appID=)(\d+)/i);
        if (linkMatch && linkMatch[1]) {
            appId = linkMatch[1];
        } else if (/^\d+$/.test(input)) {
            appId = input;
        }

        if (!appId) {
            this.showToast("Could not parse Steam URL or App ID", "error");
            return;
        }

        this.dom.steamIdInput.disabled = true;
        if (this.dom.btnAddById) this.dom.btnAddById.disabled = true;
        this.showToast("Fetching game metadata from Steam...", "success");

        try {
            const detailsUrl = `https://store.steampowered.com/api/appdetails/?appids=${appId}`;
            let details = null;

            // Try 1: Local HTTP-Server Proxy
            try {
                const localProxyUrl = `/api/appdetails/?appids=${appId}`;
                const response = await fetch(localProxyUrl);
                if (response.ok) {
                    details = await response.json();
                }
            } catch (e) {
                // Ignore local proxy error
            }

            // Try 2: CodeTabs Proxy (Raw JSON)
            if (!details) {
                try {
                    const codeTabsUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(detailsUrl)}`;
                    const response = await fetch(codeTabsUrl);
                    if (response.ok) {
                        details = await response.json();
                    }
                } catch (e) {
                    // Ignore proxy fallback error
                }
            }

            // Try 3: AllOrigins fallback
            if (!details) {
                try {
                    const allOriginsUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(detailsUrl)}`;
                    const response = await fetch(allOriginsUrl);
                    if (response.ok) {
                        const data = await response.json();
                        if (data && typeof data.contents === 'string') {
                            const trimmed = data.contents.trim();
                            if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                                details = JSON.parse(trimmed);
                            }
                        }
                    }
                } catch (e) {
                    // Ignore proxy fallback error
                }
            }

            // Process details
            if (details && details[appId] && details[appId].success) {
                const gameInfo = details[appId].data;
                const name = gameInfo.name;
                const image = gameInfo.header_image || `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/header.jpg`;
                this.addGameToPool(String(appId), name, image);
                this.dom.steamIdInput.value = '';
            } else {
                const guessedName = `Steam App #${appId}`;
                const imageUrl = `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/header.jpg`;
                this.addGameToPool(String(appId), guessedName, imageUrl);
                this.dom.steamIdInput.value = '';
                this.showToast("Loaded with fallback metadata", "success");
            }
        } catch (err) {
            const guessedName = `Steam App #${appId}`;
            const imageUrl = `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/header.jpg`;
            this.addGameToPool(String(appId), guessedName, imageUrl);
            this.dom.steamIdInput.value = '';
        } finally {
            this.dom.steamIdInput.disabled = false;
            if (this.dom.btnAddById) this.dom.btnAddById.disabled = false;
        }
    }

    addGameToPool(id, name, image) {
        const stringId = String(id);
        const existsInPool = this.state.pool.some(g => String(g.id) === stringId);
        const existsInTiers = this.state.tiers.some(t => t.games.some(g => String(g.id) === stringId));

        if (existsInPool || existsInTiers) {
            this.showToast(`"${name}" is already on the board!`, "error");
            return;
        }

        let cleanImage = image ? String(image).trim() : '';
        if (cleanImage && !/^(https?:\/\/|data:image\/|\/)/i.test(cleanImage)) {
            cleanImage = '';
        }

        const newGame = { id: stringId, name, image: cleanImage, source: "steam" };
        this.state.pool.push(newGame);
        this.renderPool();
        this.saveAutoSave();
        this.showToast(`Added "${name}" to unassigned pool`, "success");
    }


    // ==========================================================================
    // DYNAMIC TIER BOARD RENDERERS & ACTIONS
    // ==========================================================================

    renderBoard() {
        this.dom.tierRowsContainer.replaceChildren();
        
        this.state.tiers.forEach((tier, index) => {
            const row = document.createElement('div');
            row.className = 'tier-row';
            row.dataset.tierId = tier.id;

            // Tier Banner
            const banner = document.createElement('div');
            banner.className = 'tier-label-banner';
            banner.style.backgroundColor = tier.color;
            const labelSpan = document.createElement('span');
            labelSpan.textContent = tier.label;
            banner.appendChild(labelSpan);
            banner.title = "Click to edit row label or color";
            banner.addEventListener('click', () => this.openTierEditModal(tier.id));

            // Content Dropzone
            const content = document.createElement('div');
            content.className = 'tier-row-content droppable-row';
            content.dataset.tierId = tier.id;

            // Populate placed games inside row
            if (tier.games.length > 0) {
                tier.games.forEach(game => {
                    content.appendChild(this.createGameCardDom(game, tier.id));
                });
            }

            // Drag-and-drop event bindings for row content
            this.bindDragDropEvents(content);

            // Row Controls (Up, Down, Settings, Delete)
            const controls = document.createElement('div');
            controls.className = 'tier-row-actions';
            
            const btnUp = document.createElement('button');
            btnUp.className = 'row-action-btn';
            const iconUp = document.createElement('i');
            iconUp.setAttribute('data-lucide', 'chevron-up');
            btnUp.appendChild(iconUp);
            btnUp.title = "Move Row Up";
            btnUp.disabled = index === 0;
            btnUp.addEventListener('click', () => this.moveRowOrder(index, -1));

            const btnDown = document.createElement('button');
            btnDown.className = 'row-action-btn';
            const iconDown = document.createElement('i');
            iconDown.setAttribute('data-lucide', 'chevron-down');
            btnDown.appendChild(iconDown);
            btnDown.title = "Move Row Down";
            btnDown.disabled = index === this.state.tiers.length - 1;
            btnDown.addEventListener('click', () => this.moveRowOrder(index, 1));

            const btnSettings = document.createElement('button');
            btnSettings.className = 'row-action-btn';
            const iconSettings = document.createElement('i');
            iconSettings.setAttribute('data-lucide', 'sliders-horizontal');
            btnSettings.appendChild(iconSettings);
            btnSettings.title = "Settings";
            btnSettings.addEventListener('click', () => this.openTierEditModal(tier.id));

            const btnDelete = document.createElement('button');
            btnDelete.className = 'row-action-btn btn-del-row';
            const iconDelete = document.createElement('i');
            iconDelete.setAttribute('data-lucide', 'x');
            btnDelete.appendChild(iconDelete);
            btnDelete.title = "Delete Row (Games will return to pool)";
            btnDelete.addEventListener('click', () => this.deleteTierRow(tier.id));

            controls.appendChild(btnUp);
            controls.appendChild(btnDown);
            controls.appendChild(btnSettings);
            controls.appendChild(btnDelete);

            row.appendChild(banner);
            row.appendChild(content);
            row.appendChild(controls);

            this.dom.tierRowsContainer.appendChild(row);
        });

        this.refreshIcons();
    }

    renderPool() {
        // Clear all elements except the empty state
        const cards = this.dom.unassignedPool.querySelectorAll('.game-card');
        cards.forEach(c => c.remove());

        if (this.state.pool.length === 0) {
            this.dom.poolEmptyState.style.display = 'flex';
            this.dom.poolCount.textContent = '0 games';
        } else {
            this.dom.poolEmptyState.style.display = 'none';
            this.dom.poolCount.textContent = `${this.state.pool.length} game${this.state.pool.length > 1 ? 's' : ''}`;
            
            this.state.pool.forEach(game => {
                this.dom.unassignedPool.appendChild(this.createGameCardDom(game, 'pool'));
            });
        }

        // Bind drag & drop for pool itself guarded against listener duplication
        if (this.dom.unassignedPool && !this.dom.unassignedPool.dataset.bound) {
            this.bindDragDropEvents(this.dom.unassignedPool);
            this.dom.unassignedPool.dataset.bound = 'true';
        }
        if (this.dom.trashDropzone && !this.dom.trashDropzone.dataset.bound) {
            this.bindDragDropEvents(this.dom.trashDropzone);
            this.dom.trashDropzone.dataset.bound = 'true';
        }
        this.refreshIcons();
    }

    createGameCardDom(game, sourceId) {
        const card = document.createElement('div');
        card.className = 'game-card';
        card.dataset.gameId = String(game.id);
        card.dataset.sourceId = sourceId;
        card.draggable = true;
        card.tabIndex = 0;
        card.setAttribute('role', 'button');
        card.setAttribute('aria-label', `Game card: ${game.name}`);

        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.activeMobileGame = game;
                this.draggedSourceId = sourceId;
                this.openMobileModal(game);
            }
        });

        const img = document.createElement('img');
        img.className = 'game-card-img';
        img.alt = game.name;
        img.loading = 'lazy';
        img.decoding = 'async';
        img.crossOrigin = 'anonymous';

        try {
            Object.defineProperty(img, 'src', {
                get() { return this.getAttribute('src') || ''; },
                set(v) { this.setAttribute('src', v); },
                configurable: true
            });
        } catch (e) {
            // Graceful fallback if DOM environment restricts property redefinition
        }

        const attachTextFallback = () => {
            img.style.display = 'none';
            card.classList.add('no-image');
            if (!card.querySelector('.game-card-text')) {
                const text = document.createElement('div');
                text.className = 'game-card-text';
                text.textContent = game.name;
                card.appendChild(text);
            }
        };

        if (this.state.cardStyle === 'vertical') {
            const verticalUrl = `https://cdn.cloudflare.steamstatic.com/steam/apps/${game.id}/library_600x900.jpg`;
            img.src = verticalUrl;
            img.onerror = () => {
                img.src = game.image || `https://cdn.akamai.steamstatic.com/steam/apps/${game.id}/header.jpg`;
                img.onerror = () => {
                    attachTextFallback();
                };
            };
        } else {
            img.src = game.image || `https://cdn.akamai.steamstatic.com/steam/apps/${game.id}/header.jpg`;
            img.onerror = () => {
                attachTextFallback();
            };
        }
        card.appendChild(img);

        const overlay = document.createElement('div');
        overlay.className = 'game-card-overlay';
        overlay.textContent = game.name;
        card.appendChild(overlay);

        const steamLink = document.createElement('a');
        steamLink.className = 'steam-link-btn';
        steamLink.href = `https://store.steampowered.com/app/${game.id}/`;
        steamLink.target = '_blank';
        steamLink.rel = 'noopener noreferrer';
        const linkIcon = document.createElement('i');
        linkIcon.setAttribute('data-lucide', 'external-link');
        steamLink.appendChild(linkIcon);
        steamLink.title = "View on Steam";
        steamLink.addEventListener('click', (e) => e.stopPropagation());
        steamLink.addEventListener('dragstart', (e) => { e.preventDefault(); e.stopPropagation(); });
        card.appendChild(steamLink);

        // HTML5 Desktop Drag & Drop
        card.addEventListener('dragstart', (e) => {
            this.draggedGameId = String(game.id);
            this.draggedSourceId = sourceId;
            card.style.opacity = '0.5';
            card.dataset.isDragging = 'true';
            e.dataTransfer.setData('text/plain', String(game.id));
        });

        card.addEventListener('dragend', () => {
            card.style.opacity = '1';
            card.dataset.justDragged = 'true';
            setTimeout(() => {
                delete card.dataset.isDragging;
                delete card.dataset.justDragged;
            }, 150);
        });

        // Mobile / Tablet Touch Event Drag & Drop Implementation
        let touchStartX = 0;
        let touchStartY = 0;
        let touchDragged = false;
        let mirrorEl = null;

        card.addEventListener('touchstart', (e) => {
            if (e.touches.length > 1) return;
            const touch = e.touches[0];
            touchStartX = touch.clientX;
            touchStartY = touch.clientY;
            touchDragged = false;
            this.draggedGameId = String(game.id);
            this.draggedSourceId = sourceId;
        }, { passive: true });

        card.addEventListener('touchmove', (e) => {
            if (!touchStartX && !touchStartY) return;
            const touch = e.touches[0];
            const dx = touch.clientX - touchStartX;
            const dy = touch.clientY - touchStartY;

            if (!touchDragged && Math.hypot(dx, dy) > 8) {
                touchDragged = true;
                card.dataset.touchDragged = 'true';
                card.style.opacity = '0.4';
            }

            if (touchDragged) {
                if (e.cancelable) e.preventDefault();

                if (!mirrorEl) {
                    mirrorEl = card.cloneNode(true);
                    mirrorEl.classList.add('touch-drag-mirror');
                    mirrorEl.style.position = 'fixed';
                    mirrorEl.style.pointerEvents = 'none';
                    mirrorEl.style.zIndex = '9999';
                    mirrorEl.style.opacity = '0.85';
                    mirrorEl.style.width = `${card.offsetWidth}px`;
                    mirrorEl.style.height = `${card.offsetHeight}px`;
                    document.body.appendChild(mirrorEl);
                }

                mirrorEl.style.left = `${touch.clientX - card.offsetWidth / 2}px`;
                mirrorEl.style.top = `${touch.clientY - card.offsetHeight / 2}px`;

                document.querySelectorAll('.droppable-row').forEach(zone => zone.classList.remove('drag-over'));
                const elemBelow = document.elementFromPoint(touch.clientX, touch.clientY);
                if (elemBelow) {
                    const dropzone = elemBelow.closest('.droppable-row');
                    if (dropzone) dropzone.classList.add('drag-over');
                }
            }
        }, { passive: false });

        const handleTouchEnd = (e) => {
            if (mirrorEl) {
                mirrorEl.remove();
                mirrorEl = null;
            }
            card.style.opacity = '1';
            document.querySelectorAll('.droppable-row').forEach(zone => zone.classList.remove('drag-over'));

            if (touchDragged) {
                const touch = e.changedTouches ? e.changedTouches[0] : null;
                if (touch) {
                    const elemBelow = document.elementFromPoint(touch.clientX, touch.clientY);
                    if (elemBelow) {
                        const dropzone = elemBelow.closest('.droppable-row');
                        if (dropzone) {
                            const destTierId = dropzone.dataset.tierId;
                            const targetCard = elemBelow.closest('.game-card');
                            let targetGameId = null;
                            let insertAfter = false;

                            if (targetCard) {
                                targetGameId = targetCard.dataset.gameId;
                                const rect = targetCard.getBoundingClientRect();
                                if (this.state.cardStyle === 'vertical') {
                                    const midY = rect.top + rect.height / 2;
                                    if (touch.clientY > midY) insertAfter = true;
                                } else {
                                    const midX = rect.left + rect.width / 2;
                                    if (touch.clientX > midX) insertAfter = true;
                                }
                            }

                            if (destTierId === 'trash') {
                                this.deleteGame(String(game.id), sourceId);
                            } else if (destTierId) {
                                this.moveGameToDestination(String(game.id), sourceId, destTierId, targetGameId, insertAfter);
                            }
                        }
                    }
                }
                setTimeout(() => { delete card.dataset.touchDragged; }, 150);
            }
            touchStartX = 0;
            touchStartY = 0;
            touchDragged = false;
        };

        card.addEventListener('touchend', handleTouchEnd);
        card.addEventListener('touchcancel', handleTouchEnd);

        // Click handler triggers mobile quick selection screen ONLY if not dragging
        card.addEventListener('click', (e) => {
            if (card.dataset.isDragging || card.dataset.touchDragged || card.dataset.justDragged) {
                delete card.dataset.touchDragged;
                delete card.dataset.justDragged;
                return;
            }
            this.activeMobileGame = game;
            this.draggedSourceId = sourceId;
            this.openMobileModal(game);
        });

        return card;
    }

    bindDragDropEvents(zone) {
        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            zone.classList.add('drag-over');
        });

        zone.addEventListener('dragleave', () => {
            zone.classList.remove('drag-over');
        });

        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('drag-over');
            
            const gameId = this.draggedGameId;
            const destTierId = zone.dataset.tierId;

            let targetCard = e.target ? e.target.closest('.game-card') : null;
            if (!targetCard && typeof document !== 'undefined') {
                if (document.elementFromPoint) {
                    const elem = document.elementFromPoint(e.clientX, e.clientY);
                    if (elem) targetCard = elem.closest('.game-card');
                }
                if (!targetCard) {
                    const cards = Array.from(zone.querySelectorAll('.game-card'));
                    for (const c of cards) {
                        if (c.getBoundingClientRect) {
                            const r = c.getBoundingClientRect();
                            if (r && e.clientX >= r.left && e.clientX <= r.left + r.width && e.clientY >= r.top && e.clientY <= r.top + r.height) {
                                targetCard = c;
                                break;
                            }
                        }
                    }
                }
            }
            let targetGameId = null;
            let insertAfter = false;
            
            if (targetCard) {
                targetGameId = targetCard.dataset.gameId;
                const rect = targetCard.getBoundingClientRect();
                if (this.state.cardStyle === 'vertical') {
                    const midY = rect.top + rect.height / 2;
                    if (e.clientY > midY) {
                        insertAfter = true;
                    }
                } else {
                    const midX = rect.left + rect.width / 2;
                    if (e.clientX > midX) {
                        insertAfter = true;
                    }
                }
            }

            if (gameId && destTierId) {
                if (destTierId === 'trash') {
                    this.deleteGame(String(gameId), this.draggedSourceId);
                } else {
                    this.moveGameToDestination(String(gameId), this.draggedSourceId, destTierId, targetGameId, insertAfter);
                }
            }
        });
    }

    updatePoolCountDisplay() {
        if (this.state.pool.length === 0) {
            this.dom.poolEmptyState.style.display = 'flex';
            this.dom.poolCount.textContent = '0 games';
        } else {
            this.dom.poolEmptyState.style.display = 'none';
            this.dom.poolCount.textContent = `${this.state.pool.length} game${this.state.pool.length > 1 ? 's' : ''}`;
        }
    }

    appendToDestContainer(node, destId) {
        if (destId === 'pool') {
            this.dom.unassignedPool.appendChild(node);
        } else {
            const content = document.querySelector(`.tier-row-content[data-tier-id="${destId}"]`);
            if (content) content.appendChild(node);
        }
    }

    moveGameToDestination(gameId, sourceId, destId, targetGameId = null, insertAfter = false) {
        if (sourceId === destId && (!targetGameId || targetGameId.toString() === gameId.toString())) return;

        // Retrieve game object
        let gameObj = null;

        // Remove from source
        if (sourceId === 'pool') {
            const index = this.state.pool.findIndex(g => g.id.toString() === gameId.toString());
            if (index > -1) {
                gameObj = this.state.pool.splice(index, 1)[0];
            }
        } else {
            const tier = this.state.tiers.find(t => t.id === sourceId);
            if (tier) {
                const index = tier.games.findIndex(g => g.id.toString() === gameId.toString());
                if (index > -1) {
                    gameObj = tier.games.splice(index, 1)[0];
                }
            }
        }

        if (!gameObj) return;

        // Insert into destination
        if (destId === 'pool') {
            if (targetGameId) {
                let targetIndex = this.state.pool.findIndex(g => g.id.toString() === targetGameId.toString());
                if (targetIndex > -1) {
                    if (insertAfter) targetIndex += 1;
                    this.state.pool.splice(targetIndex, 0, gameObj);
                } else {
                    this.state.pool.push(gameObj);
                }
            } else {
                this.state.pool.push(gameObj);
            }
        } else {
            const tier = this.state.tiers.find(t => t.id === destId);
            if (tier) {
                if (targetGameId) {
                    let targetIndex = tier.games.findIndex(g => g.id.toString() === targetGameId.toString());
                    if (targetIndex > -1) {
                        if (insertAfter) targetIndex += 1;
                        tier.games.splice(targetIndex, 0, gameObj);
                    } else {
                        tier.games.push(gameObj);
                    }
                } else {
                    tier.games.push(gameObj);
                }
            }
        }

        // Efficient targeted DOM manipulation instead of full re-render
        const existingNode = document.querySelector(`.game-card[data-game-id="${gameId}"]`);
        
        if (!existingNode) {
            this.renderPool();
            this.renderBoard();
            return;
        }

        existingNode.dataset.sourceId = destId;
        
        if (targetGameId && targetGameId !== gameId) {
            const targetNode = document.querySelector(`.game-card[data-game-id="${targetGameId}"]`);
            if (targetNode) {
                if (insertAfter) {
                    targetNode.after(existingNode);
                } else {
                    targetNode.before(existingNode);
                }
            } else {
                this.appendToDestContainer(existingNode, destId);
            }
        } else {
            this.appendToDestContainer(existingNode, destId);
        }

        this.updatePoolCountDisplay();
        this.saveAutoSave();
    }

    deleteGame(gameId, sourceId) {
        const stringId = String(gameId);
        if (sourceId === 'pool') {
            this.state.pool = this.state.pool.filter(g => String(g.id) !== stringId);
        } else {
            const tier = this.state.tiers.find(t => t.id === sourceId);
            if (tier) {
                tier.games = tier.games.filter(g => String(g.id) !== stringId);
            }
        }
        
        const node = document.querySelector(`.game-card[data-game-id="${gameId}"]`);
        if (node) node.remove();

        this.updatePoolCountDisplay();
        this.saveAutoSave();
        this.showToast("Game removed from board", "success");
    }

    // ==========================================================================
    // DYNAMIC TIER ROW CONTROLS (UP, DOWN, ADD, DELETE)
    // ==========================================================================

    moveRowOrder(index, direction) {
        const destIndex = index + direction;
        if (destIndex < 0 || destIndex >= this.state.tiers.length) return;

        // Swap tier positions
        const temp = this.state.tiers[index];
        this.state.tiers[index] = this.state.tiers[destIndex];
        this.state.tiers[destIndex] = temp;

        this.renderBoard();
    }

    addNewTier() {
        const uniqueId = `tier-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const newTier = {
            id: uniqueId,
            label: "NEW TIER",
            color: "#6272a4",
            games: []
        };
        this.state.tiers.push(newTier);
        this.renderBoard();
        this.showToast("Added new tier row", "success");
    }

    deleteTierRow(tierId) {
        const tierIndex = this.state.tiers.findIndex(t => t.id === tierId);
        if (tierIndex === -1) return;

        const tier = this.state.tiers[tierIndex];

        // Move all placed games back into the pool
        if (tier.games.length > 0) {
            this.state.pool.push(...tier.games);
        }

        this.state.tiers.splice(tierIndex, 1);
        
        this.renderBoard();
        this.renderPool();
        this.showToast(`Deleted row and returned games to pool`, "success");
    }

    openTierEditModal(tierId) {
        const tier = this.state.tiers.find(t => t.id === tierId);
        if (!tier) return;

        this.activeEditTierId = tierId;
        this.dom.editTierLabel.value = tier.label;
        this.dom.customColorPicker.value = tier.color;

        // Highlight preset color if matching
        this.dom.colorPresets.forEach(preset => {
            if (preset.dataset.color.toLowerCase() === tier.color.toLowerCase()) {
                preset.classList.add('active');
            } else {
                preset.classList.remove('active');
            }
        });

        this.dom.tierEditModal.style.display = 'flex';
    }

    closeTierEditModal() {
        this.dom.tierEditModal.style.display = 'none';
        this.activeEditTierId = null;
    }

    saveTierRowSettings() {
        const tier = this.state.tiers.find(t => t.id === this.activeEditTierId);
        if (!tier) return;

        const label = this.dom.editTierLabel.value.trim();
        const color = this.dom.customColorPicker.value;

        if (!label) {
            this.showToast("Tier label cannot be empty", "error");
            return;
        }

        tier.label = label;
        tier.color = color;

        this.renderBoard();
        this.closeTierEditModal();
        this.showToast("Tier settings updated successfully", "success");
    }

    // ==========================================================================
    // MOBILE / TAP INTERACTIVE SYSTEM
    // ==========================================================================

    openMobileModal(game) {
        this.dom.mobileGameName.textContent = game.name;
        this.dom.mobileTierSelectGrid.innerHTML = '';

        // Dynamically build tier selections matching their custom color banners
        this.state.tiers.forEach(tier => {
            const btn = document.createElement('button');
            btn.className = 'tier-select-btn';
            btn.style.backgroundColor = tier.color;
            btn.textContent = tier.label;
            btn.addEventListener('click', () => {
                this.moveGameToDestination(game.id, this.draggedSourceId, tier.id);
                this.closeMobileModal();
            });
            this.dom.mobileTierSelectGrid.appendChild(btn);
        });

        this.dom.mobileMoveModal.style.display = 'flex';
    }

    closeMobileModal() {
        this.dom.mobileMoveModal.style.display = 'none';
        this.activeMobileGame = null;
    }

    // ==========================================================================
    // LOCAL STORAGE / THE MULTI-TIERLIST GALLERY LIBRARY
    // ==========================================================================

    loadLibraryFromStorage() {
        try {
            const lib = localStorage.getItem('steam_tier_master_library');
            if (!lib) {
                this.state.savedLists = [];
                return;
            }
            const parsed = JSON.parse(lib);
            if (!Array.isArray(parsed)) {
                this.state.savedLists = [];
            } else {
                this.state.savedLists = parsed.filter(l => l && typeof l === 'object' && l.id && typeof l.title === 'string');
            }
        } catch (e) {
            this.state.savedLists = [];
        }
    }

    saveLibraryToStorage() {
        try {
            localStorage.setItem('steam_tier_master_library', JSON.stringify(this.state.savedLists));
            this.updateLibraryBadge();
            this.renderLibrary();
            return true;
        } catch (e) {
            this.showToast("Could not save to LocalStorage (Storage quota exceeded).", "error");
            return false;
        }
    }

    updateLibraryBadge() {
        if (!this.dom.libraryCount) return;
        const count = this.state.savedLists.length;
        this.dom.libraryCount.textContent = count;
        this.dom.libraryCount.style.display = count > 0 ? 'inline-block' : 'none';
    }

    saveActiveList() {
        if (!this.state.listTitle || !this.state.listTitle.trim()) {
            this.showToast("Please give your tier list a title first", "error");
            return;
        }

        const listId = this.state.id || `list-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const timestamp = new Date().toLocaleString();

        const listConfig = {
            id: listId,
            title: this.state.listTitle,
            tiers: JSON.parse(JSON.stringify(this.state.tiers)), // deep clone
            pool: JSON.parse(JSON.stringify(this.state.pool)),
            cardStyle: this.state.cardStyle,
            cardSize: this.state.cardSize,
            lastEdited: timestamp
        };

        const existingIndex = this.state.savedLists.findIndex(l => l.id === listId);

        if (existingIndex > -1) {
            this.state.savedLists[existingIndex] = listConfig;
        } else {
            this.state.savedLists.push(listConfig);
            this.state.id = listId; // lock this active list session
        }

        if (this.saveLibraryToStorage()) {
            this.showToast(`Saved "${this.state.listTitle}" successfully!`, "success");
        }
    }

    loadSavedList(listId) {
        const list = this.state.savedLists.find(l => l.id === listId);
        if (!list) return;

        this.state.id = list.id;
        this.state.listTitle = list.title;
        this.state.tiers = JSON.parse(JSON.stringify(list.tiers));
        this.state.pool = JSON.parse(JSON.stringify(list.pool));

        this.state.cardStyle = list.cardStyle || 'horizontal';
        const loadedSize = list.cardSize || 'medium';
        this.state.cardSize = ['small', 'medium', 'large'].includes(loadedSize) ? loadedSize : 'medium';
        this.updateToggleButtonsActiveState();
        this.applyCardStyleClasses();
        this.applyCardSizeClasses();

        // Update inputs & title
        if (this.dom.listTitleInput) this.dom.listTitleInput.value = this.state.listTitle;
        if (this.dom.boardTitleDisplay) this.dom.boardTitleDisplay.textContent = this.state.listTitle.toUpperCase();

        this.renderBoard();
        this.renderPool();
        
        this.switchTab('builder');
        this.showToast(`Loaded list "${list.title}"`, "success");
    }

    duplicateSavedList(listId) {
        const original = this.state.savedLists.find(l => l.id === listId);
        if (!original) return;

        const clone = JSON.parse(JSON.stringify(original));
        clone.id = `list-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        clone.title = `${original.title} (Copy)`;
        clone.lastEdited = new Date().toLocaleString();

        this.state.savedLists.push(clone);
        this.saveLibraryToStorage();
        this.showToast(`Cloned list as "${clone.title}"`, "success");
    }

    deleteSavedList(listId) {
        this.state.savedLists = this.state.savedLists.filter(l => l.id !== listId);
        
        // Reset ID if active session deleted
        if (this.state.id === listId) {
            this.state.id = null;
        }

        this.saveLibraryToStorage();
        this.showToast("Tier list deleted permanently", "success");
    }

    renderLibrary() {
        if (!this.dom.libraryGrid) return;
        this.dom.libraryGrid.replaceChildren();

        if (this.state.savedLists.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.className = 'library-empty-state';
            const icon = document.createElement('i');
            icon.setAttribute('data-lucide', 'folder-open');
            const h3 = document.createElement('h3');
            h3.textContent = 'Your library is empty';
            const p = document.createElement('p');
            p.textContent = 'Build and save your custom tier lists to see them listed here!';
            emptyState.append(icon, h3, p);
            this.dom.libraryGrid.appendChild(emptyState);
            if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
            return;
        }

        this.state.savedLists.forEach(list => {
            const card = document.createElement('div');
            card.className = 'saved-card';

            const poolCount = Array.isArray(list.pool) ? list.pool.length : 0;
            const tierCount = Array.isArray(list.tiers) ? list.tiers.length : 0;
            const gamesInTiers = Array.isArray(list.tiers) ? list.tiers.reduce((acc, t) => acc + (Array.isArray(t.games) ? t.games.length : 0), 0) : 0;
            const totalGames = poolCount + gamesInTiers;

            const header = document.createElement('div');
            header.className = 'saved-header';
            const titleH3 = document.createElement('h3');
            titleH3.className = 'saved-title';
            titleH3.textContent = list.title || 'Untitled List';
            const dateSpan = document.createElement('span');
            dateSpan.className = 'saved-date';
            dateSpan.textContent = `Last Saved: ${list.lastEdited || ''}`;
            header.append(titleH3, dateSpan);

            const stats = document.createElement('div');
            stats.className = 'saved-stats';

            const item1 = document.createElement('div');
            item1.className = 'saved-stat-item';
            const icon1 = document.createElement('i');
            icon1.setAttribute('data-lucide', 'gamepad-2');
            const span1 = document.createElement('span');
            span1.textContent = `${totalGames} Game${totalGames !== 1 ? 's' : ''}`;
            item1.append(icon1, span1);

            const item2 = document.createElement('div');
            item2.className = 'saved-stat-item';
            const icon2 = document.createElement('i');
            icon2.setAttribute('data-lucide', 'rows-4');
            const span2 = document.createElement('span');
            span2.textContent = `${tierCount} Tier${tierCount !== 1 ? 's' : ''}`;
            item2.append(icon2, span2);

            stats.append(item1, item2);

            const actions = document.createElement('div');
            actions.className = 'saved-actions';

            const btnLoad = document.createElement('button');
            btnLoad.className = 'btn btn-primary btn-load-list';
            const loadIcon = document.createElement('i');
            loadIcon.setAttribute('data-lucide', 'folder-open');
            btnLoad.append(loadIcon, document.createTextNode(' Load'));
            btnLoad.addEventListener('click', () => this.loadSavedList(list.id));

            const btnClone = document.createElement('button');
            btnClone.className = 'btn btn-outline btn-clone-list';
            const cloneIcon = document.createElement('i');
            cloneIcon.setAttribute('data-lucide', 'copy');
            btnClone.append(cloneIcon, document.createTextNode(' Clone'));
            btnClone.addEventListener('click', () => this.duplicateSavedList(list.id));

            const btnDelete = document.createElement('button');
            btnDelete.className = 'btn btn-danger btn-delete-list';
            const delIcon = document.createElement('i');
            delIcon.setAttribute('data-lucide', 'trash-2');
            btnDelete.append(delIcon, document.createTextNode(' Delete'));
            btnDelete.addEventListener('click', () => {
                this.showConfirmModal(
                    "Delete Tier List",
                    `Are you sure you want to permanently delete "${list.title || 'Untitled List'}"?`,
                    () => this.deleteSavedList(list.id)
                );
            });

            actions.append(btnLoad, btnClone, btnDelete);

            card.append(header, stats, actions);
            this.dom.libraryGrid.appendChild(card);
        });

        if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
    }

    // ==========================================================================
    // PRESET STARTING TEMPLATES
    // ==========================================================================

    renderTemplates() {
        if (!this.dom.templatesGrid) return;
        this.dom.templatesGrid.replaceChildren();
        PRESET_TEMPLATES.forEach(tmpl => {
            const card = document.createElement('div');
            card.className = 'template-card';

            const banner = document.createElement('div');
            banner.className = 'template-banner';
            let bannerUrl = tmpl.banner || '';
            if (bannerUrl && !/^(https?:\/\/|data:image\/|\/)/i.test(bannerUrl)) {
                bannerUrl = '';
            }
            if (bannerUrl) {
                banner.style.backgroundImage = `url('${bannerUrl}')`;
            }

            const details = document.createElement('div');
            details.className = 'template-details';
            
            const h3 = document.createElement('h3');
            h3.textContent = tmpl.name;
            const p = document.createElement('p');
            p.textContent = tmpl.description;

            const footer = document.createElement('div');
            footer.className = 'template-footer';
            
            const countTag = document.createElement('span');
            countTag.className = 'games-count-tag';
            countTag.textContent = `${tmpl.games.length} games preloaded`;

            const rankBtn = document.createElement('button');
            rankBtn.className = 'btn btn-glow-green btn-rank-template';
            const rocketIcon = document.createElement('i');
            rocketIcon.setAttribute('data-lucide', 'rocket');
            rankBtn.append(rocketIcon, document.createTextNode(' Rank Now'));
            rankBtn.addEventListener('click', () => this.loadTemplate(tmpl.id));

            footer.append(countTag, rankBtn);

            details.append(h3, p, footer);
            card.append(banner, details);
            this.dom.templatesGrid.appendChild(card);
        });
        if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
    }

    loadTemplate(templateId) {
        const tmpl = PRESET_TEMPLATES.find(t => t.id === templateId);
        if (!tmpl) return;

        // Reset board and sessions
        this.state.id = null;
        this.state.listTitle = `Ultimate ${tmpl.name} Tier List`;
        if (this.dom.listTitleInput) this.dom.listTitleInput.value = this.state.listTitle;
        if (this.dom.boardTitleDisplay) this.dom.boardTitleDisplay.textContent = this.state.listTitle.toUpperCase();

        this.state.tiers = [
            { id: "tier-s", label: "S", color: "#ff79c6", games: [] },
            { id: "tier-a", label: "A", color: "#ffb86c", games: [] },
            { id: "tier-b", label: "B", color: "#f1fa8c", games: [] },
            { id: "tier-c", label: "C", color: "#50fa7b", games: [] },
            { id: "tier-d", label: "D", color: "#8be9fd", games: [] }
        ];

        // Clone game listings into pool
        this.state.pool = JSON.parse(JSON.stringify(tmpl.games)).map(g => ({
            ...g,
            id: String(g.id),
            source: g.source || "steam"
        }));
        
        this.state.cardStyle = 'horizontal';
        this.state.cardSize = 'medium';
        this.updateToggleButtonsActiveState();
        this.applyCardStyleClasses();
        this.applyCardSizeClasses();

        this.renderBoard();
        this.renderPool();

        this.switchTab('builder');
        this.showToast(`Loaded "${tmpl.name}" preset template!`, "success");
    }

    // ==========================================================================
    // BACKUPS & EXPORTS (PNG, JSON)
    // ==========================================================================

    async exportToPng() {
        if (typeof html2canvas === 'undefined') {
            this.showToast("PNG Export library (html2canvas) is not available", "error");
            return;
        }

        this.showToast("Compiling tier list image... Please wait.", "success");
        
        const actions = document.querySelectorAll('.tier-row-actions');
        const boardControls = document.querySelector('.board-builder-controls');
        
        try {
            actions.forEach(a => a.style.display = 'none');
            if (boardControls) boardControls.style.display = 'none';

            const board = this.dom.tierListBoard;
            const canvas = await html2canvas(board, {
                backgroundColor: '#0a0b10',
                scale: 2,
                useCORS: true,
                allowTaint: false,
                logging: false
            });

            const link = document.createElement('a');
            link.download = `${this.state.listTitle.replace(/\s+/g, '_')}_tierlist.png`;
            link.href = canvas.toDataURL('image/png');
            document.body.appendChild(link);
            link.click();
            link.remove();

            this.showToast("PNG exported successfully!", "success");
        } catch (e) {
            console.error("Export failure:", e);
            this.showToast("Could not generate image. Check network connection.", "error");
        } finally {
            actions.forEach(a => a.style.display = 'flex');
            if (boardControls) boardControls.style.display = 'flex';
        }
    }

    backupJson() {
        const formatGames = (games) => games.map(g => ({
            id: String(g.id),
            name: g.name || '',
            image: g.image || '',
            source: g.source || 'steam'
        }));

        const exportPayload = {
            version: "1.0",
            title: this.state.listTitle,
            tiers: this.state.tiers.map(t => ({
                id: String(t.id),
                label: String(t.label),
                color: String(t.color),
                games: formatGames(t.games || [])
            })),
            pool: formatGames(this.state.pool || []),
            cardStyle: this.state.cardStyle,
            cardSize: this.state.cardSize
        };

        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportPayload, null, 2));

        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", `${this.state.listTitle.replace(/\s+/g, '_')}_config.json`);
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        
        this.showToast("Config JSON downloaded", "success");
    }

    validateAndSanitizeImport(data) {
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
            throw new Error("Invalid root object structure");
        }

        if (typeof data.title !== 'string' || !data.title.trim()) {
            throw new Error("Missing or invalid 'title' string property");
        }

        if (!Array.isArray(data.tiers)) {
            throw new Error("Missing or invalid 'tiers' array property");
        }

        if (!Array.isArray(data.pool)) {
            throw new Error("Missing or invalid 'pool' array property");
        }

        const hexColorRegex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
        const seenGameIds = new Set();

        const sanitizeGame = (g, gIdx, location) => {
            if (!g || typeof g !== 'object') {
                throw new Error(`Game at index ${gIdx} in ${location} is invalid`);
            }
            if (g.id === undefined || g.id === null) {
                throw new Error(`Game at index ${gIdx} in ${location} missing required fields`);
            }
            if (typeof g.name !== 'string') {
                throw new Error(`Game at index ${gIdx} in ${location} missing required fields`);
            }
            if (typeof g.image !== 'string') {
                throw new Error(`Game at index ${gIdx} in ${location} missing required fields`);
            }

            let id = String(g.id).trim();
            if (!id) id = `game-${Date.now()}-${Math.random()}`;
            if (seenGameIds.has(id)) {
                id = `${id}_dup_${seenGameIds.size}`;
            }
            seenGameIds.add(id);

            const name = g.name.trim();
            let image = g.image.trim();

            if (image && !/^(https?:\/\/|data:image\/|\/)/i.test(image)) {
                image = '';
            }

            const source = g.source ? String(g.source) : 'steam';
            return { id, name, image, source };
        };

        const validatedTiers = data.tiers.map((t, idx) => {
            if (!t || typeof t !== 'object') {
                throw new Error(`Invalid tier structure at index ${idx}`);
            }
            if (t.id === undefined || t.id === null || typeof t.label !== 'string' || typeof t.color !== 'string' || !Array.isArray(t.games)) {
                throw new Error(`Tier at index ${idx} missing required fields (id, label, color, games)`);
            }

            const id = String(t.id).trim();
            const label = t.label.trim();
            const color = hexColorRegex.test(t.color.trim()) ? t.color.trim() : '#6272a4';
            const games = t.games.map((g, gIdx) => sanitizeGame(g, gIdx, `tier "${label || idx}"`));

            return { id, label, color, games };
        });

        const validatedPool = data.pool.map((g, gIdx) => sanitizeGame(g, gIdx, 'pool'));

        const cardStyle = ['horizontal', 'vertical'].includes(data.cardStyle) ? data.cardStyle : 'horizontal';
        const cardSize = ['tiny', 'small', 'medium', 'large', 'xl', 'xxl'].includes(data.cardSize) ? data.cardSize : 'medium';

        return {
            version: "1.0",
            title: data.title.trim(),
            tiers: validatedTiers,
            pool: validatedPool,
            cardStyle,
            cardSize
        };
    }

    importJson(event) {
        const file = event?.target?.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                let parsed;
                try {
                    parsed = JSON.parse(e.target.result);
                } catch (parseErr) {
                    throw new Error("Malformed JSON text syntax error");
                }

                const sanitizedState = this.validateAndSanitizeImport(parsed);

                this.state.id = null;
                this.state.listTitle = sanitizedState.title;
                this.state.tiers = sanitizedState.tiers;
                this.state.pool = sanitizedState.pool;
                this.state.cardStyle = sanitizedState.cardStyle;
                this.state.cardSize = sanitizedState.cardSize;

                if (this.dom.listTitleInput) this.dom.listTitleInput.value = this.state.listTitle;
                if (this.dom.boardTitleDisplay) this.dom.boardTitleDisplay.textContent = this.state.listTitle.toUpperCase();

                this.updateToggleButtonsActiveState();
                this.applyCardStyleClasses();
                this.applyCardSizeClasses();
                this.renderBoard();
                this.renderPool();
                this.markDirty();
                this.saveAutoSave();
                this.showToast("JSON Config loaded successfully!", "success");
            } catch (err) {
                this.showToast(`Failed to parse config: ${err.message}`, "error");
            }
        };

        reader.onerror = () => {
            this.showToast("Failed to read JSON file from disk", "error");
            if (this.dom.fileImport) this.dom.fileImport.value = '';
        };

        try {
            reader.readAsText(file);
        } catch (err) {
            this.showToast(`Failed to read file: ${err.message}`, "error");
        }
        
        if (this.dom.fileImport) this.dom.fileImport.value = '';
    }

    // ==========================================================================
    // UTILITIES
    // ==========================================================================

    switchTab(tabId) {
        if (this.dom.tabs) {
            this.dom.tabs.forEach(btn => {
                if (btn.dataset.tab === tabId) btn.classList.add('active');
                else btn.classList.remove('active');
            });
        }

        if (this.dom.tabContents) {
            this.dom.tabContents.forEach(content => {
                if (content.id === `tab-${tabId}`) content.classList.add('active');
                else content.classList.remove('active');
            });
        }

        if (tabId === 'library') {
            this.renderLibrary();
        }
    }

    resetBoard() {
        this.showConfirmModal(
            "Reset Board",
            "Are you sure you want to reset the board? This will return all tier list games to the pool.",
            () => {
                this.state.id = null; // Reset active list session ID
                this.state.tiers.forEach(tier => {
                    if (tier.games.length > 0) {
                        this.state.pool.push(...tier.games);
                    }
                    tier.games = [];
                });

                this.renderBoard();
                this.renderPool();
                this.markDirty();
                this.saveAutoSave();
                this.showToast("Board reset complete", "success");
            }
        );
    }

    showToast(message, type = "success") {
        if (!this.dom.toastContainer) return;
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        const iconName = type === 'success' ? 'check-circle' : 'alert-circle';
        const icon = document.createElement('i');
        icon.setAttribute('data-lucide', iconName);

        const textSpan = document.createElement('span');
        textSpan.textContent = String(message);

        toast.append(icon, textSpan);
        
        this.dom.toastContainer.appendChild(toast);
        this.refreshIcons();

        // Fade slide transitions out
        setTimeout(() => {
            toast.style.animation = 'slideInToast 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.25) reverse';
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 3000);
    }

    applyCardStyleClasses() {
        const board = this.dom.tierListBoard || document.getElementById('tier-list-board');
        const pool = this.dom.unassignedPool || document.getElementById('unassigned-pool');
        
        if (!board || !pool) return;

        if (this.state.cardStyle === 'vertical') {
            board.classList.remove('layout-horizontal');
            board.classList.add('layout-vertical');
            pool.classList.remove('layout-horizontal');
            pool.classList.add('layout-vertical');
        } else {
            board.classList.remove('layout-vertical');
            board.classList.add('layout-horizontal');
            pool.classList.remove('layout-vertical');
            pool.classList.add('layout-horizontal');
        }
    }

    updateCardStyle(style) {
        this.state.cardStyle = style;
        this.updateToggleButtonsActiveState();
        this.applyCardStyleClasses();
        this.renderBoard();
        this.renderPool();
        this.markDirty();
        this.showToast(`Switched layout to ${style === 'horizontal' ? 'Horizontal' : 'Vertical'} cards`, "success");
    }

    applyCardSizeClasses() {
        const board = this.dom.tierListBoard || document.getElementById('tier-list-board');
        const pool = this.dom.unassignedPool || document.getElementById('unassigned-pool');
        
        if (!board || !pool) return;

        const sizes = ['tiny', 'small', 'medium', 'large', 'xl', 'xxl'];
        sizes.forEach(s => {
            board.classList.remove(`size-${s}`);
            pool.classList.remove(`size-${s}`);
        });

        board.classList.add(`size-${this.state.cardSize}`);
        pool.classList.add(`size-${this.state.cardSize}`);
    }

    updateCardSize(size) {
        this.state.cardSize = size;
        this.updateToggleButtonsActiveState();
        this.applyCardSizeClasses();
        this.renderBoard();
        this.renderPool();
        this.markDirty();
        this.showToast(`Switched card size to ${size.toUpperCase()}`, "success");
    }

    updateToggleButtonsActiveState() {
        if (this.dom.layoutToggles) {
            this.dom.layoutToggles.forEach(btn => {
                if (btn.dataset.layout === this.state.cardStyle) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
        }
        if (this.dom.sizeToggles) {
            this.dom.sizeToggles.forEach(btn => {
                if (btn.dataset.size === this.state.cardSize) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
        }
    }

    loadAutoSave() {
        try {
            const data = localStorage.getItem('steam_tier_master_autosave');
            if (data) {
                const config = JSON.parse(data);
                if (config && typeof config === 'object' && !Array.isArray(config)) {
                    this.state.id = config.id || null;
                    if (typeof config.listTitle === 'string') this.state.listTitle = config.listTitle;
                    if (Array.isArray(config.tiers)) this.state.tiers = config.tiers;
                    if (Array.isArray(config.pool)) this.state.pool = config.pool;
                    if (config.cardStyle && ['horizontal', 'vertical'].includes(config.cardStyle)) {
                        this.state.cardStyle = config.cardStyle;
                    }
                    if (config.cardSize && ['tiny', 'small', 'medium', 'large', 'xl', 'xxl'].includes(config.cardSize)) {
                        this.state.cardSize = config.cardSize;
                    }
                    
                    if (this.dom.listTitleInput) {
                        this.dom.listTitleInput.value = this.state.listTitle;
                    }
                    if (this.dom.boardTitleDisplay) {
                        this.dom.boardTitleDisplay.textContent = this.state.listTitle.toUpperCase();
                    }
                }
            }
        } catch (e) {
            // Gracefully ignore corrupt autosave
        }
    }

    saveAutoSave() {
        try {
            const config = {
                id: this.state.id,
                listTitle: this.state.listTitle,
                tiers: this.state.tiers,
                pool: this.state.pool,
                cardStyle: this.state.cardStyle,
                cardSize: this.state.cardSize
            };
            localStorage.setItem('steam_tier_master_autosave', JSON.stringify(config));
            this.isDirty = false;
        } catch (e) {
            // LocalStorage errors caught safely
            this.isDirty = false;
        }
    }
}

// Global entrypoint
if (typeof window !== 'undefined') {
    window.TierListApp = TierListApp;
    const initApp = () => {
        if (!window.app) {
            try {
                window.app = new TierListApp();
            } catch (e) {
                console.error("Failed to instantiate TierListApp:", e);
            }
        }
    };
    if (document.readyState === 'loading' && !document.body) {
        document.addEventListener('DOMContentLoaded', initApp);
    } else {
        initApp();
    }
}


