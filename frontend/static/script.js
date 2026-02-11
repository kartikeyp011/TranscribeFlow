// Interactive Features for TranscribeFlow Premium UI

document.addEventListener('DOMContentLoaded', function() {
  // Tab functionality for benefits section
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');
  
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
  
  faqQuestions.forEach(question => {
    question.addEventListener('click', () => {
      const faqItem = question.parentElement;
      faqItem.classList.toggle('active');
    });
  });
  
  // Animated counter for metrics
  const metricValues = document.querySelectorAll('.metric-value');
  
  const observerOptions = {
    threshold: 0.5,
    rootMargin: '0px 0px -50px 0px'
  };
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const metric = entry.target;
        const target = parseInt(metric.getAttribute('data-count'));
        animateCounter(metric, target);
        observer.unobserve(metric);
      }
    });
  }, observerOptions);
  
  metricValues.forEach(metric => observer.observe(metric));
  
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
  if (heroGrid) {
    window.addEventListener('scroll', () => {
      const scrolled = window.pageYOffset;
      const rate = scrolled * -0.5;
      heroGrid.style.transform = `translate3d(0, ${rate}px, 0)`;
    });
  }
  
  // Interactive chart bars (simulated)
  const chartBars = document.querySelector('.chart-bars');
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
  
  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', () => {
      navLinks.style.display = navLinks.style.display === 'flex' ? 'none' : 'flex';
      mobileMenuBtn.innerHTML = navLinks.style.display === 'flex' ? 
        '<i class="fas fa-times"></i>' : '<i class="fas fa-bars"></i>';
    });
    
    // Adjust nav links for mobile
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
  
  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
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
  
  // Add hover effects to feature cards
  const featureCards = document.querySelectorAll('.feature-card');
  featureCards.forEach(card => {
    card.addEventListener('mouseenter', function() {
      this.style.transform = 'translateY(-8px)';
    });
    
    card.addEventListener('mouseleave', function() {
      this.style.transform = 'translateY(0)';
    });
  });
  
  // Waveform animation
  const waveBars = document.querySelectorAll('.wave-bar');
  if (waveBars.length > 0) {
    setInterval(() => {
      waveBars.forEach(bar => {
        const currentHeight = parseInt(bar.style.height);
        const newHeight = Math.min(100, Math.max(10, currentHeight + (Math.random() * 40 - 20)));
        bar.style.height = `${newHeight}%`;
      });
    }, 500);
  }
});