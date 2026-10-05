/**
 * Steam Tier Master - Application Controller
 */
const BOARD_LIMITS = Object.freeze({ tiers: 50, games: 1000, jsonBytes: 5 * 1024 * 1024, shareChars: 500000 });
const DEFAULT_TITLE = 'My Ultimate Gaming Tier List';

function allocateId(value, seen, prefix) {
    const raw = String(value ?? '').trim();
    const base = /^[A-Za-z0-9_-]{1,100}$/.test(raw) ? raw : prefix;
    let id = base;
    let suffix = 1;
    while (seen.has(id)) {
        const tail = `_dup_${suffix++}`;
        id = base.slice(0, 100 - tail.length) + tail;
    }
    seen.add(id);
    return id;
}

function tierTextColor(color) {
    let hex = color.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const rgb = hex.match(/../g).map(c => parseInt(c, 16) / 255)
        .map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    const luminance = rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
    return luminance > 0.179 ? '#05060b' : '#ffffff';
}

function sanitizeImageUrl(value) {
    const image = value ? String(value).trim() : '';
    if (!image) return '';
    const safeDataImage = /^data:image\/(png|jpe?g|gif|webp);base64,/i.test(image) && image.length <= 2000000;
    const safeWebImage = /^(https?:\/\/|\/)/i.test(image) && image.length <= 2048;
    return safeDataImage || safeWebImage ? image : '';
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
        this.activeDetailsAbortController = null;
        this.confirmCallback = null;
        this.autoSaveInterval = null;
        this.searchCache = new Map();
        this.detailsCache = new Map();
        this.activeModal = null;
        this.lastFocusedElement = null;

        this.init();
    }

    markDirty() {
        this.isDirty = true;
        this.updateSaveStatus('Unsaved changes');
    }

    updateSaveStatus(message, failed = false) {
        const status = document.getElementById('save-status');
        if (!status) return;
        status.textContent = message;
        status.classList.toggle('save-error', failed);
    }

    boardSnapshot() {
        return {
            id: this.state.id,
            listTitle: this.state.listTitle.trim() || DEFAULT_TITLE,
            tiers: this.state.tiers, pool: this.state.pool,
            cardStyle: this.state.cardStyle, cardSize: this.state.cardSize
        };
    }

    cancelPendingWork() {
        clearTimeout(this.searchTimeout);
        this.activeSearchAbortController?.abort();
        this.activeDetailsAbortController?.abort();
        this.activeDetailsAbortController = null;
        if (this.dom.steamIdInput) this.dom.steamIdInput.disabled = false;
        if (this.dom.btnAddById) this.dom.btnAddById.disabled = false;
        this.activeImportReader?.abort?.();
        this.activeImportReader = null;
        this.cancelTouchDrag?.();
        this.cancelMouseDrag?.();
        if (this.dom.searchDropdown) this.dom.searchDropdown.style.display = 'none';
        if (this.dom.searchSpinner) this.dom.searchSpinner.style.display = 'none';
        if (this.dom.searchStatus) this.dom.searchStatus.textContent = '';
        if (this.dom.retrySearch) this.dom.retrySearch.hidden = true;
        this.dom.steamSearch?.setAttribute('aria-expanded', 'false');
        this.dom.steamSearch?.removeAttribute('aria-activedescendant');
    }

    preservePreviousBoard() {
        const snapshot = JSON.stringify(this.boardSnapshot());
        try {
            localStorage.setItem('steam_tier_master_recovery', snapshot);
            this.updateRecoveryButton();
            return true;
        } catch (error) {
            this.showToast('Cannot back up the current board. Download Save JSON before replacing it.', 'error');
            return false;
        }
    }

    updateRecoveryButton() {
        const button = document.getElementById('btn-restore-board');
        if (!button) return;
        try { button.hidden = !localStorage.getItem('steam_tier_master_recovery'); }
        catch (error) { button.hidden = true; }
    }

    restorePreviousBoard() {
        try {
            const raw = localStorage.getItem('steam_tier_master_recovery');
            if (!raw || raw.length > BOARD_LIMITS.jsonBytes) throw new Error('No valid previous board');
            const config = JSON.parse(raw);
            const sanitized = this.validateAndSanitizeImport({ ...config, title: config.listTitle });
            if (!this.preservePreviousBoard()) return;
            this.applyBoard(sanitized, config.id || null);
            this.showToast('Previous board restored. You can switch back with the same button.', 'success');
        } catch (error) {
            this.showToast('Could not restore the previous board', 'error');
        }
    }

    applyBoard(config, id = null) {
        this.cancelPendingWork();
        if (this.activeModal) this.closeModal(this.activeModal);
        this.state.id = id;
        this.state.listTitle = config.title;
        this.state.tiers = config.tiers;
        this.state.pool = config.pool;
        this.state.cardStyle = config.cardStyle;
        this.state.cardSize = config.cardSize;
        this.dom.listTitleInput.value = config.title;
        this.dom.boardTitleDisplay.textContent = config.title.toUpperCase();
        this.updateToggleButtonsActiveState();
        this.applyCardStyleClasses();
        this.applyCardSizeClasses();
        this.renderBoard();
        this.renderPool();
        this.markDirty();
        this.saveAutoSave();
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
            document.getElementById('btn-restore-board')?.addEventListener('click', () => this.restorePreviousBoard());
            this.updateRecoveryButton();
            window.addEventListener('pagehide', () => { if (this.isDirty) this.saveAutoSave(); });
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) {
                    if (this.isDirty) this.saveAutoSave();
                    this.cancelMouseDrag?.();
                    this.cancelTouchDrag?.();
                }
            });
            
            // Load autosave if it exists
            this.loadAutoSave();

            this.renderLibrary();
            
            // Check if user opened a shared tier list link
            this.checkAndLoadShareUrl();
            
            // Render library tab count badge
            this.updateLibraryBadge();
            
            // Initial style configuration
            this.updateToggleButtonsActiveState();
            this.applyCardStyleClasses();
            this.applyCardSizeClasses();
            
            // Render Active Board
            this.renderBoard();
            this.renderPool();
            
            // Auto initialize lucide icons
            this.refreshIcons();
            this.bindToolbarLayout();
            this.bindSettingsDisclosures();

            // Start autosave loop (saves state every 2 seconds if dirty)
            if (this.autoSaveInterval) clearInterval(this.autoSaveInterval);
            this.autoSaveInterval = setInterval(() => {
                if (this.isDirty) {
                    this.saveAutoSave();
                }
            }, 2000);
        } catch (err) {
            console.error("Failed to initialize TierListApp:", err);
            this.showFatalError("The saved board could not be loaded. Reset local data from your browser settings and reload the page.");
        }
    }

    bindSettingsDisclosures() {
        if (typeof window.matchMedia !== 'function') return;
        const phone = window.matchMedia('(max-width: 768px)');
        const groups = Array.from(document.querySelectorAll('.settings-group'));
        const mobileOpen = new Map(groups.map(group => [group, false]));
        const adapt = () => {
            groups.forEach(group => {
                const summary = group.querySelector('.settings-summary');
                if (phone.matches) {
                    // Never hide a form control that has focus during a resize.
                    if (group.querySelector('.settings-content').contains(document.activeElement)) {
                        mobileOpen.set(group, true);
                    }
                    group.open = mobileOpen.get(group);
                    summary.tabIndex = 0;
                    summary.removeAttribute('aria-disabled');
                } else {
                    group.open = true;
                    summary.tabIndex = -1;
                    summary.setAttribute('aria-disabled', 'true');
                }
            });
        };
        groups.forEach(group => {
            group.querySelector('.settings-summary').addEventListener('click', event => {
                if (!phone.matches) event.preventDefault();
            });
            group.addEventListener('toggle', () => {
                if (phone.matches) mobileOpen.set(group, group.open);
                else if (!group.open) group.open = true;
            });
        });
        adapt();
        if (phone.addEventListener) phone.addEventListener('change', adapt);
        else phone.addListener(adapt);
    }

    bindToolbarLayout() {
        if (typeof ResizeObserver !== 'function') return;
        const controls = this.dom.boardSearch?.closest('.board-toolbar-controls');
        const size = controls?.querySelector('.toolbar-size');
        if (!size) return;
        this.toolbarResizeObserver = new ResizeObserver(([entry]) => {
            // Keep keyboard/reading order aligned with the responsive grid.
            // This threshold matches the toolbar's CSS container breakpoint.
            const centered = entry.contentRect.width > 680;
            const search = controls.querySelector('.board-search');
            if (centered ? search.nextElementSibling === size : size.nextElementSibling === search) return;
            const focused = document.activeElement;
            if (centered) controls.appendChild(size);
            else controls.insertBefore(size, search);
            if (size.contains(focused)) focused.focus({ preventScroll: true });
        });
        this.toolbarResizeObserver.observe(this.dom.boardToolbar);
    }

    showFatalError(message) {
        const host = document.querySelector('.app-main') || document.body;
        if (!host || document.getElementById('fatal-app-error')) return;
        const error = document.createElement('div');
        error.id = 'fatal-app-error';
        error.className = 'fatal-app-error';
        error.setAttribute('role', 'alert');
        error.textContent = message;
        host.prepend(error);
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
            searchStatus: document.getElementById('steam-search-status'),
            retrySearch: document.getElementById('btn-retry-search'),
            boardSearch: document.getElementById('board-search'),
            boardSearchStatus: document.getElementById('board-search-status'),
            boardSearchFeedback: document.getElementById('board-search-feedback'),
            boardSearchResults: document.getElementById('board-search-results'),
            clearBoardSearch: document.getElementById('btn-clear-board-search'),
            steamIdInput: document.getElementById('steam-id-input'),
            btnAddById: document.getElementById('btn-add-by-id'),
            btnSave: document.getElementById('btn-save'),
            btnShareCurrent: document.getElementById('btn-share-current'),
            btnExportPng: document.getElementById('btn-export-png'),
            btnExportJson: document.getElementById('btn-export-json'),
            btnImportTrigger: document.getElementById('btn-import-trigger'),
            fileImport: document.getElementById('file-import'),
            btnReset: document.getElementById('btn-reset'),
            btnResetAll: document.getElementById('btn-reset-all'),
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
            confirmModalTitle: document.getElementById('confirm-modal-title'),
            confirmModalMessage: document.getElementById('confirm-modal-message'),
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
                tab.addEventListener('keydown', (event) => {
                    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                    event.preventDefault();
                    const tabs = Array.from(this.dom.tabs);
                    const currentIndex = tabs.indexOf(tab);
                    let nextIndex = currentIndex;
                    if (event.key === 'Home') nextIndex = 0;
                    else if (event.key === 'End') nextIndex = tabs.length - 1;
                    else if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
                    else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
                    const nextTab = tabs[nextIndex];
                    this.switchTab(nextTab.dataset.tab);
                    nextTab.focus();
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
            this.dom.steamSearch.addEventListener('keydown', event => this.handleSearchKey(event));
            this.dom.steamSearch.addEventListener('focus', () => {
                if (this.dom.steamSearch.value.trim().length >= 2) this.handleSearchInput(this.dom.steamSearch.value);
            });
        }
        this.dom.retrySearch?.addEventListener('click', () => this.handleSearchInput(this.dom.steamSearch.value, true));
        this.dom.boardSearch?.addEventListener('input', () => this.refreshBoardSearch());
        this.dom.clearBoardSearch?.addEventListener('click', () => {
            this.dom.boardSearch.value = '';
            this.refreshBoardSearch();
            this.dom.boardSearch.focus();
        });
        this.dom.boardSearch?.addEventListener('keydown', event => {
            if (event.key === 'Escape') this.dom.clearBoardSearch.click();
        });

        // Global Keydown for Escape key (close modals and search dropdown)
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Tab' && this.activeModal) {
                this.trapModalFocus(e);
            }
            if (e.key === 'Escape') {
                this.dismissSearch();
                if (this.activeModal === this.dom.mobileMoveModal) this.closeMobileModal();
                else if (this.activeModal === this.dom.tierEditModal) this.closeTierEditModal();
                else if (this.activeModal === this.dom.confirmModal) this.closeConfirmModal();
            }
        });

        // Close search dropdown on click outside
        document.addEventListener('click', (e) => {
            if (this.dom.steamSearch && this.dom.searchDropdown) {
                if (!e.target.closest('.search-container')) {
                    this.dismissSearch();
                }
            }
        });

        // =====================================================
        // Custom Mouse Drag System (replaces native HTML5 drag
        // so that mouse wheel scrolling works during drag)
        // =====================================================
        this._customDrag = {
            active: false,
            started: false,
            gameId: null,
            sourceId: null,
            startX: 0,
            startY: 0,
            mirror: null,
            card: null,
            lastClientY: 0
        };

        let edgeScrollSpeed = 0;
        let edgeScrollFrameId = null;

        const runEdgeScrollLoop = () => {
            if (edgeScrollSpeed !== 0) {
                window.scrollBy(0, edgeScrollSpeed);
                edgeScrollFrameId = requestAnimationFrame(runEdgeScrollLoop);
            } else {
                edgeScrollFrameId = null;
            }
        };

        const stopEdgeScroll = () => {
            edgeScrollSpeed = 0;
            if (edgeScrollFrameId) {
                cancelAnimationFrame(edgeScrollFrameId);
                edgeScrollFrameId = null;
            }
        };

        this.cancelMouseDrag = () => {
            stopEdgeScroll();
            const drag = this._customDrag;
            drag?.mirror?.remove();
            if (drag?.card) {
                drag.card.style.opacity = '1';
                delete drag.card.dataset.isDragging;
                if (drag.started) {
                    drag.card.dataset.justDragged = 'true';
                    setTimeout(() => { delete drag.card.dataset.justDragged; }, 150);
                }
            }
            document.body.style.userSelect = '';
            document.querySelectorAll('.drag-over').forEach(zone => zone.classList.remove('drag-over'));
            this._customDrag = { active: false, started: false };
            this.draggedGameId = null;
        };
        window.addEventListener('blur', () => { this.cancelMouseDrag(); this.cancelTouchDrag?.(); });
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape') { this.cancelMouseDrag(); this.cancelTouchDrag?.(); }
        });

        const updateEdgeScroll = (clientY) => {
            const topZone = 140;
            const bottomZone = window.innerHeight - 140;
            if (clientY < topZone) {
                const ratio = Math.min(1, Math.max(0, (topZone - clientY) / topZone));
                edgeScrollSpeed = -Math.round(2 + ratio * 20);
                if (!edgeScrollFrameId) edgeScrollFrameId = requestAnimationFrame(runEdgeScrollLoop);
            } else if (clientY > bottomZone) {
                const ratio = Math.min(1, Math.max(0, (clientY - bottomZone) / 140));
                edgeScrollSpeed = Math.round(2 + ratio * 20);
                if (!edgeScrollFrameId) edgeScrollFrameId = requestAnimationFrame(runEdgeScrollLoop);
            } else {
                edgeScrollSpeed = 0;
            }
        };

        // --- Global mousemove: move mirror, highlight drop zones, edge-scroll ---
        document.addEventListener('mousemove', (e) => {
            const cd = this._customDrag;
            if (!cd.active) return;

            const dx = e.clientX - cd.startX;
            const dy = e.clientY - cd.startY;

            // Activate drag after 6px movement (so clicks still work)
            if (!cd.started && Math.hypot(dx, dy) > 6) {
                cd.started = true;
                this.draggedGameId = cd.gameId;
                this.draggedSourceId = cd.sourceId;
                if (cd.card) {
                    cd.card.style.opacity = '0.4';
                    cd.card.dataset.isDragging = 'true';
                }
                // Create floating mirror clone
                const mirror = cd.card.cloneNode(true);
                mirror.classList.add('custom-drag-mirror');
                mirror.style.cssText = `position:fixed;pointer-events:none;z-index:9999;opacity:0.88;width:${cd.card.offsetWidth}px;height:${cd.card.offsetHeight}px;transition:none;box-shadow:0 12px 40px rgba(0,0,0,.55);`;
                document.body.appendChild(mirror);
                cd.mirror = mirror;
                document.body.style.userSelect = 'none';
            }

            if (!cd.started) return;

            cd.lastClientY = e.clientY;

            // Move mirror
            if (cd.mirror) {
                cd.mirror.style.left = `${e.clientX - cd.card.offsetWidth / 2}px`;
                cd.mirror.style.top = `${e.clientY - cd.card.offsetHeight / 2}px`;
            }

            // Highlight drop zones
            document.querySelectorAll('.droppable-row').forEach(z => z.classList.remove('drag-over'));
            if (document.elementFromPoint) {
                const elem = document.elementFromPoint(e.clientX, e.clientY);
                if (elem) {
                    const dz = elem.closest('.droppable-row');
                    if (dz) dz.classList.add('drag-over');
                }
            }

            // Edge auto-scroll
            updateEdgeScroll(e.clientY);
        });

        // --- Global mouseup: finalize the drop ---
        document.addEventListener('mouseup', (e) => {
            const cd = this._customDrag;
            if (!cd.active) return;

            stopEdgeScroll();

            // Remove mirror
            if (cd.mirror) { cd.mirror.remove(); cd.mirror = null; }

            // Restore card
            if (cd.card) {
                cd.card.style.opacity = '1';
                if (cd.started) cd.card.dataset.justDragged = 'true';
                const cardRef = cd.card;
                setTimeout(() => { delete cardRef.dataset.isDragging; delete cardRef.dataset.justDragged; }, 150);
            }

            document.querySelectorAll('.droppable-row').forEach(z => z.classList.remove('drag-over'));
            document.body.style.userSelect = '';

            // Skip drop if mouse barely moved from start (prevents accidental reorder on click)
            const totalDist = Math.hypot(e.clientX - cd.startX, e.clientY - cd.startY);
            if (cd.started && totalDist > 15 && document.elementFromPoint) {
                const elem = document.elementFromPoint(e.clientX, e.clientY);
                if (elem) {
                    const dropzone = elem.closest('.droppable-row');
                    if (dropzone) {
                        const destTierId = dropzone.dataset.tierId;
                        const targetCard = elem.closest('.game-card');
                        let targetGameId = null;
                        let insertAfter = false;

                        if (targetCard && targetCard !== cd.card) {
                            targetGameId = targetCard.dataset.gameId;
                            const rect = targetCard.getBoundingClientRect();
                            insertAfter = e.clientX > rect.left + rect.width / 2;
                        }

                        if (destTierId === 'trash') {
                            this.deleteGame(String(cd.gameId), cd.sourceId);
                        } else if (destTierId) {
                            // Same tier + no target card: only move if cursor is clearly away from the original card
                            if (destTierId === cd.sourceId && !targetGameId && cd.card && cd.card.getBoundingClientRect) {
                                const r = cd.card.getBoundingClientRect();
                                const overOriginal = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
                                if (!overOriginal) {
                                    this.moveGameToDestination(String(cd.gameId), cd.sourceId, destTierId, targetGameId, insertAfter);
                                }
                            } else {
                                this.moveGameToDestination(String(cd.gameId), cd.sourceId, destTierId, targetGameId, insertAfter);
                            }
                        }
                    }
                }
            }

            // Reset
            this.draggedGameId = null;
            this.draggedSourceId = null;
            this._customDrag = { active: false, started: false, gameId: null, sourceId: null, startX: 0, startY: 0, mirror: null, card: null, lastClientY: 0 };
        });

        // Keep native dragover/drop as fallback for test harness simulated drag
        document.addEventListener('dragover', (e) => { e.preventDefault(); });
        document.addEventListener('dragend', stopEdgeScroll);
        document.addEventListener('drop', stopEdgeScroll);

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
        if (this.dom.btnShareCurrent) this.dom.btnShareCurrent.addEventListener('click', () => this.shareCurrentList());
        if (this.dom.btnExportPng) this.dom.btnExportPng.addEventListener('click', () => this.exportToPng());
        if (this.dom.btnExportJson) this.dom.btnExportJson.addEventListener('click', () => this.backupJson());
        if (this.dom.btnImportTrigger) this.dom.btnImportTrigger.addEventListener('click', () => this.dom.fileImport.click());
        if (this.dom.fileImport) this.dom.fileImport.addEventListener('change', (e) => this.importJson(e));
        if (this.dom.btnReset) this.dom.btnReset.addEventListener('click', () => this.resetBoard());
        if (this.dom.btnResetAll) this.dom.btnResetAll.addEventListener('click', () => this.fullResetBoard());

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

    // ==========================================================================
    // STEAM INTEGRATION & SEARCH
    // ==========================================================================

    async fetchJsonWithTimeout(url, { signal = null, timeoutMs = 6500 } = {}) {
        const controller = new AbortController();
        const abortFromParent = () => controller.abort();
        if (signal) {
            if (signal.aborted) controller.abort();
            else signal.addEventListener('abort', abortFromParent, { once: true });
        }

        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(url, { signal: controller.signal });
            if (!response.ok) throw new Error(`HTTP ${response.status || 'error'}`);
            if (typeof response.text !== 'function') return await response.json();

            const raw = (await response.text()).trim();
            if (raw.length > BOARD_LIMITS.jsonBytes) throw new Error('Response is too large');
            try {
                return JSON.parse(raw);
            } catch (directParseError) {
                // Jina Reader wraps non-HTML responses in a short Markdown envelope.
                const markerIndex = raw.indexOf('Markdown Content:');
                const payloadText = markerIndex >= 0 ? raw.slice(markerIndex + 'Markdown Content:'.length).trim() : raw;
                const objectStart = payloadText.indexOf('{');
                const arrayStart = payloadText.indexOf('[');
                const starts = [objectStart, arrayStart].filter(index => index >= 0);
                if (starts.length === 0) throw directParseError;
                const start = Math.min(...starts);
                const opening = payloadText[start];
                const end = payloadText.lastIndexOf(opening === '{' ? '}' : ']');
                if (end <= start) throw directParseError;
                return JSON.parse(payloadText.slice(start, end + 1));
            }
        } catch (error) {
            if (controller.signal.aborted && !(signal && signal.aborted)) {
                throw new Error('Request timed out');
            }
            throw error;
        } finally {
            clearTimeout(timeoutId);
            if (signal) signal.removeEventListener('abort', abortFromParent);
        }
    }

    async fetchSteamJson(steamUrl, signal = null) {
        const parsedUrl = new URL(steamUrl);
        if (parsedUrl.hostname !== 'store.steampowered.com') {
            throw new Error('Unsupported Steam endpoint');
        }

        const candidates = [];
        const isLocalHost = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
        const configuredProxy = document.querySelector('meta[name="steam-proxy"]')?.content;
        if (configuredProxy && /^\/(?!\/)[A-Za-z0-9/_-]*\/$/.test(configuredProxy)) {
            candidates.push(`${configuredProxy}${parsedUrl.pathname.replace(/^\/api\//, '')}${parsedUrl.search}`);
        } else if (isLocalHost) candidates.push(`${parsedUrl.pathname}${parsedUrl.search}`);

        // Jina Reader currently provides a CORS-enabled pass-through for public JSON.
        candidates.push(`https://r.jina.ai/https://store.steampowered.com${parsedUrl.pathname}${parsedUrl.search}`);
        candidates.push(`https://api.allorigins.win/raw?url=${encodeURIComponent(steamUrl)}`);

        let lastError = null;
        for (const url of candidates) {
            try {
                // Reader may need to fetch a new query upstream before replying.
                const result = await this.fetchJsonWithTimeout(url, { signal, timeoutMs: url.startsWith('https://r.jina.ai/') ? 15000 : 6500 });
                const valid = parsedUrl.pathname.includes('storesearch')
                    ? Array.isArray(result?.items)
                    : typeof result?.[parsedUrl.searchParams.get('appids')]?.success === 'boolean';
                if (!valid) throw new Error('Invalid Steam response');
                return result;
            } catch (error) {
                if (signal && signal.aborted) throw error;
                lastError = error;
            }
        }
        throw lastError || new Error('Steam service is unavailable');
    }

    handleSearchInput(query, retry = false) {
        query = String(query).trim().slice(0, 100);
        if (this.dom.retrySearch) this.dom.retrySearch.hidden = true;
        if (this.dom.searchStatus) this.dom.searchStatus.textContent = '';
        if (this.dom.searchDropdown) this.dom.searchDropdown.style.display = 'none';
        this.dom.steamSearch?.setAttribute('aria-expanded', 'false');
        this.dom.steamSearch?.removeAttribute('aria-activedescendant');
        clearTimeout(this.searchTimeout);
        
        if (this.activeSearchAbortController) {
            this.activeSearchAbortController.abort();
            this.activeSearchAbortController = null;
        }

        if (query.trim().length < 2) {
            if (this.dom.searchDropdown) this.dom.searchDropdown.style.display = 'none';
            if (this.dom.searchSpinner) this.dom.searchSpinner.style.display = 'none';
            return;
        }

        if (this.dom.searchSpinner) this.dom.searchSpinner.style.display = 'block';
        if (this.dom.searchStatus) this.dom.searchStatus.textContent = 'Searching Steam… New searches can take a few seconds.';

        this.activeSearchAbortController = new AbortController();
        const signal = this.activeSearchAbortController.signal;

        this.searchTimeout = setTimeout(async () => {
            try {
                const cacheKey = query.trim().toLowerCase();
                if (!retry && this.searchCache.has(cacheKey)) {
                    this.renderSearchDropdown(this.searchCache.get(cacheKey));
                    return;
                }

                const steamSearchUrl = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(query)}&l=english&cc=US`;
                const result = await this.fetchSteamJson(steamSearchUrl, signal);

                if (signal.aborted) return;

                if (result && result.items && result.items.length > 0) {
                    const items = result.items.map(item => ({
                        id: String(item.id),
                        name: String(item.name || ''),
                        image: item.tiny_image || item.image || ''
                    }));
                    this.searchCache.set(cacheKey, items);
                    if (this.searchCache.size > 100) this.searchCache.delete(this.searchCache.keys().next().value);
                    this.renderSearchDropdown(items);
                } else {
                    this.searchLocalTemplates(query);
                }
            } catch (err) {
                if (signal.aborted || err.name === 'AbortError') return;
                this.renderSearchMessage('Steam search could not respond. Retry or add a game by App ID.', true);
                if (this.dom.retrySearch) this.dom.retrySearch.hidden = false;
            } finally {
                if (!signal.aborted && this.dom.searchSpinner) {
                    this.dom.searchSpinner.style.display = 'none';
                    if (this.dom.searchStatus) this.dom.searchStatus.textContent = this.dom.retrySearch?.hidden === false ? 'Steam search is unavailable.' : '';
                }
            }
        }, 400);
    }

    searchLocalTemplates(query) {
        this.renderSearchMessage('No games found. Try App ID directly.');
    }

    renderSearchMessage(message, isError = false) {
        if (this.dom.searchDropdown) {
            const emptyItem = document.createElement('div');
            emptyItem.className = `autocomplete-item${isError ? ' autocomplete-error' : ''}`;
            const emptySpan = document.createElement('span');
            emptySpan.className = 'game-title';
            emptySpan.textContent = message;
            emptyItem.appendChild(emptySpan);
            this.dom.searchDropdown.replaceChildren(emptyItem);
            this.dom.searchDropdown.style.display = 'block';
            this.dom.steamSearch?.setAttribute('aria-expanded', 'true');
        }
    }

    renderSearchDropdown(items) {
        if (!this.dom.searchDropdown) return;
        this.dom.searchDropdown.replaceChildren();
        
        // Show up to 8 results
        this.searchSelection = -1;
        items.filter(item => /^\d{1,10}$/.test(String(item.id))).slice(0, 8).forEach((item, index) => {
            const el = document.createElement('button');
            el.type = 'button';
            el.className = 'autocomplete-item';
            el.setAttribute('role', 'option');
            el.id = `search-option-${index}`;
            el.tabIndex = -1;
            el.setAttribute('aria-selected', 'false');
            
            const imageUrl = sanitizeImageUrl(item.image || `https://cdn.akamai.steamstatic.com/steam/apps/${item.id}/header.jpg`);

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
            const existing = this.findBoardGame(item.id);
            if (existing) {
                const location = document.createElement('small');
                location.className = 'search-game-location';
                location.textContent = `Already in ${existing.location}`;
                titleSpan.appendChild(location);
            }

            el.append(img, titleSpan);

            el.addEventListener('click', () => {
                this.addGameToPool(String(item.id), item.name, imageUrl);
                if (this.dom.steamSearch) this.dom.steamSearch.value = '';
                this.dom.searchDropdown.style.display = 'none';
                this.dismissSearch();
            });

            this.dom.searchDropdown.appendChild(el);
        });

        this.dom.searchDropdown.style.display = 'block';
        this.dom.steamSearch?.setAttribute('aria-expanded', 'true');
    }

    dismissSearch() {
        clearTimeout(this.searchTimeout);
        this.activeSearchAbortController?.abort();
        this.dom.searchDropdown.style.display = 'none';
        this.dom.searchSpinner.style.display = 'none';
        this.dom.steamSearch.setAttribute('aria-expanded', 'false');
        this.dom.steamSearch.removeAttribute('aria-activedescendant');
        if (this.dom.searchStatus) this.dom.searchStatus.textContent = '';
        if (this.dom.retrySearch) this.dom.retrySearch.hidden = true;
    }

    handleSearchKey(event) {
        if (event.key === 'Escape' || event.key === 'Tab') { this.dismissSearch(); return; }
        const options = Array.from(this.dom.searchDropdown.querySelectorAll('[role="option"]'));
        if (event.key === 'Enter' && (!options.length || this.dom.searchDropdown.style.display === 'none')) {
            event.preventDefault();
            if (this.dom.searchSpinner.style.display === 'block') return;
            this.handleSearchInput(this.dom.steamSearch.value, true);
            return;
        }
        if (!options.length || this.dom.searchDropdown.style.display === 'none') return;
        if (event.key === 'Enter') {
            event.preventDefault();
            options[Math.max(0, this.searchSelection ?? -1)]?.click();
            return;
        }
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const current = this.searchSelection ?? -1;
        this.searchSelection = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1
            : (current + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
        options.forEach((option, index) => option.setAttribute('aria-selected', String(index === this.searchSelection)));
        this.dom.steamSearch.setAttribute('aria-activedescendant', options[this.searchSelection].id);
        options[this.searchSelection].scrollIntoView?.({ block: 'nearest' });
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

        if (!appId || !/^\d{1,10}$/.test(appId)) {
            this.showToast("Could not parse Steam URL or App ID", "error");
            return;
        }
        appId = String(Number(appId));
        const existing = this.findBoardGame(appId);
        if (existing) { this.warnDuplicate(existing); return; }

        this.dom.steamIdInput.disabled = true;
        if (this.dom.btnAddById) this.dom.btnAddById.disabled = true;
        this.showToast("Fetching game metadata from Steam...", "success");

        if (this.activeDetailsAbortController) this.activeDetailsAbortController.abort();
        this.activeDetailsAbortController = new AbortController();
        const signal = this.activeDetailsAbortController.signal;

        try {
            if (this.detailsCache.has(appId)) {
                const cached = this.detailsCache.get(appId);
                this.addGameToPool(appId, cached.name, cached.image);
                this.dom.steamIdInput.value = '';
                return;
            }

            const detailsUrl = `https://store.steampowered.com/api/appdetails/?appids=${appId}`;
            const details = await this.fetchSteamJson(detailsUrl, signal);
            if (signal.aborted) return;

            // Process details
            if (details && details[appId] && details[appId].success) {
                const gameInfo = details[appId].data;
                if (!gameInfo || typeof gameInfo.name !== 'string') throw new Error('Invalid game metadata');
                const name = String(gameInfo.name || `Steam App #${appId}`);
                const image = gameInfo.header_image || `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/header.jpg`;
                this.detailsCache.set(appId, { name, image });
                if (this.detailsCache.size > 100) this.detailsCache.delete(this.detailsCache.keys().next().value);
                this.addGameToPool(String(appId), name, image);
                this.dom.steamIdInput.value = '';
            } else {
                this.showToast("Steam app was not found", "error");
            }
        } catch (err) {
            if (!signal.aborted) {
                this.showToast("Could not reach Steam. Please retry shortly.", "error");
            }
        } finally {
            if (this.activeDetailsAbortController && this.activeDetailsAbortController.signal === signal) {
                this.dom.steamIdInput.disabled = false;
                if (this.dom.btnAddById) this.dom.btnAddById.disabled = false;
                this.activeDetailsAbortController = null;
            }
        }
    }

    addGameToPool(id, name, image) {
        const stringId = /^\d{1,10}$/.test(String(id)) ? String(Number(id)) : String(id);
        const existing = this.findBoardGame(stringId);
        if (existing) { this.warnDuplicate(existing); return false; }
        if (this.state.pool.length + this.state.tiers.reduce((n, t) => n + t.games.length, 0) >= BOARD_LIMITS.games) {
            this.showToast('A maximum of 1000 games is supported', 'error');
            return;
        }
        const cleanImage = sanitizeImageUrl(image);

        const cleanName = String(name || `Steam App #${stringId}`).trim().slice(0, 200);
        const newGame = { id: stringId, name: cleanName, image: cleanImage, source: "steam" };
        this.state.pool.push(newGame);
        this.renderPool();
        this.saveAutoSave();
        this.showToast(`Added "${name}" to unassigned pool`, "success");
        return true;
    }

    boardGames() {
        return [
            ...this.state.tiers.flatMap(tier => tier.games.map(game => ({ game, sourceId: tier.id, location: `tier ${tier.label}` }))),
            ...this.state.pool.map(game => ({ game, sourceId: 'pool', location: 'unassigned pool' }))
        ];
    }

    findBoardGame(id) {
        const canonical = value => /^\d{1,10}$/.test(String(value)) ? String(Number(value)) : String(value);
        return this.boardGames().find(entry => canonical(entry.game.id) === canonical(id));
    }

    warnDuplicate(entry) {
        this.showToast(`"${entry.game.name}" is already on the board — in ${entry.location}. A duplicate was not added.`, 'error');
        this.revealBoardGame(entry);
    }

    revealBoardGame(entry) {
        const card = Array.from(document.querySelectorAll('.game-card')).find(node =>
            node.dataset.gameId === String(entry.game.id) && node.dataset.sourceId === entry.sourceId);
        card?.scrollIntoView?.({ block: 'center', behavior: 'auto' });
        card?.focus({ preventScroll: true });
    }

    refreshBoardSearch() {
        if (!this.dom.boardSearch) return;
        const query = this.dom.boardSearch.value.trim().normalize('NFKC').toLocaleLowerCase();
        this.dom.clearBoardSearch.hidden = !query;
        if (this.dom.boardSearchFeedback) this.dom.boardSearchFeedback.hidden = !query;
        this.dom.boardSearchResults.replaceChildren();
        this.dom.boardSearchResults.hidden = !query;
        if (!query) {
            this.dom.boardSearchStatus.textContent = 'Search across every tier and the unassigned pool.';
            return;
        }
        const matches = this.boardGames().filter(({ game }) =>
            String(game.name).normalize('NFKC').toLocaleLowerCase().includes(query) || String(game.id) === query);
        this.dom.boardSearchStatus.textContent = matches.length
            ? `${matches.length} game${matches.length === 1 ? '' : 's'} found${matches.length > 20 ? ' · showing the first 20' : ''}. Select a result to jump to its card.`
            : 'This game is not in this list.';
        matches.slice(0, 20).forEach(entry => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'board-search-result';
            const name = document.createElement('span');
            name.textContent = entry.game.name;
            const location = document.createElement('small');
            location.textContent = `${entry.location} · App ID ${entry.game.id}`;
            button.append(name, location);
            button.addEventListener('click', () => this.revealBoardGame(entry));
            this.dom.boardSearchResults.appendChild(button);
        });
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
            const banner = document.createElement('button');
            banner.type = 'button';
            banner.className = 'tier-label-banner';
            banner.style.backgroundColor = tier.color;
            banner.style.color = tierTextColor(tier.color);
            const labelSpan = document.createElement('span');
            labelSpan.textContent = tier.label;
            banner.appendChild(labelSpan);
            banner.title = "Click to edit row label or color";
            banner.setAttribute('aria-label', `Edit tier ${tier.label}`);
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
            btnUp.setAttribute('aria-label', `Move ${tier.label} tier up`);
            btnUp.disabled = index === 0;
            btnUp.addEventListener('click', () => this.moveRowOrder(index, -1));

            const btnDown = document.createElement('button');
            btnDown.className = 'row-action-btn';
            const iconDown = document.createElement('i');
            iconDown.setAttribute('data-lucide', 'chevron-down');
            btnDown.appendChild(iconDown);
            btnDown.title = "Move Row Down";
            btnDown.setAttribute('aria-label', `Move ${tier.label} tier down`);
            btnDown.disabled = index === this.state.tiers.length - 1;
            btnDown.addEventListener('click', () => this.moveRowOrder(index, 1));

            const btnSettings = document.createElement('button');
            btnSettings.className = 'row-action-btn';
            const iconSettings = document.createElement('i');
            iconSettings.setAttribute('data-lucide', 'sliders-horizontal');
            btnSettings.appendChild(iconSettings);
            btnSettings.title = "Settings";
            btnSettings.setAttribute('aria-label', `Edit ${tier.label} tier settings`);
            btnSettings.addEventListener('click', () => this.openTierEditModal(tier.id));

            const btnDelete = document.createElement('button');
            btnDelete.className = 'row-action-btn btn-del-row';
            const iconDelete = document.createElement('i');
            iconDelete.setAttribute('data-lucide', 'x');
            btnDelete.appendChild(iconDelete);
            btnDelete.title = "Delete Row (Games will return to pool)";
            btnDelete.setAttribute('aria-label', `Delete ${tier.label} tier`);
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
        this.refreshBoardSearch();
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
        this.refreshBoardSearch();
    }

    createGameCardDom(game, sourceId) {
        const card = document.createElement('div');
        card.className = 'game-card';
        card.dataset.gameId = String(game.id);
        card.dataset.sourceId = sourceId;
        card.draggable = false;
        card.tabIndex = 0;
        card.setAttribute('role', 'button');
        card.setAttribute('aria-label', `Game card: ${game.name}`);

        card.addEventListener('keydown', (e) => {
            if (e.target.closest('a')) return;
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.activeMobileGame = game;
                this.draggedSourceId = card.dataset.sourceId || sourceId;
                this.openMobileModal(game);
            }
        });

        const img = document.createElement('img');
        img.className = 'game-card-img';
        img.alt = game.name;
        img.loading = 'lazy';
        img.decoding = 'async';
        img.draggable = false;
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

        // Custom Mouse Drag (allows wheel scrolling during drag)
        card.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return; // left click only
            if (touchId !== null || Date.now() < suppressTouchClickUntil) return;
            if (e.target.closest('.steam-link-btn')) return; // don't drag on steam link
            if (e.target.closest('a')) return;

            this._customDrag = {
                active: true,
                started: false,
                gameId: String(game.id),
                sourceId: card.dataset.sourceId || sourceId,
                startX: e.clientX,
                startY: e.clientY,
                mirror: null,
                card: card,
                lastClientY: e.clientY
            };
        });

        // Keep native dragstart for test harness compatibility
        card.addEventListener('dragstart', (e) => {
            this.draggedGameId = String(game.id);
            this.draggedSourceId = card.dataset.sourceId || sourceId;
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

        // Let swipes scroll; only a stationary hold arms touch dragging.
        let touchStartX = 0;
        let touchStartY = 0;
        let touchDragged = false;
        let touchMoved = false;
        let touchScrolling = false;
        let touchId = null;
        let mirrorEl = null;
        let holdTimer = null;
        let suppressTouchClickUntil = 0;

        const positionTouchMirror = (x, y) => {
            if (!mirrorEl) {
                mirrorEl = card.cloneNode(true);
                mirrorEl.classList.add('touch-drag-mirror');
                mirrorEl.setAttribute('aria-hidden', 'true');
                mirrorEl.inert = true;
                mirrorEl.style.cssText = `position:fixed;pointer-events:none;z-index:9999;opacity:0.85;width:${card.offsetWidth}px;height:${card.offsetHeight}px;`;
                document.body.appendChild(mirrorEl);
            }
            mirrorEl.style.left = `${x - card.offsetWidth / 2}px`;
            mirrorEl.style.top = `${y - card.offsetHeight / 2}px`;
        };

        const cancelTouch = () => {
            clearTimeout(holdTimer);
            holdTimer = null;
            mirrorEl?.remove();
            mirrorEl = null;
            card.style.opacity = '1';
            document.querySelectorAll('.drag-over').forEach(zone => zone.classList.remove('drag-over'));
            if (touchDragged || touchMoved) suppressTouchClickUntil = Date.now() + 400;
            delete card.dataset.touchDragged;
            touchId = null;
            touchDragged = false;
            touchMoved = false;
            touchScrolling = false;
            if (this.cancelTouchDrag === cancelTouch) {
                this.cancelTouchDrag = null;
                this.draggedGameId = null;
                this.draggedSourceId = null;
            }
        };

        card.addEventListener('contextmenu', event => {
            if (touchId !== null && !event.target.closest('a')) event.preventDefault();
        });

        card.addEventListener('touchstart', (e) => {
            if (e.target.closest('a')) return;
            if (e.touches.length !== 1) { cancelTouch(); return; }
            this.cancelTouchDrag?.();
            this.cancelTouchDrag = cancelTouch;
            const touch = e.touches[0];
            touchId = touch.identifier ?? 0;
            touchStartX = touch.clientX;
            touchStartY = touch.clientY;
            touchDragged = false;
            touchMoved = false;
            touchScrolling = false;
            suppressTouchClickUntil = 0;
            holdTimer = setTimeout(() => {
                holdTimer = null;
                if (touchId === null || !card.isConnected) { cancelTouch(); return; }
                touchDragged = true;
                card.dataset.touchDragged = 'true';
                card.style.opacity = '0.4';
                this.draggedGameId = String(game.id);
                this.draggedSourceId = card.dataset.sourceId || sourceId;
                positionTouchMirror(touchStartX, touchStartY);
            }, 450);
        }, { passive: true });

        card.addEventListener('touchmove', (e) => {
            if (touchId === null) return;
            if (e.touches.length !== 1) { cancelTouch(); return; }
            const touch = Array.from(e.touches).find(t => (t.identifier ?? 0) === touchId);
            if (!touch) { cancelTouch(); return; }
            if (touchScrolling) return;
            const dx = touch.clientX - touchStartX;
            const dy = touch.clientY - touchStartY;

            if (!touchDragged) {
                if (Math.hypot(dx, dy) > 8) {
                    touchMoved = true;
                    touchScrolling = true;
                    clearTimeout(holdTimer);
                    holdTimer = null;
                }
                return;
            }

            if (touchDragged) {
                if (!e.cancelable) { cancelTouch(); return; }
                e.preventDefault();

                if (Math.hypot(dx, dy) > 8) touchMoved = true;
                positionTouchMirror(touch.clientX, touch.clientY);

                document.querySelectorAll('.droppable-row').forEach(zone => zone.classList.remove('drag-over'));
                const elemBelow = document.elementFromPoint(touch.clientX, touch.clientY);
                if (elemBelow) {
                    const dropzone = elemBelow.closest('.droppable-row');
                    if (dropzone) dropzone.classList.add('drag-over');
                }
            }
        }, { passive: false });

        const handleTouchEnd = (e) => {
            const ended = Array.from(e.changedTouches || []).find(t => (t.identifier ?? 0) === touchId);
            if (!ended) return;
            const shouldDrop = touchDragged && touchMoved;
            if (touchDragged && e.cancelable) e.preventDefault();
            cancelTouch();

            if (shouldDrop) {
                const touch = ended;
                if (touch) {
                    const elemBelow = document.elementFromPoint(touch.clientX, touch.clientY);
                    if (elemBelow) {
                        const dropzone = elemBelow.closest('.droppable-row');
                        if (dropzone) {
                            const destTierId = dropzone.dataset.tierId;
                            const targetCard = elemBelow.closest('.game-card');
                            if (targetCard === card) return;
                            let targetGameId = null;
                            let insertAfter = false;

                            if (targetCard) {
                                targetGameId = targetCard.dataset.gameId;
                                const rect = targetCard.getBoundingClientRect();
                                insertAfter = touch.clientX > rect.left + rect.width / 2;
                            }

                            const currentSourceId = card.dataset.sourceId || sourceId;
                            if (destTierId === 'trash') {
                                this.deleteGame(String(game.id), currentSourceId);
                            } else if (destTierId) {
                                this.moveGameToDestination(String(game.id), currentSourceId, destTierId, targetGameId, insertAfter);
                            }
                        }
                    }
                }
            }
        };

        card.addEventListener('touchend', handleTouchEnd);
        card.addEventListener('touchcancel', cancelTouch);

        // Click handler triggers mobile quick selection screen ONLY if not dragging
        card.addEventListener('click', (e) => {
            if (Date.now() < suppressTouchClickUntil || card.dataset.isDragging || card.dataset.touchDragged || card.dataset.justDragged) {
                delete card.dataset.touchDragged;
                delete card.dataset.justDragged;
                return;
            }
            this.activeMobileGame = game;
            this.draggedSourceId = card.dataset.sourceId || sourceId;
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
                insertAfter = e.clientX > rect.left + rect.width / 2;
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
        this.refreshBoardSearch();
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
        const source = sourceId === 'pool' ? this.state.pool : this.state.tiers.find(t => t.id === sourceId)?.games;
        const destination = destId === 'pool' ? this.state.pool : this.state.tiers.find(t => t.id === destId)?.games;
        if (!source || !destination) return false;
        const index = source.findIndex(g => String(g.id) === String(gameId));
        if (index < 0 || String(targetGameId) === String(gameId)) return false;
        if (targetGameId && !destination.some(g => String(g.id) === String(targetGameId))) return false;
        if (source === destination && !targetGameId && index === source.length - 1) return false;
        const game = source.splice(index, 1)[0];
        let destinationIndex = targetGameId ? destination.findIndex(g => String(g.id) === String(targetGameId)) : destination.length;
        if (targetGameId && insertAfter) destinationIndex++;
        destination.splice(destinationIndex, 0, game);

        const node = document.querySelector(`.game-card[data-game-id="${gameId}"]`);
        const target = targetGameId ? document.querySelector(`.game-card[data-game-id="${targetGameId}"]`) : null;
        if (node) {
            node.dataset.sourceId = destId;
            if (target) insertAfter ? target.after(node) : target.before(node);
            else this.appendToDestContainer(node, destId);
        } else {
            this.renderPool();
            this.renderBoard();
        }
        this.updatePoolCountDisplay();
        this.saveAutoSave();
        return true;
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
        this.markDirty();
        this.saveAutoSave();
    }

    addNewTier() {
        if (this.state.tiers.length >= BOARD_LIMITS.tiers) {
            this.showToast('A maximum of 50 tiers is supported', 'error');
            return;
        }
        const uniqueId = allocateId(`tier-${Date.now()}`, new Set(this.state.tiers.map(t => t.id)), 'tier');
        const newTier = {
            id: uniqueId,
            label: "NEW TIER",
            color: "#6272a4",
            games: []
        };
        this.state.tiers.push(newTier);
        this.renderBoard();
        this.markDirty();
        this.saveAutoSave();
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
        this.markDirty();
        this.saveAutoSave();
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

        this.openModal(this.dom.tierEditModal, this.dom.editTierLabel);
    }

    closeTierEditModal() {
        this.closeModal(this.dom.tierEditModal);
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

        tier.label = label.slice(0, 30);
        tier.color = color;

        this.renderBoard();
        this.closeTierEditModal();
        this.markDirty();
        this.saveAutoSave();
        this.showToast("Tier settings updated successfully", "success");
    }

    // ==========================================================================
    // MOBILE / TAP INTERACTIVE SYSTEM
    // ==========================================================================

    openMobileModal(game) {
        this.dom.mobileGameName.textContent = game.name;
        this.dom.mobileTierSelectGrid.replaceChildren();

        // Dynamically build tier selections matching their custom color banners
        this.state.tiers.forEach(tier => {
            const btn = document.createElement('button');
            btn.className = 'tier-select-btn';
            btn.style.backgroundColor = tier.color;
            btn.style.color = tierTextColor(tier.color);
            btn.textContent = tier.label;
            btn.addEventListener('click', () => {
                this.moveGameToDestination(game.id, this.draggedSourceId, tier.id);
                this.closeMobileModal();
            });
            this.dom.mobileTierSelectGrid.appendChild(btn);
        });

        this.openModal(this.dom.mobileMoveModal);
    }

    closeMobileModal() {
        this.closeModal(this.dom.mobileMoveModal);
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
            if (lib.length > 20 * BOARD_LIMITS.jsonBytes) throw new Error('Library exceeds read budget');
            const parsed = JSON.parse(lib);
            if (!Array.isArray(parsed)) {
                this.state.savedLists = [];
            } else {
                this.state.savedLists = parsed.flatMap(list => {
                    try {
                        if (!list || typeof list !== 'object' || !list.id) return [];
                        const sanitized = this.validateAndSanitizeImport(list);
                        return [{
                            id: String(list.id),
                            title: sanitized.title,
                            tiers: sanitized.tiers,
                            pool: sanitized.pool,
                            cardStyle: sanitized.cardStyle,
                            cardSize: sanitized.cardSize,
                            lastEdited: typeof list.lastEdited === 'string' ? list.lastEdited : ''
                        }];
                    } catch (error) {
                        return [];
                    }
                });
            }
        } catch (e) {
            this.state.savedLists = [];
        }
    }

    saveLibraryToStorage(nextLists = this.state.savedLists) {
        try {
            localStorage.setItem('steam_tier_master_library', JSON.stringify(nextLists));
            this.state.savedLists = nextLists;
            this.updateLibraryBadge();
            this.renderLibrary();
            return true;
        } catch (error) {
            this.showToast('Could not save the library to LocalStorage (storage quota exceeded or unavailable). Download Save JSON.', 'error');
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
        if (!this.state.listTitle.trim()) {
            this.showToast('Please give your tier list a title first', 'error');
            return;
        }
        const listId = this.state.id || allocateId(`list-${Date.now()}`, new Set(this.state.savedLists.map(l => l.id)), 'list');
        let config;
        try { config = this.validateAndSanitizeImport({ ...this.boardSnapshot(), title: this.state.listTitle }); }
        catch (error) { this.showToast(`Cannot save this board: ${error.message}`, 'error'); return; }
        const list = { ...JSON.parse(JSON.stringify(config)), id: listId, lastEdited: new Date().toLocaleString() };
        const next = this.state.savedLists.slice();
        const index = next.findIndex(l => l.id === listId);
        if (index < 0) next.push(list); else next[index] = list;
        if (!this.saveLibraryToStorage(next)) return;
        this.state.id = listId;
        this.saveAutoSave();
        this.showToast(`Saved "${list.title}" successfully!`, 'success');
    }

    loadSavedList(listId) {
        const list = this.state.savedLists.find(l => l.id === listId);
        if (!list || !this.preservePreviousBoard()) return;
        const config = this.validateAndSanitizeImport(JSON.parse(JSON.stringify(list)));
        this.applyBoard(config, list.id);
        this.switchTab('builder');
        this.showToast(`Loaded list "${list.title}"`, 'success');
    }

    duplicateSavedList(listId) {
        const original = this.state.savedLists.find(l => l.id === listId);
        if (!original) return;
        const clone = JSON.parse(JSON.stringify(original));
        clone.id = allocateId(`list-${Date.now()}`, new Set(this.state.savedLists.map(l => l.id)), 'list');
        clone.title = `${original.title.slice(0, 113)} (Copy)`;
        clone.lastEdited = new Date().toLocaleString();
        if (this.saveLibraryToStorage([...this.state.savedLists, clone])) this.showToast(`Cloned list as "${clone.title}"`, 'success');
    }

    deleteSavedList(listId) {
        const next = this.state.savedLists.filter(l => l.id !== listId);
        if (!this.saveLibraryToStorage(next)) return;
        if (this.state.id === listId) {
            this.state.id = null;
            this.saveAutoSave();
        }
        this.showToast('Tier list deleted permanently', 'success');
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

            const btnShare = document.createElement('button');
            btnShare.className = 'btn btn-outline btn-share-list';
            const shareIcon = document.createElement('i');
            shareIcon.setAttribute('data-lucide', 'share-2');
            btnShare.append(shareIcon, document.createTextNode(' Share'));
            btnShare.addEventListener('click', () => this.shareSavedList(list.id));

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

            actions.append(btnLoad, btnShare, btnClone, btnDelete);

            card.append(header, stats, actions);
            this.dom.libraryGrid.appendChild(card);
        });

        if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
    }

    // ==========================================================================
    // SHARE LINK & URL DECODING WORKFLOW
    // ==========================================================================

    generateShareUrl(listState) {
        const formatGames = (games) => (games || []).map(g => [
            String(g.id),
            g.name || '',
            g.image || ''
        ]);

        const compactPayload = {
            t: listState.listTitle?.trim() || 'Gaming Tier List',
            r: (listState.tiers || []).map(t => ({
                l: String(t.label),
                c: String(t.color),
                g: formatGames(t.games)
            })),
            p: formatGames(listState.pool),
            st: listState.cardStyle || 'horizontal',
            sz: listState.cardSize || 'medium'
        };

        const jsonString = JSON.stringify(compactPayload);
        const encoded = btoa(encodeURIComponent(jsonString));
        if (encoded.length > BOARD_LIMITS.shareChars) throw new Error('This board is too large for a share link. Use Save JSON instead.');
        
        const baseUrl = window.location.origin + window.location.pathname;
        return `${baseUrl}#share=${encoded}`;
    }

    async copyToClipboard(text) {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
                return true;
            }
        } catch (e) {
            // Fallback for non-HTTPS or test environments
        }

        const previousFocus = document.activeElement;
        const textArea = document.createElement('textarea');
        try {
            textArea.value = text;
            textArea.style.cssText = 'position:fixed;left:-999999px;top:-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            return !!document.execCommand('copy');
        } catch (error) {
            return false;
        } finally {
            textArea.remove();
            previousFocus?.focus?.();
        }
    }

    async shareCurrentList() {
        try {
            const shareUrl = this.generateShareUrl(this.state);
            const success = await this.copyToClipboard(shareUrl);
            if (success) {
                this.showToast("Share link copied to clipboard!", "success");
            } else {
                this.showToast("Failed to copy link automatically", "error");
            }
        } catch (error) { this.showToast(error.message, 'error'); }
    }


    async shareSavedList(listId) {
        const targetList = this.state.savedLists.find(l => l.id === listId);
        if (!targetList) return;

        try {
            const shareUrl = this.generateShareUrl({
                listTitle: targetList.title,
                tiers: targetList.tiers,
                pool: targetList.pool,
                cardStyle: targetList.cardStyle,
                cardSize: targetList.cardSize
            });

            const success = await this.copyToClipboard(shareUrl);
            if (success) {
                this.showToast(`Share link for "${targetList.title}" copied!`, "success");
            } else {
                this.showToast("Failed to copy link automatically", "error");
            }
        } catch (error) { this.showToast(error.message, 'error'); }
    }


    checkAndLoadShareUrl() {
        if (typeof window === 'undefined' || !window.location || !window.location.hash) return;
        const hash = window.location.hash;
        if (!hash.startsWith('#share=')) return;

        try {
            const rawBase64 = hash.replace(/^#share=/, '');
            if (rawBase64.length > BOARD_LIMITS.shareChars) throw new Error('Shared payload is too large');
            const jsonStr = decodeURIComponent(atob(rawBase64));
            const payload = JSON.parse(jsonStr);

            if (!payload || typeof payload !== 'object') return;
            if (!Array.isArray(payload.r) || !Array.isArray(payload.p)) throw new Error('Invalid shared payload');

            const importedState = {
                title: payload.t || "Shared Tier List",
                tiers: (payload.r || []).map((t, idx) => ({
                    id: `tier-${idx}-${Date.now()}`,
                    label: String(t.l || `Tier ${idx + 1}`),
                    color: String(t.c || "#ff79c6"),
                    games: (t.g || []).map(g => ({
                        id: String(g[0]),
                        name: String(g[1] || ''),
                        image: String(g[2] || ''),
                        source: 'steam'
                    }))
                })),
                pool: (payload.p || []).map(g => ({
                    id: String(g[0]),
                    name: String(g[1] || ''),
                    image: String(g[2] || ''),
                    source: 'steam'
                })),
                cardStyle: payload.st || 'horizontal',
                cardSize: payload.sz || 'medium'
            };

            const sanitizedState = this.validateAndSanitizeImport(importedState);

            if (!this.preservePreviousBoard()) return;
            this.applyBoard(sanitizedState);

            this.switchTab('builder');

            // Clean URL hash without reloading page
            if (window.history && window.history.replaceState) {
                window.history.replaceState(null, '', window.location.pathname);
            }

            this.showToast(`Shared Tier List "${sanitizedState.title}" loaded!`, "success");
        } catch (e) {
            this.showToast("Failed to parse shared link", "error");
        }
    }

    // ==========================================================================
    // BACKUPS & EXPORTS (PNG, JSON)
    // ==========================================================================

    async exportToPng() {
        if (this.isExporting) return;
        if (typeof html2canvas === 'undefined') {
            this.showToast("PNG Export library (html2canvas) is not available", "error");
            return;
        }

        this.showToast("Compiling tier list image... Please wait.", "success");
        
        const actions = document.querySelectorAll('.tier-row-actions');
        const boardControls = document.querySelector('.board-builder-controls');
        const controls = [...actions, ...(boardControls ? [boardControls] : [])];
        const originalDisplays = controls.map(control => control.style.display);
        this.isExporting = true;
        if (this.dom.btnExportPng) this.dom.btnExportPng.disabled = true;
        
        try {
            actions.forEach(a => a.style.display = 'none');
            if (boardControls) boardControls.style.display = 'none';

            const board = this.dom.tierListBoard;
            const width = Math.max(1, board.scrollWidth || board.offsetWidth || 1);
            const height = Math.max(1, board.scrollHeight || board.offsetHeight || 1);
            const scale = Math.min(2, 16000 / width, 16000 / height, Math.sqrt(32000000 / (width * height)));
            if (scale < 0.5) throw new Error('Board is too large for PNG. Use Save JSON or reduce the card size.');
            const canvas = await html2canvas(board, {
                backgroundColor: '#0a0b10',
                scale,
                useCORS: true,
                allowTaint: false,
                logging: false
            });

            const link = document.createElement('a');
            link.download = `${this.downloadFilename()}_tierlist.png`;
            let objectUrl = null;
            if (typeof canvas.toBlob === 'function' && typeof URL.createObjectURL === 'function') {
                const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Empty PNG')), 'image/png'));
                objectUrl = URL.createObjectURL(blob);
                link.href = objectUrl;
            } else {
                link.href = canvas.toDataURL('image/png');
            }
            document.body.appendChild(link);
            link.click();
            link.remove();
            if (objectUrl) setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);

            this.showToast("PNG exported successfully!", "success");
        } catch (e) {
            console.error("Export failure:", e);
            this.showToast(e.message?.includes('too large') ? e.message : 'Could not generate PNG. Try a smaller card size or Save JSON.', 'error');
        } finally {
            controls.forEach((control, index) => control.style.display = originalDisplays[index]);
            this.isExporting = false;
            if (this.dom.btnExportPng) this.dom.btnExportPng.disabled = false;
        }
    }

    downloadFilename() {
        return (this.state.listTitle.trim() || 'Gaming Tier List')
            .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').replace(/\s+/g, '_').slice(0, 100).replace(/[. ]+$/, '') || 'Gaming_Tier_List';
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
            title: this.state.listTitle.trim() || DEFAULT_TITLE,
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
        downloadAnchor.setAttribute("download", `${this.downloadFilename()}_config.json`);
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
        const seenTierIds = new Set(['pool', 'trash']);
        let imageBudget = 0;
        if (data.tiers.length > BOARD_LIMITS.tiers) throw new Error('A maximum of 50 tiers is supported');
        const totalGames = data.pool.length + data.tiers.reduce((sum, tier) => sum + (Array.isArray(tier?.games) ? tier.games.length : 0), 0);
        if (totalGames > BOARD_LIMITS.games) throw new Error('A maximum of 1000 games is supported');

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

            const id = allocateId(g.id, seenGameIds, `game-${location === 'pool' ? 'pool' : 'tier'}-${gIdx}`);

            const name = g.name.trim().slice(0, 200);
            const image = sanitizeImageUrl(g.image);
            imageBudget += image.length;
            if (imageBudget > 3 * 1024 * 1024) throw new Error('Combined image data exceeds 3 MiB');

            const source = g.source ? String(g.source).slice(0, 50) : 'steam';
            return { id, name, image, source };
        };

        const validatedTiers = data.tiers.map((t, idx) => {
            if (!t || typeof t !== 'object') {
                throw new Error(`Invalid tier structure at index ${idx}`);
            }
            if (t.id === undefined || t.id === null || typeof t.label !== 'string' || typeof t.color !== 'string' || !Array.isArray(t.games)) {
                throw new Error(`Tier at index ${idx} missing required fields (id, label, color, games)`);
            }

            const id = allocateId(t.id, seenTierIds, `tier-${idx}`);
            const label = t.label.trim().slice(0, 30) || `Tier ${idx + 1}`;
            const color = hexColorRegex.test(t.color.trim()) ? t.color.trim() : '#6272a4';
            const games = t.games.map((g, gIdx) => sanitizeGame(g, gIdx, `tier "${label || idx}"`));

            return { id, label, color, games };
        });

        const validatedPool = data.pool.map((g, gIdx) => sanitizeGame(g, gIdx, 'pool'));

        const cardStyle = ['horizontal', 'vertical'].includes(data.cardStyle) ? data.cardStyle : 'horizontal';
        const cardSize = ['tiny', 'small', 'medium', 'large', 'xl', 'xxl'].includes(data.cardSize) ? data.cardSize : 'medium';

        return {
            version: "1.0",
            title: data.title.trim().slice(0, 120),
            tiers: validatedTiers,
            pool: validatedPool,
            cardStyle,
            cardSize
        };
    }

    importJson(event) {
        const file = event?.target?.files?.[0];
        if (!file) return;
        if (this.dom.fileImport) this.dom.fileImport.value = '';
        this.activeImportReader?.abort?.();
        this.activeImportReader = null;
        if (file.size > BOARD_LIMITS.jsonBytes) {
            this.showToast('JSON files must be 5 MiB or smaller', 'error');
            return;
        }
        const reader = new FileReader();
        this.activeImportReader = reader;
        reader.onload = (event) => {
            if (this.activeImportReader !== reader) return;
            this.activeImportReader = null;
            try {
                const raw = event.target.result;
                if (typeof raw !== 'string' || raw.length > BOARD_LIMITS.jsonBytes) throw new Error('JSON text exceeds the 5 MiB budget');
                const sanitized = this.validateAndSanitizeImport(JSON.parse(raw));
                if (!this.preservePreviousBoard()) return;
                this.applyBoard(sanitized);
                this.showToast('JSON Config loaded successfully!', 'success');
            } catch (error) {
                this.showToast(`Failed to parse config: ${error.message}`, 'error');
            }
        };
        reader.onerror = () => {
            if (this.activeImportReader !== reader) return;
            this.activeImportReader = null;
            this.showToast('Failed to read JSON file from disk', 'error');
        };
        try { reader.readAsText(file); }
        catch (error) {
            this.activeImportReader = null;
            this.showToast(`Failed to read file: ${error.message}`, 'error');
        }
    }

    // Navigation and dialogs

    switchTab(tabId) {
        if (this.dom.tabs) {
            this.dom.tabs.forEach(btn => {
                const active = btn.dataset.tab === tabId;
                btn.classList.toggle('active', active);
                btn.setAttribute('aria-selected', String(active));
                btn.tabIndex = active ? 0 : -1;
            });
        }

        if (this.dom.tabContents) {
            this.dom.tabContents.forEach(content => {
                const active = content.id === `tab-${tabId}`;
                content.classList.toggle('active', active);
                content.hidden = !active;
            });
        }

        if (tabId === 'library') {
            this.renderLibrary();
        }
    }

    showConfirmModal(title, message, onConfirm, okText = "Confirm", isDanger = true) {
        const titleEl = this.dom.confirmTitle || this.dom.confirmModalTitle || document.getElementById('confirm-modal-title');
        const msgEl = this.dom.confirmMessage || this.dom.confirmModalMessage || document.getElementById('confirm-modal-message');

        if (titleEl) titleEl.textContent = title;
        if (msgEl) msgEl.textContent = message;
        
        const badge = document.getElementById('confirm-modal-badge');
        if (badge) {
            if (isDanger) {
                badge.className = 'confirm-badge-icon';
            } else {
                badge.className = 'confirm-badge-icon warning-badge';
            }
        }

        const okBtn = this.dom.btnConfirmOk;
        if (okBtn) {
            okBtn.textContent = okText;
            okBtn.className = isDanger ? 'btn btn-danger' : 'btn btn-warning';
        }

        this.confirmCallback = onConfirm;
        this.openModal(this.dom.confirmModal, okBtn);
        this.refreshIcons();
    }

    closeConfirmModal() {
        this.closeModal(this.dom.confirmModal);
        this.confirmCallback = null;
    }

    openModal(modal, preferredFocus = null) {
        if (!modal) return;
        this.lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        this.activeModal = modal;
        modal.style.display = 'flex';
        modal.setAttribute('aria-hidden', 'false');
        const background = document.querySelector('.app-container');
        if (background) background.setAttribute('inert', '');

        const focusTarget = preferredFocus || modal.querySelector('button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (focusTarget && typeof focusTarget.focus === 'function') focusTarget.focus();
    }

    closeModal(modal) {
        if (!modal || (this.activeModal !== modal && modal.style.display === 'none')) return;
        modal.style.display = 'none';
        modal.setAttribute('aria-hidden', 'true');
        if (this.activeModal === modal) this.activeModal = null;

        const background = document.querySelector('.app-container');
        if (background && !this.activeModal) background.removeAttribute('inert');
        if (!this.activeModal && this.lastFocusedElement && typeof this.lastFocusedElement.focus === 'function') {
            this.lastFocusedElement.focus();
        }
        if (!this.activeModal) this.lastFocusedElement = null;
    }

    trapModalFocus(event) {
        if (!this.activeModal) return;
        const focusable = Array.from(this.activeModal.querySelectorAll(
            'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
        )).filter(element => element.offsetParent !== null || element === document.activeElement);
        if (focusable.length === 0) {
            event.preventDefault();
            return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    }

    clearTiers() {
        this.showConfirmModal(
            "Clear Tiers",
            "Are you sure you want to move all games from tier rows back into the unassigned pool?",
            () => {
                let movedCount = 0;
                this.state.tiers.forEach(tier => {
                    if (tier.games && tier.games.length > 0) {
                        movedCount += tier.games.length;
                        this.state.pool.push(...tier.games);
                        tier.games = [];
                    }
                });

                this.renderBoard();
                this.renderPool();
                this.markDirty();
                this.saveAutoSave();
                this.showToast(`Moved ${movedCount} game${movedCount !== 1 ? 's' : ''} to pool`, "success");
            },
            "Clear Tiers",
            false
        );
    }

    fullResetBoard() {
        this.showConfirmModal(
            "Reset All",
            "Are you sure you want to completely wipe the board, pool, and reset all tiers to default?",
            () => {
                if (!this.preservePreviousBoard()) return;
                this.cancelPendingWork();
                this.state.id = null;
                this.state.listTitle = DEFAULT_TITLE;
                if (this.dom.listTitleInput) this.dom.listTitleInput.value = this.state.listTitle;
                if (this.dom.boardTitleDisplay) this.dom.boardTitleDisplay.textContent = this.state.listTitle.toUpperCase();

                this.state.tiers = [
                    { id: "tier-s", label: "S", color: "#ff79c6", games: [] },
                    { id: "tier-a", label: "A", color: "#ffb86c", games: [] },
                    { id: "tier-b", label: "B", color: "#f1fa8c", games: [] },
                    { id: "tier-c", label: "C", color: "#50fa7b", games: [] },
                    { id: "tier-d", label: "D", color: "#8be9fd", games: [] }
                ];

                this.state.pool = [];
                this.state.cardStyle = 'horizontal';
                this.state.cardSize = 'medium';

                this.updateToggleButtonsActiveState();
                this.applyCardStyleClasses();
                this.applyCardSizeClasses();

                this.renderBoard();
                this.renderPool();
                this.markDirty();
                this.saveAutoSave();
                this.showToast("Tier list completely reset to default state", "success");
            },
            "Reset All",
            true
        );
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
            },
            "Reset Board",
            false
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
                btn.setAttribute('aria-pressed', String(btn.dataset.layout === this.state.cardStyle));
                if (btn.dataset.layout === this.state.cardStyle) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
        }
        if (this.dom.sizeToggles) {
            this.dom.sizeToggles.forEach(btn => {
                btn.setAttribute('aria-pressed', String(btn.dataset.size === this.state.cardSize));
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
                if (data.length > BOARD_LIMITS.jsonBytes) throw new Error('Autosave exceeds read budget');
                const config = JSON.parse(data);
                if (config && typeof config === 'object' && !Array.isArray(config)) {
                    const sanitized = this.validateAndSanitizeImport({
                        title: config.listTitle?.trim() || DEFAULT_TITLE,
                        tiers: config.tiers,
                        pool: config.pool,
                        cardStyle: config.cardStyle,
                        cardSize: config.cardSize
                    });
                    this.state.id = config.id ? String(config.id) : null;
                    this.state.listTitle = sanitized.title;
                    this.state.tiers = sanitized.tiers;
                    this.state.pool = sanitized.pool;
                    this.state.cardStyle = sanitized.cardStyle;
                    this.state.cardSize = sanitized.cardSize;
                    
                    if (this.dom.listTitleInput) {
                        this.dom.listTitleInput.value = this.state.listTitle;
                    }
                    if (this.dom.boardTitleDisplay) {
                        this.dom.boardTitleDisplay.textContent = this.state.listTitle.toUpperCase();
                    }
                }
            }
        } catch (e) {
            this.showToast('Saved draft could not be read. Its original data has been retained.', 'error');
        }
    }

    saveAutoSave() {
        try {
            const serialized = JSON.stringify(this.boardSnapshot());
            if (serialized.length > BOARD_LIMITS.jsonBytes) throw new Error('Board exceeds storage budget');
            localStorage.setItem('steam_tier_master_autosave', serialized);
            this.isDirty = false;
            this.storageWarningShown = false;
            this.updateSaveStatus('Saved locally');
            return true;
        } catch (error) {
            this.isDirty = true;
            this.updateSaveStatus('Not saved — use Actions → Save JSON', true);
            if (!this.storageWarningShown) {
                this.showToast('Autosave failed. Download Save JSON to protect your changes.', 'error');
                this.storageWarningShown = true;
            }
            return false;
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
