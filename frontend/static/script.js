// Interactive Features for TranscribeFlow Premium UI

/**
 * Main initialization block that runs once the DOM is fully loaded.
 * Sets up interactive UI components including tabs, FAQ accordion,
 * animated metrics, charts, parallax effects, mobile navigation,
 * smooth scrolling, and scroll-triggered animations.
 */
document.addEventListener('DOMContentLoaded', function () {

  // Tab functionality for benefits section
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');

  /**
   * Handles switching between benefit tabs.
   * Updates the active tab button and displays the corresponding tab pane.
   */
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabId = button.getAttribute('data-tab');

      // Update active tab button
      tabButtons.forEach(btn => btn.classList.remove('active'));
      button.classList.add('active');

      // Show corresponding tab pane
      tabPanes.forEach(pane => {
        pane.classList.remove('active');
        if (pane.id === tabId) {
          pane.classList.add('active');
        }
      });
    });
  });

  // FAQ accordion functionality
  const faqQuestions = document.querySelectorAll('.faq-question');

  /**
   * Toggles FAQ item visibility when a question is clicked.
   * Expands or collapses the answer section by toggling the "active" class.
   */
  faqQuestions.forEach(question => {
    question.addEventListener('click', () => {
      const faqItem = question.parentElement;
      faqItem.classList.toggle('active');
    });
  });

  // Animated counter for metrics
  const metricValues = document.querySelectorAll('.metric-value');

  /**
   * Configuration for IntersectionObserver used to detect
   * when metric elements enter the viewport.
   */
  const observerOptions = {
    threshold: 0.5,
    rootMargin: '0px 0px -50px 0px'
  };

  /**
   * Observer triggers number animation when metric values
   * become visible to the user.
   */
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const metric = entry.target;
        const target = parseInt(metric.getAttribute('data-count'));

        // Start animated counter
        animateCounter(metric, target);

        // Stop observing once animation starts
        observer.unobserve(metric);
      }
    });
  }, observerOptions);

  // Attach observer to all metric elements
  metricValues.forEach(metric => observer.observe(metric));

  /**
   * Animates numeric counters (used in metrics/statistics section).
   * Gradually increments the value until the target number is reached.
   */
  function animateCounter(element, target) {
    let current = 0;
    const increment = target / 50;

    const timer = setInterval(() => {
      current += increment;

      if (current >= target) {
        current = target;
        clearInterval(timer);
      }

      // Format number with proper suffixes
      let displayValue;
      if (target >= 1000) {
        displayValue = (current / 1000).toFixed(1) + 'k';
      } else if (target >= 1000000) {
        displayValue = (current / 1000000).toFixed(1) + 'M';
      } else {
        displayValue = Math.round(current);
      }

      element.textContent = displayValue;
    }, 30);
  }

  // Parallax effect for hero grid
  const heroGrid = document.querySelector('.hero-grid-bg');

  /**
   * Adds a subtle parallax scrolling effect to the hero background grid.
   * The background moves slower than the page scroll for visual depth.
   */
  if (heroGrid) {
    window.addEventListener('scroll', () => {
      const scrolled = window.pageYOffset;
      const rate = scrolled * -0.5;

      heroGrid.style.transform = `translate3d(0, ${rate}px, 0)`;
    });
  }

  // Interactive chart bars (simulated)
  const chartBars = document.querySelector('.chart-bars');

  /**
   * Generates a simulated weekly chart showing audio/video usage.
   * Heights are randomized to visually represent dynamic data.
   */
  if (chartBars) {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    let barsHTML = '';

    days.forEach(day => {
      const audioHeight = Math.floor(Math.random() * 60) + 30;
      const videoHeight = Math.floor(Math.random() * 40) + 20;

      barsHTML += `
        <div class="bar-wrapper">
          <div class="bar audio" style="height: ${audioHeight}%"></div>
          <div class="bar video" style="height: ${videoHeight}%"></div>
          <div class="bar-label">${day}</div>
        </div>
      `;
    });

    chartBars.innerHTML = barsHTML;
  }

  // Mobile menu toggle
  const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
  const navLinks = document.querySelector('.nav-links');

  /**
   * Toggles mobile navigation visibility and updates the menu icon.
   */
  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', () => {
      navLinks.style.display = navLinks.style.display === 'flex' ? 'none' : 'flex';

      mobileMenuBtn.innerHTML = navLinks.style.display === 'flex'
        ? '<i class="fas fa-times"></i>'
        : '<i class="fas fa-bars"></i>';
    });

    /**
     * Applies mobile-specific navigation styles when screen width
     * is below the defined breakpoint.
     */
    if (window.innerWidth <= 768) {
      navLinks.style.display = 'none';
      navLinks.style.flexDirection = 'column';
      navLinks.style.position = 'absolute';
      navLinks.style.top = '100%';
      navLinks.style.left = '0';
      navLinks.style.right = '0';
      navLinks.style.background = 'var(--bg-primary)';
      navLinks.style.padding = '1rem';
      navLinks.style.borderTop = '1px solid var(--slate-border)';
      navLinks.style.borderBottom = '1px solid var(--slate-border)';
      navLinks.style.gap = '1rem';
    }
  }

  /**
   * Smooth scrolling for internal anchor links.
   * Offsets scroll position to account for fixed header height.
   */
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const href = this.getAttribute('href');

      if (href !== '#') {
        e.preventDefault();

        const targetElement = document.querySelector(href);

        if (targetElement) {
          const headerOffset = 80;
          const elementPosition = targetElement.offsetTop;
          const offsetPosition = elementPosition - headerOffset;

          window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
          });

          // Close mobile menu if open
          if (window.innerWidth <= 768 && navLinks.style.display === 'flex') {
            navLinks.style.display = 'none';
            mobileMenuBtn.innerHTML = '<i class="fas fa-bars"></i>';
          }
        }
      }
    });
  });

  /**
   * Adds subtle hover animation to feature cards
   * for improved visual interaction.
   */
  const featureCards = document.querySelectorAll('.feature-card');

  featureCards.forEach(card => {
    card.addEventListener('mouseenter', function () {
      this.style.transform = 'translateY(-8px)';
    });

    card.addEventListener('mouseleave', function () {
      this.style.transform = 'translateY(0)';
    });
  });

  // Waveform animation
  const waveBars = document.querySelectorAll('.wave-bar');

  /**
   * Creates a continuous animated waveform effect
   * by randomly adjusting bar heights.
   */
  if (waveBars.length > 0) {
    setInterval(() => {
      waveBars.forEach(bar => {
        const currentHeight = parseInt(bar.style.height);

        const newHeight = Math.min(
          100,
          Math.max(10, currentHeight + (Math.random() * 40 - 20))
        );

        bar.style.height = `${newHeight}%`;
      });
    }, 500);
  }

  // Scroll Animations
  const scrollElements = document.querySelectorAll('.scroll-hidden');

  /**
   * Observer used to trigger CSS animations when elements
   * enter the viewport during scrolling.
   */
  const scrollObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const element = entry.target;

        const animationClass =
          element.getAttribute('data-animation') || 'animate-fade-in';

        // Remove hidden class and apply animation class
        element.classList.remove('scroll-hidden');
        element.classList.add(animationClass);

        // Stop observing once animation has triggered
        scrollObserver.unobserve(element);
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  });

  // Observe all scroll-triggered elements
  scrollElements.forEach(el => scrollObserver.observe(el));
});


// Benefits Tab Switching

/**
 * Secondary tab switching handler to ensure correct
 * tab state when buttons are clicked.
 */
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.getAttribute('data-tab');

    // Update active button
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // Show target pane, hide others
    document.querySelectorAll('.tab-pane').forEach(pane => {
      pane.classList.remove('active');
    });

    document.getElementById(target).classList.add('active');
  });
});


/**
 * Animates benefit cards within the selected tab pane.
 * Cards animate sequentially to create a staggered entrance effect.
 */
function animateBenefitCards(pane) {
  const cards = pane.querySelectorAll('.benefit-item');

  cards.forEach(card => {
    card.classList.remove('benefit-animate');

    // Force reflow so animation can restart
    void card.offsetWidth;
  });

  cards.forEach((card, index) => {
    setTimeout(() => {
      card.classList.add('benefit-animate');
    }, index * 100); // 100ms stagger between each card
  });
}


/**
 * Tab switching logic that also triggers benefit card animations
 * whenever a new tab is activated.
 */
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.getAttribute('data-tab');

    // Update active button
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // Hide all panes
    document.querySelectorAll('.tab-pane').forEach(pane => {
      pane.classList.remove('active');
    });

    const activePane = document.getElementById(target);

    // Show selected pane
    activePane.classList.add('active');

    // Trigger animation for benefit cards
    animateBenefitCards(activePane);
  });
});


/**
 * On page load, animate cards inside the default active tab.
 */
document.addEventListener('DOMContentLoaded', () => {
  const defaultPane = document.querySelector('.tab-pane.active');

  if (defaultPane) animateBenefitCards(defaultPane);
});