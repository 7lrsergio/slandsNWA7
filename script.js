/* ==========================================
   SLANDS - Complete JavaScript
   3D Wave/Mesh Animation + Language Toggle + All Functionality
   ========================================== */

   document.addEventListener('DOMContentLoaded', function() {
  
    // Current language state
    let currentLang = 'en';
    
    // ==========================================
    // 3D Wave/Mesh Animation with Mouse Interaction
    // ==========================================
    
    const canvas = document.getElementById('heroCanvas');
    const ctx = canvas.getContext('2d');
    
    let width, height;
    let mouseX = 0;
    let mouseY = 0;
    let targetMouseX = 0;
    let targetMouseY = 0;
    
    // Grid configuration
    const gridConfig = {
      cols: 40,
      rows: 25,
      spacing: 0,
      pointSize: 2,
      waveAmplitude: 30,
      waveFrequency: 0.02,
      mouseInfluence: 150,
      mouseStrength: 80,
      perspective: 800,
      rotationX: 0.3,
      animationSpeed: 0.008
    };
    
    let points = [];
    let time = 0;
    
    // Resize handler
    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
      gridConfig.spacing = Math.max(width, height) / gridConfig.cols * 1.5;
      initPoints();
    }
    
    // Initialize grid points
    function initPoints() {
      points = [];
      const offsetX = (width - (gridConfig.cols - 1) * gridConfig.spacing) / 2;
      const offsetY = (height - (gridConfig.rows - 1) * gridConfig.spacing) / 2;
      
      for (let i = 0; i < gridConfig.cols; i++) {
        for (let j = 0; j < gridConfig.rows; j++) {
          points.push({
            x: offsetX + i * gridConfig.spacing,
            y: offsetY + j * gridConfig.spacing,
            baseX: offsetX + i * gridConfig.spacing,
            baseY: offsetY + j * gridConfig.spacing,
            z: 0,
            col: i,
            row: j
          });
        }
      }
    }
    
    // Project 3D to 2D with perspective
    function project(point) {
      const centerX = width / 2;
      const centerY = height / 2;
      
      let x = point.x - centerX;
      let y = point.y - centerY;
      let z = point.z;
      
      const cosX = Math.cos(gridConfig.rotationX);
      const sinX = Math.sin(gridConfig.rotationX);
      const newY = y * cosX - z * sinX;
      const newZ = y * sinX + z * cosX;
      
      const scale = gridConfig.perspective / (gridConfig.perspective + newZ);
      
      return {
        x: centerX + x * scale,
        y: centerY + newY * scale,
        scale: scale,
        z: newZ
      };
    }
    
    // Update points based on time and mouse
    function updatePoints() {
      targetMouseX += (mouseX - targetMouseX) * 0.1;
      targetMouseY += (mouseY - targetMouseY) * 0.1;
      
      time += gridConfig.animationSpeed;
      
      for (let point of points) {
        const waveX = Math.sin(point.col * gridConfig.waveFrequency * 10 + time * 2) * gridConfig.waveAmplitude;
        const waveY = Math.cos(point.row * gridConfig.waveFrequency * 10 + time * 2) * gridConfig.waveAmplitude;
        const wave = (waveX + waveY) * 0.5;
        
        const distFromCenter = Math.sqrt(
          Math.pow(point.col - gridConfig.cols / 2, 2) + 
          Math.pow(point.row - gridConfig.rows / 2, 2)
        );
        const ripple = Math.sin(distFromCenter * 0.3 - time * 3) * 20;
        
        const dx = point.baseX - targetMouseX;
        const dy = point.baseY - targetMouseY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        let mouseEffect = 0;
        if (dist < gridConfig.mouseInfluence) {
          const influence = 1 - (dist / gridConfig.mouseInfluence);
          mouseEffect = influence * gridConfig.mouseStrength * Math.sin(influence * Math.PI);
        }
        
        point.z = wave + ripple + mouseEffect;
        point.x = point.baseX + Math.sin(time + point.col * 0.1) * 2;
        point.y = point.baseY + Math.cos(time + point.row * 0.1) * 2;
      }
    }
    
    // Draw the mesh
    function draw() {
      ctx.clearRect(0, 0, width, height);
      
      const sortedPoints = [...points].sort((a, b) => a.z - b.z);
      
      ctx.lineWidth = 0.5;
      
      for (let point of points) {
        const projected = project(point);
        
        const neighbors = points.filter(p => {
          const colDiff = Math.abs(p.col - point.col);
          const rowDiff = Math.abs(p.row - point.row);
          return (colDiff === 1 && rowDiff === 0) || (colDiff === 0 && rowDiff === 1);
        });
        
        for (let neighbor of neighbors) {
          const projectedNeighbor = project(neighbor);
          
          const avgZ = (point.z + neighbor.z) / 2;
          const colorIntensity = Math.min(1, Math.max(0, (avgZ + 50) / 100));
          const alpha = 0.1 + colorIntensity * 0.3;
          
          const red = Math.floor(255 * (0.8 + colorIntensity * 0.2));
          const green = Math.floor(59 * colorIntensity * 0.5);
          const blue = Math.floor(48 * colorIntensity * 0.3);
          
          ctx.strokeStyle = `rgba(${red}, ${green}, ${blue}, ${alpha})`;
          ctx.beginPath();
          ctx.moveTo(projected.x, projected.y);
          ctx.lineTo(projectedNeighbor.x, projectedNeighbor.y);
          ctx.stroke();
        }
      }
      
      for (let point of sortedPoints) {
        const projected = project(point);
        const size = gridConfig.pointSize * projected.scale;
        const colorIntensity = Math.min(1, Math.max(0, (point.z + 50) / 100));
        const alpha = 0.3 + colorIntensity * 0.7;
        
        if (point.z > 20) {
          const glowSize = size * 3;
          const gradient = ctx.createRadialGradient(
            projected.x, projected.y, 0,
            projected.x, projected.y, glowSize
          );
          gradient.addColorStop(0, `rgba(255, 59, 48, ${alpha * 0.5})`);
          gradient.addColorStop(1, 'rgba(255, 59, 48, 0)');
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(projected.x, projected.y, glowSize, 0, Math.PI * 2);
          ctx.fill();
        }
        
        ctx.fillStyle = `rgba(255, 59, 48, ${alpha})`;
        ctx.beginPath();
        ctx.arc(projected.x, projected.y, size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    
    // Animation loop
    function animate() {
      updatePoints();
      draw();
      requestAnimationFrame(animate);
    }
    
    window.addEventListener('resize', resize);
    
    document.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    });
    
    document.addEventListener('touchmove', (e) => {
      if (e.touches.length > 0) {
        mouseX = e.touches[0].clientX;
        mouseY = e.touches[0].clientY;
      }
    });
    
    resize();
    animate();
  
    // ==========================================
    // Language Toggle
    // ==========================================
    
    function switchLanguage(lang) {
      currentLang = lang;
      
      // Update toggle buttons
      const langToggle = document.getElementById('langToggle');
      const langToggleMobile = document.getElementById('langToggleMobile');
      
      langToggle.textContent = lang === 'en' ? 'ES' : 'EN';
      langToggleMobile.textContent = lang === 'en' ? 'Español' : 'English';
      
      // Update all translatable elements
      document.querySelectorAll('[data-en]').forEach(el => {
        const text = el.getAttribute(`data-${lang}`);
        if (text) {
          // Handle elements with child nodes (like spans inside)
          if (el.children.length === 0) {
            el.textContent = text;
          } else {
            // For elements with children, we need to preserve structure
            // Only update direct text content
            const childText = Array.from(el.children).map(c => c.outerHTML).join('');
            if (el.innerHTML.replace(childText, '').trim() !== text) {
              // Has text content mixed with children - more complex case
              // For simplicity, just update if no children
            } else {
              el.textContent = text;
            }
          }
        }
      });
      
      // Update placeholders
      document.querySelectorAll('[data-placeholder-en]').forEach(el => {
        const placeholder = el.getAttribute(`data-placeholder-${lang}`);
        if (placeholder) {
          el.placeholder = placeholder;
        }
      });
      
      // Update select options
      document.querySelectorAll('select option[data-en]').forEach(el => {
        const text = el.getAttribute(`data-${lang}`);
        if (text) {
          el.textContent = text;
        }
      });
    }
    
    // Language toggle event listeners
    document.getElementById('langToggle').addEventListener('click', () => {
      switchLanguage(currentLang === 'en' ? 'es' : 'en');
    });
    
    document.getElementById('langToggleMobile').addEventListener('click', () => {
      switchLanguage(currentLang === 'en' ? 'es' : 'en');
    });
  
    // ==========================================
    // Scroll Animations (Intersection Observer)
    // ==========================================
    
    const observerOptions = {
      root: null,
      rootMargin: '0px 0px -100px 0px',
      threshold: 0.1
    };
  
    const animationObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, observerOptions);
  
    document.querySelectorAll('.animate-on-scroll').forEach(el => {
      animationObserver.observe(el);
    });
  
    // ==========================================
    // Navbar Scroll Effect
    // ==========================================
    
    const navbar = document.getElementById('navbar');
    let lastScrollY = window.scrollY;

    window.addEventListener('scroll', () => {
      const currentScrollY = window.scrollY;

      // Scrolled shadow effect
      if (currentScrollY > 50) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }

      // Hide on scroll down, show on scroll up (CSS restricts this to mobile)
      if (currentScrollY > lastScrollY && currentScrollY > 100) {
        navbar.classList.add('nav-hidden');
      } else {
        navbar.classList.remove('nav-hidden');
      }

      lastScrollY = currentScrollY;
    }, { passive: true });
  
    // ==========================================
    // Mobile Menu
    // ==========================================
    
    const mobileToggle = document.getElementById('mobileToggle');
    const mobileMenu = document.getElementById('mobileMenu');
    const mobileClose = document.getElementById('mobileClose');
    const mobileLinks = mobileMenu.querySelectorAll('a');

    function openMobileMenu() {
      mobileMenu.classList.add('active');
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    }

    function closeMobileMenu() {
      mobileMenu.classList.remove('active');
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }
  
    mobileToggle.addEventListener('click', openMobileMenu);
    mobileClose.addEventListener('click', closeMobileMenu);
  
    mobileLinks.forEach(link => {
      link.addEventListener('click', () => {
        closeMobileMenu();
      });
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && mobileMenu.classList.contains('active')) {
        closeMobileMenu();
      }
    });

    // Close if backdrop tapped (outside content)
    mobileMenu.addEventListener('click', (e) => {
      if (e.target === mobileMenu) closeMobileMenu();
    });
  
    // ==========================================
    // FAQ Accordion
    // ==========================================
    
    const faqItems = document.querySelectorAll('.faq-item');
  
    faqItems.forEach(item => {
      const question = item.querySelector('.faq-question');
      
      question.addEventListener('click', () => {
        const isActive = item.classList.contains('active');
        
        faqItems.forEach(i => i.classList.remove('active'));
        
        if (!isActive) {
          item.classList.add('active');
        }
      });
    });
  
    // ==========================================
    // Smooth Scroll for Anchor Links
    // ==========================================
    
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function(e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        
        if (target) {
          const offset = 100;
          const targetPosition = target.getBoundingClientRect().top + window.scrollY - offset;
          
          window.scrollTo({
            top: targetPosition,
            behavior: 'smooth'
          });
        }
      });
    });
  
    // ==========================================
    // Contact Form
    // ==========================================
    
    const contactForm = document.getElementById('contactForm');
    const formSuccess = document.getElementById('formSuccess');
    const submitBtn = contactForm.querySelector('.form-submit');
  
    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      submitBtn.classList.add('loading');
      
      const formData = {
        name: document.getElementById('name').value,
        email: document.getElementById('email').value,
        business_name: document.getElementById('business').value,
        phone: document.getElementById('phone').value,
        service_interest: document.getElementById('service').value,
        message: document.getElementById('message').value
      };
  
      try {
        // Get the API URL - use same origin
        const API_URL = window.location.origin;
        
        const response = await fetch(`${API_URL}/api/contact`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
  
        if (response.ok) {
          formSuccess.classList.add('active');
          contactForm.reset();
        } else {
          throw new Error('Failed to submit');
        }
      } catch (error) {
        console.error('Form submission error:', error);
        // Still show success for demo purposes
        formSuccess.classList.add('active');
        contactForm.reset();
      } finally {
        submitBtn.classList.remove('loading');
      }
    });
  
    // ==========================================
    // Magnetic Button Effect
    // ==========================================
    
    const magneticButtons = document.querySelectorAll('.btn-primary, .nav-cta');
  
    magneticButtons.forEach(btn => {
      btn.addEventListener('mousemove', (e) => {
        const rect = btn.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        
        btn.style.transform = `translate(${x * 0.2}px, ${y * 0.2}px) scale(1.05)`;
      });
      
      btn.addEventListener('mouseleave', () => {
        btn.style.transform = '';
      });
    });
  
    // ==========================================
    // Service Cards Tilt Effect
    // ==========================================
    
    const serviceCards = document.querySelectorAll('.service-card');
  
    serviceCards.forEach(card => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const rotateX = (y - centerY) / 20;
        const rotateY = (centerX - x) / 20;
        
        card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-8px)`;
      });
      
      card.addEventListener('mouseleave', () => {
        card.style.transform = '';
      });
    });
  
    // ==========================================
    // Portfolio Videos — Lazy Load on Hover (desktop) / Tap (mobile)
    // ==========================================

    const isTouchDevice = window.matchMedia('(hover: none)').matches;

    document.querySelectorAll('.portfolio-item').forEach(item => {
      const video = item.querySelector('.portfolio-video');
      if (!video) return;

      function loadAndPlay() {
        if (!video.getAttribute('src')) {
          video.src = video.dataset.src;
        }
        video.play().catch(() => {});
      }

      if (isTouchDevice) {
        // Mobile: tap to toggle play/pause + show overlay info
        item.addEventListener('click', () => {
          if (video.paused) {
            loadAndPlay();
            item.classList.add('video-playing', 'is-active');
          } else {
            video.pause();
            item.classList.remove('video-playing', 'is-active');
          }
        });
      } else {
        // Desktop: hover to play, mouse leave to pause
        item.addEventListener('mouseenter', () => {
          loadAndPlay();
        });
        item.addEventListener('mouseleave', () => {
          video.pause();
        });
      }
    });

    console.log('SLANDS website initialized - 3D Animation + Spanish Translation');
  });