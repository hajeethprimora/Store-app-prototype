class AppController {
  constructor() {
    this.historyStack = [];
    this.currentView = "home";
    this.viewParams = {};
    this.activePdpProductId = null;
    this.productsFilters = {
      category: "all",
      brands: [],
      minPrice: 0,
      maxPrice: 2000,
      minRating: 0,
      inStockOnly: false,
      isDealOnly: false
    };
    this.productsSort = "featured";
    this.productsViewMode = "grid"; // grid | list
    this.checkoutState = {
      step: 1,
      selectedAddressId: null,
      deliverySpeed: "standard", // standard | express | same_day
      paymentMethod: "card", // card | upi | cod | netbanking
      cardData: { number: "•••• •••• •••• 4242", name: "ALEX MORGAN", exp: "12/28" }
    };
    this.activeOrderTab = "all"; // all | active | completed | cancelled
    this.activeNotifTab = "all";
    this.activeFaqCategory = "all";
    this.dealTimerInterval = null;
    this.bannerInterval = null;
    this.activeBannerSlide = 0;
    this.savedAddressesExpanded = false;
  }

  init() {
    this.bindEvents();
    this.setupThemeAndDevice();
    this.startDealsTimer();
    this.startBannerAutoplay();
    this.updateBadges();
    this.navigate("home");
    this.registerServiceWorker();
    this.setupInstallPrompt();
  }

  // --- PWA: Service Worker & Install Prompt ---
  registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch((err) => {
        console.warn("Service worker registration failed:", err);
      });
    });
  }

  setupInstallPrompt() {
    this.deferredInstallPrompt = null;
    const installBtn = document.getElementById("installAppBtn");

    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      this.deferredInstallPrompt = event;
      if (installBtn) installBtn.style.display = "inline-flex";
    });

    window.addEventListener("appinstalled", () => {
      this.deferredInstallPrompt = null;
      if (installBtn) installBtn.style.display = "none";
      this.showToast("SoftnixStore installed! 🎉");
    });
  }

  async installApp() {
    const promptEvent = this.deferredInstallPrompt;
    if (!promptEvent) {
      this.showToast("App is already installed or install isn't available here");
      return;
    }
    promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    this.deferredInstallPrompt = null;
    const installBtn = document.getElementById("installAppBtn");
    if (installBtn) installBtn.style.display = "none";
    if (outcome === "accepted") this.showToast("Installing SoftnixStore... ⚡");
  }

  // --- Theme & Device Framing ---
  setupThemeAndDevice() {
    const theme = appState.state.settings.theme || "light";
    document.documentElement.setAttribute("data-theme", theme);
    const metaTheme = document.getElementById("metaThemeColor");
    if (metaTheme) {
      metaTheme.content = theme === "dark" ? "#090d16" : "#2563eb";
    }

    const deviceMode = appState.state.settings.deviceMode || "responsive";
    const container = document.getElementById("deviceContainer");
    if (container) {
      container.className = `device-container mode-${deviceMode}`;
    }
    document.querySelectorAll(".device-mode-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.mode === deviceMode);
    });
  }

  setDeviceMode(mode) {
    appState.state.settings.deviceMode = mode;
    appState.saveState();
    const container = document.getElementById("deviceContainer");
    if (container) {
      container.className = `device-container mode-${mode}`;
    }
    document.querySelectorAll(".device-mode-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.mode === mode);
    });
    const modeLabel = mode === "responsive" ? "LAPTOP / FULL" : mode.toUpperCase();
    this.showToast(`Switched to ${modeLabel} View`);
  }

  toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme") || "light";
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    appState.state.settings.theme = next;
    appState.saveState();
    const metaTheme = document.getElementById("metaThemeColor");
    if (metaTheme) {
      metaTheme.content = next === "dark" ? "#090d16" : "#2563eb";
    }
    this.showToast(`Switched to ${next.toUpperCase()} Mode`);
    if (this.currentView === "account") {
      this.renderAccount();
    }
  }

  // --- Router & Navigation ---
  updateTopHeader(viewName) {
    const headerLeft = document.querySelector(".app-header .header-left");
    if (!headerLeft) return;

    if (viewName === "home") {
      headerLeft.innerHTML = `
        <div class="brand-logo" onclick="app.navigate('home')" style="cursor:pointer;">
          <div class="brand-logo-icon">⚡</div>
          <span>SoftnixStore</span>
        </div>
      `;
    } else {
      headerLeft.innerHTML = `
        <button class="header-back-btn" onclick="app.goBack()" title="Go Back" aria-label="Go Back">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
        </button>
      `;
    }
  }

  navigate(viewName, params = {}) {
    this.currentView = viewName;
    this.viewParams = params;
    this.historyStack.push({ view: viewName, params });

    // Update top header navigation bar
    this.updateTopHeader(viewName);

    // Hide all views
    document.querySelectorAll(".view-container").forEach(el => el.classList.remove("active"));

    // Update bottom nav
    document.querySelectorAll(".nav-item").forEach(item => {
      item.classList.toggle("active", item.dataset.targetView === viewName);
    });

    // Toggle Main header (Home, products, Orders, Account) vs Inner compact navigation header
    const headerHome = document.getElementById("headerHome");
    const headerInner = document.getElementById("headerInner");

    const isMainView = ["home", "products", "orders", "account"].includes(viewName);

    if (isMainView) {
      if (headerHome) headerHome.style.display = "flex";
      if (headerInner) headerInner.style.display = "none";
    } else {
      if (headerHome) headerHome.style.display = "none";
      if (headerInner) headerInner.style.display = "flex";
    }

    // Toggle bottom nav vs PDP action bar
    const bottomNav = document.getElementById("bottomNav");
    const pdpBottomBar = document.getElementById("pdpBottomBar");

    if (viewName === "pdp") {
      if (bottomNav) bottomNav.style.display = "none";
      if (pdpBottomBar) pdpBottomBar.style.display = "flex";
    } else {
      if (bottomNav) bottomNav.style.display = "flex";
      if (pdpBottomBar) pdpBottomBar.style.display = "none";
    }

    // Render target view
    const viewContainer = document.getElementById(`view-${viewName}`);
    if (viewContainer) {
      viewContainer.classList.add("active");
    }

    // Scroll container to top
    const content = document.getElementById("appContent");
    if (content) content.scrollTop = 0;

    // View specific render hooks
    switch (viewName) {
      case "home":
        this.renderHome();
        break;
      case "products":
        this.renderproducts();
        break;
      case "search":
        this.renderSearch();
        break;
      case "pdp":
        this.renderPDP(params.productId);
        break;
      case "wishlist":
        this.renderWishlist();
        break;
      case "cart":
        this.renderCart();
        break;
      case "checkout":
        this.renderCheckout();
        break;
      case "orders":
        this.renderOrders();
        break;
      case "order_details":
        this.renderOrderDetails(params.orderId);
        break;
      case "tracking":
        this.renderTracking(params.orderId);
        break;
      case "account":
        this.renderAccount();
        break;
      case "returns":
        this.renderReturns(params.returnId);
        break;
      case "reviews":
        this.renderReviews(params.productId);
        break;
      case "notifications":
        this.renderNotifications();
        break;
      case "support":
        this.renderSupport();
        break;
    }

    this.updateBadges();
  }

  goBack() {
    if (this.historyStack.length > 1) {
      this.historyStack.pop(); // current
      const previous = this.historyStack.pop();
      if (previous && typeof previous === "object") {
        this.navigate(previous.view || "home", previous.params || {});
      } else {
        this.navigate(previous || "home");
      }
    } else {
      this.navigate("home");
    }
  }

  updateBadges() {
    // Cart badge
    const cartCount = appState.getCartCount();
    document.querySelectorAll(".cart-badge-count").forEach(el => {
      el.textContent = cartCount;
      el.style.display = cartCount > 0 ? "flex" : "none";
    });

    // Wishlist count
    const wishCount = appState.getWishlist().length;
    document.querySelectorAll(".wishlist-badge-count").forEach(el => {
      el.textContent = wishCount;
      el.style.display = wishCount > 0 ? "flex" : "none";
    });

    // Notification unread count
    const notifCount = appState.getUnreadNotificationCount();
    document.querySelectorAll(".notif-badge-count").forEach(el => {
      el.textContent = notifCount;
      el.style.display = notifCount > 0 ? "flex" : "none";
    });

    // Active orders badge on bottom nav
    const activeOrders = appState.state.orders.filter(o => !["delivered", "cancelled"].includes(o.status)).length;
    const ordersNavBadge = document.getElementById("ordersNavBadge");
    if (ordersNavBadge) {
      ordersNavBadge.textContent = activeOrders;
      ordersNavBadge.style.display = activeOrders > 0 ? "flex" : "none";
    }
  }

  // --- Module 1: Home / Storefront ---
  renderHome() {
    const container = document.getElementById("view-home");
    if (!container) return;

    const banners = SEED_DATA.banners;
    const categories = SEED_DATA.categories;
    const flashDeals = SEED_DATA.products.filter(p => p.isDeal);
    const newArrivals = SEED_DATA.products.filter(p => p.isNew);
    const popularProducts = SEED_DATA.products.filter(p => p.isPopular);
    const recommended = appState.getRecommendedProducts();
    const recentlyViewed = appState.getRecentlyViewed();

    container.innerHTML = `
      <!-- Search Bar Shortcut -->
      <div class="home-search-trigger">
        <div class="search-fake-box" onclick="app.navigate('search')">
          <span>🔍</span>
          <span>Search products, brands, categories...</span>
        </div>
      </div>

      <!-- Hero Banner Slider -->
      <div class="banner-slider">
        <div class="banner-track" id="bannerTrack">
          ${banners.map((b, i) => `
            <div class="banner-slide" style="background-image: url('${b.image}');" onclick="app.handleBannerClick('${b.targetCategory || ""}', '${b.targetProductId || ""}')">
              <div class="banner-overlay"></div>
              <div class="banner-content">
                <span class="banner-tag">${b.tag}</span>
                <h3 class="banner-title">${b.title}</h3>
                <p class="banner-subtitle">${b.subtitle}</p>
                <div class="banner-btn">
                  <span>${b.buttonText}</span>
                  <span>→</span>
                </div>
              </div>
            </div>
          `).join("")}
        </div>
        <div class="banner-dots">
          ${banners.map((_, i) => `
            <div class="banner-dot ${i === 0 ? "active" : ""}" data-index="${i}"></div>
          `).join("")}
        </div>
      </div>

      <!-- Categories Circular Strip -->
      <div class="section-title-wrap">
        <h2 class="section-title">Shop by Category</h2>
        <a href="javascript:void(0)" class="section-link" onclick="app.navigate('products')">See All →</a>
      </div>
      <div class="category-scroll-strip">
        ${categories.map(c => `
          <div class="category-chip-item" onclick="app.filterByCategory('${c.id}')">
            <div class="category-icon-circle">${c.icon}</div>
            <span class="category-name-label">${c.name}</span>
          </div>
        `).join("")}
      </div>

      <!-- Flash Deals Section with Countdown -->
      <div class="deals-banner-card">
        <div class="deals-header">
          <div class="deals-title-box">
            <span>⚡</span>
            <span>Flash Deals</span>
          </div>
          <div class="countdown-box">
            <span>Ends in:</span>
            <span class="timer-pill" id="dealHours">14</span>:
            <span class="timer-pill" id="dealMins">32</span>:
            <span class="timer-pill" id="dealSecs">45</span>
          </div>
        </div>
        <div class="products-horizontal-scroll">
          ${flashDeals.map(p => this.renderProductCardHtml(p, true)).join("")}
        </div>
      </div>

      <!-- New Arrivals -->
      <div class="section-title-wrap" style="margin-top: 16px;">
        <h2 class="section-title">🔥 New Arrivals</h2>
        <a href="javascript:void(0)" class="section-link" onclick="app.navigate('products')">View More →</a>
      </div>
      <div class="products-horizontal-scroll">
        ${newArrivals.map(p => this.renderProductCardHtml(p, true)).join("")}
      </div>

      <!-- Recommended For You (Personalized Engine) -->
      <div class="section-title-wrap" style="margin-top: 20px;">
        <div style="display:flex; flex-direction:column;">
          <h2 class="section-title">✨ Recommended for You</h2>
          <span style="font-size:10px; color:var(--text-muted); font-weight:600;">Personalized based on your browsing & wishlist</span>
        </div>
      </div>
      <div class="products-grid-3col">
        ${recommended.map(p => this.renderProductCardHtml(p, false)).join("")}
      </div>

      <!-- Popular & Trending -->
      <div class="section-title-wrap" style="margin-top: 20px;">
        <h2 class="section-title">⭐ Trending & Popular</h2>
      </div>
      <div class="products-grid-3col">
        ${popularProducts.map(p => this.renderProductCardHtml(p, false)).join("")}
      </div>

      <!-- Recently Viewed Strip -->
      ${recentlyViewed.length > 0 ? `
        <div class="section-title-wrap" style="margin-top: 20px;">
          <h2 class="section-title">🕒 Recently Viewed</h2>
        </div>
        <div class="products-horizontal-scroll" style="margin-bottom: 24px;">
          ${recentlyViewed.map(p => this.renderProductCardHtml(p, true)).join("")}
        </div>
      ` : ""}
    `;
  }

  renderProductCardHtml(product, isScroll = false) {
    const isWishlisted = appState.isInWishlist(product.id);
    const discountPercent = Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);

    return `
      <div class="product-card ${isScroll ? "scroll-item" : ""}" onclick="app.openProduct('${product.id}')">
        <div class="product-thumb-wrap">
          <img src="${product.images[0]}" alt="${product.name}" loading="lazy" />
          ${product.isDeal ? `<span class="product-badge-pill badge-deal">-${discountPercent}%</span>` : ""}
          ${product.isNew && !product.isDeal ? `<span class="product-badge-pill badge-new">NEW</span>` : ""}
          <button class="wishlist-heart-btn ${isWishlisted ? "active" : ""}" onclick="event.stopPropagation(); app.toggleWishlist('${product.id}')">
            ${isWishlisted ? "❤️" : "🤍"}
          </button>
        </div>
        <div class="product-card-body">
          <span class="product-brand">${product.brand}</span>
          <h4 class="product-title">${product.name}</h4>
          <div class="product-rating-row">
            <span class="rating-star">★</span>
            <span>${product.rating}</span>
            <span style="color:var(--text-subtle)">(${product.reviewCount})</span>
          </div>
          <div class="product-price-row">
            <span class="current-price">$${product.price}</span>
            <span class="original-price">$${product.originalPrice}</span>
          </div>
          <button class="product-quick-add" onclick="event.stopPropagation(); app.quickAddToCart('${product.id}')">
            <span>+ Add to Cart</span>
          </button>
        </div>
      </div>
    `;
  }

  // --- Module 2: Products products & Faceted Filters ---
  renderproducts() {
    const container = document.getElementById("view-products");
    if (!container) return;

    const products = appState.searchProducts("", this.productsFilters, this.productsSort);
    const categories = [{ id: "all", name: "All Products" }, ...SEED_DATA.categories];

    container.innerHTML = `
      <div class="products-top-controls">
        <div class="filter-sort-bar">
          <button class="filter-btn-pill ${this.hasActiveFilters() ? "has-filters" : ""}" onclick="app.openFilterDrawer()">
            <span>⚙️ Filters</span>
            ${this.hasActiveFilters() ? `<span style="font-size:10px; background:var(--primary); color:#fff; border-radius:50%; width:16px; height:16px; display:inline-flex; align-items:center; justify-content:center;">!</span>` : ""}
          </button>

          <div class="sort-select-wrap">
            <label style="font-size:11px; color:var(--text-muted);">Sort:</label>
            <select onchange="app.changeproductsSort(this.value)">
              <option value="featured" ${this.productsSort === "featured" ? "selected" : ""}>Featured</option>
              <option value="price_asc" ${this.productsSort === "price_asc" ? "selected" : ""}>Price: Low to High</option>
              <option value="price_desc" ${this.productsSort === "price_desc" ? "selected" : ""}>Price: High to Low</option>
              <option value="rating" ${this.productsSort === "rating" ? "selected" : ""}>Top Rated</option>
              <option value="newest" ${this.productsSort === "newest" ? "selected" : ""}>Newest</option>
            </select>
          </div>

          <div class="view-toggle-btns">
            <button class="view-toggle-btn ${this.productsViewMode === "grid" ? "active" : ""}" onclick="app.setproductsViewMode('grid')">田</button>
            <button class="view-toggle-btn ${this.productsViewMode === "list" ? "active" : ""}" onclick="app.setproductsViewMode('list')">☰</button>
          </div>
        </div>

        <!-- Horizontal Category Pills -->
        <div class="category-filter-tabs">
          ${categories.map(c => `
            <button class="cat-tab-pill ${this.productsFilters.category === c.id ? "active" : ""}" onclick="app.filterByCategory('${c.id}')">
              ${c.name}
            </button>
          `).join("")}
        </div>
      </div>

      <!-- Result Count Bar -->
      <div style="padding: 10px 16px; display:flex; justify-content:space-between; align-items:center; font-size:12px; color:var(--text-muted);">
        <span>Showing <strong>${products.length}</strong> items</span>
        ${this.hasActiveFilters() ? `<a href="javascript:void(0)" onclick="app.clearproductsFilters()" style="color:var(--danger); font-weight:700;">Reset Filters</a>` : ""}
      </div>

      <!-- Products Grid / List -->
      <div class="${this.productsViewMode === "grid" ? "products-grid-3col" : "cart-items-list"}">
        ${products.length > 0 ? products.map(p => this.renderProductCardHtml(p, false)).join("") : `
          <div style="grid-column: 1 / -1; text-align:center; padding: 40px 20px;">
            <div style="font-size: 40px; margin-bottom: 8px;">🛍️</div>
            <h3 style="font-size:16px; font-weight:700;">No Products Found</h3>
            <p style="font-size:12px; color:var(--text-muted); margin-top:4px;">Try adjusting your filters or price range.</p>
            <button class="tool-btn" style="margin: 16px auto 0 auto; background:var(--primary); color:#fff;" onclick="app.clearproductsFilters()">Reset All Filters</button>
          </div>
        `}
      </div>
    `;
  }

  hasActiveFilters() {
    return (
      this.productsFilters.category !== "all" ||
      this.productsFilters.brands.length > 0 ||
      this.productsFilters.minPrice > 0 ||
      this.productsFilters.maxPrice < 2000 ||
      this.productsFilters.minRating > 0 ||
      this.productsFilters.inStockOnly ||
      this.productsFilters.isDealOnly
    );
  }

  filterByCategory(catId) {
    this.productsFilters.category = catId;
    this.navigate("products");
  }

  changeproductsSort(sortValue) {
    this.productsSort = sortValue;
    this.renderproducts();
  }

  setproductsViewMode(mode) {
    this.productsViewMode = mode;
    this.renderproducts();
  }

  clearproductsFilters() {
    this.productsFilters = {
      category: "all",
      brands: [],
      minPrice: 0,
      maxPrice: 2000,
      minRating: 0,
      inStockOnly: false,
      isDealOnly: false
    };
    this.renderproducts();
    this.showToast("Filters Reset");
  }

  openFilterDrawer() {
    const allBrands = Array.from(new Set(SEED_DATA.products.map(p => p.brand)));

    const modalContent = `
      <div class="bottom-sheet">
        <div class="sheet-handle"></div>
        <div class="sheet-header">
          <h3 style="font-size:16px; font-weight:800;">Faceted Filters</h3>
          <button onclick="app.closeModal()" style="font-size:18px; color:var(--text-muted);">✕</button>
        </div>
        <div class="sheet-content">
          <!-- Price Range Slider -->
          <div style="margin-bottom: 20px;">
            <label style="font-size:13px; font-weight:700; display:flex; justify-content:space-between;">
              <span>Max Price:</span>
              <span id="priceDisplay" style="color:var(--primary); font-weight:800;">$${this.productsFilters.maxPrice}</span>
            </label>
            <input type="range" min="50" max="2000" step="50" value="${this.productsFilters.maxPrice}" style="width:100%; margin-top:8px;" oninput="document.getElementById('priceDisplay').textContent = '$' + this.value; app.productsFilters.maxPrice = Number(this.value);" />
          </div>

          <!-- Brand Checkboxes -->
          <div style="margin-bottom: 20px;">
            <label style="font-size:13px; font-weight:700; margin-bottom:8px; display:block;">Brands</label>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
              ${allBrands.map(b => `
                <label style="display:flex; align-items:center; gap:6px; font-size:12px;">
                  <input type="checkbox" value="${b}" ${this.productsFilters.brands.includes(b) ? "checked" : ""} onchange="app.toggleBrandFilter('${b}', this.checked)" />
                  <span>${b}</span>
                </label>
              `).join("")}
            </div>
          </div>

          <!-- Rating Filter -->
          <div style="margin-bottom: 20px;">
            <label style="font-size:13px; font-weight:700; margin-bottom:8px; display:block;">Minimum Customer Rating</label>
            <div style="display:flex; gap:8px;">
              ${[4, 3, 0].map(r => `
                <button class="tool-btn ${this.productsFilters.minRating === r ? "active" : ""}" onclick="app.productsFilters.minRating = ${r}; app.renderproducts(); app.closeModal();">
                  ${r === 0 ? "All Ratings" : `${r}★ & above`}
                </button>
              `).join("")}
            </div>
          </div>

          <!-- Availability & Deals Switches -->
          <div style="display:flex; flex-direction:column; gap:12px; margin-bottom: 20px;">
            <label style="display:flex; justify-content:space-between; align-items:center; font-size:13px; font-weight:600;">
              <span>In-Stock Only</span>
              <label class="switch-toggle">
                <input type="checkbox" ${this.productsFilters.inStockOnly ? "checked" : ""} onchange="app.productsFilters.inStockOnly = this.checked;" />
                <span class="slider-toggle"></span>
              </label>
            </label>
            <label style="display:flex; justify-content:space-between; align-items:center; font-size:13px; font-weight:600;">
              <span>Flash Deals Only</span>
              <label class="switch-toggle">
                <input type="checkbox" ${this.productsFilters.isDealOnly ? "checked" : ""} onchange="app.productsFilters.isDealOnly = this.checked;" />
                <span class="slider-toggle"></span>
              </label>
            </label>
          </div>

          <button class="checkout-cta-btn" onclick="app.renderproducts(); app.closeModal();">
            Apply Filters
          </button>
        </div>
      </div>
    `;
    this.openModal(modalContent);
  }

  toggleBrandFilter(brand, isChecked) {
    if (isChecked) {
      if (!this.productsFilters.brands.includes(brand)) this.productsFilters.brands.push(brand);
    } else {
      this.productsFilters.brands = this.productsFilters.brands.filter(b => b !== brand);
    }
  }

  // --- Module 3: Intelligent Search & Typo-Tolerance ---
  renderSearch() {
    const container = document.getElementById("view-search");
    if (!container) return;

    const recent = appState.state.recentSearches;
    const popular = appState.state.searchAnalytics.popularTerms;
    const analytics = appState.state.searchAnalytics;

    container.innerHTML = `
      <div class="search-header-bar">
        <div class="search-input-wrap">
          <span class="search-input-icon">🔍</span>
          <input type="text" id="mainSearchInput" class="search-input-field" placeholder="Search wireless mouse, headphones..." autofocus oninput="app.handleSearchInput(this.value)" onkeydown="if(event.key === 'Enter') app.performSearch(this.value)" />
          <button class="search-clear-btn" onclick="document.getElementById('mainSearchInput').value = ''; app.handleSearchInput('')">✕</button>
        </div>
        <button onclick="app.navigate('home')" style="font-size:13px; font-weight:700; color:var(--primary);">Cancel</button>
      </div>

      <!-- Autocomplete Dropdown & Typo Suggestion Box -->
      <div id="typoSuggestionArea"></div>
      <div id="autocompleteResultsArea"></div>

      <!-- Search Results Area -->
      <div id="searchResultsArea">
        <!-- Recent Searches -->
        ${recent.length > 0 ? `
          <div class="search-section-box">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="font-size:13px; font-weight:700;">🕒 Recent Searches</span>
              <button onclick="app.clearRecentSearches()" style="font-size:11px; color:var(--text-muted);">Clear All</button>
            </div>
            <div class="search-chips-wrap">
              ${recent.map(r => `
                <div class="search-tag-chip" onclick="app.performSearch('${r}')">
                  <span>${r}</span>
                </div>
              `).join("")}
            </div>
          </div>
        ` : ""}

        <!-- Trending Popular Searches -->
        <div class="search-section-box">
          <span style="font-size:13px; font-weight:700;">🔥 Trending Searches</span>
          <div class="search-chips-wrap">
            ${popular.map(p => `
              <div class="search-tag-chip" onclick="app.performSearch('${p}')">
                <span>🔥 ${p}</span>
              </div>
            `).join("")}
          </div>
        </div>

        <!-- Search Analytics Simulator Card -->
        <div class="search-analytics-card">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <strong style="color:var(--text-main);">📊 Search Engine Analytics Log</strong>
            <span style="font-size:10px; background:var(--primary-light); color:var(--primary); padding:2px 6px; border-radius:4px; font-weight:700;">Live R&D</span>
          </div>
          <div class="analytics-grid">
            <div class="analytics-stat-box">
              <div class="analytics-stat-value">${analytics.totalQueries}</div>
              <div style="color:var(--text-muted);">Total Searches</div>
            </div>
            <div class="analytics-stat-box">
              <div class="analytics-stat-value">${analytics.clickThroughRate}</div>
              <div style="color:var(--text-muted);">Search CTR</div>
            </div>
            <div class="analytics-stat-box">
              <div class="analytics-stat-value">${analytics.zeroResultRate}</div>
              <div style="color:var(--text-muted);">Zero-Result Rate</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  handleSearchInput(query) {
    const typoArea = document.getElementById("typoSuggestionArea");
    const autoArea = document.getElementById("autocompleteResultsArea");
    const resultsArea = document.getElementById("searchResultsArea");

    if (!query || query.trim().length < 2) {
      if (typoArea) typoArea.innerHTML = "";
      if (autoArea) autoArea.innerHTML = "";
      if (resultsArea) resultsArea.style.display = "block";
      return;
    }

    if (resultsArea) resultsArea.style.display = "none";

    // Typo-tolerance Levenshtein check
    const correction = appState.findTypoCorrection(query);
    if (correction && typoArea) {
      typoArea.innerHTML = `
        <div class="typo-suggestion-box">
          <span>Did you mean: <span class="corrected-term" onclick="app.performSearch('${correction}')">${correction}</span>?</span>
          <span style="font-size:10px; opacity:0.8;">Typo Tolerant Engine</span>
        </div>
      `;
    } else if (typoArea) {
      typoArea.innerHTML = "";
    }

    // Instant Autocomplete
    const matches = appState.searchProducts(query).slice(0, 5);
    if (autoArea) {
      autoArea.innerHTML = `
        <div class="autocomplete-list">
          ${matches.map(m => `
            <div class="autocomplete-item" onclick="app.openProduct('${m.id}')">
              <div style="display:flex; align-items:center; gap:10px;">
                <img src="${m.images[0]}" style="width:36px; height:36px; border-radius:6px; object-fit:cover;" />
                <div>
                  <div style="font-size:13px; font-weight:700;">${m.name}</div>
                  <div style="font-size:11px; color:var(--text-muted);">${m.categoryName} • $${m.price}</div>
                </div>
              </div>
              <span style="font-size:12px; color:var(--primary); font-weight:700;">View →</span>
            </div>
          `).join("")}
          <div class="autocomplete-item" style="background:var(--bg-surface-subtle); justify-content:center; font-weight:700; color:var(--primary);" onclick="app.performSearch('${query}')">
            See all matching products for "${query}"
          </div>
        </div>
      `;
    }
  }

  performSearch(term) {
    appState.addRecentSearch(term);
    const input = document.getElementById("mainSearchInput");
    if (input) input.value = term;

    const results = appState.searchProducts(term);
    appState.logSearchAnalytics(term, results.length);

    const typoArea = document.getElementById("typoSuggestionArea");
    const autoArea = document.getElementById("autocompleteResultsArea");
    const resultsArea = document.getElementById("searchResultsArea");

    if (typoArea) typoArea.innerHTML = "";
    if (autoArea) autoArea.innerHTML = "";

    if (resultsArea) {
      resultsArea.style.display = "block";
      resultsArea.innerHTML = `
        <div style="padding: 12px 16px; font-size:13px; color:var(--text-muted);">
          Found <strong>${results.length}</strong> results for "<span style="color:var(--text-main); font-weight:700;">${term}</span>"
        </div>
        <div class="products-grid-3col">
          ${results.map(p => this.renderProductCardHtml(p, false)).join("")}
        </div>
      `;
    }
  }

  clearRecentSearches() {
    appState.clearRecentSearches();
    this.renderSearch();
    this.showToast("Search history cleared");
  }

  // --- Module 4: Product Details Page (PDP) ---
  openProduct(productId) {
    appState.logProductView(productId);
    this.navigate("pdp", { productId });
  }

  renderPDP(productId) {
    const container = document.getElementById("view-pdp");
    if (!container) return;

    const product = SEED_DATA.products.find(p => p.id === productId);
    if (!product) {
      container.innerHTML = `<div style="padding:20px;">Product not found. <button onclick="app.navigate('home')">Home</button></div>`;
      return;
    }

    this.activePdpProductId = product.id;

    // Connect the fixed PDP bottom action bar buttons
    const addToCartBtn = document.getElementById("pdpAddToCartBtn");
    if (addToCartBtn) {
      addToCartBtn.onclick = () => this.handlePDPAddToCart(product.id);
    }
    const buyNowBtn = document.getElementById("pdpBuyNowBtn");
    if (buyNowBtn) {
      buyNowBtn.onclick = () => this.handlePDPBuyNow(product.id);
    }

    const isWishlisted = appState.isInWishlist(product.id);
    const discountPercent = Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);
    const similar = SEED_DATA.products.filter(p => p.category === product.category && p.id !== product.id);

    container.innerHTML = `
      <div class="pdp-layout-container">
        <!-- Image Gallery Column -->
        <div class="pdp-gallery-column">
          <div class="pdp-gallery-wrap">
            <img id="pdpMainImg" class="pdp-main-image" src="${product.images[0]}" alt="${product.name}" />
            <div class="pdp-gallery-thumbs">
              ${product.images.map((img, i) => `
                <div class="pdp-thumb ${i === 0 ? "active" : ""}" onclick="app.switchPDPImage('${img}', this)">
                  <img src="${img}" alt="${product.name}" />
                </div>
              `).join("")}
            </div>
          </div>
        </div>

        <!-- Product Details Column -->
        <div class="pdp-details-column">
          <div class="pdp-body">
            <span class="pdp-brand-badge">${product.brand}</span>

            <!-- Title Row with Right-Aligned Heart and Share Icons -->
            <div class="pdp-title-row">
              <h1 class="pdp-title">${product.name}</h1>
              <div class="pdp-title-actions">
                <button class="pdp-title-action-btn ${isWishlisted ? "active" : ""}" id="pdpWishlistBtn" onclick="app.toggleWishlist('${product.id}')" title="Wishlist" aria-label="Add to Wishlist">
                  ${isWishlisted ? "❤️" : "🤍"}
                </button>
                <button class="pdp-title-action-btn" onclick="app.shareProduct('${product.name}')" title="Share" aria-label="Share Product">
                  <span>🔗</span>
                </button>
              </div>
            </div>

            <div class="pdp-rating-strip" onclick="app.navigate('reviews', { productId: '${product.id}' })" style="cursor:pointer;">
              <span style="color:#f59e0b; font-size:16px;">★</span>
              <span style="font-weight:800; font-size:14px;">${product.rating}</span>
              <span style="color:var(--primary); font-size:12px; text-decoration:underline;">(${product.reviewCount} customer reviews)</span>
            </div>

            <div class="pdp-price-box">
              <span class="price">$${product.price}</span>
              <span class="original-price" style="font-size:16px;">$${product.originalPrice}</span>
              <span class="discount-tag" style="font-size:13px;">Save ${discountPercent}%</span>
            </div>

            <!-- Stock Urgency -->
            <div>
              <span class="stock-status-pill ${product.stockCount <= 10 ? "low" : ""}">
                <span>●</span>
                <span>${product.stockCount <= 10 ? `Only ${product.stockCount} left in stock - order soon!` : "In Stock - Fast Dispatch"}</span>
              </span>
              <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">SKU: ${product.sku} • 100% Authentic Guarantee</div>
            </div>

            <!-- Variant Options: Colors -->
            ${product.variants?.colors ? `
              <div class="pdp-variant-section">
                <span class="variant-label">Color: <strong id="selectedColorLabel" style="color:var(--text-main);">${product.variants.colors[0].name}</strong></span>
                <div class="variant-color-list">
                  ${product.variants.colors.map((c, i) => `
                    <button class="color-swatch-btn ${i === 0 ? "active" : ""}" style="background-color: ${c.hex};" onclick="app.selectColorVariant('${c.name}', this)"></button>
                  `).join("")}
                </div>
              </div>
            ` : ""}

            <!-- Variant Options: Sizes / Storage -->
            ${product.variants?.sizes ? `
              <div class="pdp-variant-section">
                <span class="variant-label">Configuration / Size:</span>
                <div class="variant-size-list">
                  ${product.variants.sizes.map((s, i) => `
                    <button class="size-pill-btn ${i === 0 ? "active" : ""}" onclick="app.selectSizeVariant('${s.name}', ${s.priceDelta}, this)">
                      ${s.name} ${s.priceDelta > 0 ? `(+$${s.priceDelta})` : ""}
                    </button>
                  `).join("")}
                </div>
              </div>
            ` : ""}

            <!-- Desktop In-Page Buy Buttons (Visible in Responsive Laptop Mode) -->
            <div class="pdp-desktop-actions">
              <button class="pdp-action-btn btn-add-cart" onclick="app.handlePDPAddToCart('${product.id}')">
                🛒 Add to Cart
              </button>
              <button class="pdp-action-btn btn-buy-now" onclick="app.handlePDPBuyNow('${product.id}')">
                ⚡ Buy Now
              </button>
            </div>

            <!-- Delivery Pincode Checker -->
            <div style="background:var(--bg-surface); border:1px solid var(--border-color); border-radius:var(--radius-lg); padding:14px;">
              <label style="font-size:12px; font-weight:700;">📍 Delivery Estimate</label>
              <div class="pincode-estimator-box">
                <input type="text" id="pincodeInput" class="pincode-input" placeholder="Enter Zip Code (e.g. 97477)" value="97477" />
                <button class="pincode-btn" onclick="app.checkPincode()">Check</button>
              </div>
              <div id="pincodeResult" style="font-size:12px; color:var(--success); font-weight:600; margin-top:8px;">
                ✓ Deliver to 97477 by ${product.deliveryEstimate}
              </div>
            </div>

            <!-- Description -->
            <div>
              <div class="pdp-desc-header">
                <h3 style="font-size:14px; font-weight:800;">Product Description</h3>
                <div class="pdp-desc-actions">
                  <button class="pdp-desc-btn" onclick="app.shareProduct('${product.name}')" title="Share product link">
                    <span>🔗</span>
                    <span>Share</span>
                  </button>
                </div>
              </div>
              <p style="font-size:13px; color:var(--text-muted); line-height:1.5;">${product.description}</p>
            </div>

            <!-- Customer-Safe Specs -->
            <div>
              <h3 style="font-size:14px; font-weight:800; margin-bottom:8px;">Technical Specifications</h3>
              <table class="specs-table">
                <tbody>
                  ${Object.entries(product.specifications || {}).map(([key, val]) => `
                    <tr>
                      <td>${key}</td>
                      <td>${val}</td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <!-- Similar Products Carousel -->
      ${similar.length > 0 ? `
        <div style="margin: 20px 16px 10px 16px;">
          <h3 style="font-size:14px; font-weight:800; margin-bottom:10px;">Similar Products</h3>
          <div class="products-horizontal-scroll">
            ${similar.map(s => this.renderProductCardHtml(s, true)).join("")}
          </div>
        </div>
      ` : ""}
    `;
  }

  switchPDPImage(imgUrl, thumbEl) {
    const main = document.getElementById("pdpMainImg");
    if (main) main.src = imgUrl;
    document.querySelectorAll(".pdp-thumb").forEach(t => t.classList.remove("active"));
    if (thumbEl) thumbEl.classList.add("active");
  }

  selectColorVariant(name, el) {
    document.querySelectorAll(".color-swatch-btn").forEach(b => b.classList.remove("active"));
    if (el) el.classList.add("active");
    const lbl = document.getElementById("selectedColorLabel");
    if (lbl) lbl.textContent = name;
  }

  selectSizeVariant(name, delta, el) {
    document.querySelectorAll(".size-pill-btn").forEach(b => b.classList.remove("active"));
    if (el) el.classList.add("active");
  }

  checkPincode() {
    const input = document.getElementById("pincodeInput");
    const res = document.getElementById("pincodeResult");
    if (input && res) {
      res.innerHTML = `✓ Deliver to <strong>${input.value || "97477"}</strong> in 2 business days • Free Delivery eligible`;
      this.showToast("Delivery estimate updated");
    }
  }

  shareProduct(title) {
    if (navigator.share) {
      navigator.share({ title: title, url: window.location.href });
    } else {
      this.showToast("Product link copied to clipboard!");
    }
  }

  handlePDPAddToCart(productId) {
    const id = productId || this.activePdpProductId || this.viewParams.productId;
    if (!id) return;
    const color = document.getElementById("selectedColorLabel")?.textContent || "Standard";
    const size = document.querySelector(".size-pill-btn.active")?.textContent.trim() || "Standard";
    appState.addToCart(id, { color, size }, 1);
    this.showToast("Added to Cart! 🛒");
  }

  handlePDPBuyNow(productId) {
    const id = productId || this.activePdpProductId || this.viewParams.productId;
    if (!id) return;
    this.handlePDPAddToCart(id);
    this.validateAndProceedToCheckout();
  }

  quickAddToCart(productId) {
    appState.addToCart(productId, {}, 1);
    this.showToast("Added to Cart! 🛒");
  }

  // --- Module 5: Wishlist ---
  toggleWishlist(productId) {
    const added = appState.toggleWishlist(productId);
    this.showToast(added ? "Added to Wishlist ❤️" : "Removed from Wishlist");
    this.updateBadges();

    const pdpBtn = document.getElementById("pdpWishlistBtn");
    if (pdpBtn) {
      pdpBtn.classList.toggle("active", added);
      pdpBtn.innerHTML = `<span>${added ? "❤️" : "🤍"}</span><span>${added ? "Saved" : "Wishlist"}</span>`;
    }

    if (this.currentView === "wishlist") {
      this.renderWishlist();
    } else if (this.currentView === "pdp") {
      const pdpWish = document.getElementById("pdpWishlistBtn");
      if (pdpWish) {
        pdpWish.innerHTML = added ? "❤️" : "🤍";
        pdpWish.classList.toggle("active", added);
      }
    }
  }

  renderWishlist() {
    const container = document.getElementById("view-wishlist");
    if (!container) return;

    const wishlistIds = appState.getWishlist();
    const items = wishlistIds.map(id => SEED_DATA.products.find(p => p.id === id)).filter(Boolean);

    container.innerHTML = `
      <div style="padding:14px 16px; background:var(--bg-surface); border-bottom:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center;">
        <h2 style="font-size:16px; font-weight:800;">My Wishlist (${items.length})</h2>
        ${items.length > 0 ? `
          <button class="tool-btn" style="background:var(--primary); color:#fff;" onclick="app.moveAllWishlistToCart()">
            Move All to Cart
          </button>
        ` : ""}
      </div>

      <div style="padding:16px;">
        ${items.length > 0 ? `
          <div class="products-grid-3col">
            ${items.map(item => `
              <div class="product-card">
                <div class="product-thumb-wrap" onclick="app.openProduct('${item.id}')">
                  <img src="${item.images[0]}" alt="${item.name}" />
                  <button class="wishlist-heart-btn active" onclick="event.stopPropagation(); app.toggleWishlist('${item.id}')">❤️</button>
                </div>
                <div class="product-card-body">
                  <span class="product-brand">${item.brand}</span>
                  <h4 class="product-title">${item.name}</h4>
                  <div class="product-price-row">
                    <span class="current-price">$${item.price}</span>
                  </div>
                  <button class="product-quick-add" onclick="app.moveWishlistItemToCart('${item.id}')">
                    Move to Cart 🛒
                  </button>
                </div>
              </div>
            `).join("")}
          </div>
        ` : `
          <div style="text-align:center; padding: 50px 20px;">
            <div style="font-size: 50px; margin-bottom: 12px;">❤️</div>
            <h3 style="font-size: 16px; font-weight: 800;">Your Wishlist is Empty</h3>
            <p style="font-size: 12px; color:var(--text-muted); margin-top: 4px;">Save items you love and buy them whenever you are ready.</p>
            <button class="checkout-cta-btn" style="margin-top: 20px;" onclick="app.navigate('products')">
              Explore Products
            </button>
          </div>
        `}
      </div>
    `;
  }

  moveWishlistItemToCart(productId) {
    appState.moveToCartFromWishlist(productId);
    this.showToast("Moved to Cart!");
    this.renderWishlist();
  }

  moveAllWishlistToCart() {
    appState.addAllWishlistToCart();
    this.showToast("All items moved to Cart! 🛒");
    this.renderWishlist();
  }

  // --- Module 6: Cart & Coupon Engine ---
  renderCart() {
    const container = document.getElementById("view-cart");
    if (!container) return;

    const cartItems = appState.getCart();
    const savedItems = appState.state.savedForLater;
    const totals = appState.getCartTotals();
    const appliedCoupon = appState.state.appliedCoupon;

    container.innerHTML = `
      <div style="padding:14px 16px; background:var(--bg-surface); border-bottom:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center;">
        <h2 style="font-size:16px; font-weight:800;">Shopping Cart (${appState.getCartCount()} items)</h2>
        <span style="font-size:12px; color:var(--primary); font-weight:700;">Price Protected</span>
      </div>

      <!-- Free Shipping Progress Tracker -->
      ${totals.subtotal > 0 ? `
        <div class="free-shipping-card">
          <div style="display:flex; justify-content:space-between; font-size:12px; font-weight:700;">
            <span>🚚 Free Shipping</span>
            <span>${totals.progressToFreeDelivery >= 100 ? "✓ You unlocked FREE Delivery!" : `Add $${totals.freeDeliveryRemaining.toFixed(2)} more`}</span>
          </div>
          <div class="progress-bar-wrap">
            <div class="progress-bar-fill" style="width: ${totals.progressToFreeDelivery}%;"></div>
          </div>
        </div>
      ` : ""}

      <!-- Cart Layout (1 col mobile, 2 col laptop) -->
      ${cartItems.length > 0 ? `
        <div class="cart-layout-container">
          <!-- Cart Items Column -->
          <div class="cart-items-column">
            <div class="cart-items-list">
              ${cartItems.map(item => `
                <div class="cart-item-card">
                  <img src="${item.image}" class="cart-item-img" alt="${item.name}" onclick="app.openProduct('${item.productId}')" />
                  <div class="cart-item-info">
                    <h4 class="cart-item-title" onclick="app.openProduct('${item.productId}')">${item.name}</h4>
                    <span class="cart-item-variant">${item.color} • ${item.size}</span>
                    <div style="font-size:14px; font-weight:800; color:var(--text-main); margin-bottom:8px;">
                      $${(item.price * item.quantity).toFixed(2)}
                    </div>

                    <div class="cart-item-footer">
                      <div class="qty-stepper">
                        <button class="qty-btn" onclick="app.updateQty('${item.id}', -1)">-</button>
                        <span class="qty-val">${item.quantity}</span>
                        <button class="qty-btn" onclick="app.updateQty('${item.id}', 1)">+</button>
                      </div>

                      <div style="display:flex; gap:8px;">
                        <button onclick="app.confirmRemoveCartItem('${item.id}')" style="font-size:11px; color:var(--danger); font-weight:700;">Remove</button>
                      </div>
                    </div>
                  </div>
                </div>
              `).join("")}
            </div>
          </div>

          <!-- Cart Summary Column -->
          <div class="cart-summary-column">
            <!-- Coupon / Promo Box -->
            <div class="coupon-section-box">
              <label style="font-size:12px; font-weight:700; color:var(--text-main);">Apply Promo / Coupon Code</label>
              <div class="coupon-input-group">
                <input type="text" id="couponCodeInput" class="coupon-input" placeholder="e.g. WELCOME10" value="${appliedCoupon ? appliedCoupon.code : ""}" ${appliedCoupon ? "disabled" : ""} />
                ${appliedCoupon ? `
                  <button class="coupon-apply-btn" style="background:var(--danger);" onclick="app.removeCoupon()">Remove</button>
                ` : `
                  <button class="coupon-apply-btn" onclick="app.applyCouponCode()">Apply</button>
                `}
              </div>
              ${appliedCoupon ? `
                <div style="font-size:11px; color:var(--success); font-weight:700; margin-top:6px;">
                  ✓ ${appliedCoupon.description}
                </div>
              ` : `
                <div style="margin-top:6px;">
                  <span style="font-size:10px; color:var(--text-muted);">Quick Codes:</span>
                  <span class="coupon-pill-demo" onclick="app.fillCoupon('WELCOME10')">WELCOME10 (10% Off)</span>
                  <span class="coupon-pill-demo" onclick="app.fillCoupon('SAVE20')">SAVE20 ($20 Off)</span>
                </div>
              `}
            </div>

            <!-- Dynamic Order Summary Breakdown -->
            <div class="order-summary-card">
              <h3 style="font-size:14px; font-weight:800; margin-bottom:12px;">Price Details</h3>
              <div class="summary-row">
                <span>Items Subtotal</span>
                <span>$${totals.subtotal.toFixed(2)}</span>
              </div>
              ${totals.discount > 0 ? `
                <div class="summary-row" style="color:var(--success); font-weight:700;">
                  <span>Coupon Discount</span>
                  <span>-$${totals.discount.toFixed(2)}</span>
                </div>
              ` : ""}
              <div class="summary-row">
                <span>Delivery Fee</span>
                <span>${totals.deliveryFee === 0 ? "<strong style='color:var(--success);'>FREE</strong>" : `$${totals.deliveryFee.toFixed(2)}`}</span>
              </div>
              <div class="summary-row">
                <span>Estimated Tax (8%)</span>
                <span>$${totals.tax.toFixed(2)}</span>
              </div>
              <div class="summary-row total">
                <span>Grand Total</span>
                <span>$${totals.total.toFixed(2)}</span>
              </div>

              <button class="checkout-cta-btn" style="margin-top:16px;" onclick="app.validateAndProceedToCheckout()">
                Proceed to Checkout ($${totals.total.toFixed(2)}) →
              </button>
            </div>
          </div>
        </div>
      ` : `
        <div style="text-align:center; padding: 50px 20px;">
          <div style="font-size: 50px; margin-bottom: 12px;">🛒</div>
          <h3 style="font-size: 16px; font-weight: 800;">Your Cart is Empty</h3>
          <p style="font-size: 12px; color:var(--text-muted); margin-top: 4px;">Explore our products and find great deals!</p>
          <button class="checkout-cta-btn" style="margin-top: 20px;" onclick="app.navigate('products')">
            Start Shopping
          </button>
        </div>
      `}

      <!-- Saved for Later Section -->
      ${savedItems.length > 0 ? `
        <div style="padding:16px;">
          <h3 style="font-size:14px; font-weight:800; margin-bottom:10px;">Saved for Later (${savedItems.length})</h3>
          <div class="cart-items-list" style="padding:0;">
            ${savedItems.map(item => `
              <div class="cart-item-card">
                <img src="${item.image}" class="cart-item-img" alt="${item.name}" />
                <div class="cart-item-info">
                  <h4 class="cart-item-title">${item.name}</h4>
                  <div style="font-size:14px; font-weight:800; color:var(--text-main);">$${item.price}</div>
                  <div style="display:flex; gap:8px; margin-top:8px;">
                    <button class="tool-btn active" onclick="app.moveSavedToCart('${item.id}')">Move to Cart</button>
                    <button class="tool-btn" style="color:var(--danger);" onclick="app.removeSavedItem('${item.id}')">Delete</button>
                  </div>
                </div>
              </div>
            `).join("")}
          </div>
        </div>
      ` : ""}
    `;
  }

  validateAndProceedToCheckout() {
    this.showToast("⚡ Validating prices, taxes & live inventory...");
    setTimeout(() => {
      this.navigate("checkout");
    }, 350);
  }

  updateQty(cartItemId, delta) {
    appState.updateCartQuantity(cartItemId, delta);
    this.renderCart();
  }

  confirmRemoveCartItem(cartItemId) {
    const item = appState.state.cart.find(i => i.id === cartItemId);
    const modalContent = `
      <div class="bottom-sheet" style="padding:20px; text-align:center;">
        <div style="font-size:36px; margin-bottom:8px;">🗑️</div>
        <h3 style="font-weight:800; font-size:15px;">Remove Item from Cart?</h3>
        <p style="font-size:12px; color:var(--text-muted); margin:4px 0 16px 0;">"${item?.name}" will be removed from your shopping bag.</p>
        <div style="display:flex; gap:8px;">
          <button class="tool-btn" style="flex:1; justify-content:center;" onclick="app.closeModal()">Keep Item</button>
          <button class="tool-btn" style="flex:1; background:var(--danger); color:#fff; justify-content:center;" onclick="app.removeCartItem('${cartItemId}'); app.closeModal();">Remove</button>
        </div>
      </div>
    `;
    this.openModal(modalContent);
  }

  removeCartItem(cartItemId) {
    appState.removeFromCart(cartItemId);
    this.showToast("Item removed from cart");
    this.renderCart();
  }

  saveItemForLater(cartItemId) {
    appState.saveForLater(cartItemId);
    this.showToast("Saved for later");
    this.renderCart();
  }

  moveSavedToCart(savedId) {
    appState.moveToCartFromSaved(savedId);
    this.showToast("Moved back to cart!");
    this.renderCart();
  }

  removeSavedItem(savedId) {
    appState.removeSavedForLater(savedId);
    this.showToast("Item deleted");
    this.renderCart();
  }

  fillCoupon(code) {
    const input = document.getElementById("couponCodeInput");
    if (input) input.value = code;
    this.applyCouponCode();
  }

  applyCouponCode() {
    const input = document.getElementById("couponCodeInput");
    if (!input || !input.value) return;
    const res = appState.applyCoupon(input.value);
    this.showToast(res.message);
    this.renderCart();
  }

  removeCoupon() {
    appState.removeCoupon();
    this.showToast("Coupon removed");
    this.renderCart();
  }

  // --- Module 7: Multi-Step Checkout Flow ---
  renderCheckout() {
    const container = document.getElementById("view-checkout");
    if (!container) return;

    const cartItems = appState.getCart();
    if (cartItems.length === 0) {
      this.navigate("cart");
      return;
    }

    const addresses = appState.getAddresses();
    const defaultAddr = appState.getDefaultAddress();
    if (!this.checkoutState.selectedAddressId && defaultAddr) {
      this.checkoutState.selectedAddressId = defaultAddr.id;
    }

    const selectedAddr = addresses.find(a => a.id === this.checkoutState.selectedAddressId) || defaultAddr;
    const totals = appState.getCartTotals();
    const step = this.checkoutState.step;

    container.innerHTML = `
      <div class="checkout-layout-container">
        <!-- Steps Column -->
        <div class="checkout-steps-column">
          <!-- Checkout Stepper Indicator -->
          <div class="checkout-stepper">
            <div class="step-indicator ${step >= 1 ? "active" : ""} ${step > 1 ? "completed" : ""}">
              <div class="step-circle">${step > 1 ? "✓" : "1"}</div>
              <span class="step-label">Address</span>
            </div>
            <div class="step-indicator ${step >= 2 ? "active" : ""} ${step > 2 ? "completed" : ""}">
              <div class="step-circle">${step > 2 ? "✓" : "2"}</div>
              <span class="step-label">Delivery</span>
            </div>
            <div class="step-indicator ${step >= 3 ? "active" : ""} ${step > 3 ? "completed" : ""}">
              <div class="step-circle">${step > 3 ? "✓" : "3"}</div>
              <span class="step-label">Payment</span>
            </div>
            <div class="step-indicator ${step >= 4 ? "active" : ""}">
              <div class="step-circle">4</div>
              <span class="step-label">Review</span>
            </div>
          </div>

          <div style="padding:16px;">
            <!-- STEP 1: Address Selection -->
            ${step === 1 ? `
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                <h3 style="font-size:14px; font-weight:800;">Select Delivery Address</h3>
                <button class="tool-btn" style="background:var(--primary); color:#fff;" onclick="app.openAddAddressModal()">+ Add New</button>
              </div>
              ${addresses.map(addr => `
                <div class="address-card-item ${addr.id === this.checkoutState.selectedAddressId ? "selected" : ""}" onclick="app.checkoutState.selectedAddressId = '${addr.id}'; app.renderCheckout();">
                  <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                      <strong>${addr.fullName}</strong>
                      <span class="addr-tag" style="margin-left:6px;">${addr.label}</span>
                      ${addr.isDefault ? `<span style="font-size:10px; color:var(--success); font-weight:700; margin-left:4px;">(Default)</span>` : ""}
                    </div>
                  </div>
                  <div style="font-size:12px; color:var(--text-muted); margin-top:4px;">${addr.street}, ${addr.city}, ${addr.state} ${addr.zip}</div>
                  <div style="font-size:11px; color:var(--text-subtle); margin-top:2px;">Phone: ${addr.phone}</div>
                </div>
              `).join("")}
              <button class="checkout-cta-btn" style="margin-top:16px;" onclick="app.checkoutState.step = 2; app.renderCheckout();">
                Continue to Delivery Options →
              </button>
            ` : ""}

            <!-- STEP 2: Delivery Speed Option -->
            ${step === 2 ? `
              <h3 style="font-size:14px; font-weight:800; margin-bottom:12px;">Choose Delivery Speed</h3>
              <div class="payment-method-card ${this.checkoutState.deliverySpeed === "standard" ? "selected" : ""}" onclick="app.checkoutState.deliverySpeed = 'standard'; app.renderCheckout();">
                <span style="font-size:24px;">📦</span>
                <div>
                  <strong>Standard Delivery (FREE)</strong>
                  <div style="font-size:11px; color:var(--text-muted);">Estimated arrival in 2-3 business days</div>
                </div>
              </div>
              <div class="payment-method-card ${this.checkoutState.deliverySpeed === "express" ? "selected" : ""}" onclick="app.checkoutState.deliverySpeed = 'express'; app.renderCheckout();">
                <span style="font-size:24px;">⚡</span>
                <div>
                  <strong>Express Priority Delivery ($5.99)</strong>
                  <div style="font-size:11px; color:var(--text-muted);">Guaranteed Next-Day Delivery</div>
                </div>
              </div>
              <div class="payment-method-card ${this.checkoutState.deliverySpeed === "same_day" ? "selected" : ""}" onclick="app.checkoutState.deliverySpeed = 'same_day'; app.renderCheckout();">
                <span style="font-size:24px;">🚀</span>
                <div>
                  <strong>Same-Day Courier Delivery ($9.99)</strong>
                  <div style="font-size:11px; color:var(--text-muted);">Arrives today before 9 PM</div>
                </div>
              </div>
              <div style="display:flex; gap:8px; margin-top:16px;">
                <button class="tool-btn" style="flex:1;" onclick="app.checkoutState.step = 1; app.renderCheckout();">← Back</button>
                <button class="checkout-cta-btn" style="flex:2;" onclick="app.checkoutState.step = 3; app.renderCheckout();">Proceed to Payment →</button>
              </div>
            ` : ""}

            <!-- STEP 3: Payment Method -->
            ${step === 3 ? `
              <h3 style="font-size:14px; font-weight:800; margin-bottom:12px;">Select Payment Method</h3>
              <div class="payment-method-card ${this.checkoutState.paymentMethod === "card" ? "selected" : ""}" onclick="app.checkoutState.paymentMethod = 'card'; app.renderCheckout();">
                <span>💳</span>
                <div>
                  <strong>Credit / Debit Card</strong>
                  <div style="font-size:11px; color:var(--text-muted);">Visa, Mastercard, Amex (3DS Verified)</div>
                </div>
              </div>

              ${this.checkoutState.paymentMethod === "card" ? `
                <div class="credit-card-preview">
                  <div class="card-chip"></div>
                  <div class="card-number-preview">•••• •••• •••• 4242</div>
                  <div style="display:flex; justify-content:space-between; font-size:12px;">
                    <span>ALEX MORGAN</span>
                    <span>12 / 28</span>
                  </div>
                </div>
              ` : ""}

              <div class="payment-method-card ${this.checkoutState.paymentMethod === "upi" ? "selected" : ""}" onclick="app.checkoutState.paymentMethod = 'upi'; app.renderCheckout();">
                <span>📱</span>
                <div>
                  <strong>Instant UPI / Apple Pay / Google Pay</strong>
                  <div style="font-size:11px; color:var(--text-muted);">Instant zero-fee checkout</div>
                </div>
              </div>

              <div class="payment-method-card ${this.checkoutState.paymentMethod === "cod" ? "selected" : ""}" onclick="app.checkoutState.paymentMethod = 'cod'; app.renderCheckout();">
                <span>💵</span>
                <div>
                  <strong>Cash on Delivery (COD)</strong>
                  <div style="font-size:11px; color:var(--text-muted);">Pay cash or UPI at delivery doorstep</div>
                </div>
              </div>

              <div style="display:flex; gap:8px; margin-top:16px;">
                <button class="tool-btn" style="flex:1;" onclick="app.checkoutState.step = 2; app.renderCheckout();">← Back</button>
                <button class="checkout-cta-btn" style="flex:2;" onclick="app.checkoutState.step = 4; app.renderCheckout();">Review Order →</button>
              </div>
            ` : ""}

            <!-- STEP 4: Review & Place Order -->
            ${step === 4 ? `
              <h3 style="font-size:14px; font-weight:800; margin-bottom:12px;">Verify & Confirm Order</h3>
              
              <!-- Shipping Summary -->
              <div style="background:var(--bg-surface); border:1px solid var(--border-color); border-radius:var(--radius-lg); padding:12px; margin-bottom:10px;">
                <div style="font-size:11px; font-weight:700; color:var(--text-muted);">DELIVERING TO:</div>
                <div style="font-size:13px; font-weight:700; margin-top:2px;">${selectedAddr?.fullName} (${selectedAddr?.label})</div>
                <div style="font-size:12px; color:var(--text-muted);">${selectedAddr?.street}, ${selectedAddr?.city}</div>
              </div>

              <!-- Payment Summary -->
              <div style="background:var(--bg-surface); border:1px solid var(--border-color); border-radius:var(--radius-lg); padding:12px; margin-bottom:10px;">
                <div style="font-size:11px; font-weight:700; color:var(--text-muted);">PAYMENT METHOD:</div>
                <div style="font-size:13px; font-weight:700; margin-top:2px;">
                  ${this.checkoutState.paymentMethod === "card" ? "Credit Card (Visa ending 4242)" : this.checkoutState.paymentMethod === "upi" ? "UPI / Instant App Pay" : "Cash on Delivery"}
                </div>
              </div>

              <!-- Items preview -->
              <div style="background:var(--bg-surface); border:1px solid var(--border-color); border-radius:var(--radius-lg); padding:12px; margin-bottom:10px;">
                <div style="font-size:11px; font-weight:700; color:var(--text-muted); margin-bottom:6px;">ORDER ITEMS (${cartItems.length}):</div>
                ${cartItems.map(item => `
                  <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:4px;">
                    <span>${item.quantity}x ${item.name}</span>
                    <strong>$${(item.price * item.quantity).toFixed(2)}</strong>
                  </div>
                `).join("")}
              </div>

              <!-- Price Final -->
              <div class="order-summary-card" style="margin:0 0 16px 0;">
                <div class="summary-row"><span>Total Payable</span><strong style="color:var(--primary); font-size:16px;">$${totals.total.toFixed(2)}</strong></div>
              </div>

              <button class="checkout-cta-btn" onclick="app.triggerPaymentVerification()">
                🔒 Place Order & Pay ($${totals.total.toFixed(2)})
              </button>
            ` : ""}
          </div>
        </div>

        <!-- Checkout Summary Column (Visible on Laptop / Desktop) -->
        <div class="checkout-summary-column">
          <div class="order-summary-card checkout-sticky-summary">
            <h3 style="font-size:14px; font-weight:800; margin-bottom:12px;">Order Summary</h3>
            <div class="summary-row"><span>Items (${cartItems.length}):</span><span>$${totals.subtotal.toFixed(2)}</span></div>
            ${totals.discount > 0 ? `<div class="summary-row" style="color:var(--success); font-weight:700;"><span>Discount:</span><span>-$${totals.discount.toFixed(2)}</span></div>` : ""}
            <div class="summary-row"><span>Delivery:</span><span>${totals.deliveryFee === 0 ? "FREE" : `$${totals.deliveryFee.toFixed(2)}`}</span></div>
            <div class="summary-row"><span>Tax (8%):</span><span>$${totals.tax.toFixed(2)}</span></div>
            <div class="summary-row total"><span>Total:</span><span>$${totals.total.toFixed(2)}</span></div>
            <div style="font-size:11px; color:var(--text-muted); margin-top:10px; display:flex; align-items:center; gap:6px;">
              <span>🔒</span>
              <span>256-bit SSL Encrypted Checkout</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  triggerPaymentVerification() {
    if (this.checkoutState.paymentMethod === "card" || this.checkoutState.paymentMethod === "upi") {
      const modalContent = `
        <div class="bottom-sheet" style="padding:24px; text-align:center;">
          <div style="font-size:36px; margin-bottom:8px;">🔐</div>
          <h3 style="font-weight:800; font-size:16px;">Bank 3DS Security Verification</h3>
          <p style="font-size:12px; color:var(--text-muted); margin:4px 0 16px 0;">Enter the 6-digit one-time passcode sent to +1 555-***-5678 to authorize payment.</p>
          <input type="text" id="otpInputField" value="123456" maxlength="6" style="width:180px; text-align:center; letter-spacing:8px; font-size:20px; font-weight:800; padding:10px; border-radius:var(--radius-md); border:2px solid var(--primary); margin-bottom:16px;" />
          <div style="display:flex; flex-direction:column; gap:8px;">
            <button class="checkout-cta-btn" onclick="app.completeVerifiedPayment()">Verify & Confirm Order</button>
            <button class="tool-btn" style="justify-content:center;" onclick="app.closeModal()">Cancel</button>
          </div>
        </div>
      `;
      this.openModal(modalContent);
    } else {
      this.placeOrderNow();
    }
  }

  completeVerifiedPayment() {
    this.closeModal();
    this.placeOrderNow();
  }

  placeOrderNow() {
    const totals = appState.getCartTotals();
    const addresses = appState.getAddresses();
    const selectedAddr = addresses.find(a => a.id === this.checkoutState.selectedAddressId) || appState.getDefaultAddress();

    const orderPayload = {
      address: selectedAddr,
      deliverySpeed: this.checkoutState.deliverySpeed,
      paymentMethod: this.checkoutState.paymentMethod,
      paymentMethodLabel: this.checkoutState.paymentMethod === "card" ? "Credit Card (Visa ending 4242)" : this.checkoutState.paymentMethod === "upi" ? "UPI App Pay" : "Cash on Delivery",
      subtotal: totals.subtotal,
      discount: totals.discount,
      deliveryFee: totals.deliveryFee,
      tax: totals.tax,
      total: totals.total
    };

    const newOrder = appState.createOrder(orderPayload);
    this.checkoutState.step = 1;

    // Render celebration modal
    const celebrationContent = `
      <div class="bottom-sheet" style="padding: 24px; text-align:center;">
        <div class="celebration-icon-box">✓</div>
        <h2 style="font-size:20px; font-weight:800; color:var(--text-main);">Order Placed Successfully!</h2>
        <p style="font-size:13px; color:var(--text-muted); margin: 6px 0 16px 0;">Order #${newOrder.orderNumber} has been verified and sent to warehouse fulfillment.</p>
        
        <div style="background:var(--bg-surface-subtle); border-radius:var(--radius-lg); padding:14px; text-align:left; margin-bottom:16px; font-size:12px;">
          <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
            <span>Order Total:</span>
            <strong>$${newOrder.total.toFixed(2)}</strong>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
            <span>Expected Delivery:</span>
            <strong>${newOrder.expectedDelivery}</strong>
          </div>
          <div style="display:flex; justify-content:space-between;">
            <span>Carrier:</span>
            <strong>${newOrder.deliveryPartner.courier}</strong>
          </div>
        </div>

        <div style="display:flex; flex-direction:column; gap:8px;">
          <button class="checkout-cta-btn" onclick="app.closeModal(); app.navigate('tracking', { orderId: '${newOrder.id}' })">
            🚚 Track Package Live
          </button>
          <button class="tool-btn" style="padding:10px; justify-content:center;" onclick="app.closeModal(); app.navigate('home')">
            Continue Shopping
          </button>
        </div>
      </div>
    `;
    this.openModal(celebrationContent);
  }

  // --- Module 8: My Orders ---
  renderOrders() {
    const container = document.getElementById("view-orders");
    if (!container) return;

    if (!this.activeOrderTab) this.activeOrderTab = "all";

    let orders = [...appState.state.orders];
    if (this.activeOrderTab === "active") {
      orders = orders.filter(o => !["delivered", "cancelled"].includes(o.status));
    } else if (this.activeOrderTab === "completed") {
      orders = orders.filter(o => o.status === "delivered");
    } else if (this.activeOrderTab === "cancelled") {
      orders = orders.filter(o => o.status === "cancelled");
    }

    container.innerHTML = `
      <!-- My Orders Header -->
      <div style="padding:16px 16px 10px 16px; background:var(--bg-surface);">
        <h2 style="font-size:18px; font-weight:800; color:var(--text-main); margin:0;">My Orders</h2>
      </div>

      <!-- Order Tabs (Pills) -->
      <div style="display:flex; gap:8px; padding:8px 16px 12px 16px; background:var(--bg-surface); border-bottom:1px solid var(--border-color); overflow-x:auto;">
        <button class="tool-btn ${this.activeOrderTab === "all" ? "active" : ""}" style="border-radius:var(--radius-full); padding:6px 18px; font-size:12px; font-weight:700;" onclick="app.activeOrderTab = 'all'; app.renderOrders();">All</button>
        <button class="tool-btn ${this.activeOrderTab === "active" ? "active" : ""}" style="border-radius:var(--radius-full); padding:6px 18px; font-size:12px; font-weight:700;" onclick="app.activeOrderTab = 'active'; app.renderOrders();">Active</button>
        <button class="tool-btn ${this.activeOrderTab === "completed" ? "active" : ""}" style="border-radius:var(--radius-full); padding:6px 18px; font-size:12px; font-weight:700;" onclick="app.activeOrderTab = 'completed'; app.renderOrders();">Completed</button>
        <button class="tool-btn ${this.activeOrderTab === "cancelled" ? "active" : ""}" style="border-radius:var(--radius-full); padding:6px 18px; font-size:12px; font-weight:700;" onclick="app.activeOrderTab = 'cancelled'; app.renderOrders();">Cancelled</button>
      </div>

      <div style="padding:12px 0 24px 0;">
        ${orders.length > 0 ? orders.map(order => {
      const primaryItem = order.items[0] || {};
      const productName = order.items.length > 1 ? `${primaryItem.name} + ${order.items.length - 1} more` : (primaryItem.name || "Product Item");
      const totalQty = order.items.reduce((sum, it) => sum + (it.quantity || 1), 0);
      const isDelivered = order.status === "delivered";
      const isCancelled = order.status === "cancelled";
      const statusText = isDelivered ? "Completed" : (isCancelled ? "Cancelled" : "In Delivery");
      const statusClass = isDelivered ? "status-delivered" : (isCancelled ? "status-cancelled" : "status-out_for_delivery");

      let actionBtnHtml = "";
      if (isDelivered) {
        actionBtnHtml = `<button style="color:var(--primary); font-size:12px; font-weight:700; background:none; border:none; cursor:pointer; text-decoration:none;" onclick="event.stopPropagation(); app.navigate('reviews', { productId: '${primaryItem.productId || primaryItem.id}' })">Leave a Review</button>`;
      } else if (!isCancelled) {
        actionBtnHtml = `<button style="color:var(--primary); font-size:12px; font-weight:700; background:none; border:none; cursor:pointer; text-decoration:none;" onclick="event.stopPropagation(); app.navigate('tracking', { orderId: '${order.id}' })">Track Order</button>`;
      } else {
        actionBtnHtml = `<button style="color:var(--text-muted); font-size:12px; font-weight:600; background:none; border:none; cursor:pointer; text-decoration:none;" onclick="event.stopPropagation(); app.navigate('order_details', { orderId: '${order.id}' })">Details</button>`;
      }

      return `
            <div class="order-card-wrap" onclick="app.navigate('order_details', { orderId: '${order.id}' })" style="cursor:pointer; display:flex; gap:14px; align-items:center; padding:14px 16px; margin:10px 16px; background:var(--bg-surface); border:1px solid var(--border-color); border-radius:var(--radius-xl); box-shadow:var(--shadow-sm); transition:transform 0.15s ease;">
              <img src="${primaryItem.image}" alt="${productName}" style="width:68px; height:68px; border-radius:12px; object-fit:cover; flex-shrink:0; background:var(--bg-surface-subtle);" />
              <div style="flex:1; min-width:0; display:flex; flex-direction:column; gap:4px;">
                <div style="font-size:14px; font-weight:700; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                  ${productName}
                </div>
                <div>
                  <span class="order-status-badge ${statusClass}" style="font-size:10px; font-weight:700; padding:2px 8px; border-radius:12px; display:inline-block;">
                    ${statusText}
                  </span>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:2px;">
                  <div style="font-size:14px; font-weight:800; color:var(--text-main);">$${order.total.toFixed(2)}</div>
                  <div style="display:flex; align-items:center; gap:12px;">
                    <span style="font-size:11px; color:var(--text-muted); font-weight:600;">Qty <strong style="color:var(--text-main); font-weight:700;">${String(totalQty).padStart(2, '0')}</strong></span>
                    ${actionBtnHtml}
                  </div>
                </div>
              </div>
            </div>
          `;
    }).join("") : `
          <div style="text-align:center; padding:50px 20px;">
            <div style="font-size:40px;">📦</div>
            <h3 style="font-size:16px; font-weight:800; margin-top:8px;">No Orders Found</h3>
            <p style="font-size:12px; color:var(--text-muted); margin-top:4px;">No orders match the selected filter or search.</p>
          </div>
        `}
      </div>
    `;
  }

  // --- Module 9: Order Details & Visual Tracking Timeline ---
  renderOrderDetails(orderId) {
    const container = document.getElementById("view-order_details");
    if (!container) return;

    const order = appState.state.orders.find(o => o.id === orderId);
    if (!order) {
      this.navigate("orders");
      return;
    }

    container.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; padding:12px 16px; background:var(--bg-surface); border-bottom:1px solid var(--border-color);">
        <span style="font-weight:800; font-size:15px;">Order #${order.orderNumber}</span>
        <button class="tool-btn" onclick="app.openInvoiceModal('${order.id}')">Invoice 📄</button>
      </div>

      <div style="padding:16px;">
        <!-- Status Banner -->
        <div style="background:var(--bg-surface); border:1px solid var(--border-color); border-radius:var(--radius-lg); padding:14px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-size:11px; color:var(--text-muted);">STATUS</div>
            <span class="order-status-badge status-${order.status}" style="margin-top:4px; display:inline-block;">
              ${order.status.replace(/_/g, " ")}
            </span>
          </div>
          <div style="display:flex; gap:6px;">
            <button class="tool-btn" onclick="app.reorderItems('${order.id}')">🔄 Reorder</button>
            ${order.status !== "cancelled" ? `
              <button class="checkout-cta-btn" style="width:auto; height:36px; padding:0 14px; font-size:12px;" onclick="app.navigate('tracking', { orderId: '${order.id}' })">
                Track →
              </button>
            ` : ""}
          </div>
        </div>

        <!-- Items Card -->
        <div style="background:var(--bg-surface); border:1px solid var(--border-color); border-radius:var(--radius-lg); padding:14px; margin-bottom:12px;">
          <h4 style="font-size:13px; font-weight:800; margin-bottom:10px;">Ordered Items</h4>
          ${order.items.map(it => `
            <div style="display:flex; gap:10px; margin-bottom:10px; padding-bottom:10px; border-bottom:1px solid var(--border-color);">
              <img src="${it.image}" style="width:50px; height:50px; border-radius:6px; object-fit:cover;" />
              <div style="flex:1;">
                <div style="font-size:13px; font-weight:700;">${it.name}</div>
                <div style="font-size:11px; color:var(--text-muted);">${it.variant || ""} • Qty: ${it.quantity}</div>
                <div style="font-weight:800; font-size:13px; margin-top:2px;">$${(it.price * it.quantity).toFixed(2)}</div>
              </div>
              ${order.status === "delivered" ? `
                <button class="tool-btn" style="align-self:center;" onclick="app.openReturnRequestModal('${order.id}', '${it.productId}')">Return</button>
              ` : ""}
            </div>
          `).join("")}
        </div>

        <!-- Shipping & Payment Address -->
        <div style="background:var(--bg-surface); border:1px solid var(--border-color); border-radius:var(--radius-lg); padding:14px; margin-bottom:12px; font-size:12px;">
          <h4 style="font-size:13px; font-weight:800; margin-bottom:6px;">Delivery Details</h4>
          <div>${order.shippingAddress?.fullName}</div>
          <div style="color:var(--text-muted);">${order.shippingAddress?.street}, ${order.shippingAddress?.city}, ${order.shippingAddress?.state} ${order.shippingAddress?.zip}</div>
          <div style="margin-top:6px;">Payment: <strong>${order.paymentMethod}</strong> (${order.paymentStatus})</div>
        </div>

        <!-- Actions -->
        ${order.canCancel ? `
          <button class="tool-btn" style="width:100%; padding:10px; color:var(--danger); justify-content:center;" onclick="app.openCancelOrderModal('${order.id}')">
            Cancel Order
          </button>
        ` : ""}
      </div>
    `;
  }

  reorderItems(orderId) {
    const order = appState.state.orders.find(o => o.id === orderId);
    if (!order) return;
    order.items.forEach(it => {
      appState.addToCart(it.productId, { color: it.variant, size: "Standard" }, it.quantity);
    });
    this.showToast("All items added back to your cart! 🛒");
    this.navigate("cart");
  }

  renderTracking(orderId) {
    const container = document.getElementById("view-tracking");
    if (!container) return;

    const order = appState.state.orders.find(o => o.id === orderId) || appState.state.orders[0];
    if (!order) {
      this.navigate("orders");
      return;
    }

    container.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; padding:12px 16px; background:var(--bg-surface); border-bottom:1px solid var(--border-color);">
        <span style="font-weight:800; font-size:15px;">Live Delivery Tracking</span>
        <span style="font-size:11px; color:var(--primary); font-weight:700;">Order #${order.orderNumber}</span>
      </div>

      <!-- Out for Delivery Live Radar Simulation -->
      ${order.status === "out_for_delivery" ? `
        <div class="live-map-radar-box" style="margin: 16px;">
          <div class="radar-sweep"></div>
          <div style="position:relative; z-index:2;">
            <div style="font-size:10px; color:var(--info); font-weight:800;">LIVE GPS RADAR</div>
            <div style="font-weight:800; font-size:14px;">Courier En Route</div>
            <div style="font-size:11px; opacity:0.8;">${order.deliveryPartner.liveLocation}</div>
          </div>
          <div class="delivery-driver-badge">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:20px;">🛵</span>
              <div>
                <div style="font-size:12px; font-weight:700;">${order.deliveryPartner.driverName}</div>
                <div style="font-size:10px; opacity:0.8;">Rating: ${order.deliveryPartner.driverRating} ★</div>
              </div>
            </div>
            <a href="tel:${order.deliveryPartner.driverPhone}" class="tool-btn" style="background:var(--success); color:#fff; font-size:11px;">Call Driver</a>
          </div>
        </div>
      ` : ""}

      <!-- 6-Stage Visual Timeline Stepper -->
      <div class="tracking-timeline-box">
        <h3 style="font-size:14px; font-weight:800; margin-bottom:16px;">Delivery Timeline</h3>
        ${order.trackingTimeline.map((step, idx) => `
          <div class="timeline-step-row ${step.completed ? "completed" : ""} ${order.status === step.step ? "current" : ""}">
            <div class="timeline-icon-node">
              ${step.completed ? "✓" : idx + 1}
            </div>
            <div class="timeline-content">
              <div class="timeline-title">${step.title}</div>
              <div class="timeline-desc">${step.desc}</div>
              <div class="timeline-time">${step.time}</div>
            </div>
          </div>
        `).join("")}
      </div>
    `;
  }

  advanceTrackingDemo(orderId) {
    const updated = appState.advanceOrderTracking(orderId);
    if (updated) {
      this.showToast(`Order updated to: ${updated.status.replace(/_/g, " ")}`);
      this.renderTracking(orderId);
      this.updateBadges();
    }
  }

  openInvoiceModal(orderId) {
    const order = appState.state.orders.find(o => o.id === orderId);
    if (!order) return;

    const modalContent = `
      <div class="centered-modal" style="padding:20px;">
        <div class="sheet-header" style="padding:0 0 10px 0;">
          <h3 style="font-weight:800;">Customer Invoice #${order.orderNumber}</h3>
          <button onclick="app.closeModal()">✕</button>
        </div>
        <div style="font-size:12px; margin-top:10px;">
          <div style="display:flex; justify-content:space-between;">
            <span>Date: ${order.date}</span>
            <span>Payment: ${order.paymentStatus}</span>
          </div>
          <hr style="margin:10px 0; border:none; border-top:1px solid var(--border-color);" />
          ${order.items.map(it => `
            <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
              <span>${it.quantity}x ${it.name}</span>
              <span>$${(it.price * it.quantity).toFixed(2)}</span>
            </div>
          `).join("")}
          <hr style="margin:10px 0; border:none; border-top:1px solid var(--border-color);" />
          <div style="display:flex; justify-content:space-between;"><span>Subtotal:</span><span>$${order.subtotal.toFixed(2)}</span></div>
          <div style="display:flex; justify-content:space-between;"><span>Tax (8%):</span><span>$${order.tax.toFixed(2)}</span></div>
          <div style="display:flex; justify-content:space-between; font-weight:800; font-size:14px; margin-top:6px;"><span>Total:</span><span>$${order.total.toFixed(2)}</span></div>
        </div>
        <button class="checkout-cta-btn" style="margin-top:16px;" onclick="app.showToast('Invoice PDF downloaded!'); app.closeModal();">Download PDF Invoice</button>
      </div>
    `;
    this.openModal(modalContent);
  }

  openCancelOrderModal(orderId) {
    const modalContent = `
      <div class="centered-modal" style="padding:20px;">
        <h3 style="font-weight:800; color:var(--danger);">Cancel Order #${orderId}</h3>
        <p style="font-size:12px; color:var(--text-muted); margin: 6px 0 12px 0;">Select a cancellation reason:</p>
        <select id="cancelReasonSelect" style="width:100%; padding:10px; border-radius:var(--radius-md); border:1px solid var(--border-color); margin-bottom:16px;">
          <option value="Ordered by mistake">Ordered by mistake</option>
          <option value="Found cheaper elsewhere">Found cheaper elsewhere</option>
          <option value="Delivery time too long">Delivery time too long</option>
          <option value="Changed payment method">Changed payment method</option>
        </select>
        <button class="checkout-cta-btn" style="background:var(--danger);" onclick="app.confirmCancelOrder('${orderId}')">Confirm Cancellation</button>
      </div>
    `;
    this.openModal(modalContent);
  }

  confirmCancelOrder(orderId) {
    const reason = document.getElementById("cancelReasonSelect")?.value || "User requested";
    const res = appState.cancelOrder(orderId, reason);
    this.closeModal();
    this.showToast(res.message);
    this.navigate("orders");
  }

  toggleSavedAddresses() {
    this.savedAddressesExpanded = !this.savedAddressesExpanded;
    this.renderAccount();
  }

  // --- Module 10: My Account & Profile ---
  renderAccount() {
    const container = document.getElementById("view-account");
    if (!container) return;

    const user = appState.state.user;

    container.innerHTML = `
      <!-- User Profile Header -->
      <div class="account-profile-card">
        <img src="${user.avatar}" class="account-avatar" alt="${user.name}" />
        <div style="flex:1;">
          <div class="account-tier-pill">★ ${user.tier}</div>
          <h2 style="font-size:16px; font-weight:800; margin-top:4px;">${user.name}</h2>
          <div style="font-size:11px; color:var(--text-muted);">${user.email} • ${user.phone}</div>
          <div style="font-size:11px; color:var(--primary); font-weight:700; margin-top:2px;">🪙 ${user.loyaltyPoints} Reward Points</div>
        </div>
        <button class="tool-btn" onclick="app.openEditProfileModal()">Edit</button>
      </div>

      <div class="account-menu-list">
        <div class="account-menu-grid">
          <!-- Appearance & Settings Group (Mobile & Desktop Accessible) -->
          <div class="account-menu-group">
            <div style="padding:12px 16px; font-size:12px; font-weight:800; color:var(--text-muted); background:var(--bg-surface-subtle);">
              🎨 APPEARANCE & SETTINGS
            </div>
            <div class="account-menu-item" style="cursor:pointer;" onclick="app.toggleTheme()">
              <div style="display:flex; align-items:center; gap:8px;">
                <span>🌓</span>
                <div>
                  <strong>Theme Mode</strong>
                  <div style="font-size:11px; color:var(--text-muted);">Switch between Light & Dark modes</div>
                </div>
              </div>
              <span class="tool-btn active" style="padding:4px 10px; font-size:11px;">
                ${document.documentElement.getAttribute("data-theme") === "dark" ? "🌙 Dark" : "☀️ Light"}
              </span>
            </div>
            <div class="account-menu-item" style="cursor:pointer;" onclick="app.resetAllData()">
              <div style="display:flex; align-items:center; gap:8px;">
                <span>🔄</span>
                <div>
                  <strong style="color:var(--danger);">Reset Demo Data</strong>
                  <div style="font-size:11px; color:var(--text-muted);">Restore orders, cart & addresses</div>
                </div>
              </div>
              <button class="tool-btn" style="color:var(--danger); border-color:rgba(239, 68, 68, 0.3);">Reset</button>
            </div>
          </div>

          <!-- Quick Links -->
          <div class="account-menu-group">
            <div style="padding:12px 16px; font-size:12px; font-weight:800; color:var(--text-muted); background:var(--bg-surface-subtle);">
              ℹ️ HELP & POLICIES
            </div>
            <div class="account-menu-item" onclick="app.navigate('returns')" style="cursor:pointer;">
              <span>🔄 Returns & Refunds Hub</span>
              <span>→</span>
            </div>
            <div class="account-menu-item" onclick="app.navigate('support')" style="cursor:pointer;">
              <span>💬 Help Center & Live Support</span>
              <span>→</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  openEditProfileModal() {
    const u = appState.state.user;
    const modalContent = `
      <div class="centered-modal" style="padding:20px;">
        <h3 style="font-weight:800; margin-bottom:14px;">Edit Profile</h3>
        <label style="font-size:12px; font-weight:700;">Full Name</label>
        <input type="text" id="editUserName" value="${u.name}" style="width:100%; padding:10px; border-radius:var(--radius-md); border:1px solid var(--border-color); margin-bottom:10px;" />
        <label style="font-size:12px; font-weight:700;">Email</label>
        <input type="email" id="editUserEmail" value="${u.email}" style="width:100%; padding:10px; border-radius:var(--radius-md); border:1px solid var(--border-color); margin-bottom:10px;" />
        <label style="font-size:12px; font-weight:700;">Phone Number</label>
        <input type="text" id="editUserPhone" value="${u.phone}" style="width:100%; padding:10px; border-radius:var(--radius-md); border:1px solid var(--border-color); margin-bottom:16px;" />
        <button class="checkout-cta-btn" onclick="app.saveProfile()">Save Changes</button>
      </div>
    `;
    this.openModal(modalContent);
  }

  saveProfile() {
    const name = document.getElementById("editUserName")?.value;
    const email = document.getElementById("editUserEmail")?.value;
    const phone = document.getElementById("editUserPhone")?.value;
    appState.updateProfile({ name, email, phone });
    this.closeModal();
    this.showToast("Profile Updated ✓");
    this.renderAccount();
  }

  openAddAddressModal() {
    const modalContent = `
      <div class="centered-modal" style="padding:20px;">
        <h3 style="font-weight:800; margin-bottom:14px;">Add New Address</h3>
        <input type="text" id="newAddrName" placeholder="Address Name / Label (e.g. John Doe)" value="Alex Morgan" style="width:100%; padding:8px 12px; border-radius:var(--radius-md); border:1px solid var(--border-color); margin-bottom:8px;" />
        <input type="text" id="newAddrStreet" placeholder="Full Address" style="width:100%; padding:8px 12px; border-radius:var(--radius-md); border:1px solid var(--border-color); margin-bottom:8px;" />
        <input type="text" id="newAddrApt" placeholder="Apartment / Suite (Optional)" style="width:100%; padding:8px 12px; border-radius:var(--radius-md); border:1px solid var(--border-color); margin-bottom:8px;" />
        <div style="display:flex; gap:8px; margin-bottom:8px;">
          <input type="text" id="newAddrCity" placeholder="City" style="flex:1; padding:8px 12px; border-radius:var(--radius-md); border:1px solid var(--border-color);" />
          <input type="text" id="newAddrState" placeholder="State" style="width:80px; padding:8px 12px; border-radius:var(--radius-md); border:1px solid var(--border-color);" />
        </div>
        <div style="display:flex; gap:8px; margin-bottom:8px;">
          <input type="text" id="newAddrZip" placeholder="Zip" style="flex:1; padding:8px 12px; border-radius:var(--radius-md); border:1px solid var(--border-color);" />
          <input type="text" id="newAddrCountry" placeholder="Country" value="United States" style="flex:1; padding:8px 12px; border-radius:var(--radius-md); border:1px solid var(--border-color);" />
        </div>
        <select id="newAddrTag" style="width:100%; padding:8px 12px; border-radius:var(--radius-md); border:1px solid var(--border-color); margin-bottom:10px;">
          <option value="Home">Home</option>
          <option value="Work">Work</option>
          <option value="Other">Other</option>
        </select>
        <label style="display:flex; align-items:center; gap:6px; font-size:13px; margin-bottom:14px; font-weight:600; cursor:pointer;">
          <input type="checkbox" id="newAddrIsDefault" /> Set as Default Address
        </label>
        <button id="saveAddrBtn" class="checkout-cta-btn" onclick="app.saveNewAddress()">Save Address</button>
      </div>
    `;
    this.openModal(modalContent);
  }

  saveNewAddress() {
    const fullName = document.getElementById("newAddrName")?.value.trim() || "";
    const street = document.getElementById("newAddrStreet")?.value.trim() || "";
    const apt = document.getElementById("newAddrApt")?.value.trim() || "";
    const city = document.getElementById("newAddrCity")?.value.trim() || "";
    const state = document.getElementById("newAddrState")?.value.trim() || "";
    const zip = document.getElementById("newAddrZip")?.value.trim() || "";
    const country = document.getElementById("newAddrCountry")?.value.trim() || "";
    const label = document.getElementById("newAddrTag")?.value || "Home";
    const isDefault = document.getElementById("newAddrIsDefault")?.checked || false;

    if (!fullName || !street || !city || !state || !zip || !country) {
      this.showToast("Please fill in all required fields.");
      return;
    }

    const btn = document.getElementById("saveAddrBtn");
    if (btn) btn.disabled = true;

    const finalStreet = apt ? `${street}, ${apt}` : street;

    const newAddr = appState.addAddress({ fullName, street: finalStreet, city, state, zip, country, label, phone: "+1 555-234-5678", isDefault });
    if (this.checkoutState) {
      this.checkoutState.selectedAddressId = newAddr.id;
    }
    this.closeModal();
    this.showToast("Address Added ✓");
    if (this.currentView === "account") this.renderAccount();
    if (this.currentView === "checkout") this.renderCheckout();
  }

  deleteAddr(id) {
    appState.deleteAddress(id);
    this.showToast("Address deleted");
    this.renderAccount();
  }

  setDefaultAddr(id) {
    appState.setDefaultAddress(id);
    this.showToast("Default address updated");
    this.renderAccount();
  }


  // --- Module 11: Returns & Refunds ---
  generateReturnCard(ret) {
    let displayStatus = ret.status.charAt(0).toUpperCase() + ret.status.slice(1);
    if (ret.status === "approved") displayStatus = "Approved";

    const refundStep = ret.timeline.find(t => t.title.toLowerCase().includes("refund credited") || t.title.toLowerCase().includes("completed"));
    const isRefunded = refundStep && refundStep.done;

    // Status text (customer friendly)
    const referenceText = `Return request #${ret.id}`;

    return `
      <div class="return-card-box" onclick="app.openReturnDetailsModal('${ret.id}')" style="cursor:pointer; margin-bottom:16px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <strong>Return #${ret.id}</strong>
          <span class="order-status-badge ${isRefunded ? 'status-delivered' : 'status-shipped'}">${displayStatus}</span>
        </div>
        <div style="display:flex; gap:10px; margin-bottom:10px;">
          <img src="${ret.image}" style="width:50px; height:50px; border-radius:6px; object-fit:cover;" />
          <div>
            <div style="font-size:13px; font-weight:700;">${ret.productName}</div>
            <div style="font-size:11px; color:var(--text-muted);">Refund: ₹${ret.refundAmount.toFixed(2)} to ${ret.refundMethod}</div>
            <div style="font-size:10px; color:var(--primary); font-weight:700; margin-top:2px;">${referenceText}</div>
          </div>
        </div>

        <!-- Return Stepper Timeline -->
        <div style="background:var(--bg-surface-subtle); padding:10px; border-radius:var(--radius-md); font-size:11px;">
          ${ret.timeline.map(t => `
            <div style="display:flex; justify-content:space-between; margin-bottom:4px; color:${t.done ? "var(--text-main)" : "var(--text-subtle)"};">
              <span>${t.done ? "✓" : "○"} ${t.title}</span>
              <span style="font-size:10px;">${t.date}</span>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  openReturnDetailsModal(retId) {
    const ret = appState.state.returns.find(r => r.id === retId);
    if (!ret) return;

    let displayStatus = ret.status.charAt(0).toUpperCase() + ret.status.slice(1);
    if (ret.status === "approved") displayStatus = "Approved";

    const refundStep = ret.timeline.find(t => t.title.toLowerCase().includes("refund credited") || t.title.toLowerCase().includes("completed"));
    const isRefunded = refundStep && refundStep.done;
    const isFailed = ret.status.toLowerCase() === "failed" || ret.status.toLowerCase() === "rejected";

    let refundStatus = "Processing";
    if (isRefunded) refundStatus = "Credited";
    if (isFailed) refundStatus = "Failed";

    const pickupDate = ret.timeline.find(t => t.title.toLowerCase().includes("pickup scheduled"))?.date || 'N/A';

    const fullTimelineHtml = ret.timeline.map(t => {
      return `
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px; color:${t.done ? "var(--text-main)" : "var(--text-subtle)"};">
          <div>
            <div style="font-weight:700; font-size:12px;">${t.done ? "✓" : "○"} ${t.title}</div>
            <div style="font-size:11px; margin-top:2px;">${t.desc}</div>
          </div>
          <div style="font-size:10px; margin-left:12px; text-align:right;">${t.date}</div>
        </div>
      `;
    }).join("");

    const modalContent = `
      <div class="centered-modal" style="padding:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
          <h3 style="font-weight:800; font-size:16px;">Return Details</h3>
          <button onclick="app.closeModal()" style="background:none; border:none; font-size:18px; cursor:pointer; color:var(--text-muted);">✕</button>
        </div>
        
        <div style="background:var(--bg-surface-subtle); padding:12px; border-radius:var(--radius-md); margin-bottom:16px;">
          <div style="font-size:11px; color:var(--text-muted); margin-bottom:2px;">Return ID</div>
          <div style="font-weight:700; font-size:13px;">${ret.id}</div>
        </div>
        
        <div style="margin-bottom:16px;">
          <div style="font-size:11px; color:var(--text-muted); margin-bottom:2px;">Product</div>
          <div style="font-weight:700; font-size:13px;">${ret.productName}</div>
        </div>
        
        <div style="margin-bottom:16px;">
          <div style="font-size:11px; color:var(--text-muted); margin-bottom:2px;">Return Reason</div>
          <div style="font-weight:600; font-size:13px;">${ret.reason}</div>
        </div>

        <div style="margin-bottom:16px;">
          <div style="font-size:11px; color:var(--text-muted); margin-bottom:2px;">Return Status</div>
          <div style="font-weight:700; font-size:13px; color:${isRefunded ? 'var(--success)' : 'var(--text-main)'};">${displayStatus}</div>
        </div>
        
        <div style="margin-bottom:16px;">
          <div style="font-size:11px; color:var(--text-muted); margin-bottom:2px;">Pickup</div>
          <div style="font-weight:600; font-size:13px;">${pickupDate}</div>
        </div>
        
        <hr style="border:none; border-top:1px solid var(--border-color); margin:16px 0;" />

        <div style="display:flex; justify-content:space-between; margin-bottom:16px;">
          <div>
            <div style="font-size:11px; color:var(--text-muted); margin-bottom:2px;">Refund</div>
            <div style="font-weight:800; font-size:14px;">₹${ret.refundAmount.toFixed(2)}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:11px; color:var(--text-muted); margin-bottom:2px;">Refund Status</div>
            <div style="font-weight:700; font-size:13px; color:${isRefunded ? 'var(--success)' : (isFailed ? 'var(--danger)' : '#f59e0b')};">${refundStatus}</div>
          </div>
        </div>

        <div style="margin-bottom:20px;">
          <div style="font-size:11px; color:var(--text-muted); margin-bottom:2px;">Refund Method</div>
          <div style="font-weight:600; font-size:13px;">${ret.refundMethod}</div>
        </div>

        <div style="font-size:13px; font-weight:800; margin-bottom:12px;">Return Timeline</div>
        <div style="padding:12px; border:1px solid var(--border-color); border-radius:var(--radius-md);">
          ${fullTimelineHtml}
        </div>
      </div>
    `;
    this.openModal(modalContent);
  }

  renderReturns() {
    const container = document.getElementById("view-returns");
    if (!container) return;

    const returns = appState.state.returns;
    const deliveredOrders = appState.state.orders.filter(o => o.status === "delivered");

    container.innerHTML = `
      <div style="padding:14px 16px; background:var(--bg-surface); border-bottom:1px solid var(--border-color); display:flex; align-items:center; justify-content:space-between;">
        <h2 style="font-size:15px; font-weight:800;">Returns & Refunds Hub</h2>
        <span style="font-size:11px; color:var(--text-muted);">15-Day Policy</span>
      </div>

      <div style="padding:16px;">
        <h3 style="font-size:14px; font-weight:800; margin-bottom:12px;">Active & Past Returns (${returns.length})</h3>
        ${returns.map(ret => this.generateReturnCard(ret)).join("")}
      </div>
    `;
  }

  openReturnRequestModal(orderId, productId) {
    const order = appState.state.orders.find(o => o.id === orderId);
    const item = order?.items.find(i => i.productId === productId) || order?.items[0];

    const modalContent = `
      <div class="centered-modal" style="padding:20px;">
        <h3 style="font-weight:800; margin-bottom:10px;">Request Return for ${item?.name}</h3>
        
        <label style="font-size:12px; font-weight:700;">Reason for Return</label>
        <select id="returnReasonSelect" style="width:100%; padding:8px 12px; border-radius:var(--radius-md); border:1px solid var(--border-color); margin: 6px 0 10px 0;">
          <option value="Item defective or not working">Item defective or not working</option>
          <option value="Size is too tight / loose">Size is too tight / loose</option>
          <option value="Wrong item delivered">Wrong item delivered</option>
          <option value="Item not as described">Item not as described</option>
        </select>

        <label style="font-size:12px; font-weight:700;">Return Pickup Method</label>
        <select id="returnPickupMethod" style="width:100%; padding:8px 12px; border-radius:var(--radius-md); border:1px solid var(--border-color); margin: 6px 0 10px 0;">
          <option value="Doorstep Courier Pickup">Doorstep Courier Pickup (Courier collects from your home)</option>
          <option value="Drop at Nearest Center">Drop at Nearest Logistics Center</option>
        </select>

        <label style="font-size:12px; font-weight:700;">Refund Preference</label>
        <select id="returnRefundMethod" style="width:100%; padding:8px 12px; border-radius:var(--radius-md); border:1px solid var(--border-color); margin: 6px 0 16px 0;">
          <option value="Original Payment Method">Original Payment Method (Refund to Visa Card)</option>
          <option value="Store Credit / Wallet">Store Credit (Instant + 5% Bonus)</option>
        </select>

        <button class="checkout-cta-btn" onclick="app.submitReturn('${orderId}', '${item?.productId}')">
          Submit Return Request
        </button>
      </div>
    `;
    this.openModal(modalContent);
  }

  submitReturn(orderId, productId) {
    const reason = document.getElementById("returnReasonSelect")?.value || "Defective";
    const method = document.getElementById("returnRefundMethod")?.value || "Original Payment";
    appState.requestReturn(orderId, productId, reason, null, method);
    this.closeModal();
    this.showToast("Return request approved! Doorstep pickup scheduled.");
    this.navigate("returns");
  }

  // --- Module 12: Customer Reviews & Ratings ---
  renderReviews(productId) {
    const container = document.getElementById("view-reviews");
    if (!container) return;

    const product = SEED_DATA.products.find(p => p.id === productId) || SEED_DATA.products[0];
    const reviews = appState.getProductReviews(product.id);

    container.innerHTML = `
      <div style="padding:14px 16px; background:var(--bg-surface); border-bottom:1px solid var(--border-color); display:flex; align-items:center; justify-content:space-between;">
        <h2 style="font-size:15px; font-weight:800;">Customer Reviews</h2>
        <button class="tool-btn" style="background:var(--primary); color:#fff;" onclick="app.openWriteReviewModal('${product.id}')">+ Write Review</button>
      </div>

      <div style="padding:16px;">
        <!-- Rating Summary Box -->
        <div style="background:var(--bg-surface); border:1px solid var(--border-color); border-radius:var(--radius-xl); padding:16px; display:flex; align-items:center; gap:20px; margin-bottom:16px;">
          <div style="text-align:center;">
            <div style="font-size:36px; font-weight:800; color:var(--text-main); line-height:1;">${product.rating}</div>
            <div style="color:#f59e0b; font-size:16px; margin:4px 0;">★★★★★</div>
            <div style="font-size:11px; color:var(--text-muted);">${reviews.length} reviews</div>
          </div>
          <div style="flex:1; font-size:11px; color:var(--text-muted);">
            <div>5★ Verified Buyer High Satisfaction</div>
            <div style="margin-top:4px;">96% of customers recommend this item</div>
          </div>
        </div>

        <!-- Reviews List -->
        ${reviews.map(rev => `
          <div class="review-item-card">
            <div class="review-item-header">
              <div>
                <strong>${rev.user}</strong>
                ${rev.verified ? `<span class="verified-buyer-tag">✓ Verified Buyer</span>` : ""}
              </div>
              <span style="font-size:11px; color:var(--text-subtle);">${rev.date}</span>
            </div>
            <div style="color:#f59e0b; font-size:12px; margin-bottom:4px;">
              ${"★".repeat(rev.rating)}${"☆".repeat(5 - rev.rating)}
            </div>
            <h5 style="font-size:13px; font-weight:700; margin-bottom:4px;">${rev.title}</h5>
            <p style="font-size:12px; color:var(--text-muted); line-height:1.4;">${rev.comment}</p>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px; font-size:11px;">
              <button onclick="app.voteReviewHelpful('${product.id}', '${rev.id}')" style="color:var(--text-muted);">
                👍 Helpful (${rev.helpful || 0})
              </button>
            </div>
          </div>
        `).join("")}
      </div>
    `;
  }

  openWriteReviewModal(productId) {
    const modalContent = `
      <div class="centered-modal" style="padding:20px;">
        <h3 style="font-weight:800; margin-bottom:12px;">Write a Customer Review</h3>
        <label style="font-size:12px; font-weight:700;">Your Rating</label>
        <div class="star-rating-picker" id="reviewStarPicker" style="margin: 6px 0 12px 0;">
          <span class="star active" onclick="app.setReviewRating(1)">★</span>
          <span class="star active" onclick="app.setReviewRating(2)">★</span>
          <span class="star active" onclick="app.setReviewRating(3)">★</span>
          <span class="star active" onclick="app.setReviewRating(4)">★</span>
          <span class="star active" onclick="app.setReviewRating(5)">★</span>
        </div>
        <input type="hidden" id="selectedStarValue" value="5" />

        <label style="font-size:12px; font-weight:700;">Review Title</label>
        <input type="text" id="reviewTitleInput" placeholder="e.g. Absolutely exceptional quality!" style="width:100%; padding:8px 12px; border-radius:var(--radius-md); border:1px solid var(--border-color); margin: 4px 0 10px 0;" />

        <label style="font-size:12px; font-weight:700;">Detailed Feedback</label>
        <textarea id="reviewTextInput" rows="3" placeholder="Share your honest experience..." style="width:100%; padding:8px 12px; border-radius:var(--radius-md); border:1px solid var(--border-color); margin: 4px 0 14px 0;"></textarea>

        <button class="checkout-cta-btn" onclick="app.submitReview('${productId}')">Submit Review</button>
      </div>
    `;
    this.openModal(modalContent);
  }

  setReviewRating(rating) {
    document.getElementById("selectedStarValue").value = rating;
    const stars = document.querySelectorAll("#reviewStarPicker .star");
    stars.forEach((s, idx) => {
      s.classList.toggle("active", idx < rating);
    });
  }

  submitReview(productId) {
    const rating = document.getElementById("selectedStarValue")?.value || 5;
    const title = document.getElementById("reviewTitleInput")?.value || "Great Product!";
    const text = document.getElementById("reviewTextInput")?.value || "Very satisfied with my purchase.";

    appState.addReview(productId, rating, title, text);
    this.closeModal();
    this.showToast("Review submitted & published live! ★");
    this.renderReviews(productId);
  }

  voteReviewHelpful(productId, reviewId) {
    appState.voteReviewHelpful(productId, reviewId);
    this.renderReviews(productId);
    this.showToast("Thank you for your feedback!");
  }

  // --- Module 13: Notification Center ---
  renderNotifications() {
    const container = document.getElementById("view-notifications");
    if (!container) return;

    let notifs = appState.getNotifications();
    if (this.activeNotifTab !== "all") {
      notifs = notifs.filter(n => n.category === this.activeNotifTab);
    }

    container.innerHTML = `
      <div style="padding:14px 16px; background:var(--bg-surface); border-bottom:1px solid var(--border-color); display:flex; align-items:center; justify-content:space-between;">
        <h2 style="font-size:16px; font-weight:800;">Notifications</h2>
        <button onclick="app.markAllNotifsRead()" style="font-size:12px; color:var(--primary); font-weight:700;">Mark all as read</button>
      </div>

      <!-- Categories filter -->
      <div class="category-filter-tabs" style="padding:10px 16px; background:var(--bg-surface); border-bottom:1px solid var(--border-color);">
        ${["all", "shipping", "orders", "returns", "promos"].map(cat => `
          <button class="cat-tab-pill ${this.activeNotifTab === cat ? "active" : ""}" onclick="app.activeNotifTab = '${cat}'; app.renderNotifications();">
            ${cat.toUpperCase()}
          </button>
        `).join("")}
      </div>

      <div>
        ${notifs.map(n => `
          <div class="notification-card ${!n.read ? "unread" : ""}" onclick="app.handleNotifClick('${n.id}', '${n.deepLink || ""}', '${n.targetId || ""}')">
            <div style="flex:1;">
              <div style="font-size:13px; font-weight:700; color:var(--text-main);">${n.title}</div>
              <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">${n.message}</div>
              <div style="font-size:10px; color:var(--text-subtle); margin-top:4px;">${n.time}</div>
            </div>
            <button onclick="event.stopPropagation(); app.deleteNotif('${n.id}')" style="color:var(--text-subtle); font-size:14px;">✕</button>
          </div>
        `).join("")}
      </div>
    `;
  }

  handleNotifClick(notifId, deepLink, targetId) {
    appState.markNotificationRead(notifId);
    this.updateBadges();
    if (deepLink === "view_tracking" && targetId) {
      this.navigate("tracking", { orderId: targetId });
    } else if (deepLink === "view_order_details" && targetId) {
      this.navigate("order_details", { orderId: targetId });
    } else if (deepLink === "view_returns") {
      this.navigate("returns");
    } else if (deepLink === "view_cart") {
      this.navigate("cart");
    } else {
      this.renderNotifications();
    }
  }

  markAllNotifsRead() {
    appState.markAllNotificationsRead();
    this.updateBadges();
    this.renderNotifications();
    this.showToast("All marked as read");
  }

  deleteNotif(id) {
    appState.deleteNotification(id);
    this.updateBadges();
    this.renderNotifications();
  }

  // --- Module 14: Customer Support & Live Chat ---
  renderSupport() {
    const container = document.getElementById("view-support");
    if (!container) return;

    const faqs = SEED_DATA.faqs;
    const tickets = appState.state.tickets;

    container.innerHTML = `
      <div style="padding:14px 16px; background:var(--bg-surface); border-bottom:1px solid var(--border-color); display:flex; align-items:center; justify-content:space-between;">
        <h2 style="font-size:16px; font-weight:800;">Help & Live Support</h2>
        <button class="tool-btn" style="background:var(--primary); color:#fff;" onclick="app.openRaiseTicketModal()">+ Raise Claim</button>
      </div>

      <div style="padding:16px;">
        <!-- Active Tickets / Claims -->
        <h3 style="font-size:14px; font-weight:800; margin-bottom:10px;">Support Inquiries & Claims</h3>
        ${tickets.map(t => `
          <div style="background:var(--bg-surface); border:1px solid var(--border-color); border-radius:var(--radius-lg); padding:12px; margin-bottom:10px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <strong>${t.id}: ${t.subject}</strong>
              <span class="order-status-badge status-${t.status === "Resolved" ? "delivered" : "processing"}">${t.status}</span>
            </div>
            <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">Category: ${t.category} • ${t.date}</div>
            
            <!-- Chat simulation box -->
            <div class="chat-messages-container" style="height:140px; margin-top:8px; background:var(--bg-surface-subtle); border-radius:var(--radius-md); padding:10px;">
              ${t.messages.map(m => `
                <div class="chat-bubble ${m.sender === "user" ? "user" : "agent"}" style="font-size:11px; padding:6px 10px;">
                  ${m.text}
                </div>
              `).join("")}
            </div>

            <div style="display:flex; gap:6px; margin-top:8px;">
              <input type="text" id="chatInput_${t.id}" placeholder="Type your reply to care agent..." style="flex:1; padding:6px 10px; border-radius:var(--radius-sm); border:1px solid var(--border-color); font-size:12px;" onkeydown="if(event.key==='Enter') app.sendTicketChat('${t.id}')" />
              <button class="tool-btn active" onclick="app.sendTicketChat('${t.id}')">Send</button>
            </div>
            ${t.status !== "Resolved" ? `
              <button class="tool-btn" style="margin-top:6px; font-size:11px; color:var(--success);" onclick="app.closeTicketAndRate('${t.id}')">✓ Mark Solved & Rate</button>
            ` : ""}
          </div>
        `).join("")}

        <!-- FAQ Accordion -->
        <h3 style="font-size:14px; font-weight:800; margin: 20px 0 10px 0;">Frequently Asked Questions</h3>
        <div style="display:flex; flex-direction:column; gap:8px;">
          ${faqs.map((f, i) => `
            <div style="background:var(--bg-surface); border:1px solid var(--border-color); border-radius:var(--radius-md); overflow:hidden;">
              <div style="padding:12px 14px; font-weight:700; font-size:13px; display:flex; justify-content:space-between; cursor:pointer;" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'block' ? 'none' : 'block';">
                <span>${f.question}</span>
                <span>▾</span>
              </div>
              <div style="display:none; padding: 0 14px 12px 14px; font-size:12px; color:var(--text-muted); line-height:1.4;">
                ${f.answer}
                <div style="margin-top:10px; padding-top:8px; border-top:1px dashed var(--border-color); display:flex; justify-content:space-between; align-items:center; font-size:11px;">
                  <span>Did this answer help?</span>
                  <div style="display:flex; gap:6px;">
                    <button class="tool-btn" style="font-size:10px;" onclick="app.showToast('Thanks for your feedback! 👍')">👍 Yes</button>
                    <button class="tool-btn" style="font-size:10px;" onclick="app.openRaiseTicketModal('${f.category}')">👎 No, Raise Ticket</button>
                  </div>
                </div>
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  sendTicketChat(ticketId) {
    const input = document.getElementById(`chatInput_${ticketId}`);
    if (!input || !input.value.trim()) return;
    appState.sendChatMessage(ticketId, input.value.trim());
    input.value = "";
    this.renderSupport();
  }

  closeTicketAndRate(ticketId) {
    const modalContent = `
      <div class="centered-modal" style="padding:20px; text-align:center;">
        <h3 style="font-weight:800; margin-bottom:8px;">Rate Support Experience</h3>
        <p style="font-size:12px; color:var(--text-muted); margin-bottom:12px;">How satisfied were you with our customer resolution?</p>
        <div class="star-rating-picker" style="justify-content:center; margin-bottom:16px;">
          <span class="star active" onclick="this.parentElement.querySelectorAll('.star').forEach((s,i)=>s.classList.toggle('active', i<1))">★</span>
          <span class="star active" onclick="this.parentElement.querySelectorAll('.star').forEach((s,i)=>s.classList.toggle('active', i<2))">★</span>
          <span class="star active" onclick="this.parentElement.querySelectorAll('.star').forEach((s,i)=>s.classList.toggle('active', i<3))">★</span>
          <span class="star active" onclick="this.parentElement.querySelectorAll('.star').forEach((s,i)=>s.classList.toggle('active', i<4))">★</span>
          <span class="star active" onclick="this.parentElement.querySelectorAll('.star').forEach((s,i)=>s.classList.toggle('active', i<5))">★</span>
        </div>
        <button class="checkout-cta-btn" onclick="app.submitTicketRating('${ticketId}')">Submit Feedback & Close Ticket</button>
      </div>
    `;
    this.openModal(modalContent);
  }

  submitTicketRating(ticketId) {
    const ticket = appState.state.tickets.find(t => t.id === ticketId);
    if (ticket) ticket.status = "Resolved";
    this.closeModal();
    this.showToast("Thank you for your rating! Ticket marked as Resolved ✓");
    this.renderSupport();
  }

  openRaiseTicketModal(prefilledCategory = null) {
    const modalContent = `
      <div class="centered-modal" style="padding:20px;">
        <h3 style="font-weight:800; margin-bottom:12px;">Raise a Support Claim / Ticket</h3>
        <label style="font-size:12px; font-weight:700;">Issue Category</label>
        <select id="ticketCategorySelect" style="width:100%; padding:8px 12px; border-radius:var(--radius-md); border:1px solid var(--border-color); margin: 4px 0 10px 0;">
          <option value="Delivery Delay" ${prefilledCategory?.includes("Orders") ? "selected" : ""}>Delivery Delay / Tracking</option>
          <option value="Payment Inquiry" ${prefilledCategory?.includes("Payments") ? "selected" : ""}>Payment / Refund Inquiry</option>
          <option value="Damaged Item" ${prefilledCategory?.includes("Returns") ? "selected" : ""}>Damaged Item on Arrival</option>
          <option value="ERP Sales Return Sync">ERP Sales Return Sync</option>
        </select>
        <label style="font-size:12px; font-weight:700;">Subject</label>
        <input type="text" id="ticketSubjectInput" placeholder="Brief summary of problem" style="width:100%; padding:8px 12px; border-radius:var(--radius-md); border:1px solid var(--border-color); margin: 4px 0 10px 0;" />
        <label style="font-size:12px; font-weight:700;">Message</label>
        <textarea id="ticketMessageInput" rows="3" placeholder="Describe the issue in detail..." style="width:100%; padding:8px 12px; border-radius:var(--radius-md); border:1px solid var(--border-color); margin: 4px 0 14px 0;"></textarea>
        <button class="checkout-cta-btn" onclick="app.submitNewTicket()">Submit Ticket</button>
      </div>
    `;
    this.openModal(modalContent);
  }

  submitNewTicket() {
    const cat = document.getElementById("ticketCategorySelect")?.value || "General";
    const sub = document.getElementById("ticketSubjectInput")?.value || "Support inquiry";
    const msg = document.getElementById("ticketMessageInput")?.value || "Need help with my order.";

    appState.createSupportTicket(cat, sub, null, msg);
    this.closeModal();
    this.showToast("Support Ticket Raised ✓");
    this.renderSupport();
  }

  // --- Modals, Banners & Toasts ---
  openModal(contentHtml) {
    const overlay = document.getElementById("appModalOverlay");
    if (overlay) {
      overlay.innerHTML = contentHtml;
      overlay.classList.add("active");
    }
  }

  closeModal() {
    const overlay = document.getElementById("appModalOverlay");
    if (overlay) {
      overlay.classList.remove("active");
      overlay.innerHTML = "";
    }
  }

  showToast(message) {
    const container = document.getElementById("toastContainer");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = "toast-item";
    toast.innerHTML = `<span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 300);
    }, 2400);
  }

  // --- Timers & Background Autoplay ---
  startDealsTimer() {
    let seconds = 45;
    let minutes = 32;
    let hours = 14;

    this.dealTimerInterval = setInterval(() => {
      seconds--;
      if (seconds < 0) {
        seconds = 59;
        minutes--;
        if (minutes < 0) {
          minutes = 59;
          hours--;
        }
      }
      const sEl = document.getElementById("dealSecs");
      const mEl = document.getElementById("dealMins");
      const hEl = document.getElementById("dealHours");
      if (sEl) sEl.textContent = seconds.toString().padStart(2, "0");
      if (mEl) mEl.textContent = minutes.toString().padStart(2, "0");
      if (hEl) hEl.textContent = hours.toString().padStart(2, "0");
    }, 1000);
  }

  startBannerAutoplay() {
    this.bannerInterval = setInterval(() => {
      const track = document.getElementById("bannerTrack");
      if (track) {
        this.activeBannerSlide = (this.activeBannerSlide + 1) % SEED_DATA.banners.length;
        track.style.transform = `translateX(-${this.activeBannerSlide * 100}%)`;
        document.querySelectorAll(".banner-dot").forEach((d, i) => {
          d.classList.toggle("active", i === this.activeBannerSlide);
        });
      }
    }, 4500);
  }

  handleBannerClick(catId, prodId) {
    if (prodId) {
      this.openProduct(prodId);
    } else if (catId) {
      this.filterByCategory(catId);
    } else {
      this.navigate("products");
    }
  }

  // --- Global Event Bindings ---
  bindEvents() {
    // State subscription
    appState.subscribe("*", () => {
      this.updateBadges();
    });

    // Close modal on outside click
    const overlay = document.getElementById("appModalOverlay");
    if (overlay) {
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) this.closeModal();
      });
    }
  }

  resetAllData() {
    if (confirm("Reset all cart, orders, and addresses to initial demo data?")) {
      appState.resetDemoData();
      this.showToast("Demo Data Reset Successfully");
      this.navigate("home");
    }
  }
}

// Global App Instance
const app = new AppController();
document.addEventListener("DOMContentLoaded", () => {
  app.init();
});
